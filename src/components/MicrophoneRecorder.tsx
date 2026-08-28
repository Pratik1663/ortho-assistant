import { useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in TypeScript's DOM lib).
interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: ((event: { error?: string }) => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface MicrophoneRecorderProps {
  disabled: boolean
  onTranscript: (text: string) => void
}

// Voice dictation using the browser's built-in speech recognition.
// Only the transcribed text is used — no audio is saved or uploaded anywhere.
export default function MicrophoneRecorder({
  disabled,
  onTranscript,
}: MicrophoneRecorderProps) {
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const supported = getSpeechRecognition() !== null

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  if (!supported) {
    return null
  }

  const stop = () => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
  }

  const start = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      return
    }
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-CA'
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal && result[0]?.transcript) {
          onTranscript(result[0].transcript.trim())
        }
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setRecording(false)
    }
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        window.alert(
          'Microphone access was blocked. Allow microphone access in your browser to use dictation.',
        )
      }
      recognitionRef.current = null
      setRecording(false)
    }
    recognitionRef.current = recognition
    recognition.start()
    setRecording(true)
  }

  return (
    <button
      aria-label={recording ? 'Stop dictation' : 'Start dictation'}
      aria-pressed={recording}
      className={`composer-tool-btn mic-btn ${recording ? 'recording' : ''}`}
      disabled={disabled}
      onClick={recording ? stop : start}
      title={recording ? 'Stop dictation' : 'Dictate with your voice'}
      type="button"
    >
      {recording ? '⏹' : '🎤'}
    </button>
  )
}
