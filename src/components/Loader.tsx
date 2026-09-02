/**
 *  spin  — the winterflower loading mark. Shown for every "we're working on it"
 *          wait in the twin: first token of an answer, cloned-voice generation,
 *          and speech-to-text transcription.
 *  bars  — a five-bar equaliser. Shown only while an answer is playing aloud —
 *          that's playback, not loading, so it gets its own mark.
 *
 * `bars` is CSS-only and collapses to a static glyph under prefers-reduced-motion;
 * the label always carries the meaning.
 */

type LoaderVariant = 'spin' | 'bars'

export function Loader({
  variant = 'spin',
  label,
  className,
}: {
  variant?: LoaderVariant
  label?: string
  className?: string
}) {
  return (
    <span
      className={`loader${className ? ` ${className}` : ''}`}
      data-variant={variant}
      role="status"
      aria-label={label ?? 'Loading'}
    >
      {variant === 'bars' ? (
        <span className="loader-glyph" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <img
          className="loader-gif"
          src="/winterflower-loading-bar.gif"
          alt=""
          aria-hidden="true"
          width={22}
          height={22}
        />
      )}
      {label && <span className="loader-label mono">{label}</span>}
    </span>
  )
}
