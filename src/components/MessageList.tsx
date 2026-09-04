import { useEffect, useRef } from 'react'
import type { Message } from '../App'
import { parseAssistantMessage } from '../formOptions'

interface MessageListProps {
  messages: Message[]
  pending: boolean
  /**
   * Called when a clickable option is chosen. The value is staged into the
   * composer rather than sent, so the practitioner can add a qualifier first.
   * When omitted, chips are not rendered at all.
   */
  onSelectOption?: (value: string) => void
}

function MessageList({ messages, pending, onSelectOption }: MessageListProps) {
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
        const isLast = index === visibleMessages.length - 1

        // Assistant replies may carry an options marker. Strip it from the
        // text either way; only the newest settled reply gets chips, so an
        // older message's options cannot be clicked out of context.
        const parsed =
          message.role === 'assistant'
            ? parseAssistantMessage(message.content)
            : { text: message.content, options: [] as string[] }

        const showOptions =
          Boolean(onSelectOption) &&
          message.role === 'assistant' &&
          isLast &&
          !isLive &&
          !pending &&
          parsed.options.length > 0

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
              {parsed.text}
              {isLive && <span className="stream-caret" aria-hidden="true" />}
              {showOptions && (
                <div className="option-chips" role="group" aria-label="Form options">
                  {parsed.options.map((option) => (
                    <button
                      className="option-chip"
                      key={option}
                      onClick={() => onSelectOption?.(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                  <span className="option-chips-hint">
                    or type your own — a typed value always wins
                  </span>
                </div>
              )}
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
