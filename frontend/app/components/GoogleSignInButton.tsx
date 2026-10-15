"use client";

import { useEffect, useRef, useState } from "react";

// "Sign in with Google" via Google Identity Services. Google hands us a signed
// ID token in a popup; the backend verifies it at POST /api/auth/google and
// starts the usual cookie session. The client ID comes from the backend
// (GET /api/auth/config), so the button only appears when the server has
// GOOGLE_CLIENT_ID set.

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        itp_support?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          shape?: "rectangular" | "pill" | "circle" | "square";
          logo_alignment?: "left" | "center";
          width?: number;
        },
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/** The signed-in user as returned by /api/auth/login and /api/auth/google. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SessionUser = any;

const GSI_SRC = "https://accounts.google.com/gsi/client";

let clientIdPromise: Promise<string | null> | null = null;
function loadClientId(): Promise<string | null> {
  clientIdPromise ??= fetch("/api/auth/config")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data?.googleClientId as string | null) ?? null)
    .catch(() => null);
  return clientIdPromise;
}

let scriptPromise: Promise<void> | null = null;
function loadGsiScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function GoogleSignInButton({
  onSignedIn,
  onError,
  text = "continue_with",
}: {
  onSignedIn: (user: SessionUser, created: boolean) => void;
  onError: (message: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "signing-in">("loading");

  // Latest callbacks without re-initializing Google on every render
  const callbacks = useRef({ onSignedIn, onError });
  useEffect(() => {
    callbacks.current = { onSignedIn, onError };
  });

  useEffect(() => {
    let cancelled = false;

    const handleCredential = async ({ credential }: GoogleCredentialResponse) => {
      setState("signing-in");
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Google sign-in failed");
        callbacks.current.onSignedIn(data.user, Boolean(data.created));
      } catch (err) {
        callbacks.current.onError(err instanceof Error ? err.message : "Google sign-in failed");
        if (!cancelled) setState("ready");
      }
    };

    (async () => {
      const clientId = await loadClientId();
      if (cancelled) return;
      if (!clientId) {
        setState("unavailable");
        return;
      }
      try {
        await loadGsiScript();
      } catch {
        if (!cancelled) setState("unavailable");
        return;
      }
      const google = window.google;
      const el = containerRef.current;
      if (cancelled || !google || !el) return;

      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });
      el.innerHTML = "";
      google.accounts.id.renderButton(el, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text,
        shape: "pill",
        logo_alignment: "center",
        // Google caps the button at 400px
        width: Math.min(400, Math.max(200, Math.floor(el.parentElement?.clientWidth ?? 320))),
      });
      setState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (state === "unavailable") return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={containerRef}
        className={`flex min-h-[44px] w-full justify-center ${state === "signing-in" ? "pointer-events-none opacity-60" : ""}`}
        // Google's iframe is a light-scheme document; inside our dark page the
        // browser would paint an opaque white box behind it. Matching the
        // scheme here keeps its background transparent.
        style={{ colorScheme: "light" }}
        aria-busy={state !== "ready"}
      />
      {state === "signing-in" && <p className="text-xs text-slate-400">Signing you in with Google…</p>}
      {/* Separator before the email form; hidden along with the button */}
      <div className="mt-2 flex w-full items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        <span className="h-px flex-1 bg-slate-700/60" />
        or use email
        <span className="h-px flex-1 bg-slate-700/60" />
      </div>
    </div>
  );
}
