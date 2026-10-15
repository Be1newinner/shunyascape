"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import AuthModal from "../AuthModal";
import { hasSession } from "../../lib/session";

/**
 * A call-to-action: signed-in players go straight to the game, everyone else
 * gets the sign-in / sign-up modal.
 */
export default function PlayButton({
  children,
  className,
  magnetic = false,
}: {
  children: ReactNode;
  className?: string;
  /** Drift toward the pointer (handled by LandingEffects). */
  magnetic?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Check the session up front so the click doesn't wait on it.
  useEffect(() => {
    void hasSession();
  }, []);
  const play = async () => {
    if (await hasSession()) router.push("/battleground");
    else setOpen(true);
  };
  return (
    <>
      <button type="button" className={className} onClick={play} data-magnetic={magnetic || undefined}>
        {children}
      </button>
      {/* Portal: animated (transformed) ancestors would otherwise trap the fixed overlay */}
      {open && createPortal(<AuthModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
