import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { OutgoingAttachment } from '../App'
import FileUploadButton from './FileUploadButton'
import MicrophoneRecorder from './MicrophoneRecorder'

/**
 * A form option chosen by clicking a chip. The nonce changes on every click so
 * the same value can be staged twice in a row; the text alone would not
 * re-trigger the effect.
 */
export interface StagedOption {
  text: string
  nonce: number
}

interface ComposerProps {
  onSend: (content: string, attachments: OutgoingAttachment[]) => void
  pending: boolean
  patientName?: string
  stagedOption?: StagedOption | null
}

function Composer({ onSend, pending, patientName, stagedOption }: ComposerProps) {
  const [content, setContent] = useState('')
  const [interim, setInterim] = useState('')
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Seeded with the nonce present at mount so a stale selection is not
  // replayed into a freshly keyed composer when the conversation changes.
  const lastStagedNonce = useRef(stagedOption?.nonce ?? 0)
  const isEmpty = content.trim().length === 0 && attachments.length === 0

  const submit = () => {
    if (pending || isEmpty) {
      return
    }

    const text =
      content.trim().length > 0
        ? content
        : 'Please review the attached file(s).'
    onSend(text, attachments)
    setContent('')
    setAttachments([])
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

  // A clicked chip is staged into the box rather than sent, so a qualifier can
  // be added before sending and a misclick stays recoverable.
  useEffect(() => {
    if (!stagedOption || stagedOption.nonce === lastStagedNonce.current) {
      return
    }
    lastStagedNonce.current = stagedOption.nonce

    setContent((current) => {
      if (current.length === 0) {
        return stagedOption.text
      }
      // Respect a trailing space the practitioner typed deliberately; comma
      // otherwise, so consecutive chips read as "Extrinsic, Varus".
      return /\s$/.test(current)
        ? `${current}${stagedOption.text}`
        : `${current}, ${stagedOption.text}`
    })

    textareaRef.current?.focus()
  }, [stagedOption])

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
          placeholder="Enter consultation notes or a question"
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
