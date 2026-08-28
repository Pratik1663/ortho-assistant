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

  const lastMessage = messages[messages.length - 1]
  const isStreaming = pending && lastMessage?.role === 'assistant'
  // While the reply is streaming the last bubble is the reply itself, so the
  // placeholder dots only show before the first characters arrive.
  const awaitingFirstToken = isStreaming && lastMessage.content.length === 0
  const visibleMessages = awaitingFirstToken ? messages.slice(0, -1) : messages
  const showThinking = pending && (!isStreaming || awaitingFirstToken)

  return (
    <div className="message-list" aria-live="polite" aria-busy={pending}>
      {visibleMessages.length === 0 && !pending && (
        <div className="conversation-empty">
          <p>Start the conversation when you are ready.</p>
        </div>
      )}
      {visibleMessages.map((message, index) => {
        const isLive =
          isStreaming && !awaitingFirstToken && index === visibleMessages.length - 1
        return (
          <div className={`message-row ${message.role}`} key={index}>
            <div className={`message-bubble${isLive ? ' streaming' : ''}`}>
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
              {isLive && <span className="stream-caret" aria-hidden="true" />}
            </div>
          </div>
        )
      })}
      {showThinking && (
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
