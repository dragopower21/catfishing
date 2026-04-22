import { prisma } from "@/lib/db";
import { broadcast } from "@/lib/pusherServer";
import { matchGuess } from "@/lib/matchGuess";
import { fetchArticle, titleFromUrl } from "@/lib/wikipedia";
import { filterCategories } from "@/lib/filterCategories";

// Scoring — the formula approved earlier.
const GUESS_BASE = 50;
const GUESS_TIME_BONUS = 200; // scaled by timeFraction
const ORDER_BONUS = [30, 20, 10, 5, 0]; // 1st/2nd/3rd/4th correct guesser

type MemberRow = {
  id: string;
  userId: string;
  displayName: string;
  score: number;
  isHost: boolean;
  joinedAt: Date;
};

type RoundRow = {
  id: string;
  lobbyId: string;
  roundNumber: number;
  pickerMemberId: string | null;
  status: string;
  articleTitle: string | null;
  articleUrl: string | null;
  articleCategories: string | null;
  articleAliases: string | null;
  articleCustomHints: string | null;
  articleCustomAliases: string | null;
  articleSummary: string | null;
  articleThumbnailUrl: string | null;
  articleDifficulty: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

type LobbyRow = {
  id: string;
  code: string;
  mode: string;
  setId: string | null;
  status: string;
  roundDuration: number;
  totalRounds: number;
  currentRoundNumber: number;
};

type LobbyWithMembersAndRounds = LobbyRow & {
  members: MemberRow[];
  rounds: RoundRow[];
};

export class FlowError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/** Categories visible to guessers during a round (title + giveaway words stripped). */
export function publicRoundView(round: RoundRow) {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    pickerMemberId: round.pickerMemberId,
    status: round.status as "PICKING" | "ACTIVE" | "ENDED",
    categories: round.articleCategories
      ? (JSON.parse(round.articleCategories) as string[])
      : null,
    customHints: round.articleCustomHints
      ? (JSON.parse(round.articleCustomHints) as string[])
      : [],
    startsAt: round.startsAt?.toISOString() ?? null,
    endsAt: round.endsAt?.toISOString() ?? null,
  };
}

/** Full reveal after the round ends — everyone can see the answer. */
export function revealRoundView(round: RoundRow) {
  return {
    id: round.id,
    roundNumber: round.roundNumber,
    title: round.articleTitle,
    url: round.articleUrl,
    summary: round.articleSummary,
    thumbnailUrl: round.articleThumbnailUrl,
    difficulty: round.articleDifficulty,
    categories: round.articleCategories
      ? (JSON.parse(round.articleCategories) as string[])
      : [],
    customHints: round.articleCustomHints
      ? (JSON.parse(round.articleCustomHints) as string[])
      : [],
  };
}

async function loadLobbyByCode(code: string) {
  return prisma.lobby.findUnique({
    where: { code },
    include: {
      members: { orderBy: { joinedAt: "asc" } },
      rounds: { orderBy: { roundNumber: "desc" }, take: 1 },
    },
  });
}

/**
 * Opportunistic clock tick — called from every API entry point so that
 * a game never stalls just because nobody poked the server. Job:
 *   • If the current round is ACTIVE and its timer expired → end it.
 *
 * Advancing past an ENDED round is now host-driven (see advanceNext).
 */
export async function tickLobby(code: string): Promise<void> {
  const lobby = await loadLobbyByCode(code);
  if (!lobby || lobby.status !== "IN_GAME") return;
  const round = lobby.rounds[0];
  if (!round) return;
  const now = Date.now();

  if (
    round.status === "ACTIVE" &&
    round.endsAt &&
    round.endsAt.getTime() <= now
  ) {
    await endRound(lobby, round);
    return;
  }
}

/**
 * Host-only. Advance past an ENDED round to the next round, or finish
 * the game if we're out of rounds.
 */
