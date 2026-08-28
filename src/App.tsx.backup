import { useEffect, useState } from 'react'
import DoctorView from './components/DoctorView'
import ReceptionistView from './components/ReceptionistView'
import type { Doctor } from './components/DoctorManagement'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface SoapNote {
  subjective: string
  objective: string
  assessment: string
  plan: string
  diagnosis: string
  prescription_suggestion: string
}

export type DocumentKey =
  | 'diagnosis'
  | 'prescription'
  | 'summary'
  | 'insurance'

export interface ClinicalDocument {
  content: string
  approved: boolean
}

export interface PatientConversation {
  id: string
  createdAt: string
  messages: Message[]
  soapNote: SoapNote | null
  soapApproved: boolean
  documents: Partial<Record<DocumentKey, ClinicalDocument>>
}

export interface Patient {
  id: string
  name: string
  weight: number
  dob: string
  complaint: string
  shoeSize: string
  footwearType: string
  activityLevel: string
  notes: string
  assignedDoctorId: string | null
  activeConversationId: string
  conversations: PatientConversation[]
}

export interface PatientInput {
  name: string
  weight: number
  dob: string
  complaint: string
  shoeSize: string
  footwearType: string
  activityLevel: string
  notes: string
}

export type WorkspaceTab = 'charting' | 'soap' | 'dispense'

type AppMode = 'receptionist' | 'doctor'
type Workspace = 'patient' | 'quick'
type PendingAction = 'chat' | 'soap' | 'documents' | null

interface AppState {
  mode: AppMode
  workspace: Workspace
  doctors: Doctor[]
  patients: Patient[]
  selectedPatientId: string | null
  quickMessages: Message[]
}

interface PatientContext {
  age: number
  weight: number
  weightUnit: 'lbs'
  complaint: string
  shoeSize: string
  footwearType: string
  activityLevel: string
  notes: string
}

const STORAGE_KEY = 'orthotic_app_state'

const createId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

const createConversation = (): PatientConversation => ({
  id: createId('consultation'),
  createdAt: new Date().toISOString(),
  messages: [],
  soapNote: null,
  soapApproved: false,
  documents: {},
})

const isMessage = (value: unknown): value is Message => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const message = value as Record<string, unknown>
  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  )
}

const normaliseSoapNote = (value: unknown): SoapNote | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const note = value as Record<string, unknown>
  const keys: (keyof SoapNote)[] = [
    'subjective',
    'objective',
    'assessment',
    'plan',
    'diagnosis',
    'prescription_suggestion',
  ]

  if (!keys.every((key) => typeof note[key] === 'string')) {
    return null
  }

  return Object.fromEntries(keys.map((key) => [key, note[key]])) as unknown as SoapNote
}

const normaliseDocuments = (
  value: unknown,
): Partial<Record<DocumentKey, ClinicalDocument>> => {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const source = value as Record<string, unknown>
  const result: Partial<Record<DocumentKey, ClinicalDocument>> = {}
  const keys: DocumentKey[] = ['diagnosis', 'prescription', 'summary', 'insurance']

  keys.forEach((key) => {
    const document = source[key]
    if (typeof document !== 'object' || document === null) {
      return
    }
    const record = document as Record<string, unknown>
    if (typeof record.content === 'string') {
      result[key] = {
        content: record.content,
        approved: record.approved === true,
      }
    }
  })

  return result
}

const normaliseConversation = (value: unknown): PatientConversation | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const conversation = value as Record<string, unknown>
  if (!Array.isArray(conversation.messages)) {
    return null
  }

  return {
    id:
      typeof conversation.id === 'string' && conversation.id.length > 0
        ? conversation.id
        : createId('consultation'),
    createdAt:
      typeof conversation.createdAt === 'string'
        ? conversation.createdAt
        : new Date().toISOString(),
    messages: conversation.messages.filter(isMessage),
    soapNote: normaliseSoapNote(conversation.soapNote),
    soapApproved: conversation.soapApproved === true,
    documents: normaliseDocuments(conversation.documents),
  }
}

