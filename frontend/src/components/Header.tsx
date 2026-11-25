import { USE_MOCK } from '../api/client'
import type { StudentProfile } from '../api/types'

interface Props {
  profile: StudentProfile | null
  onEdit: () => void
  onReset: () => void
}

export default function Header({ profile, onEdit, onReset }: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-title">Mines Registration Helper</span>
        <span className="badge">Unofficial</span>
        {USE_MOCK && <span className="badge mock" title="Responses are fake until the Flask backend is connected">Demo data</span>}
      </div>
      {profile && (
        <div className="profile-chip">
          <span className="profile-summary">
            {profile.majors.join(' + ')}
            {profile.track ? ` · ${profile.track}` : ''} · Catalog {profile.catalog_year}
          </span>
          <button className="btn link light" onClick={onEdit}>
            Edit profile
          </button>
          <button className="btn link light" onClick={onReset}>
            Start over
          </button>
        </div>
      )}
    </header>
  )
}
