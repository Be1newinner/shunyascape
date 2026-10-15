import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Crosshair,
  Gamepad2,
  Map,
  Package,
  ShieldPlus,
  Sparkles,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import LandingEffects from "./components/landing/LandingEffects";
import Logo, { LogoMark } from "./components/landing/Logo";
import PlayButton from "./components/landing/PlayButton";
import AutoSignIn from "./components/landing/AutoSignIn";
import SplitWords from "./components/landing/SplitWords";
import {
  ARSENAL,
  CONTROLS,
  DEFINITION,
  FAQ,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  STATS,
} from "./lib/site";
import "./landing.css";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const SCREENSHOTS = [
  {
    src: "/images/landing/bg-combat.webp",
    alt: "ShunyaScape gameplay: third-person view of a soldier aiming an M416 across a grassy field toward a town, with the battle royale HUD showing ammo, weapon slots, minimap and players alive",
    caption: "Over the shoulder, M416 up — the HUD tracks ammo, zone and who's left",
    tag: "Gameplay",
  },
  {
    src: "/images/landing/bg-scope.webp",
    alt: "Looking through a Kar98k 4× scope at an enemy soldier standing on a hillside",
    caption: "Kar98k, 4× scope — one headshot is enough",
    tag: "Sniping",
  },
  {
    src: "/images/landing/bg-town.webp",
    alt: "A town of plaster and brick houses with trees, crates and a dirt road on the ShunyaScape battleground",
    caption: "Houses you can walk into, shoot through and loot",
    tag: "The map",
  },
] as const;

const FEATURES = [
  {
    icon: Map,
    title: "A battleground that looks real",
    body: "640 metres of towns, fields, forests and cliffs. Photo-scanned props, PBR ground, real-time shadows and grass that moves in the wind.",
    tone: "cyan",
    size: "wide",
  },
  {
    icon: Bot,
    title: "24 soldiers hunting you",
    body: "AI soldiers roam, spot you, strafe, fire in bursts and reload — and every one of them is after you.",
    tone: "violet",
    size: "tall",
  },
  {
    icon: Package,
    title: "Loot to survive",
    body: "Guns in houses and by crates. Two primaries and a pistol, ammo per calibre, med kits.",
    tone: "gold",
    size: "normal",
  },
  {
    icon: Crosshair,
    title: "Gunplay that matters",
    body: "Recoil, spread, red dot and 4× scope, headshots, reloads you have to time.",
    tone: "emerald",
    size: "normal",
  },
  {
    icon: ShieldPlus,
    title: "Outrun the zone",
    body: "Six shrinking phases. Outside the circle you bleed health, faster every time.",
    tone: "rose",
    size: "normal",
  },
  {
    icon: Zap,
    title: "Runs in your browser",
    body: "WebGPU with a WebGL fallback, three graphics presets, about 12 MB to load.",
    tone: "sky",
    size: "normal",
  },
] as const;

const MATCH = [
  { time: "00:00", title: "Drop in", body: "You land on the edge of a town with a P92 and a med kit. Twenty-four soldiers are already on the map." },
  { time: "00:30", title: "Ceasefire ends", body: "Thirty seconds to grab a rifle. After that, any soldier who sees you opens fire." },
  { time: "01:15", title: "Zone one closes", body: "The blue wall starts moving. Loot on the way in, or run." },
  { time: "03:00", title: "Mid-game", body: "Fewer soldiers, tighter circle. Hills and houses decide who sees whom first." },
  { time: "06:00", title: "Final circles", body: "The zone hurts now. Crouch in the grass, wait for the shot, heal when you can." },
  { time: "08:00", title: "Last one standing", body: "Clear the last soldier and the match is yours: #1 of 25." },
];

const STEPS = [
  {
    level: "01",
    title: "Create a free account",
    body: "Sign up with Google or email. No download, no credit card. Your first match loads right in the browser.",
    reward: "Free",
    xp: 34,
  },
  {
    level: "02",
    title: "Loot up fast",
    body: "Run into the nearest house. Find an M416 or a Kar98k, the ammo next to it, and a med kit before the ceasefire ends.",
    reward: "Armed",
    xp: 67,
  },
  {
    level: "03",
    title: "Survive to #1",
    body: "Stay inside the zone, fight from cover, aim for the head. Be the last of 25 soldiers alive.",
    reward: "#1",
    xp: 100,
  },
];

