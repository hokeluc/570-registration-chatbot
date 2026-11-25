import { useEffect, useState, type FormEvent } from 'react'
import { fetchOptions } from '../api/client'
import { FALLBACK_OPTIONS } from '../api/fallbackOptions'
import type { OptionsResponse, StudentProfile } from '../api/types'

const THIS_YEAR = new Date().getFullYear()
const ENTRY_YEARS = Array.from({ length: 8 }, (_, i) => THIS_YEAR - 6 + i)
const GRAD_YEARS = Array.from({ length: 8 }, (_, i) => THIS_YEAR + i)
const SEASONS = ['Fall', 'Spring', 'Summer']
const STEPS = ['When you started', 'Your major', 'Minors & courses', 'Review']

// Students are generally held to the catalog of the year they were admitted.
// Mines catalog years run fall to summer, so Spring/Summer 2026 belong to 2025-2026.
function inferCatalogYear(entryTerm: string): string {
  const [season, yearStr] = entryTerm.split(' ')
  const year = Number(yearStr)
  if (!year) return ''
  const start = season === 'Fall' ? year : year - 1
  return `${start}-${start + 1}`
}

interface Props {
  initial?: StudentProfile | null
  onDone: (p: StudentProfile) => void
  onCancel?: () => void
}

export default function Onboarding({ initial, onDone, onCancel }: Props) {
  const [options, setOptions] = useState<OptionsResponse>(FALLBACK_OPTIONS)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  const [season, setSeason] = useState(initial?.entry_term.split(' ')[0] ?? 'Fall')
  const [entryYear, setEntryYear] = useState(Number(initial?.entry_term.split(' ')[1]) || THIS_YEAR - 1)
  const [gradYear, setGradYear] = useState(initial?.grad_year ?? THIS_YEAR + 3)
  const [major, setMajor] = useState(initial?.majors[0] ?? '')
  const [secondMajor, setSecondMajor] = useState(initial?.majors[1] ?? '')
  const [track, setTrack] = useState(initial?.track ?? '')
  const [minors, setMinors] = useState<string[]>(initial?.minors ?? [])
  const [catalogOverride, setCatalogOverride] = useState(
    initial?.catalog_year && initial.catalog_year !== inferCatalogYear(initial.entry_term) ? initial.catalog_year : '',
  )
  const [courses, setCourses] = useState((initial?.completed_courses ?? []).join(', '))
  const [ack, setAck] = useState(!!initial)

  useEffect(() => {
    fetchOptions().then(setOptions)
  }, [])

  const entryTerm = `${season} ${entryYear}`
  const inferred = inferCatalogYear(entryTerm)
  const tracks = options.majors.find((m) => m.name === major)?.tracks ?? []

  function buildProfile(): StudentProfile {
    return {
      entry_term: entryTerm,
      grad_year: gradYear,
      catalog_year: catalogOverride || inferred,
      majors: [major, secondMajor].filter(Boolean),
      track: track || undefined,
      minors,
      completed_courses: courses
        .split(/[,\n]/)
        .map((c) => c.replace(/\s+/g, '').toUpperCase())
        .filter(Boolean),
    }
  }

  function validate(): string {
    if (step === 0 && gradYear < entryYear) return 'Graduation year can’t be before your entry year.'
    if (step === 1 && !major) return 'Pick your major to continue.'
    if (step === 1 && secondMajor && secondMajor === major) return 'Your second major must differ from your first.'
    if (step === 3 && !ack) return 'Please confirm you’ve read the privacy note.'
    return ''
  }

  function next(e: FormEvent) {
    e.preventDefault()
    const msg = validate()
    setError(msg)
    if (msg) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else onDone(buildProfile())
  }

  const p = buildProfile()

  return (
    <div className="onboarding">
      <div className="card onboarding-card">
        <h1>Let’s set up your plan</h1>
        <p className="muted">
          A few questions so answers match <strong>your</strong> catalog year and major. Nothing is saved after you
          close this tab.
        </p>

        <ol className="stepper" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              <span className="dot">{i < step ? '✓' : i + 1}</span>
              <span className="label">{s}</span>
            </li>
          ))}
        </ol>

        <form onSubmit={next} noValidate>
          {step === 0 && (
            <fieldset>
              <legend>When did you start at Mines?</legend>
              <div className="row">
                <label>
                  Term
                  <select value={season} onChange={(e) => setSeason(e.target.value)}>
                    {SEASONS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Year
                  <select value={entryYear} onChange={(e) => setEntryYear(Number(e.target.value))}>
                    {ENTRY_YEARS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Expected graduation year
                <select value={gradYear} onChange={(e) => setGradYear(Number(e.target.value))}>
                  {GRAD_YEARS.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </label>
              <p className="hint">
                Your catalog year is probably <strong>{inferred}</strong>. You can change it in step 3.
              </p>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <legend>What are you studying?</legend>
              <label>
                Major
                <select
                  value={major}
                  onChange={(e) => {
                    setMajor(e.target.value)
                    setTrack('')
                  }}
                  required
                >
                  <option value="">Choose a major…</option>
                  {options.majors.map((m) => (
                    <option key={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              {tracks.length > 0 && (
                <label>
                  Track / focus area
                  <select value={track} onChange={(e) => setTrack(e.target.value)}>
                    <option value="">Not sure yet</option>
                    {tracks.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Second major <span className="optional">(optional)</span>
                <select value={secondMajor} onChange={(e) => setSecondMajor(e.target.value)}>
                  <option value="">None</option>
                  {options.majors
                    .filter((m) => m.name !== major)
                    .map((m) => (
                      <option key={m.id}>{m.name}</option>
                    ))}
                </select>
              </label>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend>Anything else?</legend>
              <div className="field">
                <span className="field-label">
                  Minors <span className="optional">(optional)</span>
                </span>
                <div className="chips" role="group" aria-label="Minors">
                  {options.minors.map((m) => {
                    const on = minors.includes(m)
                    return (
                      <button
                        type="button"
                        key={m}
                        className={`chip ${on ? 'on' : ''}`}
                        aria-pressed={on}
                        onClick={() => setMinors(on ? minors.filter((x) => x !== m) : [...minors, m])}
                      >
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label>
                Catalog year
                <select value={catalogOverride} onChange={(e) => setCatalogOverride(e.target.value)}>
                  <option value="">Use my entry year ({inferred})</option>
                  {options.catalog_years.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
                <span className="hint">Only change this if you formally switched to a later catalog.</span>
              </label>
              <label>
                Courses you’ve completed <span className="optional">(optional)</span>
                <textarea
                  rows={3}
                  placeholder="e.g. CSCI101, MATH111, CHGN121"
                  value={courses}
                  onChange={(e) => setCourses(e.target.value)}
                />
                <span className="hint">Course codes only. Don’t include grades.</span>
              </label>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend>Does this look right?</legend>
              <dl className="review">
                <dt>Started</dt>
                <dd>{p.entry_term}</dd>
                <dt>Graduating</dt>
                <dd>{p.grad_year}</dd>
                <dt>Catalog year</dt>
                <dd>{p.catalog_year}</dd>
                <dt>Major{p.majors.length > 1 ? 's' : ''}</dt>
                <dd>
                  {p.majors.join(' + ')}
                  {p.track ? ` · ${p.track}` : ''}
                </dd>
                <dt>Minors</dt>
                <dd>{p.minors.length ? p.minors.join(', ') : 'None'}</dd>
                <dt>Completed</dt>
                <dd>{p.completed_courses.length ? p.completed_courses.join(', ') : 'None listed'}</dd>
              </dl>
              <div className="privacy">
                <strong>Privacy:</strong> Never enter your name, CWID, or grades. This tool is unofficial, so always
                confirm your plan with your CASA advisor.
              </div>
              <label className="check">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />I understand
              </label>
            </fieldset>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="actions">
            {step > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : onCancel ? (
              <button type="button" className="btn ghost" onClick={onCancel}>
                Cancel
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn primary">
              {step === STEPS.length - 1 ? 'Start chatting' : 'Next'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
