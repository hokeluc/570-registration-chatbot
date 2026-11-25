import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Citation, ProfileUpdate } from '../api/types'
import EmailDraft from './EmailDraft'
import ProfileUpdateCard, { type UpdateStatus } from './ProfileUpdateCard'

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  warnings?: string[]
  updates?: { update: ProfileUpdate; status: UpdateStatus }[]
  error?: boolean
}

const mdComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const text = String(children ?? '').replace(/\n$/, '')
    if (className?.includes('language-email')) return <EmailDraft text={text} />
    if (className || text.includes('\n'))
      return (
        <pre className="code-block">
          <code>{text}</code>
        </pre>
      )
    return <code>{children}</code>
  },
}

function formatDate(iso?: string) {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

interface Props {
  message: UIMessage
  onDecide?: (index: number, s: 'accepted' | 'rejected') => void
  onRetry?: () => void
}

export default function MessageBubble({ message, onDecide, onRetry }: Props) {
  if (message.role === 'user') {
    return (
      <div className="msg user">
        <div className="bubble">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="msg assistant">
      <div className={`bubble ${message.error ? 'error' : ''}`}>
        {message.warnings?.map((w) => (
          <div className="warning" role="note" key={w}>
            <span aria-hidden>⚠</span> {w}
          </div>
        ))}

        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {message.content}
          </ReactMarkdown>
        </div>

        {message.error && onRetry && (
          <button className="btn small" onClick={onRetry}>
            Try again
          </button>
        )}

        {!!message.citations?.length && (
          <div className="sources">
            <div className="sources-title">Sources</div>
            <ul>
              {message.citations.map((c) => {
                const updated = formatDate(c.last_updated)
                const accessed = formatDate(c.accessed)
                return (
                  <li key={c.url + c.title}>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {c.title || hostname(c.url)}
                    </a>
                    <span className="source-meta">
                      {hostname(c.url)}
                      {c.catalog_year && ` · Catalog ${c.catalog_year}`}
                      {updated ? ` · Updated ${updated}` : accessed ? ` · Retrieved ${accessed}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {message.updates?.map((u, i) => (
        <ProfileUpdateCard key={i} update={u.update} status={u.status} onDecide={(s) => onDecide?.(i, s)} />
      ))}
    </div>
  )
}
