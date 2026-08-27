import { useState } from 'react'
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

  const handleSend = async (content: string) => {
    if (pending || content.trim().length === 0) {
      return
    }

    const userMessage: Message = { role: 'user', content }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setPending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'API request failed')
      }

      const data = await response.json()
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.reply },
      ])
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
      ])
    } finally {
      setPending(false)
    }
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