const normalisePatient = (value: unknown): Patient | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const patient = value as Record<string, unknown>
  if (
    typeof patient.id !== 'string' ||
    typeof patient.name !== 'string' ||
    typeof patient.weight !== 'number' ||
    !Number.isFinite(patient.weight) ||
    typeof patient.dob !== 'string'
  ) {
    return null
  }

  const conversations = Array.isArray(patient.conversations)
    ? patient.conversations.flatMap((item) => {
        const conversation = normaliseConversation(item)
        return conversation ? [conversation] : []
      })
    : []
  const safeConversations = conversations.length > 0 ? conversations : [createConversation()]
  const savedActiveId =
    typeof patient.activeConversationId === 'string'
      ? patient.activeConversationId
      : ''
  const activeConversationId = safeConversations.some(
    (conversation) => conversation.id === savedActiveId,
  )
    ? savedActiveId
    : safeConversations[0].id

  return {
    id: patient.id,
    name: patient.name,
    weight: patient.weight,
    dob: patient.dob,
    complaint: typeof patient.complaint === 'string' ? patient.complaint : '',
    shoeSize: typeof patient.shoeSize === 'string' ? patient.shoeSize : '',
    footwearType:
      typeof patient.footwearType === 'string' ? patient.footwearType : '',
    activityLevel:
      typeof patient.activityLevel === 'string' ? patient.activityLevel : '',
    notes: typeof patient.notes === 'string' ? patient.notes : '',
    assignedDoctorId:
      typeof patient.assignedDoctorId === 'string' ? patient.assignedDoctorId : null,
    activeConversationId,
    conversations: safeConversations,
  }
}

const loadState = (): AppState => {
  const fallback: AppState = {
    mode: 'doctor',
    workspace: 'patient',
    doctors: [],
    patients: [],
    selectedPatientId: null,
    quickMessages: [],
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return fallback
    }

    const parsed = JSON.parse(saved) as Record<string, unknown>
    const doctors = Array.isArray(parsed.doctors)
      ? parsed.doctors.filter(
          (d: unknown): d is Doctor =>
            typeof d === 'object' &&
            d !== null &&
            typeof (d as Record<string, unknown>).id === 'string' &&
            typeof (d as Record<string, unknown>).name === 'string' &&
            typeof (d as Record<string, unknown>).email === 'string' &&
            typeof (d as Record<string, unknown>).specialty === 'string',
        )
      : []
    const patients = Array.isArray(parsed.patients)
      ? parsed.patients.flatMap((patient) => {
          const normalised = normalisePatient(patient)
          return normalised ? [normalised] : []
        })
      : []
    const selectedPatientId =
      typeof parsed.selectedPatientId === 'string' &&
      patients.some((patient) => patient.id === parsed.selectedPatientId)
        ? parsed.selectedPatientId
        : null

    return {
      mode: parsed.mode === 'receptionist' ? 'receptionist' : 'doctor',
      workspace: parsed.workspace === 'quick' ? 'quick' : 'patient',
      doctors,
      patients,
      selectedPatientId,
      quickMessages: Array.isArray(parsed.quickMessages)
        ? parsed.quickMessages.filter(isMessage)
        : [],
    }
  } catch (error) {
    console.error('Failed to load saved application state:', error)
    return fallback
  }
}

const calculateAge = (dob: string) => {
  const [year, month, day] = dob.split('-').map(Number)
  const today = new Date()

  if (!year || !month || !day) {
    return 0
  }

  let age = today.getFullYear() - year
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1
  }

  return Math.max(0, age)
}

const getPatientContext = (patient: Patient): PatientContext => ({
  age: calculateAge(patient.dob),
  weight: patient.weight,
  weightUnit: 'lbs',
  complaint: patient.complaint,
  shoeSize: patient.shoeSize,
  footwearType: patient.footwearType,
  activityLevel: patient.activityLevel,
  notes: patient.notes,
})

const replacePatientPlaceholder = (content: string, displayName: string) =>
  content.split('[PATIENT LABEL]').join(displayName)

