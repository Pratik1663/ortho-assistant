import { useState, type KeyboardEvent } from 'react'
import type { OutgoingAttachment } from '../App'
import FileUploadButton from './FileUploadButton'
import MicrophoneRecorder from './MicrophoneRecorder'

interface ComposerProps {
  onSend: (content: string, attachments: OutgoingAttachment[]) => void
  pending: boolean
  patientName?: string
}

function Composer({ onSend, pending, patientName }: ComposerProps) {
  const [content, setContent] = useState('')
  const [attachments, setAttachments] = useState<OutgoingAttachment[]>([])
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
            <span className="attachment-chip" key={`${attachment.name}-${index}`}>
              <span className="attachment-chip-icon" aria-hidden="true">
                {attachment.mediaType === 'application/pdf' ? '📄' : '🖼️'}
              </span>
              {attachment.name}
              <button
                aria-label={`Remove ${attachment.name}`}
                className="attachment-remove"
                disabled={pending}
                onClick={() => removeAttachment(index)}
                type="button"
              >
                ×
              </button>
            </span>
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
          <MicrophoneRecorder disabled={pending} onTranscript={appendTranscript} />
        </div>
        <textarea
          aria-label="Message"
          disabled={pending}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter consultation notes or a question"
          rows={3}
          value={content}
        />
        <button disabled={pending || isEmpty} onClick={submit} type="button">
          Send
        </button>
      </div>
    </div>
  )
}

export default Composer
