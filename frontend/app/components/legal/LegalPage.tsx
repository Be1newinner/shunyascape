import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "../landing/Logo";
import "../../landing.css";
import "./legal.css";

/** Shell for the plain-text policy pages (privacy, account deletion). */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="ls-page">
      <header className="ls-container lg-header">
        <Link href="/" aria-label="ShunyaScape home">
          <Logo />
        </Link>
      </header>
      <main className="ls-container lg-main">
        <h1>{title}</h1>
        <p className="lg-updated">Last updated {updated}</p>
        {children}
      </main>
      <footer className="ls-footer">
        <div className="ls-container ls-footer__inner">
          <nav aria-label="Footer" className="ls-footer__links">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/delete-account">Delete your account</Link>
          </nav>
          <p className="ls-footer__copy">© {new Date().getFullYear()} ShunyaScape.</p>
        </div>
      </footer>
    </div>
  );
}
