import { FALLBACK_OPTIONS } from './fallbackOptions'
import { mockChat } from './mock'
import type { ChatRequest, ChatResponse, OptionsResponse } from './types'

// Mock is ON unless VITE_USE_MOCK=false (set it in frontend/.env.local once Flask is up).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  if (USE_MOCK) return mockChat(req)
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  // Tolerate a backend that omits optional arrays.
  const data = (await res.json()) as Partial<ChatResponse>
  return {
    reply: data.reply ?? '',
    citations: data.citations ?? [],
    profile_updates: data.profile_updates ?? [],
    warnings: data.warnings ?? [],
  }
}

export async function fetchOptions(): Promise<OptionsResponse> {
  if (USE_MOCK) return FALLBACK_OPTIONS
  try {
    const res = await fetch(`${API_BASE}/options`)
    if (!res.ok) throw new Error()
    return (await res.json()) as OptionsResponse
  } catch {
    return FALLBACK_OPTIONS
  }
}
