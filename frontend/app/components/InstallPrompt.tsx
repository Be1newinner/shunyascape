"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { isNativeApp } from "../lib/nativeApp";
import "./install-prompt.css";

/** Chrome / Edge / Samsung Internet's install event (not in the DOM typings yet). */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SKIP_KEY = "pwa.skippedAt";
/** "Skip" hides the prompt for this long. */
const SKIP_MS = 7 * 24 * 60 * 60 * 1000;
/** Pages where the root layout doesn't show it (the battleground lobby shows its own). */
const HIDDEN_ON = ["/battleground", "/admin"];

// The browser offers installation once per page load, often before React mounts,
// so the event is caught here and shared by every prompt on later pages.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own prompt instead of the browser's mini-bar
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  // A service worker is what makes the site installable (and gives it an offline page).
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production" && !isNativeApp()) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("[pwa] service worker", err));
    });
  }
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad Safari: no install event, players add it from the Share menu. */
function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function skippedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(SKIP_KEY) || 0) < SKIP_MS;
  } catch {
    return false;
  }
}

/**
 * "Install the app" card shown when someone arrives: Install (or, on iOS, how
 * to add it to the home screen) and Skip. Never shown inside the native app,
 * once installed, or for a week after Skip.
 */
export default function InstallPrompt({ placement = "bottom" }: { placement?: "bottom" | "lobby" }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"none" | "install" | "ios">("none");
  const [shown, setShown] = useState(false);

  const hiddenHere = placement === "bottom" && HIDDEN_ON.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (hiddenHere || isNativeApp() || isInstalled() || skippedRecently()) return;
    const update = () => setMode(deferred ? "install" : isIosSafari() ? "ios" : "none");
    update();
    listeners.add(update);
    // A beat after arriving, so it slides in rather than flashing with the page.
    const t = setTimeout(() => setShown(true), 1200);
    return () => {
      listeners.delete(update);
      clearTimeout(t);
    };
  }, [hiddenHere]);

  if (hiddenHere || mode === "none" || !shown) return null;

  const skip = () => {
    try {
      localStorage.setItem(SKIP_KEY, String(Date.now()));
    } catch {
      // Storage blocked: it'll just ask again next visit.
    }
    setMode("none");
  };

  const install = async () => {
    const e = deferred;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // The event can only be used once either way.
    deferred = null;
    if (outcome === "dismissed") skip();
    else setMode("none");
  };

  return (
    <div className={`ip-card ip-${placement}`} role="dialog" aria-label="Install ShunyaScape">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ip-icon" src="/pwa-icon/192" alt="" width={48} height={48} />
      <div className="ip-text">
        <b>Install ShunyaScape</b>
        {mode === "install" ? (
          <span>Play full screen, one tap from your home screen.</span>
        ) : (
          <span>
            Tap <Share className="ip-inline" aria-label="Share" /> then <em>Add to Home Screen</em> to play full screen.
          </span>
        )}
      </div>
      <div className="ip-actions">
        {mode === "install" && (
          <button className="ip-install" onClick={install}>
            <Download aria-hidden="true" /> Install
          </button>
        )}
        <button className="ip-skip" onClick={skip}>
          {mode === "install" ? "Skip" : <><X aria-hidden="true" /> Skip</>}
        </button>
      </div>
    </div>
  );
}
