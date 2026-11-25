import { useState } from 'react'
import Chat from './components/Chat'
import Disclaimer from './components/Disclaimer'
import Header from './components/Header'
import type { UIMessage } from './components/MessageBubble'
import Onboarding from './components/Onboarding'
import { useProfile } from './context/ProfileContext'

export default function App() {
  const { profile, setProfile } = useProfile()
  const [editing, setEditing] = useState(false)
  // Chat history is in memory only; it's gone on refresh (no conversation history is kept).
  const [messages, setMessages] = useState<UIMessage[]>([])

  function reset() {
    if (messages.length && !confirm('Start over? This clears your profile and the conversation.')) return
    setMessages([])
    setEditing(false)
    setProfile(null)
  }

  const showOnboarding = !profile || editing

  return (
    <div className="app">
      <Header profile={showOnboarding ? null : profile} onEdit={() => setEditing(true)} onReset={reset} />
      {showOnboarding ? (
        <Onboarding
          initial={profile}
          onCancel={profile ? () => setEditing(false) : undefined}
          onDone={(p) => {
            setProfile(p)
            setEditing(false)
          }}
        />
      ) : (
        <Chat messages={messages} setMessages={setMessages} />
      )}
      <Disclaimer />
    </div>
  )
}