export async function advanceNext(
  code: string,
  ownerId: string
): Promise<void> {
  const lobby = await loadLobbyByCode(code);
  if (!lobby) throw new FlowError(404, "Lobby not found");
  if (lobby.status !== "IN_GAME")
    throw new FlowError(409, "Game isn't in progress.");
  const me = lobby.members.find((m) => m.userId === ownerId);
  if (!me || !me.isHost)
    throw new FlowError(403, "Only the host can start the next round.");
  const round = lobby.rounds[0];
  if (!round)
    throw new FlowError(409, "No round to advance past.");
  if (round.status !== "ENDED")
    throw new FlowError(409, "Current round hasn't ended yet.");
  await advanceAfterReveal(lobby, round);
}

/** Host-only. Creates round 1 in PICKING (freestyle) or ACTIVE (set) state. */
export async function startGame(
  code: string,
  ownerId: string
): Promise<void> {
  const lobby = await loadLobbyByCode(code);
  if (!lobby) throw new FlowError(404, "Lobby not found");
  if (lobby.status !== "WAITING")
    throw new FlowError(409, "Game already started");

  const me = lobby.members.find((m) => m.userId === ownerId);
  if (!me || !me.isHost)
    throw new FlowError(403, "Only the host can start the game");
  if (lobby.members.length < 2)
    throw new FlowError(409, "Need at least 2 players");

  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { status: "IN_GAME", currentRoundNumber: 1 },
  });

  await prisma.lobbyMember.updateMany({
    where: { lobbyId: lobby.id },
    data: { score: 0 },
  });

  await prisma.lobbyMessage.create({
    data: {
      lobbyId: lobby.id,
      memberId: null,
      displayName: "",
      text: "Game started. Good luck.",
      type: "SYSTEM",
    },
  });

  if (lobby.mode === "FREESTYLE") {
    const picker = pickNextPicker(lobby.members, null);
    const round = await prisma.lobbyRound.create({
      data: {
        lobbyId: lobby.id,
        roundNumber: 1,
        pickerMemberId: picker.id,
        status: "PICKING",
      },
    });
    await broadcast(lobby.code, "round-started", {
      round: publicRoundView(round),
      picker: { id: picker.id, displayName: picker.displayName },
    });
  } else {
    await startSetBasedRound(lobby, 1);
  }
}

function pickNextPicker(
  members: MemberRow[],
  previousPickerId: string | null
): MemberRow {
  if (members.length === 0) throw new FlowError(500, "No members");
  if (!previousPickerId) {
    return members[Math.floor(Math.random() * members.length)];
  }
  const idx = members.findIndex((m) => m.id === previousPickerId);
  const nextIdx = (idx + 1) % members.length;
  return members[nextIdx];
}

async function startSetBasedRound(
  lobby: LobbyWithMembersAndRounds,
  roundNumber: number
): Promise<void> {
  if (!lobby.setId) throw new FlowError(500, "Missing setId for SET_BASED");
  const article = await prisma.article.findFirst({
    where: { setId: lobby.setId },
    orderBy: { orderIndex: "asc" },
    skip: roundNumber - 1,
  });
  if (!article) {
    await endGame(lobby);
    return;
  }
  const now = new Date();
  const endsAt = new Date(now.getTime() + lobby.roundDuration * 1000);
  const round = await prisma.lobbyRound.create({
    data: {
      lobbyId: lobby.id,
      roundNumber,
      pickerMemberId: null,
      status: "ACTIVE",
      articleTitle: article.title,
      articleUrl: article.wikipediaUrl,
      articlePageId: article.wikipediaPageId,
      articleCategories: article.categories,
      articleAliases: article.aliases,
      articleCustomAliases: article.customAliases,
      articleSummary: article.summary,
      articleThumbnailUrl: article.thumbnailUrl,
      articleDifficulty: article.difficultyScore,
      startsAt: now,
      endsAt,
    },
  });
  await broadcast(lobby.code, "round-started", {
    round: publicRoundView(round),
    picker: null,
  });
}

