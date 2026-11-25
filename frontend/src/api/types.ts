// Mirrors docs/api-contract.md. If you change one, change the other.

export interface StudentProfile {
  entry_term: string // e.g. "Fall 2025"
  grad_year: number // expected graduation year, e.g. 2029
  catalog_year?: string // e.g. "2025-2026"; inferred from entry_term if not given
  majors: string[] // one, or two for a double major
  track?: string // track / focus area for the first major
  minors: string[]
  completed_courses: string[] // e.g. ["CSCI101", "MATH111"]
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  profile: StudentProfile
  messages: ChatTurn[] // most recent k turns, oldest first, ending with the new user message
}

export interface Citation {
  title: string
  url: string
  last_updated?: string // ISO date the page says it was modified
  accessed?: string // ISO date we scraped it
  catalog_year?: string
}

export type ProfileField = 'completed_courses' | 'majors' | 'minors' | 'track' | 'catalog_year' | 'grad_year' | 'entry_term'

export interface ProfileUpdate {
  field: ProfileField
  op: 'add' | 'remove' | 'set'
  value: string | number
  reason: string // shown to the student so they can decide
}

export interface ChatResponse {
  reply: string // markdown; an advisor email goes in a ```email fenced block
  citations: Citation[]
  profile_updates: ProfileUpdate[]
  warnings?: string[] // e.g. "Sources disagree on ..." or "This is a guess"
}

export interface MajorOption {
  id: string
  name: string
  tracks: string[]
}

export interface OptionsResponse {
  majors: MajorOption[]
  minors: string[]
  catalog_years: string[]
}
