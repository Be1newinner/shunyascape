import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Coins,
  Gamepad2,
  Globe,
  HardHat,
  Sparkles,
  UserRound,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import CityScene from "./components/landing/CityScene";
import LandingEffects from "./components/landing/LandingEffects";
import PlayButton from "./components/landing/PlayButton";
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

const FEATURES = [
  {
    icon: Globe,
    title: "One shared, persistent city",
    body: "Every player walks the same 200×200 city in real time. What you build stays built and everyone sees it instantly.",
    tone: "cyan",
  },
  {
    icon: UserRound,
    title: "Citizens with real routines",
    body: "220+ citizens sleep, commute, take lunch, shop and stroll through Central Park on a shared day–night clock.",
    tone: "violet",
  },
  {
    icon: Building2,
    title: "Build with permits",
    body: "Buy permits to lay roads, plant trees and raise homes, shops and skyscrapers in four sizes — builders walk over and get to work.",
    tone: "amber",
  },
  {
    icon: Coins,
    title: "Earn your way up",
    body: "Work in offices, repair houses, help construction crews, collect crystals and crates, and finish quests to level up.",
    tone: "emerald",
  },
  {
    icon: UtensilsCrossed,
    title: "Survive the city",
    body: "Hunger drops every in-game day. Eat at restaurants, dress up at cloth shops and get a fresh cut at the barber.",
    tone: "rose",
  },
  {
    icon: Users,
    title: "Party up",
    body: "Invite friends into a party of up to 8, meet in the park and grow your part of the skyline together.",
    tone: "sky",
  },
] as const;

const DAY = [
  { time: "06:30", title: "The city wakes up", body: "Lights flick on across the residential blocks as citizens get ready." },
  { time: "08:00", title: "Rush hour", body: "Sidewalks fill up as workers head to the towers and shopkeepers open up." },
  { time: "12:30", title: "Lunch break", body: "Office workers pour into nearby restaurants — a good time to find a crowd." },
  { time: "15:00", title: "Builders at work", body: "Hard hats walk to every new construction site and raise it piece by piece." },
  { time: "18:00", title: "Evening errands", body: "Shops get busy and Central Park fills with people taking a walk." },
  { time: "23:00", title: "Night owls", body: "Most of the city is home asleep — a few still wander the empty streets." },
];

const STEPS = [
  {
    title: "Create a free account",
    body: "Sign up with your email — no download, no credit card. You spawn in Central Park with 100 ShunyaCoins.",
  },
  {
    title: "Earn coins and XP",
    body: "Collect resources, work jobs inside buildings and help citizens with quests to level up.",
  },
  {
    title: "Buy a permit and build",
    body: "Start with a 50-coin Road Builder permit, then grow into homes, shops and skyscrapers.",
  },
];

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

