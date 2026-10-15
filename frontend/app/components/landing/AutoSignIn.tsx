"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import AuthModal from "../AuthModal";

const noSubscribe = () => () => {};
const wantsSignIn = () => new URLSearchParams(window.location.search).get("signin") === "1";

/** Opens the sign-in modal when the page is loaded with `?signin=1` (the mobile app sends players here). */
export default function AutoSignIn() {
  // False on the server and during hydration, then the real URL value.
  const requested = useSyncExternalStore(noSubscribe, wantsSignIn, () => false);
  const [closed, setClosed] = useState(false);
  return requested && !closed ? createPortal(<AuthModal onClose={() => setClosed(true)} />, document.body) : null;
}
