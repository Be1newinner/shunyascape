import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Coins,
  Gamepad2,
  Globe,
  HardHat,
  Sparkles,
  Swords,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import CityScene from "./components/landing/CityScene";
import LandingEffects from "./components/landing/LandingEffects";
import LiveTicker from "./components/landing/LiveTicker";
import Logo, { LogoMark } from "./components/landing/Logo";
import PlayButton from "./components/landing/PlayButton";
import SplitWords from "./components/landing/SplitWords";
import {
  CONTROLS,
  DEFINITION,
  FAQ,
  PERMITS,
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
    src: "/images/landing/city-hud.webp",
    alt: "ShunyaScape gameplay: Central Park with citizens walking the ring road, a downtown tower and the game HUD with level, coins, quests and minimap",
    caption: "Central Park, 11:00 — quests, coins and the city map at a glance",
    tag: "Gameplay",
  },
  {
    src: "/images/landing/city-day.webp",
    alt: "Aerial view of ShunyaScape's shared city at midday: park paths, tree-lined streets and a downtown office block",
    caption: "One shared 200×200 city for every player",
    tag: "The city",
  },
  {
    src: "/images/landing/city-evening.webp",
    alt: "ShunyaScape in the evening: citizens heading home along the streets around Central Park",
    caption: "Evening rush — citizens head home after work",
    tag: "Living world",
  },
] as const;

const FEATURES = [
  {
    icon: Globe,
    title: "One shared, persistent city",
    body: "No instances, no loading between zones. Every player walks the same 200×200 city in real time, and what you build stays built.",
    tone: "cyan",
    size: "wide",
  },
  {
    icon: UserRound,
    title: "Citizens with real routines",
    body: "220+ citizens sleep, commute, lunch, shop and stroll on the shared day–night clock.",
    tone: "violet",
    size: "tall",
  },
  {
    icon: Building2,
    title: "Build with permits",
    body: "Roads, trees, homes, shops and skyscrapers in four sizes. Builders walk over and raise them.",
    tone: "gold",
    size: "normal",
  },
  {
    icon: Coins,
    title: "Earn your way up",
    body: "Office shifts, repairs, construction help, crystals, crates and quests.",
    tone: "emerald",
    size: "normal",
  },
  {
    icon: UtensilsCrossed,
    title: "Survive the city",
    body: "Hunger drops every in-game day. Eat out, dress up, get a fresh cut.",
    tone: "rose",
    size: "normal",
  },
  {
    icon: Users,
    title: "Party up",
    body: "Squads of up to 8 players. Meet in the park and grow your part of the skyline together.",
    tone: "sky",
    size: "normal",
  },
] as const;

const DAY = [
  { time: "06:30", title: "The city wakes up", body: "Lights flick on across the residential blocks as citizens get ready." },
  { time: "08:00", title: "Rush hour", body: "Sidewalks fill as workers head to the towers and shopkeepers open up." },
  { time: "12:30", title: "Lunch break", body: "Office workers pour into nearby restaurants — the busiest streets of the day." },
  { time: "15:00", title: "Builders at work", body: "Hard hats walk to every new construction site and raise it piece by piece." },
  { time: "18:00", title: "Evening errands", body: "Shops get busy and Central Park fills with people taking a walk." },
  { time: "23:00", title: "Night owls", body: "Most of the city is home asleep. A few still wander the empty streets." },
];

