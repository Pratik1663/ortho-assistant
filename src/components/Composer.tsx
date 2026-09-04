import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { OutgoingAttachment } from '../App'
import FileUploadButton from './FileUploadButton'
import MicrophoneRecorder from './MicrophoneRecorder'

/**
 * An answer chosen by clicking a chip. The nonce changes on every click so the
 * same value can be staged twice in a row; the value alone would not
 * re-trigger the effect.
 */
export interface StagedOption {
  label?: string
  value: string
  nonce: number
  /** Set when the reply asked one thing, so the answer can send itself. */
  autoSend?: boolean
}

/** How long the practitioner has to call back an auto-sent answer. */
const AUTO_SEND_DELAY_MS = 1200

interface StagedAnswer {
  label?: string
  value: string
}

interface ComposerProps {
  onSend: (content: string, attachments: OutgoingAttachment[]) => void
  pending: boolean
  patientName?: string
  stagedOption?: StagedOption | null
  /** Lets the parent show which chips are already chosen. */
  onStagedChange?: (answers: Record<string, string>) => void
}

function Composer({
  onSend,
  pending,
  patientName,
  stagedOption,
  onStagedChange,
}: ComposerProps) {
  const [content, setContent] = useState('')
  const [interim, setInterim] = useState('')
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([])
  // Clicked answers are held as removable pills rather than injected into the
  // textarea. Five answers pasted into one sentence read ambiguously, and raw
  // text cannot be un-clicked without editing by hand.
  const [staged, setStaged] = useState<StagedAnswer[]>([])
  // Holds the answer that is about to send itself, so the strip can name it
  // and the practitioner can stop it.
  const [autoSending, setAutoSending] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Seeded with the nonce present at mount so a stale selection is not
  // replayed into a freshly keyed composer when the conversation changes.
  const lastStagedNonce = useRef(stagedOption?.nonce ?? 0)
  const isEmpty =
    content.trim().length === 0 && attachments.length === 0 && staged.length === 0

  useEffect(() => {
    if (!onStagedChange) {
      return
    }
    const map: Record<string, string> = {}
    for (const answer of staged) {
      if (answer.label) {
        map[answer.label.toLowerCase()] = answer.value
      }
    }
    onStagedChange(map)
  }, [staged, onStagedChange])

  const composeMessage = () => {
    const answered = staged
      .map((answer) => (answer.label ? `${answer.label}: ${answer.value}` : answer.value))
      .join('\n')
    const typed = content.trim()

    if (answered && typed) {
      return `${answered}\n${typed}`
    }
    return answered || typed
  }

  const submit = () => {
    if (pending || isEmpty) {
      return
    }

    const composed = composeMessage()
    const text = composed.length > 0 ? composed : 'Please review the attached file(s).'
    setAutoSending(null)
    onSend(text, attachments)
    setContent('')
    setAttachments([])
    setStaged([])
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const appendTranscript = (text: string) => {
    setContent((current) =>
      current.trim().length > 0 ? `${current.trimEnd()} ${text}` : text,
    )
  }

  // Clicking a chip stages an answer instead of sending it, so a misclick is
  // recoverable and several questions can be answered in one message.
  useEffect(() => {
    if (!stagedOption || stagedOption.nonce === lastStagedNonce.current) {
      return
    }
    lastStagedNonce.current = stagedOption.nonce
    const { label, value } = stagedOption

    // Clicking a second answer means they are still working, so an armed
    // send is called off rather than racing them.
    setAutoSending((current) => {
      if (current !== null) {
        return null
      }
      return stagedOption.autoSend && content.trim().length === 0 ? value : null
    })

    setStaged((current) => {
      // Changing your mind on the same field replaces the answer rather than
      // adding a second one, so the lab never sees two values for one field.
      if (label) {
        const existing = current.findIndex(
          (answer) => answer.label?.toLowerCase() === label.toLowerCase(),
        )
        if (existing >= 0) {
          if (current[existing].value === value) {
            return current.filter((_, i) => i !== existing)
          }
          const next = [...current]
          next[existing] = { label, value }
          return next
        }
        return [...current, { label, value }]
      }

      return current.some((answer) => !answer.label && answer.value === value)
        ? current
        : [...current, { value }]
    })
  }, [stagedOption])

  const removeStaged = (index: number) => {
    setStaged((current) => current.filter((_, i) => i !== index))
    setAutoSending(null)
  }

  // The countdown lives here rather than in the click handler so that any
  // re-render which cancels it also clears the timer.
  useEffect(() => {
    if (autoSending === null || pending) {
      return
    }
    const timer = window.setTimeout(() => {
      submit()
    }, AUTO_SEND_DELAY_MS)
    return () => window.clearTimeout(timer)
    // submit is intentionally not a dependency; re-arming on every keystroke
    // would restart the countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSending, pending, staged])

  useEffect(() => {
    if (autoSending === null) {
      return
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAutoSending(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [autoSending])

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, i) => i !== index))
  }

  return (
    <div className="composer-wrapper">
      {patientName && (
        <div className="composer-patient" aria-label={`Consulting for ${patientName}`}>
          <span>Consulting for</span>
          <strong>{patientName}</strong>
        </div>
      )}
      {staged.length > 0 && (
        <div className="staged-answers" aria-label="Answers ready to send">
          {staged.map((answer, index) => (
            <span className="staged-answer" key={`${answer.label ?? ''}-${answer.value}`}>
              {answer.label && <span className="staged-answer-label">{answer.label}</span>}
              <span className="staged-answer-value">{answer.value}</span>
              <button
                aria-label={`Remove ${answer.label ? `${answer.label} ` : ''}${answer.value}`}
                className="staged-answer-x"
                disabled={pending}
                onClick={() => removeStaged(index)}
                type="button"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="attachment-previews">
          {attachments.map((attachment, index) => (
            <div className="attachment-thumb" key={`${attachment.name}-${index}`}>
              {attachment.mediaType === 'application/pdf' ? (
                <div className="attachment-thumb-file" title={attachment.name}>
                  <span aria-hidden="true">📄</span>
                  <span className="attachment-thumb-name">{attachment.name}</span>
                </div>
              ) : (
                <img
                  alt={attachment.name}
                  src={`data:${attachment.mediaType};base64,${attachment.data}`}
                  title={attachment.name}
                />
              )}
              <button
                aria-label={`Remove ${attachment.name}`}
                className="attachment-x"
                disabled={pending}
                onClick={() => removeAttachment(index)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {autoSending !== null ? (
        <button
          className="auto-send-strip"
          onClick={() => setAutoSending(null)}
          type="button"
        >
          <span className="auto-send-text">
            Sending <strong>{autoSending}</strong>
          </span>
          <span className="auto-send-cancel">Cancel</span>
          <span className="auto-send-bar" aria-hidden="true" />
        </button>
      ) : (
        <div className="composer">
        <div className="composer-tools">
          <FileUploadButton
            attachmentCount={attachments.length}
            disabled={pending}
            onAdd={(attachment) =>
              setAttachments((current) => [...current, attachment])
            }
          />
          <MicrophoneRecorder
            disabled={pending}
            onInterim={setInterim}
            onTranscript={appendTranscript}
          />
        </div>
        <textarea
          aria-label="Message"
          disabled={pending}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            staged.length > 0
              ? 'Add degrees, millimetres or a note — or just send'
              : 'Enter consultation notes or a question'
          }
          ref={textareaRef}
          rows={3}
          value={content}
        />
        <button disabled={pending || isEmpty} onClick={submit} type="button">
          Send
        </button>
        </div>
      )}
      {interim && (
        <div aria-live="polite" className="dictation-preview">
          🎤 {interim}…
        </div>
      )}
    </div>
  )
}

export default Composer
