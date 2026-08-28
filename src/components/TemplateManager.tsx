import { useRef, useState } from 'react'
import type { DoctorTemplate, DocumentKey, OutgoingAttachment } from '../App'

const DOCUMENT_TYPE_LABELS: Record<DocumentKey, string> = {
  diagnosis: 'Diagnosis Letter',
  prescription: 'Orthotic Prescription',
  summary: 'Patient Summary Letter',
  insurance: 'Insurance Support Letter',
}

const MAX_PDF_BYTES = 3 * 1024 * 1024

interface TemplateManagerProps {
  templates: DoctorTemplate[]
  pending: boolean
  onAdd: (documentType: DocumentKey, name: string, content: string) => void
  onDelete: (id: string) => void
  onExtractPdf: (
    documentType: DocumentKey,
    name: string,
    attachment: OutgoingAttachment,
  ) => void
  onClose: () => void
}

export default function TemplateManager({
  templates,
  pending,
  onAdd,
  onDelete,
  onExtractPdf,
  onClose,
}: TemplateManagerProps) {
  const [name, setName] = useState('')
  const [documentType, setDocumentType] = useState<DocumentKey>('prescription')
  const [pastedContent, setPastedContent] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const templateName = (fallback: string) =>
    name.trim().length > 0 ? name.trim() : fallback

  const resetForm = () => {
    setName('')
    setPastedContent('')
    setShowPaste(false)
  }

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) {
      return
    }
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.txt') || lower.endsWith('.md')) {
      const text = await file.text()
      if (text.trim().length === 0) {
        window.alert('That file appears to be empty.')
        return
      }
      onAdd(documentType, templateName(file.name), text)
      resetForm()
      return
    }
    if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
      if (file.size > MAX_PDF_BYTES) {
        window.alert('PDF templates must be under 3 MB.')
        return
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Read failed'))
        reader.readAsDataURL(file)
      })
      onExtractPdf(documentType, templateName(file.name), {
        name: file.name,
        mediaType: 'application/pdf',
        data: dataUrl.split(',')[1],
      })
      resetForm()
      return
    }
    window.alert('Templates can be uploaded as PDF, TXT, or MD files.')
  }

  const handlePasteSave = () => {
    if (pastedContent.trim().length === 0) {
      window.alert('Paste your template text first.')
      return
    }
    onAdd(documentType, templateName('Pasted template'), pastedContent)
    resetForm()
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        aria-labelledby="template-manager-title"
        className="modal template-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="doctor-header">
          <h2 id="template-manager-title">📄 My Document Templates</h2>
          <button className="btn-primary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <p className="template-intro">
          Upload your own blank forms. When you generate a document, your
          template for that type is filled in instead of the standard format.
        </p>

        <div className="template-add-form">
          <div className="form-group">
            <label htmlFor="template-doc-type">Document type</label>
            <select
              id="template-doc-type"
              onChange={(event) =>
                setDocumentType(event.target.value as DocumentKey)
              }
              value={documentType}
            >
              {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentKey[]).map((key) => (
                <option key={key} value={key}>
                  {DOCUMENT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="template-name">Template name (optional)</label>
            <input
              id="template-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Clinic letterhead Rx form"
              type="text"
              value={name}
            />
          </div>

          <div className="template-add-actions">
            <input
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              hidden
              onChange={(event) => {
                void handleFile(event.target.files)
                event.target.value = ''
              }}
              ref={fileInputRef}
              type="file"
            />
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {pending ? 'Reading PDF…' : '⬆ Upload file (PDF, TXT, MD)'}
            </button>
            <button
              className="btn-primary secondary"
              disabled={pending}
              onClick={() => setShowPaste(!showPaste)}
              type="button"
            >
              {showPaste ? 'Cancel paste' : '📋 Paste text instead'}
            </button>
          </div>

          {showPaste && (
            <div className="form-group">
              <textarea
                onChange={(event) => setPastedContent(event.target.value)}
                placeholder="Paste your blank template text here. Use blanks or placeholders like [PATIENT NAME] where data should go."
                rows={8}
                value={pastedContent}
              />
              <button
                className="btn-primary"
                disabled={pending}
                onClick={handlePasteSave}
                type="button"
              >
                Save pasted template
              </button>
            </div>
          )}
        </div>

        <div className="doctors-list">
          {templates.length === 0 ? (
            <p className="empty-state">
              No templates yet. Upload a blank form to get started.
            </p>
          ) : (
            templates.map((template) => (
              <div className="doctor-card" key={template.id}>
                <div className="doctor-info">
                  <h3>{template.name}</h3>
                  <p className="specialty">
                    {DOCUMENT_TYPE_LABELS[template.documentType]}
                  </p>
                  <p className="email">
                    Added {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (window.confirm(`Delete template "${template.name}"?`)) {
                      onDelete(template.id)
                    }
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
