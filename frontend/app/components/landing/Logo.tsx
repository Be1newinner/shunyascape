import { LOGO_FACES } from "../../lib/logo";

/** Logo mark (isometric city towers). Decorative: pair it with the wordmark or a label. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <g transform="translate(0 3)">
        {LOGO_FACES.map((f, i) => (
          <path key={i} d={f.d} fill={f.fill} />
        ))}
      </g>
    </svg>
  );
}

/** Mark + wordmark, as used in the nav and footer. */
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className={`ls-logo ls-logo--${size}`}>
      <span className="ls-logo__badge">
        <LogoMark className="ls-logo__mark" />
      </span>
      <span className="ls-logo__word">
        Shunya<span className="ls-logo__accent">Scape</span>
      </span>
    </span>
  );
}
