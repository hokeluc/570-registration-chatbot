import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { ProfileUpdate, StudentProfile } from '../api/types'

// Profile lives only for this browser tab (sessionStorage), per the proposal's
// privacy plan: no accounts, nothing kept after the tab closes.
const KEY = 'mines-helper-profile'

function load(): StudentProfile | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StudentProfile) : null
  } catch {
    return null
  }
}

function save(p: StudentProfile | null) {
  try {
    if (p) sessionStorage.setItem(KEY, JSON.stringify(p))
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: state still works in memory */
  }
}

const LIST_FIELDS = ['completed_courses', 'majors', 'minors'] as const

function applyProfileUpdate(p: StudentProfile, u: ProfileUpdate): StudentProfile {
  if ((LIST_FIELDS as readonly string[]).includes(u.field)) {
    const key = u.field as (typeof LIST_FIELDS)[number]
    const value = String(u.value)
    const current = p[key]
    if (u.op === 'add') return current.includes(value) ? p : { ...p, [key]: [...current, value] }
    if (u.op === 'remove') return { ...p, [key]: current.filter((v) => v !== value) }
    return { ...p, [key]: [value] }
  }
  if (u.field === 'grad_year') return { ...p, grad_year: Number(u.value) }
  return { ...p, [u.field]: u.op === 'remove' ? undefined : String(u.value) }
}

interface Ctx {
  profile: StudentProfile | null
  setProfile: (p: StudentProfile | null) => void
  applyUpdate: (u: ProfileUpdate) => void
}

const ProfileContext = createContext<Ctx | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setState] = useState<StudentProfile | null>(load)

  const setProfile = useCallback((p: StudentProfile | null) => {
    save(p)
    setState(p)
  }, [])

  const applyUpdate = useCallback((u: ProfileUpdate) => {
    setState((prev) => {
      if (!prev) return prev
      const next = applyProfileUpdate(prev, u)
      save(next)
      return next
    })
  }, [])

  return <ProfileContext.Provider value={{ profile, setProfile, applyUpdate }}>{children}</ProfileContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