function App() {
  const [appState, setAppState] = useState<AppState>(loadState)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('charting')
  const [errorMessage, setErrorMessage] = useState('')

  const { mode, workspace, doctors, patients, selectedPatientId, quickMessages } = appState
  const currentPatient =
    patients.find((patient) => patient.id === selectedPatientId) ?? null
  const currentConversation =
    currentPatient?.conversations.find(
      (conversation) => conversation.id === currentPatient.activeConversationId,
    ) ?? null

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState))
    } catch (error) {
      console.error('Failed to save application state:', error)
    }
  }, [appState])

  const updateConversation = (
    patientId: string,
    conversationId: string,
    update: (conversation: PatientConversation) => PatientConversation,
  ) => {
    setAppState((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === patientId
          ? {
              ...patient,
              conversations: patient.conversations.map((conversation) =>
                conversation.id === conversationId
                  ? update(conversation)
                  : conversation,
              ),
            }
          : patient,
      ),
    }))
  }

  const callApi = async (
    messages: Message[],
    options: {
      patientContext?: PatientContext
      action?: 'consultation' | 'soap' | 'document'
      documentType?: DocumentKey
    } = {},
  ) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, ...options }),
    })

    if (!response.ok) {
      throw new Error('Something went wrong — try again')
    }

    const data = (await response.json()) as { reply?: unknown }
    if (typeof data.reply !== 'string') {
      throw new Error('Something went wrong — try again')
    }

    return data.reply
  }

  const handleSend = async (content: string) => {
    if (pendingAction || content.trim().length === 0) {
      return
    }

    const userMessage: Message = { role: 'user', content: content.trim() }
    setErrorMessage('')
    setPendingAction('chat')

    if (workspace === 'quick') {
      const updatedMessages = [...quickMessages, userMessage]
      setAppState((current) => ({ ...current, quickMessages: updatedMessages }))
      try {
        const reply = await callApi(updatedMessages)
        setAppState((current) => ({
          ...current,
          quickMessages: [
            ...current.quickMessages,
            { role: 'assistant', content: reply },
          ],
        }))
      } catch {
        setErrorMessage('Something went wrong — try again')
      } finally {
        setPendingAction(null)
      }
      return
    }

    if (!currentPatient || !currentConversation) {
      setPendingAction(null)
      return
    }

    const patientId = currentPatient.id
    const conversationId = currentConversation.id
    const updatedMessages = [...currentConversation.messages, userMessage]
    updateConversation(patientId, conversationId, (conversation) => ({
      ...conversation,
      messages: updatedMessages,
    }))

    try {
      const reply = await callApi(updatedMessages, {
        action: 'consultation',
        patientContext: getPatientContext(currentPatient),
      })
      updateConversation(patientId, conversationId, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { role: 'assistant', content: reply },
        ],
      }))
    } catch {
      setErrorMessage('Something went wrong — try again')
    } finally {
      setPendingAction(null)
    }
  }

  const handleGenerateSoap = async () => {
    if (
      pendingAction ||
      !currentPatient ||
      !currentConversation ||
      currentConversation.messages.length === 0
    ) {
      return
    }

    const patientId = currentPatient.id
    const conversationId = currentConversation.id
    setErrorMessage('')
    setPendingAction('soap')

    try {
      const raw = await callApi(currentConversation.messages, {
        action: 'soap',
        patientContext: getPatientContext(currentPatient),
      })
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim()
      const soapNote = normaliseSoapNote(JSON.parse(cleaned))
      if (!soapNote) {
        throw new Error('Invalid SOAP response')
      }
      updateConversation(patientId, conversationId, (conversation) => ({
        ...conversation,
        soapNote,
        soapApproved: false,
        documents: {},
      }))
      setActiveTab('soap')
    } catch {
      setErrorMessage('SOAP notes could not be generated. Please try again.')
    } finally {
      setPendingAction(null)
    }
  }

  const handleUpdateSoap = (field: keyof SoapNote, value: string) => {
    if (!currentPatient || !currentConversation || !currentConversation.soapNote) {
      return
    }
    updateConversation(currentPatient.id, currentConversation.id, (conversation) => ({
      ...conversation,
      soapNote: conversation.soapNote
        ? { ...conversation.soapNote, [field]: value }
        : null,
    }))
  }

  const handleApproveSoap = () => {
    if (!currentPatient || !currentConversation?.soapNote) {
      return
    }
    updateConversation(currentPatient.id, currentConversation.id, (conversation) => ({
      ...conversation,
      soapApproved: true,
    }))
    setActiveTab('dispense')
  }

  const handleGenerateDocuments = async (keys: DocumentKey[]) => {
    if (
      pendingAction ||
      !currentPatient ||
      !currentConversation?.soapApproved ||
      !currentConversation.soapNote ||
      keys.length === 0
    ) {
      return
    }

    const patientId = currentPatient.id
    const conversationId = currentConversation.id
    const sourceMessage: Message = {
      role: 'user',
      content: JSON.stringify({
        approvedSoap: currentConversation.soapNote,
        patientContext: getPatientContext(currentPatient),
      }),
    }
    setErrorMessage('')
    setPendingAction('documents')

    try {
      const generated = await Promise.all(
        keys.map(async (key) => ({
          key,
          content: replacePatientPlaceholder(
            await callApi([sourceMessage], {
              action: 'document',
              documentType: key,
            }),
            currentPatient.name,
          ),
        })),
      )

      updateConversation(patientId, conversationId, (conversation) => {
        const documents = { ...conversation.documents }
        generated.forEach(({ key, content }) => {
          documents[key] = { content, approved: false }
        })
        return { ...conversation, documents }
      })
    } catch {
      setErrorMessage('Documents could not be generated. Please try again.')
    } finally {
      setPendingAction(null)
    }
  }

  const handleApproveDocument = (key: DocumentKey) => {
    if (!currentPatient || !currentConversation?.documents[key]) {
      return
    }
    updateConversation(currentPatient.id, currentConversation.id, (conversation) => ({
      ...conversation,
      documents: {
        ...conversation.documents,
        [key]: {
          ...(conversation.documents[key] as ClinicalDocument),
          approved: true,
        },
      },
    }))
  }

  const handleCreatePatient = (input: PatientInput) => {
    const conversation = createConversation()
    const newPatient: Patient = {
      id: createId('patient'),
      ...input,
      name: input.name.trim(),
      assignedDoctorId: null,
      activeConversationId: conversation.id,
      conversations: [conversation],
    }

    setAppState((current) => ({
      ...current,
      workspace: 'patient',
      patients: [...current.patients, newPatient],
      selectedPatientId: newPatient.id,
    }))
    setActiveTab('charting')
  }

  const handleUpdatePatient = (id: string, input: PatientInput) => {
    setAppState((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === id
          ? { ...patient, ...input, name: input.name.trim() }
          : patient,
      ),
    }))
  }

  const handleDeletePatient = (id: string) => {
    setAppState((current) => ({
      ...current,
      patients: current.patients.filter((patient) => patient.id !== id),
      selectedPatientId:
        current.selectedPatientId === id ? null : current.selectedPatientId,
    }))
  }

  const handleSelectPatient = (id: string) => {
    if (pendingAction) {
      return
    }
    setAppState((current) => ({
      ...current,
      workspace: 'patient',
      selectedPatientId: id,
    }))
    setActiveTab('charting')
    setErrorMessage('')
  }

  const handleSelectQuickQA = () => {
    if (pendingAction) {
      return
    }
    setAppState((current) => ({ ...current, workspace: 'quick' }))
    setErrorMessage('')
  }

  const handleNewConsultation = () => {
    if (!currentPatient || pendingAction) {
      return
    }
    const conversation = createConversation()
    setAppState((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === currentPatient.id
          ? {
              ...patient,
              activeConversationId: conversation.id,
              conversations: [conversation, ...patient.conversations],
            }
          : patient,
      ),
    }))
    setActiveTab('charting')
    setErrorMessage('')
  }

  const handleSelectConversation = (conversationId: string) => {
    if (!currentPatient || pendingAction) {
      return
    }
    setAppState((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === currentPatient.id
          ? { ...patient, activeConversationId: conversationId }
          : patient,
      ),
    }))
    setActiveTab('charting')
    setErrorMessage('')
  }

  // Doctor handlers
  const handleAddDoctor = (doctor: Doctor) => {
    setAppState((current) => ({
      ...current,
      doctors: [...current.doctors, doctor],
    }))
  }

  const handleDeleteDoctor = (doctorId: string) => {
    setAppState((current) => ({
      ...current,
      doctors: current.doctors.filter((d) => d.id !== doctorId),
      // Unassign all patients from this doctor
      patients: current.patients.map((p) =>
        p.assignedDoctorId === doctorId ? { ...p, assignedDoctorId: null } : p,
      ),
    }))
  }

  const handleAssignPatient = (patientId: string, doctorId: string | '') => {
    setAppState((current) => ({
      ...current,
      patients: current.patients.map((p) =>
        p.id === patientId ? { ...p, assignedDoctorId: doctorId || null } : p,
      ),
    }))
  }

  if (mode === 'receptionist') {
    return (
      <ReceptionistView
        doctors={doctors}
        onAddDoctor={handleAddDoctor}
        onAssignPatient={handleAssignPatient}
        onCreatePatient={handleCreatePatient}
        onDeleteDoctor={handleDeleteDoctor}
        onDeletePatient={handleDeletePatient}
        onSwitchMode={() =>
          setAppState((current) => ({ ...current, mode: 'doctor' }))
        }
        onUpdatePatient={handleUpdatePatient}
        patients={patients}
      />
    )
  }

  return (
    <DoctorView
      activeTab={activeTab}
      currentConversation={currentConversation}
      currentPatient={currentPatient}
      errorMessage={errorMessage}
      isQuickQA={workspace === 'quick'}
      onApproveDocument={handleApproveDocument}
      onApproveSoap={handleApproveSoap}
      onGenerateDocuments={handleGenerateDocuments}
      onGenerateSoap={handleGenerateSoap}
      onNewConsultation={handleNewConsultation}
      onSelectConversation={handleSelectConversation}
      onSelectPatient={handleSelectPatient}
      onSelectQuickQA={handleSelectQuickQA}
      onSend={handleSend}
      onSetActiveTab={setActiveTab}
      onSwitchMode={() =>
        setAppState((current) => ({ ...current, mode: 'receptionist' }))
      }
      onUpdateSoap={handleUpdateSoap}
      patients={patients}
      pendingAction={pendingAction}
      quickMessages={quickMessages}
      selectedPatientId={selectedPatientId}
    />
  )
}

export default App
