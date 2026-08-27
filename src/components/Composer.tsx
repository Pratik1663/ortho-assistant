import { useState, type KeyboardEvent } from 'react'

interface ComposerProps {
  onSend: (content: string) => void
  pending: boolean
  patientName?: string
}

function Composer({ onSend, pending, patientName }: ComposerProps) {
  const [content, setContent] = useState('')
  const isEmpty = content.trim().length === 0

  const submit = () => {
    if (pending || isEmpty) {
      return
    }

    onSend(content)
    setContent('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className="composer-wrapper">
      {patientName && (
        <div className="composer-patient" aria-label={`Consulting for ${patientName}`}>
          <span>Consulting for</span>
          <strong>{patientName}</strong>
        </div>
      )}
      <div className="composer">
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
