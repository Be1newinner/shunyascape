"use client";

import { useEffect } from "react";

/**
 * All landing-page motion in one small client island. It only sets classes,
 * data attributes and CSS variables; landing.css does the drawing.
 *  - --sy / --mx / --my on <html>: scroll offset and pointer (-1..1) for parallax
 *  - --progress on <html> + [data-scrolled]: progress bar and shrinking nav
 *  - [data-reveal]: below-the-fold items fade/slide in when scrolled to
 *  - [data-scrolly] / [data-step]: sticky day-cycle story tracks the active step
 *  - [data-tilt] / [data-spotlight]: cards tilt and light up under the pointer
 *  - [data-magnetic]: buttons drift toward the pointer
 * Motion is skipped for prefers-reduced-motion; content is visible without JS.
 */
export default function LandingEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    // Progress bar + shrinking nav (cheap, kept even with reduced motion)
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty("--progress", max > 0 ? (window.scrollY / max).toFixed(4) : "0");
      root.toggleAttribute("data-scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    // Sticky day-cycle story: the step nearest the viewport centre is active
    document.querySelectorAll<HTMLElement>("[data-scrolly]").forEach((story) => {
      const steps = Array.from(story.querySelectorAll<HTMLElement>("[data-step]"));
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const step = Number((entry.target as HTMLElement).dataset.step);
            story.dataset.active = String(step);
            story.style.setProperty("--day", String((step + 1) / steps.length));
            steps.forEach((s, i) => s.classList.toggle("is-active", i === step));
          }
        },
        { rootMargin: "-45% 0px -45% 0px" },
      );
      steps.forEach((s) => io.observe(s));
      steps[0]?.classList.add("is-active");
      story.style.setProperty("--day", String(1 / Math.max(1, steps.length)));
      cleanups.push(() => io.disconnect());
    });

    if (reduced) return () => cleanups.forEach((c) => c());

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
    cleanups.push(() => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
    });

    // Reveal on scroll: only hide what the user can't see yet
    const pending = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.9,
    );
    pending.forEach((el) => el.classList.add("ls-pending"));
    const revealer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove("ls-pending");
          revealer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    pending.forEach((el) => revealer.observe(el));
    cleanups.push(() => revealer.disconnect());

    // Tilt + cursor spotlight
    const hoverables = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt], [data-spotlight]"));
    const onMove = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
      if (el.hasAttribute("data-tilt")) {
        el.style.setProperty("--ry", `${(px * 9).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-py * 9).toFixed(2)}deg`);
      }
    };
    const onLeave = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    hoverables.forEach((el) => {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    });
    cleanups.push(() =>
      hoverables.forEach((el) => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
      }),
    );

    // Magnetic buttons (fine pointers only)
    if (window.matchMedia("(pointer: fine)").matches) {
      const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnetic]"));
      const onMagnet = (e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty("--tx", `${(dx * 0.22).toFixed(1)}px`);
        el.style.setProperty("--ty", `${(dy * 0.3).toFixed(1)}px`);
      };
      const offMagnet = (e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.style.setProperty("--tx", "0px");
        el.style.setProperty("--ty", "0px");
      };
      magnets.forEach((el) => {
        el.addEventListener("pointermove", onMagnet);
        el.addEventListener("pointerleave", offMagnet);
      });
      cleanups.push(() =>
        magnets.forEach((el) => {
          el.removeEventListener("pointermove", onMagnet);
          el.removeEventListener("pointerleave", offMagnet);
        }),
      );
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
