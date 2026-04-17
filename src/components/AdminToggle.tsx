"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

type Props = {
  onChange?: (admin: boolean) => void;
};

type Status = { admin: boolean; configured: boolean } | null;

export default function AdminToggle({ onChange }: Props) {
  const [status, setStatus] = useState<Status>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/admin/status");
      if (res.ok) {
        const data = (await res.json()) as {
          admin: boolean;
          configured: boolean;
        };
        setStatus(data);
        onChange?.(data.admin);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login() {
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Login failed");
        return;
      }
      setKey("");
      setOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  if (!status.configured && !status.admin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (status.admin) {
            logout();
          } else {
            setOpen(true);
          }
        }}
        className={`brut-btn brut-btn-sm ${
          status.admin ? "bg-accent-green" : "bg-white"
        } text-slate-900`}
        title={status.admin ? "Disable admin mode" : "Enable admin mode"}
      >
        {status.admin ? (
          <>
            <ShieldCheck className="h-4 w-4" strokeWidth={2.5} /> Admin on
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" strokeWidth={2.5} /> Admin
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="brut-card animate-pop-in w-full max-w-sm bg-white p-6">
            <div className="font-display text-2xl text-slate-900">
              Admin mode
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Enter the admin key to unlock deletion on any public set.
            </p>
            <input
              type="password"
              autoFocus
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  login();
                }
              }}
              placeholder="Admin key"
              className="brut-input mt-4 w-full"
            />
            {error && (
              <div className="mt-3 rounded-lg border-[2.5px] border-slate-900 bg-accent-red/20 p-2 text-xs font-bold text-slate-900">
                {error}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setKey("");
                  setError(null);
                  setOpen(false);
                }}
                disabled={busy}
                className="brut-btn brut-btn-sm bg-white text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={login}
                disabled={busy || !key.trim()}
                className="brut-btn brut-btn-sm bg-accent-yellow text-slate-900"
              >
                {busy && (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                )}
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
