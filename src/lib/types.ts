export type ArticleDTO = {
  id: string;
  setId: string;
  title: string;
  wikipediaUrl: string;
  wikipediaPageId: number;
  categories: string[];
  disabledCategories: string[];
  customHints: string[];
  aliases: string[];
  customAliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
  pageViews: number | null;
  difficultyScore: number | null;
  orderIndex: number;
  createdAt: string;
};

export type SetSummary = {
  id: string;
  name: string;
  description: string | null;
  hidden: boolean;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt: string | null;
  isMine: boolean;
  canManage: boolean;
  creatorName: string | null;
  difficultyScore: number | null;
};

export type SetDetail = {
  id: string;
  name: string;
  description: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
  canManage: boolean;
  creatorName: string | null;
  difficultyScore: number | null;
  articles: ArticleDTO[];
};

export type PlayResultEntry = {
  articleId: string;
  guesserName: string;
  guessText: string;
  correct: boolean;
  skipped: boolean;
  verdict?: "EXACT" | "CLOSE" | "WRONG" | "SKIP";
  points?: number;
  articleTitle?: string;
};

export type FetchedArticlePreview = {
  title: string;
  url: string;
  pageId: number;
  categories: string[];
  rawCategoryCount: number;
  aliases: string[];
  summary: string | null;
  thumbnailUrl: string | null;
};

export type ProfileDTO = {
  id: string | null;
  displayName: string | null;
  hasPassword: boolean;
};

export type LobbyMode = "FREESTYLE" | "SET_BASED";
export type LobbyStatus = "WAITING" | "IN_GAME" | "ENDED";

export type LobbyMemberDTO = {
  id: string;
  displayName: string;
  score: number;
  isHost: boolean;
  isMe: boolean;
  joinedAt: string;
};

export type LobbySummary = {
  code: string;
  mode: LobbyMode;
  status: LobbyStatus;
  hasPassword: boolean;
  setId: string | null;
  setName: string | null;
  roundDuration: number;
  totalRounds: number;
  currentRoundNumber: number;
  memberCount: number;
};

export type LobbyRoundView = {
  id: string;
  roundNumber: number;
  pickerMemberId: string | null;
  status: "PICKING" | "ACTIVE" | "ENDED";
  categories: string[] | null;
  customHints: string[];
  startsAt: string | null;
  endsAt: string | null;
};

export type LobbyRoundReveal = {
  id: string;
  roundNumber: number;
  title: string | null;
  url: string | null;
  summary: string | null;
  thumbnailUrl: string | null;
  difficulty: number | null;
  categories: string[];
  customHints: string[];
};

export type LobbyMessageDTO = {
  id: string;
  memberId: string | null;
  displayName: string;
  text: string | null;
  type: "CHAT" | "SYSTEM" | "CORRECT_GUESS";
  points: number | null;
  roundId: string | null;
  createdAt: string;
};

export type LobbyState = LobbySummary & {
  id: string;
  members: LobbyMemberDTO[];
  /** present only if the requester is already a member */
  me: LobbyMemberDTO | null;
  currentRound: LobbyRoundView | null;
  lastReveal: LobbyRoundReveal | null;
  messages: LobbyMessageDTO[];
  picker: { id: string; displayName: string } | null;
  finalScores:
    | Array<{ id: string; displayName: string; score: number }>
    | null;
};
