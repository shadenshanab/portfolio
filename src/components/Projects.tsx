import { projects } from '../content/cv'
import { Reveal } from './Reveal'
import { SectionHead } from './SectionHead'

export function Projects() {
  return (
    <section className="section" id="projects">
      <div className="wrap">
        <SectionHead
          num="03"
          label="Signature work"
          title="Systems, not notebooks."
          lede="Four production builds from the consulting practice — each one shipped with its interface, its API and its analytics attached."
        />

        <div className="proj-grid">
          {projects.map((p, i) => (
            <Reveal as="article" className="card proj" key={p.id} delay={i * 70} id={`proj-${p.id}`}>
              <span className="proj-kicker">{p.kicker}</span>
              <h3 className="proj-name">{p.name}</h3>
              <p className="proj-summary">{p.summary}</p>

              <ul className="proj-bullets">
                {p.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>

              <div className="proj-stack">
                {p.stack.map((s) => (
                  <span className="chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