/** Freestyle picker commits their article; round flips to ACTIVE. */
export async function submitPick(
  code: string,
  ownerId: string,
  urlOrTitle: string,
  customHintsInput?: unknown
): Promise<void> {
  await tickLobby(code);
  const lobby = await loadLobbyByCode(code);
  if (!lobby) throw new FlowError(404, "Lobby not found");
  const me = lobby.members.find((m) => m.userId === ownerId);
  if (!me) throw new FlowError(403, "Not a member");
  const round = lobby.rounds[0];
  if (!round) throw new FlowError(409, "No active round");
  if (round.status !== "PICKING") {
    // Game moved on — likely the reveal advanced and we're now in the
    // next round's PICKING or ACTIVE. Re-fetch on client will show it.
    console.warn("[submitPick] round not in PICKING", {
      code,
      roundNumber: round.roundNumber,
      status: round.status,
    });
    throw new FlowError(
      409,
      `Round ${round.roundNumber} is ${round.status.toLowerCase()}, not picking. Refresh the page.`
    );
  }
  if (round.pickerMemberId !== me.id) {
    console.warn("[submitPick] picker mismatch", {
      code,
      roundNumber: round.roundNumber,
      expectedPicker: round.pickerMemberId,
      actualMe: me.id,
      membersByJoinOrder: lobby.members.map((m) => m.id),
    });
    throw new FlowError(
      403,
      `It's not your turn to pick (round ${round.roundNumber} picker is someone else — try refreshing).`
    );
  }

  const input = urlOrTitle.trim().slice(0, 500);
  if (!input) throw new FlowError(400, "Pick an article");
  const lookupTitle = input.startsWith("http")
    ? titleFromUrl(input) ?? input
    : input;

  let fetched;
  try {
    fetched = await fetchArticle(lookupTitle);
  } catch (err) {
    throw new FlowError(
      400,
      err instanceof Error ? err.message : "Fetch failed"
    );
  }
  const filtered = filterCategories(fetched.categories, fetched.title);
  if (filtered.length < 2) {
    throw new FlowError(
      400,
      "That article has almost no useful categories — pick a different one."
    );
  }

  // Sanitize picker-provided custom hints (cap count + length).
  let customHints: string[] = [];
  if (Array.isArray(customHintsInput)) {
    const seen = new Set<string>();
    for (const h of customHintsInput) {
      if (typeof h !== "string") continue;
      const trimmed = h.trim().slice(0, 120);
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      customHints.push(trimmed);
      if (customHints.length >= 10) break;
    }
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + lobby.roundDuration * 1000);

  const updated = await prisma.lobbyRound.update({
    where: { id: round.id },
    data: {
      status: "ACTIVE",
      articleTitle: fetched.title,
      articleUrl: fetched.url,
      articlePageId: fetched.pageId,
      articleCategories: JSON.stringify(filtered),
      articleAliases: JSON.stringify(fetched.aliases),
      articleCustomHints: JSON.stringify(customHints),
      articleCustomAliases: JSON.stringify([]),
      articleSummary: fetched.summary,
      articleThumbnailUrl: fetched.thumbnailUrl,
      articleDifficulty: fetched.difficultyScore,
      startsAt: now,
      endsAt,
    },
  });

  await broadcast(lobby.code, "round-active", {
    round: publicRoundView(updated),
    picker: { id: me.id, displayName: me.displayName },
  });
}

/** Host-only: end the whole game immediately. */
export async function endGameByHost(
  code: string,
  ownerId: string
): Promise<void> {
  const lobby = await loadLobbyByCode(code);
  if (!lobby) throw new FlowError(404, "Lobby not found");
  const me = lobby.members.find((m) => m.userId === ownerId);
  if (!me) throw new FlowError(403, "Not a member");
  if (!me.isHost) throw new FlowError(403, "Only the host can end the room");
  if (lobby.status === "ENDED") return;

  // Close any in-flight round so data stays consistent.
  const round = lobby.rounds[0];
  if (round && round.status !== "ENDED") {
    await prisma.lobbyRound.updateMany({
      where: { id: round.id, status: { in: ["ACTIVE", "PICKING"] } },
      data: { status: "ENDED", endsAt: new Date() },
    });
  }

  await endGame(lobby);
}

