import { useEffect, useRef } from 'react'
import type { Message } from '../App'

interface MessageListProps {
  messages: Message[]
  pending: boolean
}

function MessageList({ messages, pending }: MessageListProps) {
  const newestMessageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    newestMessageRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  return (
    <div className="message-list" aria-live="polite" aria-busy={pending}>
      {messages.length === 0 && !pending && (
        <div className="conversation-empty">
          <p>Start the conversation when you are ready.</p>
        </div>
      )}
      {messages.map((message, index) => (
        <div className={`message-row ${message.role}`} key={index}>
          <div className="message-bubble">
            {Array.isArray(message.attachments) && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment, i) => (
                  <span className="attachment-chip static" key={`${attachment.name}-${i}`}>
                    <span aria-hidden="true">
                      {attachment.mediaType === 'application/pdf' ? '📄' : '🖼️'}
                    </span>
                    {attachment.name}
                  </span>
                ))}
              </div>
            )}
            {message.content}
          </div>
        </div>
      ))}
      {pending && (
        <div className="message-row assistant">
          <div className="message-bubble thinking" aria-label="Assistant is thinking">
            <span aria-hidden="true">…</span>
          </div>
        </div>
      )}
      <div ref={newestMessageRef} />
    </div>
  )
}

export default MessageList
