import { useEffect, useState } from 'react'
import Composer from './components/Composer'
import Header from './components/Header'
import MessageList from './components/MessageList'
import ReceptionistView from './components/ReceptionistView'
import DoctorView from './components/DoctorView'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Patient {
  id: string
  name: string
  weight: number
  dob: string
  conversations?: Array<{ messages: Message[] }>
}

type AppMode = 'receptionist' | 'doctor'

function App() {
  const [mode, setMode] = useState<AppMode>('doctor')
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('orthotic_app_state')
    if (saved) {
      try {
        const state = JSON.parse(saved)
        setMode(state.mode || 'doctor')
        setPatients(state.patients || [])
        setSelectedPatientId(state.selectedPatientId || null)
        
        // Load conversations for selected patient if exists
        if (state.selectedPatientId && state.patients) {
          const patient = state.patients.find((p: Patient) => p.id === state.selectedPatientId)
          if (patient?.conversations?.[0]) {
            setMessages(patient.conversations[0].messages || [])
          }
        }
      } catch (error) {
        console.error('Failed to load saved state:', error)
      }
    }
  }, [])

  // Save to localStorage whenever state changes
  useEffect(() => {
    const state = {
      mode,
      patients,
      selectedPatientId,
    }
    localStorage.setItem('orthotic_app_state', JSON.stringify(state))
  }, [mode, patients, selectedPatientId])

  // Save messages when they change
  useEffect(() => {
    if (selectedPatientId && patients) {
      const updatedPatients = patients.map((p) => {
        if (p.id === selectedPatientId) {
          return {
            ...p,
            conversations: [{ messages }],
          }
        }
        return p
      })
      setPatients(updatedPatients)
    }
  }, [messages, selectedPatientId, patients])

  const currentPatient = patients.find((p) => p.id === selectedPatientId) || null

  const calculateAge = (dob: string) => {
    const today = new Date()
    const birthDate = new Date(dob)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const handleSend = async (content: string) => {
    if (pending || content.trim().length === 0) {
      return
    }

    const userMessage: Message = { role: 'user', content }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setPending(true)

    try {
      // Build patient context
      let patientContext = {}
      if (currentPatient) {
        const age = calculateAge(currentPatient.dob)
        patientContext = {
          name: currentPatient.name,
          weight: currentPatient.weight,
          age: age,
          context: `Patient name: ${currentPatient.name}, age ${age}, weight ${currentPatient.weight} lbs.`,
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          patientContext,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'API request failed')
      }

      const data = await response.json()
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.reply },
      ])
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
      ])
    } finally {
      setPending(false)
    }
  }

  const handleCreatePatient = (name: string, weight: number, dob: string) => {
    const newPatient: Patient = {
      id: `patient-${Date.now()}`,
      name,
      weight,
      dob,
      conversations: [],
    }
    setPatients([...patients, newPatient])
    setSelectedPatientId(newPatient.id)
    setMessages([])
  }

  const handleDeletePatient = (id: string) => {
    setPatients(patients.filter((p) => p.id !== id))
    if (selectedPatientId === id) {
      setSelectedPatientId(null)
      setMessages([])
    }
  }

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id)
    const patient = patients.find((p) => p.id === id)
    if (patient?.conversations?.[0]) {
      setMessages(patient.conversations[0].messages || [])
    } else {
      setMessages([])
    }
  }

  if (mode === 'receptionist') {
    return (
      <ReceptionistView
        patients={patients}
        onCreatePatient={handleCreatePatient}
        onDeletePatient={handleDeletePatient}
        onSwitchMode={() => setMode('doctor')}
      />
    )
  }

  return (
    <DoctorView
      patients={patients}
      selectedPatientId={selectedPatientId}
      onSelectPatient={handleSelectPatient}
      onSwitchMode={() => setMode('receptionist')}
      currentPatient={currentPatient}
      messages={messages}
      pending={pending}
      onSend={handleSend}
    />
  )
}

export default App