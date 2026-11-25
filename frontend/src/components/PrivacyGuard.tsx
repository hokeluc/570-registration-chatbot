import { BLOCKING_KINDS, KIND_LABEL, type PiiFinding } from '../lib/privacy'

interface Props {
  findings: PiiFinding[]
  onRedact: () => void
  onEdit: () => void
  onSendAnyway: () => void
}

// Shown instead of sending when a message looks like it contains a CWID, grade, or name.
export default function PrivacyGuard({ findings, onRedact, onEdit, onSendAnyway }: Props) {
  const kinds = [...new Set(findings.map((f) => f.kind))]
  const canOverride = !kinds.some((k) => BLOCKING_KINDS.includes(k))

  return (
    <div className="privacy-guard" role="alertdialog" aria-labelledby="pg-title" aria-describedby="pg-desc">
      <div id="pg-title" className="pg-title">
        <span aria-hidden>🔒</span> Hold on, this looks like personal information
      </div>
      <p id="pg-desc">
        Your message seems to include {kinds.map((k) => KIND_LABEL[k]).join(', ').replace(/, ([^,]*)$/, ' and $1')}:{' '}
        {findings.map((f, i) => (
          <span key={f.match}>
            {i > 0 && ', '}
            <mark>{f.match}</mark>
          </span>
        ))}
        . This tool doesn’t need it to answer, and you shouldn’t share it here. Your advisor can see your records
        directly.
      </p>
      <div className="pg-actions">
        <button className="btn primary small" onClick={onRedact} autoFocus>
          Remove it and send
        </button>
        <button className="btn small" onClick={onEdit}>
          Edit my message
        </button>
        {canOverride && (
          <button className="btn link pg-override" onClick={onSendAnyway}>
            This isn’t personal info, send anyway
          </button>
        )}
      </div>
    </div>
  )
}