/**
 * Chat submit. Acts as a guess during ACTIVE rounds; otherwise plain chat.
 */
export async function submitChat(
  code: string,
  ownerId: string,
  text: string
): Promise<"correct" | "wrong" | "chat"> {
  await tickLobby(code);
  const lobby = await loadLobbyByCode(code);
  if (!lobby) throw new FlowError(404, "Lobby not found");
  const me = lobby.members.find((m) => m.userId === ownerId);
  if (!me) throw new FlowError(403, "Not a member");

  const clean = text.trim().slice(0, 200);
  if (!clean) throw new FlowError(400, "Empty message");

  const round = lobby.rounds[0];
  const isActive = round?.status === "ACTIVE";
  const amPicker = round && round.pickerMemberId === me.id;

  if (isActive && round && !amPicker) {
    const alreadyCorrect = await prisma.lobbyMessage.findFirst({
      where: {
        roundId: round.id,
        memberId: me.id,
        type: "CORRECT_GUESS",
      },
      select: { id: true },
    });
    if (!alreadyCorrect && round.articleTitle) {
      const verdict = matchGuess(clean, {
        title: round.articleTitle,
        aliases: round.articleAliases
          ? (JSON.parse(round.articleAliases) as string[])
          : [],
        customAliases: round.articleCustomAliases
          ? (JSON.parse(round.articleCustomAliases) as string[])
          : [],
      });
      if (verdict === "EXACT" || verdict === "CLOSE") {
        await handleCorrectGuess(lobby, round, me);
        return "correct";
      }
    }
  }

  // Plain chat.
  const msg = await prisma.lobbyMessage.create({
    data: {
      lobbyId: lobby.id,
      memberId: me.id,
      displayName: me.displayName,
      text: clean,
      type: "CHAT",
      roundId: round?.id ?? null,
    },
  });
  await broadcast(lobby.code, "chat-message", {
    id: msg.id,
    displayName: msg.displayName,
    text: msg.text,
    type: "CHAT",
    createdAt: msg.createdAt.toISOString(),
  });
  return isActive && !amPicker ? "wrong" : "chat";
}

async function handleCorrectGuess(
  lobby: LobbyWithMembersAndRounds,
  round: RoundRow,
  member: MemberRow
): Promise<void> {
  const now = new Date();
  const totalMs = lobby.roundDuration * 1000;
  const remaining = Math.max(
    0,
    (round.endsAt?.getTime() ?? now.getTime()) - now.getTime()
  );
  const timeFraction = Math.min(1, Math.max(0, remaining / totalMs));
  const base = GUESS_BASE + Math.round(timeFraction * GUESS_TIME_BONUS);

  const priorCount = await prisma.lobbyMessage.count({
    where: { roundId: round.id, type: "CORRECT_GUESS" },
  });
  const orderBonus = ORDER_BONUS[priorCount] ?? 0;
  const points = base + orderBonus;

  await prisma.lobbyMessage.create({
    data: {
      lobbyId: lobby.id,
      memberId: member.id,
      displayName: member.displayName,
      text: null,
      type: "CORRECT_GUESS",
      roundId: round.id,
      points,
      orderIndex: priorCount,
    },
  });
  await prisma.lobbyMember.update({
    where: { id: member.id },
    data: { score: { increment: points } },
  });

  await broadcast(lobby.code, "correct-guess", {
    memberId: member.id,
    displayName: member.displayName,
    points,
    orderIndex: priorCount,
  });

  const eligibleCount =
    lobby.mode === "FREESTYLE"
      ? lobby.members.filter((m) => m.id !== round.pickerMemberId).length
      : lobby.members.length;
  if (priorCount + 1 >= eligibleCount) {
    await endRound(lobby, round);
  }
}

