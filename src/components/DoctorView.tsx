import { useState } from 'react'
import type {
  DoctorTemplate,
  DocumentKey,
  Message,
  OutgoingAttachment,
  Patient,
  PatientConversation,
  SoapNote,
  WorkspaceTab,
} from '../App'
import type { Doctor } from './DoctorManagement'
import Composer from './Composer'
import DispensingView from './DispensingView'
import Header from './Header'
import MessageList from './MessageList'
import TemplateManager from './TemplateManager'
import SoapReview from './SoapReview'
import './DoctorView.css'

type PendingAction = 'chat' | 'soap' | 'documents' | 'template' | null

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
  onNewConsultation: () => void
  onSelectConversation: (id: string) => void
  onSetActiveTab: (tab: WorkspaceTab) => void
  onGenerateSoap: () => void
  onUpdateSoap: (field: keyof SoapNote, value: string) => void
  onApproveSoap: () => void
  onGenerateDocuments: (keys: DocumentKey[]) => void
  onApproveDocument: (key: DocumentKey) => void
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

const formatConsultation = (conversation: PatientConversation, index: number) => {
  const date = new Date(conversation.createdAt)
  const formatted = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
  return `Consultation ${index + 1}${formatted ? ` — ${formatted}` : ''}`
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
  onNewConsultation,
  onSelectConversation,
  onSetActiveTab,
  onGenerateSoap,
  onUpdateSoap,
  onApproveSoap,
  onGenerateDocuments,
  onApproveDocument,
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
          <div className="brand-mark" aria-hidden="true">OA</div>
          <div>
            <strong>Orthotic Assistant</strong>
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

        {errorMessage && <div className="workflow-error" role="alert">{errorMessage}</div>}

        {isQuickQA ? (
          <div className="quick-workspace">
            <div className="workspace-heading simple">
              <div>
                <p className="workspace-kicker">Knowledge-base assistant</p>
                <h1>Quick Q&amp;A</h1>
                <p>Ask a general fabrication or workflow question without patient context.</p>
              </div>
            </div>
            <div className="chat-container">
              <MessageList messages={quickMessages} pending={pendingAction === 'chat'} />
              <Composer onSend={onSend} pending={pending} />
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
                    {currentPatient.conversations.map((conversation, index) => (
                      <option key={conversation.id} value={conversation.id}>
                        {formatConsultation(conversation, index)}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={pending} onClick={onNewConsultation} type="button">
                  + New consultation
                </button>
              </div>
            </div>

            <nav className="workflow-tabs" aria-label="Patient workflow">
              <button
                className={activeTab === 'charting' ? 'active' : ''}
                onClick={() => onSetActiveTab('charting')}
                type="button"
              >
                <span>1</span> Charting
              </button>
              <button
                className={activeTab === 'soap' ? 'active' : ''}
                disabled={!currentConversation.soapNote}
                onClick={() => onSetActiveTab('soap')}
                type="button"
              >
                <span>2</span> SOAP review
              </button>
              <button
                className={activeTab === 'dispense' ? 'active' : ''}
                disabled={!currentConversation.soapApproved}
                onClick={() => onSetActiveTab('dispense')}
                type="button"
              >
                <span>3</span> Documents
              </button>
            </nav>

            <div className="workflow-content">
              {activeTab === 'charting' && (
                <div className="charting-workspace">
                  <MessageList
                    messages={currentConversation.messages}
                    pending={pendingAction === 'chat'}
                  />
                  <div className="charting-footer">
                    {currentConversation.messages.length > 0 && (
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
                      patientName={currentPatient.name}
                      pending={pending}
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
