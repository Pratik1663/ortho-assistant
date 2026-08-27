import { useState } from 'react'
import type { ClinicalDocument, DocumentKey } from '../App'

interface DispensingViewProps {
  documents: Partial<Record<DocumentKey, ClinicalDocument>>
  pending: boolean
  onGenerate: (keys: DocumentKey[]) => void
  onApprove: (key: DocumentKey) => void
}

const DOCUMENT_OPTIONS: {
  key: DocumentKey
  label: string
  icon: string
  description: string
}[] = [
  {
    key: 'diagnosis',
    label: 'Diagnosis Letter',
    icon: 'DL',
    description: 'Formal document for practitioner review',
  },
  {
    key: 'prescription',
    label: 'Orthotic Prescription',
    icon: 'RX',
    description: 'Prescription wording and device specifications',
  },
  {
    key: 'summary',
    label: 'Patient Summary Letter',
    icon: 'PS',
    description: 'Clinical summary for the patient file',
  },
  {
    key: 'insurance',
    label: 'Insurance Support Letter',
    icon: 'IS',
    description: 'Supporting documentation for benefit submission',
  },
]

export default function DispensingView({
  documents,
  pending,
  onGenerate,
  onApprove,
}: DispensingViewProps) {
  const [selected, setSelected] = useState<Record<DocumentKey, boolean>>({
    diagnosis: true,
    prescription: true,
    summary: false,
    insurance: false,
  })
  const [expanded, setExpanded] = useState<DocumentKey | null>(null)

  const selectedKeys = DOCUMENT_OPTIONS.filter((item) => selected[item.key]).map(
    (item) => item.key,
  )

  const generate = () => {
    onGenerate(selectedKeys)
    if (selectedKeys.length > 0) {
      setExpanded(selectedKeys[0])
    }
  }

  return (
    <section className="workflow-panel dispensing-view">
      <div className="workflow-title-row">
        <div>
          <p className="workflow-kicker">Final workflow step</p>
          <h2>Dispensing Documents</h2>
          <p>Select documents, generate drafts, then review and approve each one.</p>
        </div>
      </div>

      <div className="document-option-grid">
        {DOCUMENT_OPTIONS.map((item) => (
          <label
            className={`document-option ${selected[item.key] ? 'selected' : ''}`}
            key={item.key}
          >
            <input
              checked={selected[item.key]}
              onChange={(event) =>
                setSelected((current) => ({
                  ...current,
                  [item.key]: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span className="document-icon" aria-hidden="true">{item.icon}</span>
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </label>
        ))}
      </div>

      <button
        className="workflow-primary generate-documents"
        disabled={pending || selectedKeys.length === 0}
        onClick={generate}
        type="button"
      >
        {pending ? 'Generating documents…' : 'Generate selected documents'}
      </button>

      <div className="document-results">
        {DOCUMENT_OPTIONS.flatMap((item) => {
          const document = documents[item.key]
          if (!document) {
            return []
          }
          const isOpen = expanded === item.key
          return [
            <article
              className={`document-result ${document.approved ? 'approved' : ''}`}
              key={item.key}
            >
              <button
                className="document-result-header"
                onClick={() => setExpanded(isOpen ? null : item.key)}
                type="button"
              >
                <span className="document-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {document.approved && <span className="approved-badge">✓ Approved</span>}
                <span className="document-chevron" aria-hidden="true">
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>
              {isOpen && (
                <div className="document-result-body">
                  <pre>{document.content}</pre>
                  {document.approved ? (
                    <p className="document-approved-copy">✓ Document finalized</p>
                  ) : (
                    <button
                      className="workflow-primary small"
                      onClick={() => onApprove(item.key)}
                      type="button"
                    >
                      ✓ Approve &amp; finalize
                    </button>
                  )}
                </div>
              )}
            </article>,
          ]
        })}
      </div>
    </section>
  )
}