export default function Home() {
  return (
    <div className="ls-page">
      <JsonLd />
      <LandingEffects />
      <a href="#main" className="ls-skip">
        Skip to content
      </a>

      <header className="ls-nav">
        <div className="ls-container ls-nav__inner">
          <Link href="/" className="ls-brand" aria-label="ShunyaScape home">
            <span className="ls-brand__mark" aria-hidden="true">
              <Globe className="h-5 w-5" />
            </span>
            <span>
              Shunya<span className="ls-brand__accent">Scape</span>
            </span>
          </Link>
          <nav aria-label="Main" className="ls-nav__links">
            <a href="#features">Features</a>
            <a href="#living-city">Living city</a>
            <a href="#how-to-play">How to play</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="ls-nav__actions">
            <PlayButton className="ls-link-btn">Log in</PlayButton>
            <PlayButton className="ls-btn ls-btn--small">
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
              <PlayButton className="ls-btn ls-btn--glow">
                <Gamepad2 className="h-5 w-5" aria-hidden="true" />
                Play free now
              </PlayButton>
              <a href="#features" className="ls-btn ls-btn--ghost">
                Explore the city
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
          <div className="ls-container ls-what__grid">
            <div data-reveal>
              <p className="ls-kicker">The game</p>
              <h2 id="what-title" className="ls-h2">
                What is ShunyaScape?
              </h2>
            </div>
            <p className="ls-what__text" data-reveal>
              {DEFINITION}
            </p>
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section id="features" className="ls-section" aria-labelledby="features-title">
          <div className="ls-container">
            <header className="ls-section__head" data-reveal>
              <p className="ls-kicker">Features</p>
              <h2 id="features-title" className="ls-h2">
                Everything happens in one shared world
              </h2>
              <p className="ls-section__lead">
                No instances, no loading between zones. The city, the economy and its people are simulated live on the
                server for everyone at once.
              </p>
            </header>
            <ul className="ls-features">
              {FEATURES.map((f) => (
                <li key={f.title} className={`ls-card ls-card--${f.tone}`} data-tilt data-reveal>
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

        {/* ── A day in the city ───────────────────────────────────────────── */}
        <section id="living-city" className="ls-section ls-day" aria-labelledby="day-title">
          <div className="ls-day__glow" aria-hidden="true" />
          <div className="ls-container">
            <header className="ls-section__head" data-reveal>
              <p className="ls-kicker">The living city</p>
              <h2 id="day-title" className="ls-h2">
                A day in ShunyaScape
              </h2>
              <p className="ls-section__lead">
                Every citizen has a home, a job or a hobby, and their own schedule. One in-game day lasts eight real
                hours, so the city feels different every time you log in.
              </p>
            </header>
            <ol className="ls-timeline">
              {DAY.map((d) => (
                <li key={d.time} className="ls-timeline__item" data-reveal>
                  <time className="ls-timeline__time">{d.time}</time>
                  <div>
                    <h3 className="ls-timeline__title">{d.title}</h3>
                    <p className="ls-timeline__body">{d.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── How to play ─────────────────────────────────────────────────── */}
        <section id="how-to-play" className="ls-section" aria-labelledby="play-title">
          <div className="ls-container">
            <header className="ls-section__head" data-reveal>
              <p className="ls-kicker">How to play</p>
              <h2 id="play-title" className="ls-h2">
                From newcomer to city builder in three steps
              </h2>
            </header>
            <ol className="ls-steps">
              {STEPS.map((step, i) => (
                <li key={step.title} className="ls-step" data-reveal>
                  <span className="ls-step__num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="ls-step__title">{step.title}</h3>
                  <p className="ls-step__body">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="ls-panels">
              <div className="ls-panel" data-reveal>
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
              <div className="ls-panel" data-reveal>
                <h3 className="ls-panel__title">
                  <HardHat className="h-5 w-5" aria-hidden="true" /> Permit store
                </h3>
                <table className="ls-permits">
                  <caption className="sr-only">Building permits and their prices in ShunyaCoins</caption>
                  <thead>
                    <tr>
                      <th scope="col">Permit</th>
                      <th scope="col">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMITS.map((p) => (
                      <tr key={p.name}>
                        <th scope="row">{p.name}</th>
                        <td>{p.cost} SC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section id="faq" className="ls-section" aria-labelledby="faq-title">
          <div className="ls-container ls-faq">
            <header className="ls-section__head" data-reveal>
              <p className="ls-kicker">FAQ</p>
              <h2 id="faq-title" className="ls-h2">
                Questions, answered
              </h2>
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
              <h2 id="cta-title" className="ls-h2">
                Your plot of the skyline is waiting.
              </h2>
              <p className="ls-section__lead">Join the city in under a minute. It&apos;s free, and it runs right here.</p>
              <PlayButton className="ls-btn ls-btn--glow">
                Start building <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </PlayButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="ls-footer">
        <div className="ls-container ls-footer__inner">
          <p className="ls-brand ls-brand--footer">
            <span>
              Shunya<span className="ls-brand__accent">Scape</span>
            </span>
          </p>
          <nav aria-label="Footer" className="ls-footer__links">
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
