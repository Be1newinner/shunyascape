import { Fragment, type CSSProperties } from "react";

/**
 * Split text into word spans so headings can reveal word by word (see
 * `.ls-w` in landing.css). The full text stays in the DOM for crawlers and
 * screen readers.
 */
export default function SplitWords({ text, offset = 0 }: { text: string; offset?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="ls-w" style={{ "--i": i + offset } as CSSProperties}>
            {word}
          </span>
          {/* Space outside the inline-block span, which would trim it */}
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
