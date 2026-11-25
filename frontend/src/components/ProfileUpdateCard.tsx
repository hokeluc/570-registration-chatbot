import type { ProfileUpdate } from '../api/types'

export type UpdateStatus = 'pending' | 'accepted' | 'rejected'

const FIELD_LABELS: Record<string, string> = {
  completed_courses: 'completed courses',
  majors: 'majors',
  minors: 'minors',
  track: 'track',
  catalog_year: 'catalog year',
  grad_year: 'graduation year',
  entry_term: 'entry term',
}

function describe(u: ProfileUpdate) {
  const field = FIELD_LABELS[u.field] ?? u.field
  if (u.op === 'add') return <>Add <strong>{u.value}</strong> to your {field}</>
  if (u.op === 'remove') return <>Remove <strong>{u.value}</strong> from your {field}</>
  return <>Set your {field} to <strong>{u.value}</strong></>
}

interface Props {
  update: ProfileUpdate
  status: UpdateStatus
  onDecide: (s: 'accepted' | 'rejected') => void
}

// The agent can only *suggest* profile changes. The student must confirm (proposal, Fig. 2).
export default function ProfileUpdateCard({ update, status, onDecide }: Props) {
  return (
    <div className={`update-card ${status}`}>
      <div>
        <div className="update-title">Update your profile?</div>
        <div>{describe(update)}</div>
        <div className="muted small">{update.reason}</div>
      </div>
      {status === 'pending' ? (
        <div className="update-actions">
          <button className="btn primary small" onClick={() => onDecide('accepted')}>
            Accept
          </button>
          <button className="btn ghost small" onClick={() => onDecide('rejected')}>
            No thanks
          </button>
        </div>
      ) : (
        <span className="update-status">{status === 'accepted' ? 'Added ✓' : 'Skipped'}</span>
      )}
    </div>
  )
}
