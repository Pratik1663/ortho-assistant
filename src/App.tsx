import { useEffect, useState } from 'react'
import DoctorView from './components/DoctorView'
import ReceptionistView from './components/ReceptionistView'
import AuthScreen from './components/AuthScreen'
import AdminDashboard from './components/AdminDashboard'
import type { Doctor } from './components/DoctorManagement'
import {
  clearSession,
  clinicStateKey,
  getClinic,
  isEmailTaken,
  loadSession,
  saveSession,
  type Clinic,
  type Session,
} from './auth'

export interface AttachmentMeta {
  name: string
  mediaType: string
}

export interface OutgoingAttachment extends AttachmentMeta {
  data: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  attachments?: AttachmentMeta[]
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

export interface DoctorTemplate {
  id: string
  doctorId: string
  documentType: DocumentKey
  name: string
  content: string
  createdAt: string
}

export interface PatientConversation {
  id: string
  createdAt: string
  // When the practitioner first charted this visit — i.e. the day the
  // patient was actually seen. Distinct from createdAt, which is only when
  // the record was opened (a receptionist may create it days earlier).
  // Set once, on the first keystroke in Charting, and never moved after.
  chartedAt: string | null
  // Stage 1 — the practitioner's own notes for this visit, pasted in.
  // Raw text; nothing is inferred from it until Stage 2 summarises it.
  capture: string
  // Stage 2 — the denoised summary of `capture`, generated on request and
  // editable. Only feeds SOAP once chartingApproved is true, so an
  // unreviewed summary can never reach a clinical document.
  chartingNotes: string
  // The exact `capture` text these notes were generated from. Lets us tell
  // an untouched summary from one whose source has since been edited.
  chartingSource: string
  chartingApproved: boolean
  messages: Message[]
  soapNote: SoapNote | null
  soapApproved: boolean
  documents: Partial<Record<DocumentKey, ClinicalDocument>>
}

export interface AssignmentInfo {
  byName: string
  byRole: string
  at: string
}

export interface ActivityEntry {
  id: string
  at: string
  actorName: string
  actorRole: string
  action: string
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
  assignedBy: AssignmentInfo | null
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

export type WorkspaceTab = 'capture' | 'consultation' | 'soap' | 'dispense'

type Workspace = 'patient' | 'quick'
export type PendingAction =
  | 'chat'
  | 'charting'
  | 'soap'
  | 'documents'
  | 'template'
  | null

interface AppState {
  workspace: Workspace
  doctors: Doctor[]
  patients: Patient[]
  selectedPatientId: string | null
  quickMessages: Message[]
  activityLog: ActivityEntry[]
  templates: DoctorTemplate[]
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

const GENERIC_ERROR = 'Something went wrong - try again'

const createId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

const createConversation = (): PatientConversation => ({
  id: createId('consultation'),
  createdAt: new Date().toISOString(),
  chartedAt: null,
  capture: '',
  chartingNotes: '',
  chartingSource: '',
  chartingApproved: false,
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
    chartedAt:
      typeof conversation.chartedAt === 'string' ? conversation.chartedAt : null,
    // Conversations saved before Stage 1 existed have no capture field.
    capture: typeof conversation.capture === 'string' ? conversation.capture : '',
    // Conversations saved before Stage 2 existed have no charting fields.
    // Without these three lines the type claims they exist while every
    // reload hands back undefined.
    chartingNotes:
      typeof conversation.chartingNotes === 'string'
        ? conversation.chartingNotes
        : '',
    chartingSource:
      typeof conversation.chartingSource === 'string'
        ? conversation.chartingSource
        : '',
    chartingApproved: conversation.chartingApproved === true,
    messages: conversation.messages.filter(isMessage),
    soapNote: normaliseSoapNote(conversation.soapNote),
    soapApproved: conversation.soapApproved === true,
    documents: normaliseDocuments(conversation.documents),
  }
}

const normaliseAssignmentInfo = (value: unknown): AssignmentInfo | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const info = value as Record<string, unknown>
  if (
    typeof info.byName !== 'string' ||
    typeof info.byRole !== 'string' ||
    typeof info.at !== 'string'
  ) {
    return null
  }
  return { byName: info.byName, byRole: info.byRole, at: info.at }
}

const normaliseActivityEntry = (value: unknown): ActivityEntry | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const entry = value as Record<string, unknown>
  if (
    typeof entry.id !== 'string' ||
    typeof entry.at !== 'string' ||
    typeof entry.actorName !== 'string' ||
    typeof entry.actorRole !== 'string' ||
    typeof entry.action !== 'string'
  ) {
    return null
  }
  return {
    id: entry.id,
    at: entry.at,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
  }
}

const DOCUMENT_KEYS: DocumentKey[] = ['diagnosis', 'prescription', 'summary', 'insurance']

const normaliseTemplate = (value: unknown): DoctorTemplate | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const template = value as Record<string, unknown>
  if (
    typeof template.id !== 'string' ||
    typeof template.doctorId !== 'string' ||
    typeof template.name !== 'string' ||
    typeof template.content !== 'string' ||
    typeof template.documentType !== 'string' ||
    !DOCUMENT_KEYS.includes(template.documentType as DocumentKey)
  ) {
    return null
  }
  return {
    id: template.id,
    doctorId: template.doctorId,
    documentType: template.documentType as DocumentKey,
    name: template.name,
    content: template.content,
    createdAt:
      typeof template.createdAt === 'string'
        ? template.createdAt
        : new Date().toISOString(),
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
    assignedBy: normaliseAssignmentInfo(patient.assignedBy),
    activeConversationId,
    conversations: safeConversations,
  }
}

