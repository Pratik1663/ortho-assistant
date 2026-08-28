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
  onInterim?: (text: string) => void
}

// Voice dictation using the browser's built-in speech recognition.
// Only the transcribed text is used — no audio is saved or uploaded anywhere.
export default function MicrophoneRecorder({
  disabled,
  onTranscript,
  onInterim,
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
    onInterim?.('')
  }

  const start = () => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) {
      return
    }
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    // Use the browser's default language — setting an explicit locale makes
    // some browsers (notably Edge) fail silently with language-not-supported.
    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal && transcript.trim()) {
          onTranscript(transcript.trim())
        } else if (transcript) {
          interim += transcript
        }
      }
      onInterim?.(interim.trim())
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setRecording(false)
      onInterim?.('')
    }
    recognition.onerror = (event) => {
      const error = event.error ?? ''
      if (error === 'not-allowed' || error === 'service-not-allowed') {
        window.alert(
          'Microphone access was blocked. Click the padlock/mic icon in the address bar and allow the microphone, then try again.',
        )
      } else if (error === 'language-not-supported') {
        window.alert(
          "This browser doesn't support dictation for your language. Chrome works best for dictation.",
        )
      } else if (error === 'network') {
        window.alert(
          'The speech service could not be reached. Check your internet connection and try again.',
        )
      } else if (error !== 'no-speech' && error !== 'aborted') {
        window.alert(`Dictation stopped (${error || 'unknown error'}). Please try again.`)
      }
      recognitionRef.current = null
      setRecording(false)
      onInterim?.('')
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
