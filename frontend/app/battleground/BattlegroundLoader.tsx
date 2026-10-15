"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeApp } from "../lib/nativeApp";

// WebGPU / WebGL and pointer lock only exist in the browser.
const BattlegroundGame = dynamic(() => import("../components/battleground/BattlegroundGame"), { ssr: false });

/** In the mobile app, skip the marketing page and go straight to sign-in. */
const signInUrl = () => (isNativeApp() ? "/?signin=1" : "/");

/** Only signed-in players get in; everyone else goes back to the landing page to sign in. */
export default function BattlegroundLoader() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setAllowed(true);
        else router.replace(signInUrl());
      })
      .catch(() => {
        if (!cancelled) router.replace(signInUrl());
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return <div style={{ position: "fixed", inset: 0, background: "hsl(214 30% 6%)" }} />;
  }
  return <BattlegroundGame />;
}
