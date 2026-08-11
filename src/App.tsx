import { useEffect, useRef, useState } from 'react'
import Composer from './components/Composer'
import Header from './components/Header'
import MessageList from './components/MessageList'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const responseTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (responseTimer.current !== null) {
        window.clearTimeout(responseTimer.current)
      }
    }
  }, [])

  const handleSend = (content: string) => {
    if (pending || content.trim().length === 0) {
      return
    }

    setMessages((current) => [...current, { role: 'user', content }])
    setPending(true)

    responseTimer.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: 'SAMPLE RESPONSE' },
      ])
      setPending(false)
      responseTimer.current = null
    }, 600)
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="chat-panel" aria-label="Conversation">
        <MessageList messages={messages} pending={pending} />
        <Composer onSend={handleSend} pending={pending} />
      </main>
    </div>
  )
}

export default App
