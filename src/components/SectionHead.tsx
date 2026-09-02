import { Reveal } from './Reveal'

export function SectionHead({ num, label, title, lede }: { num: string; label: string; title: string; lede?: string }) {
  return (
    <Reveal>
      <div className="eyebrow">
        <span className="num pixel">{num}</span>
        <span className="mono">{label}</span>
        <span className="rule" aria-hidden="true" />
      </div>
      <h2 className="h2">{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </Reveal>
  )
}