const RARITY_LABEL = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" } as const;

function JsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoGame",
        "@id": `${SITE_URL}/#game`,
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFINITION,
        image: `${SITE_URL}/opengraph-image`,
        screenshot: SCREENSHOTS.map((s) => ({
          "@type": "ImageObject",
          contentUrl: `${SITE_URL}${s.src}`,
          caption: s.alt,
        })),
        genre: ["Battle royale", "Third-person shooter", "Action"],
        gamePlatform: ["Web browser"],
        applicationCategory: "Game",
        operatingSystem: "Any operating system with a WebGPU or WebGL 2 browser",
        playMode: ["SinglePlayer"],
        numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1, maxValue: 1 },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: "en",
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      // Static, server-built JSON; escape "<" so it can't close the script tag
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default function Home() {
  return (
    <div className="ls-page">
      <JsonLd />
      <LandingEffects />
      <AutoSignIn />
      <div className="ls-progress" aria-hidden="true" />
      <div className="ls-grain" aria-hidden="true" />
      <a href="#main" className="ls-skip">
        Skip to content
      </a>

      <header className="ls-nav">
        <div className="ls-container ls-nav__inner">
          <Link href="/" className="ls-nav__brand" aria-label="ShunyaScape home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="ls-nav__links">
            <a href="#gameplay">Gameplay</a>
            <a href="#features">Features</a>
            <a href="#match">A match</a>
            <a href="#how-to-play">How to play</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="ls-nav__actions">
            <PlayButton className="ls-link-btn">Log in</PlayButton>
            <PlayButton className="ls-btn ls-btn--gold ls-btn--small">
              Play free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </PlayButton>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="ls-hero" aria-labelledby="hero-title">
          <div className="ls-scene" aria-hidden="true">
            <div className="ls-layer ls-hero-shot" style={{ "--depth": 0.35 } as CSSProperties}>
              <Image src="/images/landing/bg-hero.webp" alt="" fill priority sizes="100vw" className="ls-hero-shot__img" />
            </div>
            <div className="ls-hero-shade" />
            <div className="ls-fade" />
          </div>
          <div className="ls-container ls-hero__content">
            <p className="ls-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Free 3D battle royale in your browser
            </p>
            <h1 id="hero-title" className="ls-hero__title">
              Drop in. Loot up.{" "}
              <span className="ls-gradient-text">Be the last one standing.</span>
            </h1>
            <p className="ls-hero__lead">
              A realistic third-person battleground against 24 AI soldiers. Grab guns from houses and crates, outrun
              the shrinking zone and fight your way to #1 — no download, just click and play.
            </p>
            <div className="ls-hero__ctas">
              <PlayButton className="ls-btn ls-btn--gold ls-btn--lg" magnetic>
                <Gamepad2 className="h-5 w-5" aria-hidden="true" />
                Play free now
              </PlayButton>
              <a href="#gameplay" className="ls-btn ls-btn--ghost ls-btn--lg">
                See the gameplay
              </a>
            </div>
            <ul className="ls-stats" aria-label="ShunyaScape at a glance">
              {STATS.map((s) => (
                <li key={s.label}>
                  <strong>{s.value}</strong>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── What is ─────────────────────────────────────────────────────── */}
        <section className="ls-section ls-what" aria-labelledby="what-title">
          <div className="ls-container">
            <div className="ls-what__panel ls-frame" data-reveal>
              <span className="ls-frame__corners" aria-hidden="true" />
              <div className="ls-what__head">
                <p className="ls-kicker">The game</p>
                <h2 id="what-title" className="ls-h2">
                  What is <span className="ls-gradient-text">ShunyaScape</span>?
                </h2>
              </div>
              <p className="ls-what__text">{DEFINITION}</p>
            </div>
          </div>
        </section>

        {/* ── Gameplay screenshots ────────────────────────────────────────── */}
        <section id="gameplay" className="ls-section ls-gameplay ls-cut" aria-labelledby="gameplay-title">
          <div className="ls-outline-word" aria-hidden="true">
            Gameplay
          </div>
          <div className="ls-container">
            <header className="ls-section__head" data-reveal="words">
              <p className="ls-kicker">Gameplay</p>
              <h2 id="gameplay-title" className="ls-h2">
                <SplitWords text="Step onto the battleground" />
              </h2>
              <p className="ls-section__lead">Real screenshots from the game — no renders, no mock-ups.</p>
            </header>
            <ul className="ls-shots">
              {SCREENSHOTS.map((s, i) => (
                <li key={s.src} className={`ls-shot ls-shot--${i}`} data-reveal>
                  <figure>
                    <div className="ls-shot__frame">
                      <Image
                        src={s.src}
                        alt={s.alt}
                        width={1524}
                        height={638}
                        sizes={i === 0 ? "(max-width: 960px) 100vw, 760px" : "(max-width: 960px) 100vw, 420px"}
                        className="ls-shot__img"
                        priority={i === 0}
                      />
                      <span className="ls-shot__scan" aria-hidden="true" />
                      <span className="ls-shot__tag">{s.tag}</span>
                    </div>
                    <figcaption>{s.caption}</figcaption>
                  </figure>
                </li>
              ))}
              <li className="ls-shot ls-shot--stat" data-reveal>
                <div className="ls-shot__statbox">
                  <strong>24</strong>
                  <span>AI soldiers in every match, all hunting you</span>
                  <a href="#match" className="ls-text-link">
                    How a match plays out <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* ── Features bento ──────────────────────────────────────────────── */}
        <section id="features" className="ls-section" aria-labelledby="features-title">
          <div className="ls-container">
            <header className="ls-section__head" data-reveal="words">
              <p className="ls-kicker">Features</p>
              <h2 id="features-title" className="ls-h2">
                <SplitWords text="Everything a battle royale needs" />
              </h2>
            </header>
            <ul className="ls-bento">
              {FEATURES.map((f) => (
                <li
                  key={f.title}
                  className={`ls-card ls-card--${f.tone} ls-card--${f.size}`}
                  data-tilt
                  data-reveal
                >
                  <span className="ls-card__icon" aria-hidden="true">
                    <f.icon className="h-6 w-6" />
                  </span>
                  <h3 className="ls-card__title">{f.title}</h3>
                  <p className="ls-card__body">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── A match: sticky scrollytelling ──────────────────────────────── */}
        <section id="match" className="ls-section ls-day ls-cut" aria-labelledby="match-title">
          <div className="ls-container ls-day__grid" data-scrolly data-active="0">
            <div className="ls-day__sticky">
              <div className="ls-day__screen ls-frame">
                <span className="ls-frame__corners" aria-hidden="true" />
                <Image
                  src="/images/landing/bg-map.webp"
                  alt=""
                  width={1524}
                  height={638}
                  sizes="(max-width: 960px) 100vw, 560px"
                  className="ls-day__img"
                />
                <span className="ls-day__tint" aria-hidden="true" />
                <svg className="ls-day__route" viewBox="0 0 400 168" aria-hidden="true">
                  <path d="M30 140 C 90 140, 110 96, 170 92 S 260 60, 300 70 S 360 40, 372 24" pathLength={1} />
                </svg>
                <div className="ls-day__clock" aria-hidden="true">
                  {MATCH.map((d, i) => (
                    <span key={d.time} className="ls-day__time" data-i={i}>
                      {d.time}
                    </span>
                  ))}
                </div>
                <span className="ls-day__label">Your route to #1</span>
              </div>
            </div>
            <div>
              <header className="ls-section__head" data-reveal="words">
                <p className="ls-kicker">A match</p>
                <h2 id="match-title" className="ls-h2">
                  <SplitWords text="Eight minutes, twenty-five soldiers" />
                </h2>
                <p className="ls-section__lead">
                  Every match is a fresh drop: a new spawn, a new zone path, and soldiers who never stand in the same
                  place twice.
                </p>
              </header>
              <ol className="ls-steps-day">
                {MATCH.map((d, i) => (
                  <li key={d.time} className="ls-step-day" data-step={i}>
                    <time className="ls-step-day__time">{d.time}</time>
                    <h3 className="ls-step-day__title">{d.title}</h3>
                    <p className="ls-step-day__body">{d.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── How to play: steps, controls, arsenal ───────────────────────── */}
        <section id="how-to-play" className="ls-section" aria-labelledby="play-title">
          <div className="ls-container">
            <header className="ls-section__head" data-reveal="words">
              <p className="ls-kicker">How to play</p>
              <h2 id="play-title" className="ls-h2">
                <SplitWords text="Your first match" />
              </h2>
            </header>
            <ol className="ls-quests">
              {STEPS.map((q) => (
                <li key={q.level} className="ls-quest" data-reveal data-spotlight>
                  <div className="ls-quest__top">
                    <span className="ls-quest__level">Step {q.level}</span>
                    <span className="ls-quest__reward">{q.reward}</span>
                  </div>
                  <h3 className="ls-quest__title">{q.title}</h3>
                  <p className="ls-quest__body">{q.body}</p>
                  <div className="ls-xp" aria-hidden="true">
                    <span className="ls-xp__fill" style={{ "--xp": `${q.xp}%` } as CSSProperties} />
                  </div>
                </li>
              ))}
            </ol>

            <div className="ls-loadout">
              <div className="ls-panel ls-frame" data-reveal>
                <span className="ls-frame__corners" aria-hidden="true" />
                <h3 className="ls-panel__title">
                  <Gamepad2 className="h-5 w-5" aria-hidden="true" /> Controls
                </h3>
                <dl className="ls-controls">
                  {CONTROLS.map((c) => (
                    <div key={c.action} className="ls-controls__row">
                      <dt>
                        {c.keys.map((k) => (
                          <kbd key={k}>{k}</kbd>
                        ))}
                      </dt>
                      <dd>{c.action}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="ls-panel ls-frame ls-shop" data-reveal>
                <span className="ls-frame__corners" aria-hidden="true" />
                <h3 className="ls-panel__title">
                  <Target className="h-5 w-5" aria-hidden="true" /> Arsenal
                </h3>
                <p className="ls-shop__note">Everything is looted on the map — nothing to buy.</p>
                <ul className="ls-items">
                  {ARSENAL.map((p) => (
                    <li key={p.name} className={`ls-item ls-item--${p.rarity}`}>
                      <span className="ls-item__rarity">{RARITY_LABEL[p.rarity]}</span>
                      <span className="ls-item__name">{p.name}</span>
                      <span className="ls-item__desc">{p.detail}</span>
                      <span className="ls-item__price">{p.stat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section id="faq" className="ls-section ls-faq-section" aria-labelledby="faq-title">
          <div className="ls-container ls-faq">
            <header className="ls-section__head" data-reveal="words">
              <p className="ls-kicker">FAQ</p>
              <h2 id="faq-title" className="ls-h2">
                <SplitWords text="Questions, answered" />
              </h2>
              <p className="ls-section__lead">Still curious? Jump in — it&apos;s free.</p>
            </header>
            <div className="ls-faq__list">
              {FAQ.map((item, i) => (
                <details key={item.q} className="ls-faq__item" data-reveal open={i === 0}>
                  <summary>
                    <h3>{item.q}</h3>
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <section className="ls-section ls-cta" aria-labelledby="cta-title">
          <div className="ls-container">
            <div className="ls-cta__box" data-reveal>
              <div className="ls-aurora" aria-hidden="true" />
              <div className="ls-blob" aria-hidden="true" />
              <div className="ls-cta__word" aria-hidden="true">
                Play
              </div>
              <LogoMark className="ls-cta__mark" />
              <h2 id="cta-title" className="ls-h2 ls-cta__title">
                Twenty-four soldiers are waiting.
              </h2>
              <p className="ls-section__lead">Your first match is a minute away. It&apos;s free, and it runs right here.</p>
              <PlayButton className="ls-btn ls-btn--gold ls-btn--xl" magnetic>
                <Swords className="h-5 w-5" aria-hidden="true" />
                Drop in
              </PlayButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="ls-footer">
        <div className="ls-container ls-footer__inner">
          <Logo />
          <nav aria-label="Footer" className="ls-footer__links">
            <a href="#gameplay">Gameplay</a>
            <a href="#features">Features</a>
            <a href="#match">A match</a>
            <a href="#how-to-play">How to play</a>
            <a href="#faq">FAQ</a>
            <a href="https://github.com/Be1newinner/shunyascape" rel="noopener">
              Open source on GitHub
            </a>
          </nav>
          <p className="ls-footer__copy">© {new Date().getFullYear()} ShunyaScape. A free browser battle royale.</p>
        </div>
      </footer>
    </div>
  );
}
