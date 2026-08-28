import { useState } from 'react'
import type { ClinicalDocument, DocumentKey } from '../App'

interface DispensingViewProps {
  documents: Partial<Record<DocumentKey, ClinicalDocument>>
  pending: boolean
  onGenerate: (keys: DocumentKey[]) => void
  onApprove: (key: DocumentKey) => void
  templateNames?: Partial<Record<DocumentKey, string>>
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Opens the browser's print dialog with only the document text, so the
// practitioner can choose "Save as PDF". A hidden iframe is used rather than
// window.open so popup blockers don't interfere.
function printDocument(label: string, content: string) {
  const today = new Date().toISOString().slice(0, 10)
  // The <title> becomes the default filename in the Save as PDF dialog.
  const title = `${label} - ${today}`

  const frame = window.document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  window.document.body.appendChild(frame)

  const frameDocument = frame.contentWindow?.document
  if (!frameDocument) {
    window.document.body.removeChild(frame)
    return
  }

  frameDocument.open()
  frameDocument.write(
    [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8">',
      `<title>${escapeHtml(title)}</title>`,
      '<style>',
      '@page { margin: 20mm; }',
      'body { margin: 0; }',
      'pre {',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;',
      '  font-size: 11pt;',
      '  line-height: 1.5;',
      '  white-space: pre-wrap;',
      '  word-wrap: break-word;',
      '  margin: 0;',
      '}',
      '</style>',
      '</head><body>',
      `<pre>${escapeHtml(content)}</pre>`,
      '</body></html>',
    ].join('\n'),
  )
  frameDocument.close()

  const frameWindow = frame.contentWindow
  if (!frameWindow) {
    window.document.body.removeChild(frame)
    return
  }

  // Give the iframe a tick to lay out before printing, then clean up.
  window.setTimeout(() => {
    frameWindow.focus()
    frameWindow.print()
    window.setTimeout(() => {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame)
      }
    }, 1000)
  }, 100)
}

export default function DispensingView({
  documents,
  pending,
  onGenerate,
  onApprove,
  templateNames = {},
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
              {templateNames[item.key] && (
                <small className="template-indicator">
                  📄 Uses your template: {templateNames[item.key]}
                </small>
              )}
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
                    <div className="document-actions">
                      <p className="document-approved-copy">✓ Document finalized</p>
                      <button
                        className="workflow-primary small"
                        onClick={() => printDocument(item.label, document.content)}
                        type="button"
                      >
                        ⬇ Download PDF
                      </button>
                    </div>
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
