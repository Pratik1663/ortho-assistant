interface CaptureViewProps {
  capture: string
  disabled: boolean
  onUpdateCapture: (value: string) => void
  onContinue: () => void
}

// Stage 1 of the clinical pipeline. Holds the practitioner's own notes for
// this visit as raw text. Nothing is inferred from it here — Stage 2 will
// summarise it, and only an approved summary feeds anything downstream.
//
// Paste-only for now. Recorded-encounter capture is a separate build.
export default function CaptureView({
  capture,
  disabled,
  onUpdateCapture,
  onContinue,
}: CaptureViewProps) {
  const characters = capture.trim().length
  const hasContent = characters > 0

  return (
    <section className="workflow-panel capture-view">
      <div className="workflow-title-row">
        <div>
          <p className="workflow-kicker">Clinical documentation</p>
          <h2>Charting</h2>
          <p>
            Paste your notes from this visit, or type them here. This is the
            record of what happened — nothing is generated from it until you
            move on.
          </p>
        </div>
        {hasContent && (
          <button className="workflow-primary" onClick={onContinue} type="button">
            Continue to Ask LEOPA →
          </button>
        )}
      </div>

      <label className="capture-field">
        Visit notes
        <textarea
          disabled={disabled}
          onChange={(event) => onUpdateCapture(event.target.value)}
          placeholder="Paste or type your notes from this visit. Any format — full sentences, shorthand, or a dictated block."
          rows={18}
          value={capture}
        />
      </label>

      <div className="capture-footer">
        <span className="capture-count">
          {hasContent
            ? `${characters.toLocaleString()} character${characters === 1 ? '' : 's'} · saved automatically`
            : 'Nothing captured yet'}
        </span>
      </div>

      <p className="capture-notice">
        These notes are stored with the visit but are not yet used to generate
        the SOAP note — SOAP is still built from the Ask LEOPA conversation.
        Summary generation is the next stage to be built.
      </p>
    </section>
  )
}
