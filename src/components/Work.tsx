import { experience } from '../content/cv'
import { Reveal } from './Reveal'
import { SectionHead } from './SectionHead'

export function Work() {
  return (
    <section className="section" id="work">
      <div className="wrap">
        <SectionHead
          num="02"
          label="Experience"
          title="Four teams, one habit: finish the thing."
          lede="Consulting, governance, generative AI, and the data engineering underneath it all."
        />

        <div className="tl" style={{ marginTop: 'clamp(2rem,5vw,3rem)' }}>
          {experience.map((job, i) => (
            <Reveal as="div" className="tl-row" key={job.id} delay={i * 60}>
              <div className="tl-period">{job.period}</div>

              <div>
                <div className="tl-role">
                  {job.role}
                  <br />
                  <span className="tl-company">{job.company}</span>
                </div>
                <p className="tl-headline pixel">{job.headline}</p>
              </div>

              <ul className="tl-bullets">
                {job.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