async function endRound(
  lobby: LobbyWithMembersAndRounds,
  round: RoundRow
): Promise<void> {
  // Atomic transition — only the caller that actually flips the status
  // wins, so picker bonus + broadcast happen exactly once even when a
  // correct-guess handler and the timer-expiry tick race. We leave the
  // ACTIVE-phase endsAt in place; advancing is now host-driven.
  const transition = await prisma.lobbyRound.updateMany({
    where: { id: round.id, status: { in: ["ACTIVE", "PICKING"] } },
    data: { status: "ENDED" },
  });
  if (transition.count === 0) {
    // Someone else already ended this round.
    return;
  }

  // Picker bonus (Freestyle only).
  if (lobby.mode === "FREESTYLE" && round.pickerMemberId) {
    const correct = await prisma.lobbyMessage.findMany({
      where: { roundId: round.id, type: "CORRECT_GUESS" },
      select: { points: true },
    });
    let pickerPoints = 0;
    if (correct.length > 0) {
      const avg =
        correct.reduce((s, m) => s + (m.points ?? 0), 0) / correct.length;
      const difficulty = round.articleDifficulty ?? 5;
      const multiplier = 1 + (difficulty - 5) * 0.1;
      pickerPoints = Math.max(0, Math.round(avg * multiplier));
    }
    if (pickerPoints > 0) {
      await prisma.lobbyMember.update({
        where: { id: round.pickerMemberId },
        data: { score: { increment: pickerPoints } },
      });
    }
    await prisma.lobbyMessage.create({
      data: {
        lobbyId: lobby.id,
        memberId: round.pickerMemberId,
        displayName: "",
        text: null,
        type: "SYSTEM",
        roundId: round.id,
        points: pickerPoints,
      },
    });
    await broadcast(lobby.code, "picker-bonus", {
      pickerMemberId: round.pickerMemberId,
      points: pickerPoints,
    });
  }

  const members = await prisma.lobbyMember.findMany({
    where: { lobbyId: lobby.id },
    orderBy: { joinedAt: "asc" },
  });
  await broadcast(lobby.code, "round-ended", {
    reveal: revealRoundView(round),
    scores: members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      score: m.score,
    })),
  });
}

async function advanceAfterReveal(
  lobby: LobbyWithMembersAndRounds,
  round: RoundRow
): Promise<void> {
  const nextRoundNumber = round.roundNumber + 1;

  // Use @@unique(lobbyId, roundNumber) to fail cleanly if two ticks race.
  if (nextRoundNumber > lobby.totalRounds) {
    await endGame(lobby);
    return;
  }

  try {
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { currentRoundNumber: nextRoundNumber },
    });

    if (lobby.mode === "FREESTYLE") {
      const next = pickNextPicker(lobby.members, round.pickerMemberId);
      const newRound = await prisma.lobbyRound.create({
        data: {
          lobbyId: lobby.id,
          roundNumber: nextRoundNumber,
          pickerMemberId: next.id,
          status: "PICKING",
        },
      });
      await broadcast(lobby.code, "round-started", {
        round: publicRoundView(newRound),
        picker: { id: next.id, displayName: next.displayName },
      });
    } else {
      await startSetBasedRound(lobby, nextRoundNumber);
    }
  } catch (err) {
    // Likely a unique-constraint hit from another racing tick; safe to ignore.
    console.warn("[lobbyFlow] advance race:", err);
  }
}

async function endGame(
  lobby: LobbyWithMembersAndRounds
): Promise<void> {
  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { status: "ENDED" },
  });
  const members = await prisma.lobbyMember.findMany({
    where: { lobbyId: lobby.id },
    orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
  });
  await broadcast(lobby.code, "game-ended", {
    finalScores: members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      score: m.score,
    })),
  });
}
