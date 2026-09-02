import { skills } from '../content/cv'
import { Reveal } from './Reveal'
import { SectionHead } from './SectionHead'

export function Skills() {
  return (
    <section className="section" id="skills">
      <div className="wrap">
        <SectionHead
          num="04"
          label="Toolkit"
          title="The whole stack, model to interface."
          lede="Grouped the way the work actually splits — not an alphabetical keyword dump."
        />

        {/* One reveal for the whole grid: fading individual cells would expose
            the grid's separator colour behind them. */}
        <Reveal delay={80}>
          <div className="skill-grid">
            {skills.map((g) => (
              <div className="skill-cell" key={g.group}>
                <h3>{g.group}</h3>
                <div className="skill-items">
                  {g.items.map((s) => (
                    <span className="chip" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
