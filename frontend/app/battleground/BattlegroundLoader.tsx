"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isNativeApp, postToApp } from "../lib/nativeApp";

// WebGPU / WebGL and pointer lock only exist in the browser.
const BattlegroundGame = dynamic(() => import("../components/battleground/BattlegroundGame"), { ssr: false });

/** Not signed in: the app shows its own login screen; on the web, back to the landing page. */
function needSignIn(router: ReturnType<typeof useRouter>) {
  if (isNativeApp()) postToApp("auth-required");
  else router.replace("/");
}

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
        else needSignIn(router);
      })
      .catch(() => {
        if (!cancelled) needSignIn(router);
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
