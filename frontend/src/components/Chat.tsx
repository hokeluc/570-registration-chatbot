import { useEffect, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react'
import { sendChat } from '../api/client'
import type { ChatTurn } from '../api/types'
import { useProfile } from '../context/ProfileContext'
import { detectPii, redactPii, type PiiFinding } from '../lib/privacy'
import MessageBubble, { type UIMessage } from './MessageBubble'
import PrivacyGuard from './PrivacyGuard'
import SuggestedPrompts from './SuggestedPrompts'

const HISTORY_LIMIT = 10 // "last k messages" sent as user context (proposal, Fig. 2)
let nextId = 0
const newId = () => `m${++nextId}`

interface Props {
  messages: UIMessage[]
  setMessages: Dispatch<SetStateAction<UIMessage[]>>
}

export default function Chat({ messages, setMessages }: Props) {
  const { profile, applyUpdate } = useProfile()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [findings, setFindings] = useState<PiiFinding[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  async function ask(history: UIMessage[]) {
    if (!profile) return
    setLoading(true)
    const turns: ChatTurn[] = history
      .filter((m) => !m.error)
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content }))
    try {
      const res = await sendChat({ profile, messages: turns })
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: res.reply,
          citations: res.citations,
          warnings: res.warnings,
          updates: res.profile_updates.map((update) => ({ update, status: 'pending' })),
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: `Sorry, I couldn’t reach the server. ${err instanceof Error ? err.message : ''}`,
          error: true,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function send(text: string, { skipCheck = false } = {}) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    if (!skipCheck) {
      const found = detectPii(trimmed)
      if (found.length) {
        setFindings(found) // hold the message until the student decides
        return
      }
    }
    setFindings([])
    const userMsg: UIMessage = { id: newId(), role: 'user', content: trimmed }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    void ask(history)
  }

  function retry() {
    const history = messages.filter((m) => !m.error)
    setMessages(history)
    void ask(history)
  }

  function decide(msgId: string, index: number, status: 'accepted' | 'rejected') {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.updates) return m
        const updates = m.updates.map((u, i) => (i === index ? { ...u, status } : u))
        return { ...m, updates }
      }),
    )
    const msg = messages.find((m) => m.id === msgId)
    const u = msg?.updates?.[index]
    if (status === 'accepted' && u && u.status === 'pending') applyUpdate(u.update)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const lastIsError = messages[messages.length - 1]?.error

  return (
    <main className="chat">
      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="welcome">
            <h1>Hi! What are you planning?</h1>
            <p className="muted">
              Ask about requirements, prerequisites, flowcharts, or advising. I’ll answer for the{' '}
              <strong>{profile?.catalog_year}</strong> catalog and cite where each answer came from.
            </p>
            <SuggestedPrompts onPick={send} />
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            onDecide={(idx, s) => decide(m.id, idx, s)}
            onRetry={i === messages.length - 1 && lastIsError ? retry : undefined}
          />
        ))}

        {loading && (
          <div className="msg assistant">
            <div className="bubble typing" aria-label="Thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {findings.length > 0 && (
        <div className="guard-wrap">
          <PrivacyGuard
            findings={findings}
            onRedact={() => send(redactPii(input), { skipCheck: true })}
            onEdit={() => {
              setFindings([])
              inputRef.current?.focus()
            }}
            onSendAnyway={() => send(input, { skipCheck: true })}
          />
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor="chat-input" className="sr-only">
          Ask a question
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (findings.length) setFindings([])
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask about courses, requirements, or advising…"
          autoFocus
        />
        <button type="submit" className="btn primary" disabled={!input.trim() || loading}>
          Send
        </button>
      </form>
    </main>
  )
}
