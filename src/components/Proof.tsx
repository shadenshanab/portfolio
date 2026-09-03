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
          title="Certified, and ranked first in Jordan."
          lede="The education and recognition behind the work — most recent first."
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
