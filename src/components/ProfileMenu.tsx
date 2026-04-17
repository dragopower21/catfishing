"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import type { ProfileDTO } from "@/lib/types";

type Mode = "closed" | "pick" | "login";

export default function ProfileMenu() {
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [mode, setMode] = useState<Mode>("closed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [clearPassword, setClearPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = (await res.json()) as ProfileDTO;
        setProfile(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openPick() {
    setNameDraft(profile?.displayName ?? "");
    setPasswordDraft("");
    setClearPassword(false);
    setError(null);
    setMode("pick");
  }

  function openLogin() {
    setNameDraft("");
    setPasswordDraft("");
    setError(null);
    setMode("login");
  }

  function close() {
    setMode("closed");
    setError(null);
    setBusy(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: {
        displayName: string;
        password?: string;
        removePassword?: boolean;
      } = { displayName: nameDraft.trim() };
      if (clearPassword) {
        body.removePassword = true;
      } else if (passwordDraft) {
        body.password = passwordDraft;
      }
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Save failed");
        return;
      }
      const data = (await res.json()) as ProfileDTO;
      setProfile(data);
      close();
      // Refresh dashboard / any reactive bits
      window.dispatchEvent(new CustomEvent("profile:changed"));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: nameDraft.trim(),
          password: passwordDraft,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Sign-in failed");
        return;
      }
      const data = (await res.json()) as ProfileDTO;
      setProfile(data);
      close();
      window.dispatchEvent(new CustomEvent("profile:changed"));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/profile/logout", { method: "POST" });
      await load();
      window.dispatchEvent(new CustomEvent("profile:changed"));
    } finally {
      setBusy(false);
    }
  }

  const label = profile?.displayName ?? "Guest";

  return (
    <>
      <button
        type="button"
        onClick={openPick}
        className="brut-btn brut-btn-sm bg-white text-slate-900"
        title="Set display name"
      >
        <UserRound className="h-4 w-4" strokeWidth={2.5} />
        <span className="max-w-[10rem] truncate">{label}</span>
      </button>

      {mode !== "closed" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="brut-card animate-pop-in w-full max-w-md bg-white p-6">
            {mode === "pick" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="brut-sticker bg-accent-yellow text-slate-900">
                    Profile
                  </span>
                </div>
                <div className="mt-3 font-display text-2xl text-slate-900">
                  What should we call you?
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Shown on any set you create. A password is optional — set
                  one if you want to claim the name so friends can&rsquo;t
                  take it on another device.
                </p>

                <label className="mt-5 block">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Display name
                  </span>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="e.g. dragon"
                    autoFocus
                    className="brut-input mt-2 block w-full"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Password{" "}
                    <span className="font-medium text-slate-400 normal-case tracking-normal">
                      {profile?.hasPassword
                        ? "(already set — leave blank to keep)"
                        : "(optional)"}
                    </span>
                  </span>
                  <input
                    type="password"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                    placeholder={
                      profile?.hasPassword ? "Change password…" : "Claim the name"
                    }
                    disabled={clearPassword}
                    className="brut-input mt-2 block w-full disabled:opacity-50"
                  />
                </label>
                {profile?.hasPassword && (
                  <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={clearPassword}
                      onChange={(e) => {
                        setClearPassword(e.target.checked);
                        if (e.target.checked) setPasswordDraft("");
                      }}
                      className="h-4 w-4 rounded border-2 border-slate-900"
                    />
                    Remove password (anyone could take the name)
                  </label>
                )}

                {error && (
                  <div className="mt-4 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  {profile?.displayName ? (
                    <button
                      type="button"
                      onClick={logout}
                      disabled={busy}
                      className="brut-btn brut-btn-sm bg-white text-slate-900"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={2.5} /> Sign
                      out
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openLogin}
                      className="brut-btn brut-btn-sm bg-white text-slate-900"
                    >
                      <LogIn className="h-4 w-4" strokeWidth={2.5} /> Sign in
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={close}
                      disabled={busy}
                      className="brut-btn bg-white text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={save}
                      disabled={busy || !nameDraft.trim()}
                      className="brut-btn bg-accent-yellow text-slate-900"
                    >
                      {busy && (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.5}
                        />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="brut-sticker bg-accent-sky text-slate-900">
                    Sign in
                  </span>
                </div>
                <div className="mt-3 font-display text-2xl text-slate-900">
                  Welcome back
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Enter the name and password you claimed to bring your
                  sets to this device.
                </p>

                <label className="mt-5 block">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Display name
                  </span>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    autoFocus
                    className="brut-input mt-2 block w-full"
                  />
                </label>

                <label className="mt-4 block">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-600">
                    Password
                  </span>
                  <input
                    type="password"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) {
                        e.preventDefault();
                        login();
                      }
                    }}
                    className="brut-input mt-2 block w-full"
                  />
                </label>

                {error && (
                  <div className="mt-4 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
                    {error}
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("pick")}
                    className="brut-btn brut-btn-sm bg-white text-slate-900"
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={close}
                      disabled={busy}
                      className="brut-btn bg-white text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={login}
                      disabled={busy || !nameDraft.trim() || !passwordDraft}
                      className="brut-btn bg-accent-yellow text-slate-900"
                    >
                      {busy && (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2.5}
                        />
                      )}
                      Sign in
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
