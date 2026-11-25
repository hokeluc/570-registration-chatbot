import { useState } from 'react'

// Rendered for ```email fenced blocks. The bot never sends email. The student copies it.
export default function EmailDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="email-draft">
      <div className="email-head">
        <span>Email draft</span>
        <button className="btn small" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <pre>{text}</pre>
    </div>
  )
}
