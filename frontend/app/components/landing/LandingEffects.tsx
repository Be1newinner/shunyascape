"use client";

import { useEffect } from "react";

/**
 * Motion for the landing page, kept in one small client island:
 *  - --sy (scroll offset) and --mx / --my (pointer, -1..1) on <html> drive the
 *    parallax layers in landing.css,
 *  - elements with [data-reveal] below the fold fade in when scrolled to,
 *  - cards with [data-tilt] tilt towards the pointer.
 * Everything is skipped for users who prefer reduced motion, and content is
 * visible without JavaScript (only below-the-fold items are hidden, by JS).
 */
export default function LandingEffects() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Scroll + pointer parallax, eased in a single rAF loop
    let targetX = 0;
    let targetY = 0;
    let mx = 0;
    let my = 0;
    let frame = 0;
    const tick = () => {
      mx += (targetX - mx) * 0.08;
      my += (targetY - my) * 0.08;
      root.style.setProperty("--sy", `${window.scrollY}`);
      root.style.setProperty("--mx", mx.toFixed(4));
      root.style.setProperty("--my", my.toFixed(4));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // Reveal on scroll: only hide what the user can't see yet
    const pending = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.9,
    );
    pending.forEach((el) => el.classList.add("ls-pending"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("ls-pending");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    pending.forEach((el) => observer.observe(el));

    // Tilt cards towards the pointer
    const tilts = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt]"));
    const onTiltMove = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${(px * 10).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * 10).toFixed(2)}deg`);
      el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
    };
    const onTiltLeave = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    tilts.forEach((el) => {
      el.addEventListener("pointermove", onTiltMove);
      el.addEventListener("pointerleave", onTiltLeave);
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      observer.disconnect();
      tilts.forEach((el) => {
        el.removeEventListener("pointermove", onTiltMove);
        el.removeEventListener("pointerleave", onTiltLeave);
      });
    };
  }, []);

  return null;
}
