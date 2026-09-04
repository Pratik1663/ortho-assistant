import { useState } from 'react'
import type {
  DoctorTemplate,
  DocumentKey,
  Message,
  OutgoingAttachment,
  Patient,
  PatientConversation,
  PendingAction,
  SoapNote,
  WorkspaceTab,
} from '../App'
import type { Doctor } from './DoctorManagement'
import CaptureView from './CaptureView'
import Composer, { type StagedOption } from './Composer'
import DispensingView from './DispensingView'
import Header from './Header'
import MessageList, { type OptionSelection } from './MessageList'
import PrescriptionPanel, { type FieldEdit } from './PrescriptionPanel'
import { parsePrescriptionState } from '../prescriptionState'
import TemplateManager from './TemplateManager'
import SoapReview from './SoapReview'
import './DoctorView.css'

interface DoctorViewProps {
  patients: Patient[]
  selectedPatientId: string | null
  currentPatient: Patient | null
  currentConversation: PatientConversation | null
  quickMessages: Message[]
  isQuickQA: boolean
  pendingAction: PendingAction
  activeTab: WorkspaceTab
  errorMessage: string
  currentDoctor: Doctor
  onSelectPatient: (id: string) => void
  onSelectQuickQA: () => void
  onSend: (content: string, attachments: OutgoingAttachment[]) => void
  onUpdateCapture: (value: string) => void
  onGenerateCharting: () => void
  onUpdateCharting: (value: string) => void
  onApproveCharting: () => void
  onExportData: () => void
  onImportData: (file: File) => void
  saveError: string
  onNewConsultation: () => void
  onSelectConversation: (id: string) => void
  onSetActiveTab: (tab: WorkspaceTab) => void
  onGenerateSoap: () => void
  onUpdateSoap: (field: keyof SoapNote, value: string) => void
  onApproveSoap: () => void
  onGenerateDocuments: (keys: DocumentKey[]) => void
  onApproveDocument: (key: DocumentKey) => void
  onClearConversation: () => void
  onDoctorLogout: () => void
  templates: DoctorTemplate[]
  onAddTemplate: (documentType: DocumentKey, name: string, content: string) => void
  onDeleteTemplate: (id: string) => void
  onExtractTemplate: (
    documentType: DocumentKey,
    name: string,
    attachment: OutgoingAttachment,
  ) => void
}

const calculateAge = (dob: string) => {
  const [year, month, day] = dob.split('-').map(Number)
  if (!year || !month || !day) {
    return null
  }
  const today = new Date()
  let age = today.getFullYear() - year
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1
  }
  return Math.max(0, age)
}

// Consultations are stored newest-created-first, but they are labelled by
// the date charted, which can differ. Sorting by the same stamp the label
// shows keeps the dropdown in the order the reader expects.
const consultationOrder = (conversation: PatientConversation) =>
  conversation.chartedAt ?? conversation.createdAt

// Labelled by the date the patient was actually seen — the day charting
// happened — not the day the record was opened, which may be earlier if a
// receptionist created it in advance. Falls back to createdAt for visits
// that were never charted, and for records saved before chartedAt existed.
// Time is included because same-day repeat visits happen.
const formatConsultation = (conversation: PatientConversation) => {
  const stamp = conversation.chartedAt ?? conversation.createdAt
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) {
    return 'Undated consultation'
  }
  const formatted = date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return conversation.chartedAt ? formatted : `${formatted} (not charted)`
}

