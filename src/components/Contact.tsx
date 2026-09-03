import { profile } from '../content/cv'
import { Reveal } from './Reveal'

export function Contact() {
  return (
    <section className="section" id="contact">
      <div className="wrap">
        <Reveal>
          <div className="eyebrow">
            <span className="num pixel">06</span>
            <span className="mono">Contact</span>
            <span className="rule" aria-hidden="true" />
          </div>

          <h2 className="contact-head pixel">
            LET&apos;S BUILD
            <br />
            SOMETHING.
          </h2>

          <p className="lede" style={{ marginTop: '1.5rem' }}>
            Open to full-time roles, consulting engagements and scoped builds. Based in {profile.location}, working
            in English and Arabic.
          </p>

          <div className="contact-links">
            <a className="btn primary" href={`mailto:${profile.email}`}>
              {profile.email}
            </a>
            <a className="btn" href={profile.linkedin} target="_blank" rel="noreferrer noopener">
              LinkedIn
            </a>
            <a className="btn" href={`/${profile.cv}`} download>
              Download CV
            </a>
          </div>
        </Reveal>

        <div className="footer mono">
          <span>© {new Date().getFullYear()} {profile.name}</span>
          <span>Built from scratch · press ⌘K · ↑↑↓↓←→←→BA</span>
        </div>
      </div>
    </section>
  )
}
