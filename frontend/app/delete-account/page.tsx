import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../components/legal/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "../lib/site";

export const metadata: Metadata = {
  title: "Delete your account",
  description: `How to delete your ${SITE_NAME} account and the data stored with it.`,
  alternates: { canonical: "/delete-account" },
};

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account" updated="15 October 2026">
      <p>
        You can delete your {SITE_NAME} account at any time. Deleting it is permanent and cannot be undone.
      </p>

      <div className="lg-card">
        <h2>Delete it yourself, in the game</h2>
        <ol>
          <li>
            Open the {SITE_NAME} app, or <Link href="/battleground">play in your browser</Link>, and sign in.
          </li>
          <li>In the lobby, open <strong>Settings</strong> (the gear icon).</li>
          <li>
            Tap <strong>Delete account</strong>, then <strong>Delete forever</strong> to confirm.
          </li>
        </ol>
      </div>

      <div className="lg-card">
        <h2>Or ask us to delete it</h2>
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}?subject=Delete%20my%20${SITE_NAME}%20account`}>{CONTACT_EMAIL}</a>{" "}
          from the email address you signed up with, with the subject &quot;Delete my account&quot;. We delete the
          account within 7 days and reply to confirm.
        </p>
      </div>

      <h2>What is deleted</h2>
      <ul>
        <li>your name, email address, and password hash or Google account link;</li>
        <li>your outfit, level, XP and all game stats;</li>
        <li>your optional gender and date of birth, if you added them;</li>
        <li>your sign-in sessions, so you are signed out everywhere.</li>
      </ul>
      <p>
        All of it is removed from our database straight away. We do not keep any of it after your account is deleted.
      </p>
      <p>
        See our <Link href="/privacy">privacy policy</Link> for more about the data we hold.
      </p>
    </LegalPage>
  );
}
