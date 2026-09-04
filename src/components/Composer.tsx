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
}

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
  }

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
      {interim && (
        <div aria-live="polite" className="dictation-preview">
          🎤 {interim}…
        </div>
      )}
    </div>
  )
}

export default Composer
