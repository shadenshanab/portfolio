import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Scroll-reveal wrapper. Uses IntersectionObserver rather than a motion library
 * (smaller bundle) and collapses to a no-op under prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className,
  id,
}: {
  children: ReactNode
  delay?: number
  as?: 'div' | 'section' | 'li' | 'article'
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLElement>(null)
  // Reduced-motion visitors start visible — no observer, no fade.
  const [shown, setShown] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      id={id}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(18px)',
        transition: `opacity .7s cubic-bezier(.22,.7,.3,1) ${delay}ms, transform .7s cubic-bezier(.22,.7,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </Tag>
  )
}
