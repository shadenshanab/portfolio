import { proof } from '../content/cv'
import { Reveal } from './Reveal'
import { SectionHead } from './SectionHead'

export function Proof() {
  return (
    <section className="section" id="proof">
      <div className="wrap">
        <SectionHead
          num="05"
          label="Credentials"
          title="Ranked first in a country, then certified."
          lede="Education and recognition, in the order it happened."
        />

        <div className="proof-list">
          {proof.map((p, i) => (
            <Reveal as="div" className="proof-row" key={p.title} delay={i * 50}>
              <div className="proof-year pixel">{p.year}</div>
              <div>
                <div className="proof-title">{p.title}</div>
                <div className="proof-issuer">{p.issuer}</div>
                {p.note && <p className="proof-note">{p.note}</p>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
