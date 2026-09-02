import { useEffect, useState } from 'react'
import { profile, stats } from '../content/cv'
import { Reveal } from './Reveal'

/** Small ticking latency read-out — the hero's "instrument panel" flavour. */
function useFakeLatency() {
  const [ms, setMs] = useState(312)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setMs(280 + Math.floor(Math.random() * 90)), 2600)
    return () => clearInterval(t)
  }, [])
  return ms
}

export function Hero() {
  const latency = useFakeLatency()

  return (
    <header className="hero" id="top">
      <div className="wrap">
        <Reveal>
          <p className="mono" style={{ color: 'var(--text-faint)', marginBottom: '1.5rem' }}>
            {profile.location} · Available for work
          </p>
        </Reveal>

        <Reveal delay={60}>
          <h1 className="hero-name">
            {profile.first}
            <span className="line2">{profile.last}</span>
          </h1>
        </Reveal>

        <Reveal delay={140}>
          <p className="hero-title">
            {profile.title} — <em>{profile.subtitle}</em>
          </p>
          <p className="hero-intro">{profile.intro}</p>
        </Reveal>

        <Reveal delay={220}>
          <div className="status mono" role="status">
            <span className="item">
              <span className="dot" aria-hidden="true" />
              <b>twin online</b>
            </span>
            <span className="item">
              runtime <b>local</b>
            </span>
            <span className="item">
              latency <b>{latency}ms</b>
            </span>
            <span className="item">
              lang <b>EN / AR</b>
            </span>
          </div>
        </Reveal>

        <Reveal delay={300}>
          <div className="stat-row">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <div className="v pixel">{s.value}</div>
                <div className="l">{s.label}</div>
                <div className="n mono" style={{ letterSpacing: '0.06em' }}>
                  {s.note}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </header>
  )
}