export default function DoctorView({
  patients,
  selectedPatientId,
  currentPatient,
  currentConversation,
  quickMessages,
  isQuickQA,
  pendingAction,
  activeTab,
  errorMessage,
  currentDoctor,
  onSelectPatient,
  onSelectQuickQA,
  onSend,
  onUpdateCapture,
  onGenerateCharting,
  onUpdateCharting,
  onApproveCharting,
  onExportData,
  onImportData,
  saveError,
  onNewConsultation,
  onSelectConversation,
  onSetActiveTab,
  onGenerateSoap,
  onUpdateSoap,
  onApproveSoap,
  onGenerateDocuments,
  onApproveDocument,
  onClearConversation,
  onDoctorLogout,
  templates,
  onAddTemplate,
  onDeleteTemplate,
  onExtractTemplate,
}: DoctorViewProps) {
  const pending = pendingAction !== null
  const sortedPatients = [...patients].sort((a, b) => a.name.localeCompare(b.name))
  const age = currentPatient ? calculateAge(currentPatient.dob) : null
  const patientMeta = currentPatient
    ? [
        age !== null ? `Age ${age}` : '',
        currentPatient.weight > 0 ? `${currentPatient.weight} lbs` : '',
        currentPatient.shoeSize ? `Shoe ${currentPatient.shoeSize}` : '',
        currentPatient.footwearType,
      ].filter(Boolean)
    : []

  const [showTemplates, setShowTemplates] = useState(false)

  // Clicking an option chip stages the value into the composer instead of
  // sending it, so a qualifier can be added first and a misclick is
  // recoverable. Only one composer is on screen at a time, so a single piece
  // of state serves both the quick Q&A and consultation panels.
  const [stagedOption, setStagedOption] = useState<StagedOption | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  // The newest reply that carried a prescription block wins. Walking backwards
  // rather than reading the last message means a reply without one — a
  // clarifying question, say — leaves the panel showing the last known build
  // instead of blanking it.
  const prescription = (() => {
    const messages = currentConversation?.messages ?? []
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role !== 'assistant') {
        continue
      }
      const parsed = parsePrescriptionState(messages[i].content)
      if (parsed) {
        return parsed
      }
    }
    return null
  })()

  // A change made in the panel is sent as an ordinary message, so LEOPA sees it
  // the same way as anything typed and the conversation stays the record.
  const handleFieldEdit = (edit: FieldEdit) => {
    const side = edit.side === 'R' ? ' on the right' : edit.side === 'L' ? ' on the left' : ''
    const message = edit.value
      ? `Change ${edit.label.toLowerCase()}${side} to ${edit.value}.`
      : `I want to change ${edit.label.toLowerCase()}${side}.`
    onSend(message, [])
  }

  const handleSelectOption = (selection: OptionSelection) => {
    setStagedOption({
      autoSend: selection.autoSend,
      label: selection.label,
      value: selection.value,
      nonce: Date.now(),
    })
  }

  // The warning names what is actually at risk. Clearing a visit that has
  // approved clinical work is a heavier action than clearing a chat thread,
  // so the message says so rather than leaving it generic.
  const confirmClear = (warnAboutSoap: boolean) => {
    if (!warnAboutSoap) {
      if (window.confirm('Clear this Quick Q&A conversation? This cannot be undone.')) {
        onClearConversation()
      }
      return
    }

    const approvedDocs = currentConversation
      ? Object.values(currentConversation.documents).filter((doc) => doc?.approved)
          .length
      : 0
    const soapApproved = currentConversation?.soapApproved ?? false

    const atRisk: string[] = ['the consultation messages']
    if (soapApproved) {
      atRisk.push('the APPROVED SOAP note')
    } else if (currentConversation?.soapNote) {
      atRisk.push('the SOAP draft')
    }
    if (approvedDocs > 0) {
      atRisk.push(
        `${approvedDocs} APPROVED document${approvedDocs === 1 ? '' : 's'}`,
      )
    } else if (
      currentConversation &&
      Object.keys(currentConversation.documents).length > 0
    ) {
      atRisk.push('the generated documents')
    }

    const heavy = soapApproved || approvedDocs > 0
    const message = [
      heavy
        ? 'This visit contains approved clinical work.'
        : 'Clear this visit?',
      '',
      `The following will be permanently removed: ${atRisk.join(', ')}.`,
      '',
      'Your charting notes will be kept.',
      '',
      'This cannot be undone. Continue?',
    ].join('\n')

    if (window.confirm(message)) {
      onClearConversation()
    }
  }

  const templateNames: Partial<Record<DocumentKey, string>> = {}
  for (const template of [...templates].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    templateNames[template.documentType] = template.name
  }

  return (
    <div className="doctor-view">
      <aside className="sidebar" aria-label="Patient list">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <img alt="LEO Lab" className="leo-sidebar-logo" src="/leo-logo.png" />
          </div>
          <div>
            <strong>LEOPA</strong>
            <span>Clinical workflow</span>
          </div>
        </div>

        <div className="doctor-info-block">
          <div className="doctor-details">
            <p className="doctor-label">Logged in as</p>
            <p className="doctor-name">{currentDoctor.name}</p>
            <p className="doctor-email">{currentDoctor.email}</p>
          </div>
          <button
            onClick={onDoctorLogout}
            className="btn-logout"
            type="button"
            title="Logout"
          >
            Logout
          </button>
        </div>

        <button
          aria-pressed={isQuickQA}
          className={`quick-entry ${isQuickQA ? 'active' : ''}`}
          disabled={pending}
          onClick={onSelectQuickQA}
          type="button"
        >
          <span className="quick-icon" aria-hidden="true">?</span>
          <span>
            <strong>Quick Q&amp;A</strong>
            <small>General lab questions</small>
          </span>
        </button>

        <button
          className="quick-entry"
          disabled={pending}
          onClick={() => setShowTemplates(true)}
          type="button"
        >
          <span className="quick-icon" aria-hidden="true">📄</span>
          <span>
            <strong>My Templates</strong>
            <small>{templates.length} saved</small>
          </span>
        </button>

        <div className="backup-block">
          <p className="backup-label">Backup</p>
          <p className="backup-hint">
            Records live only in this browser. Export regularly.
          </p>
          <div className="backup-actions">
            <button
              className="backup-button"
              disabled={pending}
              onClick={onExportData}
              type="button"
            >
              Export
            </button>
            <label className={`backup-button ${pending ? 'disabled' : ''}`}>
              Restore
              <input
                accept="application/json,.json"
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    onImportData(file)
                  }
                  event.target.value = ''
                }}
                type="file"
              />
            </label>
          </div>
        </div>

        <div className="sidebar-header">
          <div>
            <p className="sidebar-kicker">Patient files</p>
            <h2>Patients</h2>
          </div>
          <span className="patient-count">{patients.length}</span>
        </div>

        <div className="patient-list">
          {sortedPatients.length === 0 ? (
            <p className="sidebar-empty">No patients have been created yet.</p>
          ) : (
            sortedPatients.map((patient) => (
              <button
                aria-pressed={!isQuickQA && selectedPatientId === patient.id}
                className={`patient-item ${
                  !isQuickQA && selectedPatientId === patient.id ? 'active' : ''
                }`}
                disabled={pending}
                key={patient.id}
                onClick={() => onSelectPatient(patient.id)}
                type="button"
              >
                <span className="patient-avatar" aria-hidden="true">
                  {patient.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <span>
                  <span className="patient-name">{patient.name}</span>
                  <span className="patient-meta">
                    {patient.complaint || `${patient.conversations.length} consultation${patient.conversations.length === 1 ? '' : 's'}`}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

      </aside>

      <main className="doctor-main">
        <div className="doctor-app-header">
          <Header />
        </div>

        {saveError && (
          <div className="storage-error" role="alert">
            <strong>Not saved.</strong> {saveError}
          </div>
        )}

        {errorMessage && <div className="workflow-error" role="alert">{errorMessage}</div>}

        {isQuickQA ? (
          <div className="quick-workspace">
            <div className="workspace-heading simple">
              <div>
                <p className="workspace-kicker">LEOPA — Knowledge-base assistant</p>
                <h1>Quick Q&amp;A</h1>
                <p>Ask LEOPA a general fabrication or workflow question without patient context.</p>
              </div>
              {quickMessages.length > 0 && (
                <button
                  className="clear-conversation"
                  disabled={pending}
                  onClick={() => confirmClear(false)}
                  type="button"
                >
                  Clear conversation
                </button>
              )}
            </div>
            <div className="chat-container">
              <MessageList
                messages={quickMessages}
                onSelectOption={handleSelectOption}
                pending={pendingAction === 'chat'}
                selectedOptions={selectedOptions}
              />
              <Composer
                onSend={onSend}
                onStagedChange={setSelectedOptions}
                pending={pending}
                stagedOption={stagedOption}
              />
            </div>
          </div>
        ) : !currentPatient || !currentConversation ? (
          <div className="no-patient-selected">
            <div className="selection-card">
              <span className="selection-icon" aria-hidden="true">+</span>
              <h2>Select a patient</h2>
              <p>Choose a patient from the sidebar to open their clinical workflow.</p>
            </div>
          </div>
        ) : (
          <div className="patient-workspace">
            <div className="workspace-heading">
              <div className="patient-heading-main">
                <span className="workspace-avatar" aria-hidden="true">
                  {currentPatient.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <div>
                  <div className="patient-title-line">
                    <h1>{currentPatient.name}</h1>
                    {currentConversation.soapApproved && (
                      <span className="approved-badge">SOAP ✓</span>
                    )}
                  </div>
                  <p>{currentPatient.complaint || 'No case reason entered'}</p>
                  {patientMeta.length > 0 && <small>{patientMeta.join(' · ')}</small>}
                </div>
              </div>
              <div className="consultation-controls">
                <label>
                  Consultation
                  <select
                    disabled={pending}
                    onChange={(event) => onSelectConversation(event.target.value)}
                    value={currentConversation.id}
                  >
                    {[...currentPatient.conversations]
                      .sort((a, b) =>
                        consultationOrder(b).localeCompare(consultationOrder(a)),
                      )
                      .map((conversation) => (
                        <option key={conversation.id} value={conversation.id}>
                          {formatConsultation(conversation)}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={pending} onClick={onNewConsultation} type="button">
                  + New consultation
                </button>
                {currentConversation.messages.length > 0 && (
                  <button
                    className="clear-conversation"
                    disabled={pending}
                    onClick={() => confirmClear(true)}
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <nav className="workflow-tabs" aria-label="Patient workflow">
              <button
                className={activeTab === 'capture' ? 'active' : ''}
                onClick={() => onSetActiveTab('capture')}
                type="button"
              >
                <span>1</span> Charting
              </button>
              <button
                className={activeTab === 'consultation' ? 'active' : ''}
                onClick={() => onSetActiveTab('consultation')}
                type="button"
              >
                <span>2</span> Ask LEOPA
              </button>
              <button
                className={activeTab === 'soap' ? 'active' : ''}
                disabled={!currentConversation.soapNote}
                onClick={() => onSetActiveTab('soap')}
                type="button"
              >
                <span>3</span> SOAP review
              </button>
              <button
                className={activeTab === 'dispense' ? 'active' : ''}
                disabled={!currentConversation.soapApproved}
                onClick={() => onSetActiveTab('dispense')}
                type="button"
              >
                <span>4</span> Documents
              </button>
            </nav>

            <div className="workflow-content">
              {activeTab === 'capture' && (
                <CaptureView
                  approved={currentConversation.chartingApproved}
                  capture={currentConversation.capture}
                  chartingNotes={currentConversation.chartingNotes}
                  disabled={pending}
                  generating={pendingAction === 'charting'}
                  onApprove={onApproveCharting}
                  onContinue={() => onSetActiveTab('consultation')}
                  onGenerate={onGenerateCharting}
                  onUpdateCapture={onUpdateCapture}
                  onUpdateCharting={onUpdateCharting}
                  stale={
                    currentConversation.chartingNotes.length > 0 &&
                    currentConversation.capture !== currentConversation.chartingSource
                  }
                />
              )}

              {activeTab === 'consultation' && (
                <div className="charting-workspace">
                  {prescription && (
                    <PrescriptionPanel
                      disabled={pending}
                      onEdit={handleFieldEdit}
                      state={prescription}
                    />
                  )}
                  <MessageList
                    messages={currentConversation.messages}
                    onSelectOption={handleSelectOption}
                    pending={pendingAction === 'chat'}
                    selectedOptions={selectedOptions}
                  />
                  <div className="charting-footer">
                    {(currentConversation.messages.length > 0 ||
                      currentConversation.chartingApproved) && (
                      <div className="charting-action-row">
                        {!currentConversation.soapNote ? (
                          <button
                            className="workflow-primary"
                            disabled={pending}
                            onClick={onGenerateSoap}
                            type="button"
                          >
                            {pendingAction === 'soap'
                              ? 'Generating SOAP notes…'
                              : 'Generate SOAP notes'}
                          </button>
                        ) : currentConversation.soapApproved ? (
                          <button
                            className="workflow-secondary"
                            onClick={() => onSetActiveTab('dispense')}
                            type="button"
                          >
                            SOAP approved · Continue to documents →
                          </button>
                        ) : (
                          <button
                            className="workflow-secondary"
                            onClick={() => onSetActiveTab('soap')}
                            type="button"
                          >
                            SOAP draft ready · Review →
                          </button>
                        )}
                      </div>
                    )}
                    <Composer
                      key={`${currentPatient.id}-${currentConversation.id}`}
                      onSend={onSend}
                      onStagedChange={setSelectedOptions}
                      patientName={currentPatient.name}
                      pending={pending}
                      stagedOption={stagedOption}
                    />
                    <p className="workflow-disclaimer">
                      AI supports documentation and fabrication decisions; practitioner approval is required.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'soap' && currentConversation.soapNote && (
                <SoapReview
                  approved={currentConversation.soapApproved}
                  onApprove={onApproveSoap}
                  onContinue={() => onSetActiveTab('dispense')}
                  onUpdate={onUpdateSoap}
                  soapNote={currentConversation.soapNote}
                />
              )}

              {activeTab === 'dispense' && currentConversation.soapApproved && (
                <DispensingView
                  documents={currentConversation.documents}
                  onApprove={onApproveDocument}
                  onGenerate={onGenerateDocuments}
                  pending={pendingAction === 'documents'}
                  templateNames={templateNames}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {showTemplates && (
        <TemplateManager
          onAdd={onAddTemplate}
          onClose={() => setShowTemplates(false)}
          onDelete={onDeleteTemplate}
          onExtractPdf={onExtractTemplate}
          pending={pendingAction === 'template'}
          templates={templates}
        />
      )}
    </div>
  )
}