const QUESTS = [
  {
    level: "01",
    title: "Create a free account",
    body: "Sign up with Google or email. No download, no credit card. You spawn in Central Park with 100 ShunyaCoins.",
    reward: "+100 SC",
    xp: 34,
  },
  {
    level: "02",
    title: "Earn coins and XP",
    body: "Collect crystals and crates, work shifts inside buildings, help citizens with quests and level up.",
    reward: "Level up",
    xp: 67,
  },
  {
    level: "03",
    title: "Buy a permit and build",
    body: "Start with a 50-coin Road Builder permit, then grow into homes, shops and skyscrapers.",
    reward: "Your skyline",
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
        genre: ["City builder", "Life simulation", "Sandbox", "Multiplayer"],
        gamePlatform: ["Web browser"],
        applicationCategory: "Game",
        operatingSystem: "Any operating system with a WebGL-capable browser",
        playMode: ["MultiPlayer", "SinglePlayer"],
        numberOfPlayers: { "@type": "QuantitativeValue", minValue: 1 },
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

/** Small gold coin used as a price icon and as floating decoration. */
function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="url(#ls-coin)" stroke="#8a5a00" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff3c4" strokeOpacity=".7" strokeWidth="1.2" />
      <path
        d="M10.2 9.2c.4-.9 1.2-1.3 2.2-1.2 1.2.1 2 .8 1.9 1.7-.1 1.9-4.6 1.1-4.4 3.5.1 1.1 1.2 1.8 2.5 1.7 1-.1 1.8-.6 2.1-1.4M12 6.8v1.2m0 7.9v1.3"
        fill="none"
        stroke="#7a4b00"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="ls-coin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset=".55" stopColor="#ffc94d" />
          <stop offset="1" stopColor="#e89a12" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="ls-page">
      <JsonLd />
      <LandingEffects />
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
            <a href="#living-city">Living city</a>
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
          <CityScene />
          <div className="ls-container ls-hero__content">
            <p className="ls-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Free multiplayer 3D city builder
            </p>
            <h1 id="hero-title" className="ls-hero__title">
              Build a living city{" "}
              <span className="ls-gradient-text">with friends.</span>
            </h1>
            <p className="ls-hero__lead">
              ShunyaScape is a real-time 3D city you share with every player — right in your browser. Earn coins,
              unlock building permits, raise skyscrapers and watch hundreds of citizens go about their day.
            </p>
            <div className="ls-hero__ctas">
              <PlayButton className="ls-btn ls-btn--gold ls-btn--lg" magnetic>
                <Gamepad2 className="h-5 w-5" aria-hidden="true" />
                Play free now
              </PlayButton>
              <a href="#gameplay" className="ls-btn ls-btn--ghost ls-btn--lg">
                Watch the city
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

        <LiveTicker />

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
                <SplitWords text="Step into the city" />
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
                  <strong>220+</strong>
                  <span>citizens living their day, right now</span>
                  <a href="#living-city" className="ls-text-link">
                    See a day in the city <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
                <SplitWords text="Everything happens in one shared world" />
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

        {/* ── A day in the city: sticky scrollytelling ────────────────────── */}
        <section id="living-city" className="ls-section ls-day ls-cut" aria-labelledby="day-title">
          <div className="ls-container ls-day__grid" data-scrolly data-active="0">
            <div className="ls-day__sticky">
              <div className="ls-day__screen ls-frame">
                <span className="ls-frame__corners" aria-hidden="true" />
                <Image
                  src="/images/landing/city-day.webp"
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
                  {DAY.map((d, i) => (
                    <span key={d.time} className="ls-day__time" data-i={i}>
                      {d.time}
                    </span>
                  ))}
                </div>
                <span className="ls-day__label">Maya&apos;s route today</span>
              </div>
            </div>
            <div>
              <header className="ls-section__head" data-reveal="words">
                <p className="ls-kicker">The living city</p>
                <h2 id="day-title" className="ls-h2">
                  <SplitWords text="A day in ShunyaScape" />
                </h2>
                <p className="ls-section__lead">
                  Every citizen has a home, a job or a hobby, and their own schedule. One in-game day lasts eight real
                  hours, so the city feels different every time you log in.
                </p>
              </header>
              <ol className="ls-steps-day">
                {DAY.map((d, i) => (
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

        {/* ── How to play: quests, controls, item shop ────────────────────── */}
        <section id="how-to-play" className="ls-section" aria-labelledby="play-title">
          <div className="ls-container">
            <header className="ls-section__head" data-reveal="words">
              <p className="ls-kicker">How to play</p>
              <h2 id="play-title" className="ls-h2">
                <SplitWords text="Your first three quests" />
              </h2>
            </header>
            <ol className="ls-quests">
              {QUESTS.map((q) => (
                <li key={q.level} className="ls-quest" data-reveal data-spotlight>
                  <div className="ls-quest__top">
                    <span className="ls-quest__level">Lv. {q.level}</span>
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
                  <HardHat className="h-5 w-5" aria-hidden="true" /> Permit shop
                </h3>
                <p className="ls-shop__note">One-time unlocks, paid in ShunyaCoins earned in game.</p>
                <ul className="ls-items">
                  {PERMITS.map((p) => (
                    <li key={p.name} className={`ls-item ls-item--${p.rarity}`}>
                      <span className="ls-item__rarity">{RARITY_LABEL[p.rarity]}</span>
                      <span className="ls-item__name">{p.name}</span>
                      <span className="ls-item__desc">{p.unlocks}</span>
                      <span className="ls-item__price">
                        <CoinIcon className="ls-item__coin" />
                        {p.cost} <abbr title="ShunyaCoins">SC</abbr>
                      </span>
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
              {[0, 1, 2, 3, 4].map((i) => (
                <CoinIcon key={i} className={`ls-float-coin ls-float-coin--${i}`} />
              ))}
              <LogoMark className="ls-cta__mark" />
              <h2 id="cta-title" className="ls-h2 ls-cta__title">
                Your plot of the skyline is waiting.
              </h2>
              <p className="ls-section__lead">Join the city in under a minute. It&apos;s free, and it runs right here.</p>
              <PlayButton className="ls-btn ls-btn--gold ls-btn--xl" magnetic>
                <Swords className="h-5 w-5" aria-hidden="true" />
                Start building
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
            <a href="#living-city">Living city</a>
            <a href="#how-to-play">How to play</a>
            <a href="#faq">FAQ</a>
            <a href="https://github.com/Be1newinner/shunyascape" rel="noopener">
              Open source on GitHub
            </a>
          </nav>
          <p className="ls-footer__copy">© {new Date().getFullYear()} ShunyaScape. A free multiplayer city builder.</p>
        </div>
      </footer>
    </div>
  );
}
