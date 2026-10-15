import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../components/legal/LegalPage";
import { CONTACT_EMAIL, SITE_NAME } from "../lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${SITE_NAME} collects when you play, why, and how to delete your account.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="15 October 2026">
      <p>
        This policy explains what {SITE_NAME} (the website and the Android app) collects when you play, why we need it,
        and the choices you have. {SITE_NAME} is made by Shipsar Developers (&quot;we&quot;). If you have a question,
        email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> your name and email address. If you sign up with email, we also store your
          password as a one-way scrypt hash, never the password itself. If you sign in with Google, we receive your name,
          email address and Google account ID from Google.
        </li>
        <li>
          <strong>Verification codes:</strong> when you verify your email or reset your password we send you a one-time
          code. It is stored until it is used or expires.
        </li>
        <li>
          <strong>Game profile:</strong> your chosen outfit and your game results: matches played, wins, kills, damage,
          top-10 finishes, best placement, time played, XP and when you last played.
        </li>
        <li>
          <strong>Optional profile details:</strong> gender and date of birth, only if you choose to provide them.
        </li>
        <li>
          <strong>Sign-in session:</strong> a session token that keeps you signed in. On the web it is kept in secure,
          HTTP-only cookies; in the Android app it is kept in the device&apos;s encrypted secure storage.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> collect your location, contacts, photos, files, microphone or camera input, or
        advertising ID. {SITE_NAME} shows no ads and contains no third-party analytics or tracking SDKs.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To create your account, sign you in and keep your account secure.</li>
        <li>To run matches, show your name to other players in a match, and keep your level and stats.</li>
        <li>To send you the emails you ask for, such as verification and password-reset codes.</li>
      </ul>
      <p>We do not sell your data, and we do not use it for advertising.</p>

      <h2>Who we share it with</h2>
      <p>We share data only with the services that run the game for us, and only so they can do that:</p>
      <ul>
        <li>our server hosting and database providers, which store your account and stats;</li>
        <li>Google, which delivers our emails (Gmail) and, if you choose it, handles Sign in with Google.</li>
      </ul>
      <p>We may also disclose data if the law requires it.</p>

      <h2>Security</h2>
      <p>
        All traffic between your device and our servers is encrypted with HTTPS. Passwords are hashed, and session
        cookies cannot be read by scripts on the page.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and stats while your account exists. When you delete your account, your profile, stats and
        sign-in details are removed from our database straight away.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can change your outfit and optional profile details at any time.</li>
        <li>
          You can delete your account and its data from the game&apos;s settings, or by following the steps on our{" "}
          <Link href="/delete-account">account deletion page</Link>.
        </li>
        <li>
          You can ask us for a copy of your data, or to correct it, by emailing{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h2>Age</h2>
      <p>
        {SITE_NAME} is a shooter game meant for players aged 16 and over. It is not directed at children, and we do not
        knowingly collect data from anyone under 16. If you believe a child has created an account, email us and we will
        delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change what we collect or how we use it, we will update this page and the date at the top. Significant
        changes will also be announced in the game.
      </p>
    </LegalPage>
  );
}
