import type { SoapNote } from '../App'

interface SoapReviewProps {
  soapNote: SoapNote
  approved: boolean
  onUpdate: (field: keyof SoapNote, value: string) => void
  onApprove: () => void
  onContinue: () => void
}

const SOAP_FIELDS: { key: keyof SoapNote; label: string }[] = [
  { key: 'subjective', label: 'S — Subjective' },
  { key: 'objective', label: 'O — Objective' },
  { key: 'assessment', label: 'A — Assessment' },
  { key: 'plan', label: 'P — Plan' },
]

export default function SoapReview({
  soapNote,
  approved,
  onUpdate,
  onApprove,
  onContinue,
}: SoapReviewProps) {
  return (
    <section className="workflow-panel soap-review">
      <div className="workflow-title-row">
        <div>
          <p className="workflow-kicker">Clinical documentation</p>
          <h2>SOAP Note Review</h2>
          <p>Review and edit every field before practitioner approval.</p>
        </div>
        {approved ? (
          <div className="approval-actions">
            <span className="approved-badge">✓ SOAP approved</span>
            <button className="workflow-primary small" onClick={onContinue} type="button">
              Continue to documents
            </button>
          </div>
        ) : (
          <button className="workflow-primary" onClick={onApprove} type="button">
            ✓ Approve &amp; unlock documents
          </button>
        )}
      </div>

      <div className="review-warning">
        <strong>Practitioner review required.</strong> AI-generated content is a
        documentation aid. Final clinical decisions remain with the licensed practitioner.
      </div>

      <div className="soap-grid">
        {SOAP_FIELDS.map((field) => (
          <label key={field.key}>
            {field.label}
            <textarea
              disabled={approved}
              onChange={(event) => onUpdate(field.key, event.target.value)}
              rows={6}
              value={soapNote[field.key]}
            />
          </label>
        ))}
      </div>

      <div className="decision-review-card">
        <p className="decision-review-title">Practitioner confirmation required</p>
        <div className="soap-grid">
          <label>
            Diagnosis wording
            <textarea
              disabled={approved}
              onChange={(event) => onUpdate('diagnosis', event.target.value)}
              rows={4}
              value={soapNote.diagnosis}
            />
          </label>
          <label>
            Orthotic prescription wording
            <textarea
              disabled={approved}
              onChange={(event) =>
                onUpdate('prescription_suggestion', event.target.value)
              }
              rows={4}
              value={soapNote.prescription_suggestion}
            />
          </label>
        </div>
      </div>
    </section>
  )
}
