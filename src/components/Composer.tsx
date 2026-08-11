import { useState, type KeyboardEvent } from 'react'

interface ComposerProps {
  onSend: (content: string) => void
  pending: boolean
}

function Composer({ onSend, pending }: ComposerProps) {
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
    <div className="composer">
      <textarea
        aria-label="Message"
        disabled={pending}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message"
        rows={3}
        value={content}
      />
      <button disabled={pending || isEmpty} onClick={submit} type="button">
        Send
      </button>
    </div>
  )
}

export default Composer
