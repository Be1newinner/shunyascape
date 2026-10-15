"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import AuthModal from "../AuthModal";

/** A call-to-action that opens the sign-in / sign-up modal. */
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
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} data-magnetic={magnetic || undefined}>
        {children}
      </button>
      {/* Portal: animated (transformed) ancestors would otherwise trap the fixed overlay */}
      {open && createPortal(<AuthModal onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
