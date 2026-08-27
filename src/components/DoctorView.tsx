import { Message, Patient } from '../App'
import MessageList from './MessageList'
import Composer from './Composer'
import Header from './Header'
import './DoctorView.css'

interface DoctorViewProps {
  patients: Patient[]
  selectedPatientId: string | null
  onSelectPatient: (id: string) => void
  onSwitchMode: () => void
  currentPatient: Patient | null
  messages: Message[]
  pending: boolean
  onSend: (content: string) => void
}

export default function DoctorView({
  patients,
  selectedPatientId,
  onSelectPatient,
  onSwitchMode,
  currentPatient,
  messages,
  pending,
  onSend,
}: DoctorViewProps) {
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

  return (
    <div className="doctor-view">
      <Header />

      <div className="doctor-container">
        {/* Sidebar with patient list */}
        <aside className="doctor-sidebar">
          <h2>Patients</h2>
          <div className="mode-toggle-container">
            <button className="mode-toggle-btn" onClick={onSwitchMode}>
              Switch to Receptionist
            </button>
          </div>
          {patients.length === 0 ? (
            <p className="no-patients">No patients yet. Switch to Receptionist mode to create one.</p>
          ) : (
            <div className="patient-list">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  className={`patient-item ${selectedPatientId === patient.id ? 'active' : ''}`}
                  onClick={() => onSelectPatient(patient.id)}
                >
                  <div className="patient-name">{patient.name}</div>
                  <div className="patient-meta">
                    Age {calculateAge(patient.dob)}, {patient.weight} lbs
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main chat area */}
        <main className="doctor-main">
          {!selectedPatientId ? (
            <div className="no-selection">
              <p>Select a patient from the list to start a conversation.</p>
            </div>
          ) : currentPatient ? (
            <>
              {/* Patient header */}
              <div className="patient-header">
                <div className="patient-header-info">
                  <h1>{currentPatient.name}</h1>
                  <div className="patient-stats">
                    <span>Age: {calculateAge(currentPatient.dob)}</span>
                    <span>Weight: {currentPatient.weight} lbs</span>
                    <span>DOB: {currentPatient.dob}</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <MessageList messages={messages} pending={pending} />

              {/* Composer */}
              <Composer onSend={onSend} pending={pending} />
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}