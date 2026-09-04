import { useEffect, useRef } from 'react'
import type { Message } from '../App'
import { parseAssistantMessage } from '../formOptions'

export interface OptionSelection {
  /** Which field this answers, when the marker named one. */
  label?: string
  value: string
}

interface MessageListProps {
  messages: Message[]
  pending: boolean
  /**
   * Called when an option is chosen. The answer is staged in the composer
   * rather than sent, so several can be gathered and edited before sending.
   * When omitted, chips are not rendered at all.
   */
  onSelectOption?: (selection: OptionSelection) => void
  /** Answers already staged, keyed by label, so chosen chips read as chosen. */
  selectedOptions?: Record<string, string>
}

function MessageList({
  messages,
  pending,
  onSelectOption,
  selectedOptions,
}: MessageListProps) {
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

        // Assistant replies may carry option markers. Strip them from the text
        // either way; only the newest settled reply gets chips, so an older
        // message's options cannot be clicked out of context.
        const segments =
          message.role === 'assistant'
            ? parseAssistantMessage(message.content)
            : [{ text: message.content, options: [] as string[] }]

        const chipsAllowed =
          Boolean(onSelectOption) &&
          message.role === 'assistant' &&
          isLast &&
          !isLive &&
          !pending

        const hasAnyChips =
          chipsAllowed && segments.some((segment) => segment.options.length > 0)

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
              {segments.map((segment, segmentIndex) => {
                const showChips = chipsAllowed && segment.options.length > 0
                const chosen = segment.label
                  ? selectedOptions?.[segment.label.toLowerCase()]
                  : undefined

                return (
                  <span key={segmentIndex}>
                    {segment.text}
                    {showChips && (
                      <span
                        className="option-chips"
                        role="group"
                        aria-label={segment.label ?? 'Options'}
                      >
                        {segment.options.map((option) => (
                          <button
                            className={`option-chip${chosen === option ? ' chosen' : ''}`}
                            key={option}
                            onClick={() =>
                              onSelectOption?.({ label: segment.label, value: option })
                            }
                            type="button"
                          >
                            {option}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                )
              })}
              {isLive && <span className="stream-caret" aria-hidden="true" />}
              {hasAnyChips && (
                <div className="option-chips-hint">
                  Click to answer, or type instead — a typed value always wins.
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
