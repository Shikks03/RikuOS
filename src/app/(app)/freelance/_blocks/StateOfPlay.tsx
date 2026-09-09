import type { SayLine } from "@/lib/freelanceView";

/**
 * The statement lines under the hero row. They are sentences, and they
 * disappear entirely when they have nothing to say — they never render as a
 * zero, and there is no empty slot left behind.
 *
 * The figure sits in <b> and the rest is plain text, separated by one space:
 * `<b>3</b> approved, not yet sent`. A line with no figure — today's
 * `Nothing waiting on you.` — renders the text alone.
 */
export default function StateOfPlay({ lines }: { lines: SayLine[] }) {
  if (lines.length === 0) return null;

  return (
    <>
      {lines.map((line) => (
        <p className="fl-say" key={line.text}>
          {line.figure !== null ? (
            <>
              <b>{line.figure}</b> {line.text}
            </>
          ) : (
            line.text
          )}
        </p>
      ))}
    </>
  );
}