const loadState = (storageKey: string): AppState => {
  const fallback: AppState = {
    workspace: 'patient',
    doctors: [],
    patients: [],
    selectedPatientId: null,
    quickMessages: [],
    activityLog: [],
    templates: [],
  }

  try {
    const saved = localStorage.getItem(storageKey)
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
      workspace: parsed.workspace === 'quick' ? 'quick' : 'patient',
      doctors,
      patients,
      selectedPatientId,
      quickMessages: Array.isArray(parsed.quickMessages)
        ? parsed.quickMessages.filter(isMessage)
        : [],
      activityLog: Array.isArray(parsed.activityLog)
        ? parsed.activityLog.flatMap((item) => {
            const entry = normaliseActivityEntry(item)
            return entry ? [entry] : []
          })
        : [],
      templates: Array.isArray(parsed.templates)
        ? parsed.templates.flatMap((item) => {
            const template = normaliseTemplate(item)
            return template ? [template] : []
          })
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

// Drops a trailing assistant placeholder that never received any text,
// so a failed request doesn't leave an empty bubble behind.
const dropEmptyPlaceholder = (messages: Message[]): Message[] => {
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant' && last.content === '') {
    return messages.slice(0, -1)
  }
  return messages
}

const replaceLastMessage = (messages: Message[], content: string): Message[] => {
  if (messages.length === 0) {
    return messages
  }
  const next = messages.slice()
  next[next.length - 1] = { role: 'assistant', content }
  return next
}

function App() {
  const [session, setSession] = useState<Session | null>(loadSession)

  const handleLogin = (nextSession: Session) => {
    saveSession(nextSession)
    setSession(nextSession)
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
  }

  if (!session) {
    return <AuthScreen onLogin={handleLogin} />
  }

  return (
    <ClinicApp
      key={`${session.clinicId}-${session.userId}`}
      session={session}
      onLogout={handleLogout}
    />
  )
}

interface ClinicAppProps {
  session: Session
  onLogout: () => void
}

function ClinicApp({ session, onLogout }: ClinicAppProps) {
  const storageKey = clinicStateKey(session.clinicId)
  const [appState, setAppState] = useState<AppState>(() => loadState(storageKey))
  const [clinic, setClinic] = useState<Clinic | null>(() => getClinic(session.clinicId))
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('capture')
  const [errorMessage, setErrorMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const {
    workspace,
    doctors,
    patients,
    selectedPatientId,
    quickMessages,
    activityLog,
    templates,
  } = appState

  const createActivityEntry = (action: string): ActivityEntry => ({
    id: createId('activity'),
    at: new Date().toISOString(),
    actorName: session.name,
    actorRole: session.role,
    action,
  })

  const appendActivity = (log: ActivityEntry[], action: string): ActivityEntry[] =>
    [createActivityEntry(action), ...log].slice(0, 300)
  // A doctor can only ever open patients assigned to them, even if a
  // different patient was left selected by a previous login.
  const currentPatient =
    patients.find(
      (patient) =>
        patient.id === selectedPatientId &&
        (session.role !== 'doctor' ||
          patient.assignedDoctorId === session.userId),
    ) ?? null
  const currentConversation =
    currentPatient?.conversations.find(
      (conversation) => conversation.id === currentPatient.activeConversationId,
    ) ?? null

  // A failed write used to be logged and nothing more, so a full storage
  // quota looked exactly like a bug in whatever had just been built: text
  // typed, tab switched, text gone. The banner makes the real cause visible.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(appState))
      setSaveError('')
    } catch (error) {
      console.error('Failed to save application state:', error)
      const full =
        error instanceof DOMException &&
        (error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      setSaveError(
        full
          ? 'Browser storage is full. Recent changes have NOT been saved. Export your data, then remove an old patient or consultation to free space.'
          : 'Changes could not be saved to this browser. Recent edits may be lost if you close this tab.',
      )
    }
  }, [appState, storageKey])

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
      action?: 'charting' | 'soap' | 'document' | 'template'
      documentType?: DocumentKey
      attachments?: OutgoingAttachment[]
      template?: string
      approvedCharting?: string
    } = {},
  ) => {
    // Only role + content go to the API; attachment metadata stays local.
    const cleanMessages = messages.map(({ role, content }) => ({ role, content }))
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: cleanMessages, ...options }),
    })

    if (!response.ok) {
      throw new Error(GENERIC_ERROR)
    }

    const data = (await response.json()) as { reply?: unknown }
    if (typeof data.reply !== 'string') {
      throw new Error(GENERIC_ERROR)
    }

    return data.reply
  }

  // Live chat is streamed so text appears as it is generated instead of
  // arriving all at once after a long pause.
  const streamChat = async (
    messages: Message[],
    options: {
      patientContext?: PatientContext
      attachments?: OutgoingAttachment[]
    },
    onText: (textSoFar: string) => void,
  ) => {
    const cleanMessages = messages.map(({ role, content }) => ({ role, content }))
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: cleanMessages,
        action: 'consultation',
        ...options,
      }),
    })

    if (!response.ok || !response.body) {
      throw new Error(GENERIC_ERROR)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let textSoFar = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      const chunk = decoder.decode(value, { stream: true })
      if (chunk.length > 0) {
        textSoFar += chunk
        onText(textSoFar)
      }
    }

    const tail = decoder.decode()
    if (tail.length > 0) {
      textSoFar += tail
      onText(textSoFar)
    }

    if (textSoFar.trim().length === 0) {
      throw new Error(GENERIC_ERROR)
    }

    return textSoFar
  }

  const handleSend = async (
    content: string,
    attachments: OutgoingAttachment[] = [],
  ) => {
    if (pendingAction || content.trim().length === 0) {
      return
    }

    const userMessage: Message = {
      role: 'user',
      content: content.trim(),
      ...(attachments.length > 0
        ? {
            attachments: attachments.map(({ name, mediaType }) => ({
              name,
              mediaType,
            })),
          }
        : {}),
    }
    const placeholder: Message = { role: 'assistant', content: '' }
    setErrorMessage('')
    setPendingAction('chat')

    if (workspace === 'quick') {
      const updatedMessages = [...quickMessages, userMessage]
      setAppState((current) => ({
        ...current,
        quickMessages: [...updatedMessages, placeholder],
      }))
      try {
        await streamChat(
          updatedMessages,
          { attachments: attachments.length > 0 ? attachments : undefined },
          (textSoFar) => {
            setAppState((current) => ({
              ...current,
              quickMessages: replaceLastMessage(current.quickMessages, textSoFar),
            }))
          },
        )
      } catch {
        setErrorMessage(GENERIC_ERROR)
        setAppState((current) => ({
          ...current,
          quickMessages: dropEmptyPlaceholder(current.quickMessages),
        }))
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
      messages: [...updatedMessages, placeholder],
    }))

    try {
      await streamChat(
        updatedMessages,
        {
          patientContext: getPatientContext(currentPatient),
          attachments: attachments.length > 0 ? attachments : undefined,
        },
        (textSoFar) => {
          updateConversation(patientId, conversationId, (conversation) => ({
            ...conversation,
            messages: replaceLastMessage(conversation.messages, textSoFar),
          }))
        },
      )
    } catch {
      setErrorMessage(GENERIC_ERROR)
      updateConversation(patientId, conversationId, (conversation) => ({
        ...conversation,
        messages: dropEmptyPlaceholder(conversation.messages),
      }))
    } finally {
      setPendingAction(null)
    }
  }

  // Wipes the visible thread. For a patient consultation this also clears
  // the SOAP draft and documents, because they were derived from the
  // messages being removed.
  const handleClearConversation = () => {
    if (pendingAction) {
      return
    }

    setErrorMessage('')

    if (workspace === 'quick') {
      setAppState((current) => ({ ...current, quickMessages: [] }))
      return
    }

    if (!currentPatient || !currentConversation) {
      return
    }

    const patientId = currentPatient.id
    const conversationId = currentConversation.id
    const patientName = currentPatient.name

    setAppState((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === patientId
          ? {
              ...patient,
              conversations: patient.conversations.map((conversation) =>
                conversation.id === conversationId
                  ? {
                      ...conversation,
                      messages: [],
                      soapNote: null,
                      soapApproved: false,
                      documents: {},
                    }
                  : conversation,
              ),
            }
          : patient,
      ),
      activityLog: appendActivity(
        current.activityLog,
        `Cleared a consultation for patient "${patientName}"`,
      ),
    }))
    setActiveTab('capture')
  }

  // Stage 1. Stores the practitioner's pasted notes for this visit.
  const handleUpdateCapture = (value: string) => {
    if (!currentPatient || !currentConversation) {
      return
    }
    updateConversation(currentPatient.id, currentConversation.id, (conversation) => {
      if (conversation.capture === value) {
        return conversation
      }
      // Editing the raw notes after a summary was built from them leaves
      // everything downstream resting on text that no longer exists. Rather
      // than let an approved SOAP quietly describe a superseded visit, the
      // approvals drop and have to be given again.
      const supersedesSummary =
        conversation.chartingNotes.length > 0 &&
        value !== conversation.chartingSource
      return {
        ...conversation,
        capture: value,
        // Stamped on the first keystroke only. This is the day the patient was
        // seen, so later edits must not move it.
        chartedAt:
          conversation.chartedAt ??
          (value.trim().length > 0 ? new Date().toISOString() : null),
        chartingApproved: supersedesSummary ? false : conversation.chartingApproved,
        soapApproved: supersedesSummary ? false : conversation.soapApproved,
        documents: supersedesSummary ? {} : conversation.documents,
      }
    })
  }

  // Stage 2. Turns the raw capture into a clean summary. The raw text never
  // travels further than this call — SOAP reads the approved summary only.
  const handleGenerateCharting = async () => {
    if (pendingAction || !currentPatient || !currentConversation) {
      return
    }
    const source = currentConversation.capture
    const trimmedSource = source.trim()
    if (trimmedSource.length === 0) {
      return
    }
    // The API rejects anything past this, and a rejection there surfaces as a
    // bare 400 with nothing to explain it. Fail here instead, where we can say
    // what went wrong.
    if (trimmedSource.length > 120_000) {
      setErrorMessage(
        'These notes are too long to summarise in one pass. Split the visit into two consultations.',
      )
      return
    }

    const patientId = currentPatient.id
    const conversationId = currentConversation.id
    setErrorMessage('')
    setPendingAction('charting')

    try {
      const reply = await callApi([{ role: 'user', content: trimmedSource }], {
        action: 'charting',
        patientContext: getPatientContext(currentPatient),
      })
      const chartingNotes = reply.trim()
      if (chartingNotes.length === 0) {
        throw new Error('Empty charting response')
      }
      updateConversation(patientId, conversationId, (conversation) => ({
        ...conversation,
        chartingNotes,
        // Recorded as it was at the moment of generation, not as it is now —
        // the practitioner may have kept typing while the call was in flight.
        chartingSource: source,
        chartingApproved: false,
        soapApproved: false,
        documents: {},
      }))
    } catch {
      setErrorMessage('The charting summary could not be generated. Please try again.')
    } finally {
      setPendingAction(null)
    }
  }

  const handleUpdateCharting = (value: string) => {
    if (!currentPatient || !currentConversation) {
      return
    }
    updateConversation(currentPatient.id, currentConversation.id, (conversation) => ({
      ...conversation,
      chartingNotes: value,
    }))
  }

  const handleApproveCharting = () => {
    if (!currentPatient || !currentConversation?.chartingNotes.trim()) {
      return
    }
    updateConversation(currentPatient.id, currentConversation.id, (conversation) => ({
      ...conversation,
      chartingApproved: true,
    }))
    setActiveTab('consultation')
  }

  const handleGenerateSoap = async () => {
    if (pendingAction || !currentPatient || !currentConversation) {
      return
    }

    // Two sources feed a SOAP note and either one alone is enough: a visit
    // that was charted but never taken to Ask LEOPA still documents, and so
    // does a prescription built without charting.
    const approvedCharting =
      currentConversation.chartingApproved &&
      currentConversation.chartingNotes.trim().length > 0
        ? currentConversation.chartingNotes.trim()
        : undefined
    if (!approvedCharting && currentConversation.messages.length === 0) {
      return
    }

    // The API rejects an empty message array, so a charting-only note still
    // needs one turn to hang the request on.
    const soapMessages: Message[] =
      currentConversation.messages.length > 0
        ? currentConversation.messages
        : [
            {
              role: 'user',
              content: 'Generate the SOAP note from the approved charting notes.',
            },
          ]

    const patientId = currentPatient.id
    const conversationId = currentConversation.id
    setErrorMessage('')
    setPendingAction('soap')

    try {
      const raw = await callApi(soapMessages, {
        action: 'soap',
        patientContext: getPatientContext(currentPatient),
        approvedCharting,
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

  const doctorTemplates =
    session.role === 'doctor'
      ? templates.filter((template) => template.doctorId === session.userId)
      : []

  const templateForType = (key: DocumentKey): DoctorTemplate | null => {
    const matching = doctorTemplates
      .filter((template) => template.documentType === key)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return matching[0] ?? null
  }

  const handleAddTemplate = (
    documentType: DocumentKey,
    name: string,
    content: string,
  ) => {
    const template: DoctorTemplate = {
      id: createId('template'),
      doctorId: session.userId,
      documentType,
      name: name.trim() || 'Untitled template',
      content,
      createdAt: new Date().toISOString(),
    }
    setAppState((current) => ({
      ...current,
      templates: [...current.templates, template],
      activityLog: appendActivity(
        current.activityLog,
        `Added document template "${template.name}"`,
      ),
    }))
  }

  const handleDeleteTemplate = (id: string) => {
    setAppState((current) => {
      const target = current.templates.find((template) => template.id === id)
      return {
        ...current,
        templates: current.templates.filter((template) => template.id !== id),
        activityLog: appendActivity(
          current.activityLog,
          `Deleted document template "${target?.name ?? 'Unknown'}"`,
        ),
      }
    })
  }

  const handleExtractTemplate = async (
    documentType: DocumentKey,
    name: string,
    attachment: OutgoingAttachment,
  ) => {
    if (pendingAction) {
      return
    }
    setPendingAction('template')
    try {
      const reply = await callApi(
        [
          {
            role: 'user',
            content:
              'Transcribe the attached blank form into a reusable plain-text template.',
          },
        ],
        { action: 'template', attachments: [attachment] },
      )
      handleAddTemplate(documentType, name, reply)
    } catch {
      window.alert(
        'The PDF could not be read into a template. Please try again, or paste the template text instead.',
      )
    } finally {
      setPendingAction(null)
    }
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
        keys.map(async (key) => {
          const template = templateForType(key)
          return {
            key,
            content: replacePatientPlaceholder(
              await callApi([sourceMessage], {
                action: 'document',
                documentType: key,
                template: template ? template.content : undefined,
              }),
              currentPatient.name,
            ),
          }
        }),
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

  // There is no server, so this file is the only backup that exists.
  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: session.name,
      clinicId: session.clinicId,
      clinicName: session.clinicName,
      schema: 1,
      state: appState,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `${session.clinicName.replace(/[^a-z0-9]+/gi, '-')}-backup-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Imported files are run through the same validators as saved state
  // rather than trusted, so a hand-edited or truncated file cannot poison
  // the app. Replaces rather than merges: a restore should be predictable.
  const handleImportData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>
      const raw = (parsed.state ?? parsed) as Record<string, unknown>
      if (typeof raw !== 'object' || raw === null) {
        throw new Error('Unrecognised file')
      }

      const importedPatients = Array.isArray(raw.patients)
        ? raw.patients.flatMap((item) => {
            const patient = normalisePatient(item)
            return patient ? [patient] : []
          })
        : []
      const importedDoctors = Array.isArray(raw.doctors) ? raw.doctors : []

      if (importedPatients.length === 0 && importedDoctors.length === 0) {
        window.alert(
          'That file contained no readable patients or doctors. Nothing has been changed.',
        )
        return
      }

      const confirmed = window.confirm(
        [
          'Restore from this file?',
          '',
          `The file holds ${importedPatients.length} patient${importedPatients.length === 1 ? '' : 's'} and ${importedDoctors.length} doctor${importedDoctors.length === 1 ? '' : 's'}.`,
          '',
          `This REPLACES everything currently in this browser, including the ${patients.length} patient${patients.length === 1 ? '' : 's'} here now.`,
          '',
          'Export the current data first if you have not already. Continue?',
        ].join('\n'),
      )
      if (!confirmed) {
        return
      }

      setAppState((current) => ({
        ...current,
        doctors: importedDoctors as Doctor[],
        patients: importedPatients,
        selectedPatientId: null,
        templates: Array.isArray(raw.templates)
          ? raw.templates.flatMap((item) => {
              const template = normaliseTemplate(item)
              return template ? [template] : []
            })
          : [],
        activityLog: appendActivity(
          current.activityLog,
          `Restored clinic data from a backup file (${importedPatients.length} patients)`,
        ),
      }))
      window.alert('Restore complete.')
    } catch (error) {
      console.error('Import failed:', error)
      window.alert(
        'That file could not be read as a LEOPA backup. Nothing has been changed.',
      )
    }
  }

  const handleCreatePatient = (input: PatientInput) => {
    const conversation = createConversation()
    const newPatient: Patient = {
      id: createId('patient'),
      ...input,
      name: input.name.trim(),
      assignedDoctorId: null,
      assignedBy: null,
      activeConversationId: conversation.id,
      conversations: [conversation],
    }

    setAppState((current) => ({
      ...current,
      workspace: 'patient',
      patients: [...current.patients, newPatient],
      selectedPatientId: newPatient.id,
      activityLog: appendActivity(
        current.activityLog,
        `Created patient "${newPatient.name}"`,
      ),
    }))
    setActiveTab('capture')
  }

  const handleUpdatePatient = (id: string, input: PatientInput) => {
    setAppState((current) => ({
      ...current,
      patients: current.patients.map((patient) =>
        patient.id === id
          ? { ...patient, ...input, name: input.name.trim() }
          : patient,
      ),
      activityLog: appendActivity(
        current.activityLog,
        `Updated patient "${input.name.trim()}"`,
      ),
    }))
  }

  const handleDeletePatient = (id: string) => {
    setAppState((current) => {
      const target = current.patients.find((patient) => patient.id === id)
      return {
        ...current,
        patients: current.patients.filter((patient) => patient.id !== id),
        selectedPatientId:
          current.selectedPatientId === id ? null : current.selectedPatientId,
        activityLog: appendActivity(
          current.activityLog,
          `Deleted patient "${target?.name ?? 'Unknown'}"`,
        ),
      }
    })
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
    setActiveTab('capture')
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
    setActiveTab('capture')
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
    setActiveTab('capture')
    setErrorMessage('')
  }

  // The logged-in doctor comes from the session (email login on the auth screen).
  const currentLoggedInDoctor =
    session.role === 'doctor'
      ? doctors.find((d) => d.id === session.userId) ?? null
      : null

  // Filter patients for logged-in doctor
  const getVisiblePatients = () => {
    if (!currentLoggedInDoctor) {
      return []
    }
    return patients.filter((p) => p.assignedDoctorId === currentLoggedInDoctor.id)
  }

  // Doctor handlers
  const handleAddDoctor = (doctor: Doctor) => {
    if (isEmailTaken(doctor.email)) {
      window.alert('This email is already in use. Please use a different email.')
      return
    }
    setAppState((current) => ({
      ...current,
      doctors: [...current.doctors, doctor],
      activityLog: appendActivity(
        current.activityLog,
        `Added doctor ${doctor.name} (${doctor.email})`,
      ),
    }))
  }

  const handleDeleteDoctor = (doctorId: string) => {
    setAppState((current) => {
      const target = current.doctors.find((d) => d.id === doctorId)
      return {
        ...current,
        doctors: current.doctors.filter((d) => d.id !== doctorId),
        // Unassign all patients from this doctor
        patients: current.patients.map((p) =>
          p.assignedDoctorId === doctorId
            ? { ...p, assignedDoctorId: null, assignedBy: null }
            : p,
        ),
        activityLog: appendActivity(
          current.activityLog,
          `Removed doctor ${target?.name ?? 'Unknown'}`,
        ),
      }
    })
  }

  const handleAssignPatient = (patientId: string, doctorId: string | '') => {
    setAppState((current) => {
      const patient = current.patients.find((p) => p.id === patientId)
      const doctor = current.doctors.find((d) => d.id === doctorId)
      const assignedBy: AssignmentInfo | null = doctorId
        ? {
            byName: session.name,
            byRole: session.role,
            at: new Date().toISOString(),
          }
        : null
      return {
        ...current,
        patients: current.patients.map((p) =>
          p.id === patientId
            ? { ...p, assignedDoctorId: doctorId || null, assignedBy }
            : p,
        ),
        activityLog: appendActivity(
          current.activityLog,
          doctorId
            ? `Assigned patient "${patient?.name ?? 'Unknown'}" to ${doctor?.name ?? 'Unknown'}`
            : `Unassigned patient "${patient?.name ?? 'Unknown'}"`,
        ),
      }
    })
  }

  if (session.role === 'admin') {
    if (!clinic) {
      onLogout()
      return null
    }
    return (
      <AdminDashboard
        session={session}
        clinic={clinic}
        doctors={doctors}
        patients={patients}
        activityLog={activityLog}
        onAddDoctor={handleAddDoctor}
        onDeleteDoctor={handleDeleteDoctor}
        onClinicUpdated={setClinic}
        onLogActivity={(action) =>
          setAppState((current) => ({
            ...current,
            activityLog: appendActivity(current.activityLog, action),
          }))
        }
        onLogout={onLogout}
      />
    )
  }

  if (session.role === 'receptionist') {
    return (
      <ReceptionistView
        clinicName={session.clinicName}
        doctors={doctors}
        onAssignPatient={handleAssignPatient}
        onCreatePatient={handleCreatePatient}
        onDeletePatient={handleDeletePatient}
        onLogout={onLogout}
        onUpdatePatient={handleUpdatePatient}
        patients={patients}
      />
    )
  }

  // Doctor role: their account may have been removed by the clinic admin.
  if (!currentLoggedInDoctor) {
    return (
      <div className="doctor-login-container">
        <div className="doctor-login-card">
          <div className="login-header">
            <h1>Account not found</h1>
            <p>
              Your doctor account is no longer active in {session.clinicName}.
              Please contact your clinic admin.
            </p>
          </div>
          <button className="btn-login" onClick={onLogout} type="button">
            Back to login
          </button>
        </div>
      </div>
    )
  }

  const visiblePatients = getVisiblePatients()

  return (
    <DoctorView
      activeTab={activeTab}
      currentConversation={currentConversation}
      currentPatient={currentPatient}
      errorMessage={errorMessage}
      isQuickQA={workspace === 'quick'}
      onApproveDocument={handleApproveDocument}
      onApproveSoap={handleApproveSoap}
      onClearConversation={handleClearConversation}
      onGenerateDocuments={handleGenerateDocuments}
      onGenerateSoap={handleGenerateSoap}
      onNewConsultation={handleNewConsultation}
      onSelectConversation={handleSelectConversation}
      onSelectPatient={handleSelectPatient}
      onSelectQuickQA={handleSelectQuickQA}
      onSend={handleSend}
      onUpdateCapture={handleUpdateCapture}
      onGenerateCharting={handleGenerateCharting}
      onUpdateCharting={handleUpdateCharting}
      onApproveCharting={handleApproveCharting}
      onExportData={handleExportData}
      onImportData={handleImportData}
      saveError={saveError}
      onSetActiveTab={setActiveTab}
      onUpdateSoap={handleUpdateSoap}
      currentDoctor={currentLoggedInDoctor}
      onDoctorLogout={onLogout}
      templates={doctorTemplates}
      onAddTemplate={handleAddTemplate}
      onDeleteTemplate={handleDeleteTemplate}
      onExtractTemplate={handleExtractTemplate}
      patients={visiblePatients}
      pendingAction={pendingAction}
      quickMessages={quickMessages}
      selectedPatientId={selectedPatientId}
    />
  )
}

export default App
