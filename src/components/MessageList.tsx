import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
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
   * Called when an option is chosen or a value typed. The answer is staged in
   * the composer rather than sent, so several can be gathered and edited
   * before sending. When omitted, chips and boxes are not rendered at all.
   */
  onSelectOption?: (selection: OptionSelection) => void
  /** Answers already staged, keyed by label, so chosen chips read as chosen. */
  selectedOptions?: Record<string, string>
}

/**
 * A small box beside a question that wants a written value — degrees,
 * millimetres. Commits on Enter or on leaving the box, and stages the answer
 * the same way a chip does, so it lands as a labelled pill and never sends on
 * its own.
 */
function InlineValue({
  label,
  unit,
  staged,
  onCommit,
}: {
  label: string
  unit?: string
  staged?: string
  onCommit: (value: string) => void
}) {
  const [value, setValue] = useState(staged ?? '')

  // A pill removed above the box should clear the box too, otherwise the two
  // disagree about what has been answered.
  useEffect(() => {
    setValue(staged ?? '')
  }, [staged])

  const commit = () => {
    const trimmed = value.trim()
    // Only fire on a real change, so re-committing the same value cannot
    // toggle the staged answer back off.
    if (trimmed.length > 0 && trimmed !== staged) {
      onCommit(trimmed)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  return (
    <span className="option-input-wrap">
      <input
        aria-label={label}
        className={`option-input${staged ? ' filled' : ''}`}
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={unit ?? ''}
        type="text"
        value={value}
      />
    </span>
  )
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

        // Assistant replies may carry markers. Strip them from the text either
        // way; only the newest settled reply gets controls, so an older
        // message's options cannot be answered out of context.
        const segments =
          message.role === 'assistant'
            ? parseAssistantMessage(message.content)
            : [{ text: message.content, options: [] as string[] }]

        const controlsAllowed =
          Boolean(onSelectOption) &&
          message.role === 'assistant' &&
          isLast &&
          !isLive &&
          !pending

        const hasAnyControls =
          controlsAllowed &&
          segments.some(
            (segment) => segment.options.length > 0 || Boolean(segment.input),
          )

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
                const chosen = segment.label
                  ? selectedOptions?.[segment.label.toLowerCase()]
                  : undefined
                const showChips = controlsAllowed && segment.options.length > 0
                const showInput =
                  controlsAllowed && Boolean(segment.input) && Boolean(segment.label)

                // The field name lives in the marker, so chips can always be
                // named even when the reply text does not repeat it — several
                // markers in a row otherwise render as anonymous buttons.
                // Checking the last line avoids saying the name twice.
                const lastLine = segment.text.split('\n').pop() ?? ''
                const needsLabel =
                  Boolean(segment.label) &&
                  !lastLine.toLowerCase().includes((segment.label ?? '').toLowerCase())

                return (
                  <span key={segmentIndex}>
                    {segment.text}
                    {(showChips || showInput) && needsLabel && (
                      <span className="option-group-label">{segment.label}</span>
                    )}
                    {showInput && segment.label && (
                      <InlineValue
                        key={`${index}-${segment.label}`}
                        label={segment.label}
                        onCommit={(value) =>
                          onSelectOption?.({ label: segment.label, value })
                        }
                        staged={chosen}
                        unit={segment.input?.unit}
                      />
                    )}
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
              {hasAnyControls && (
                <div className="option-chips-hint">
                  Answer here or in the message box — a typed value always wins.
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
