import { useState } from 'react'
import DoctorManagement, { type Doctor } from './DoctorManagement'
import type { ActivityEntry, Patient } from '../App'
import {
  addReceptionist,
  removeReceptionist,
  type Clinic,
  type Session,
} from '../auth'
import './AdminDashboard.css'
import './ReceptionistView.css'

interface AdminDashboardProps {
  session: Session
  clinic: Clinic
  doctors: Doctor[]
  patients: Patient[]
  activityLog: ActivityEntry[]
  onAddDoctor: (doctor: Doctor) => void
  onDeleteDoctor: (doctorId: string) => void
  onClinicUpdated: (clinic: Clinic) => void
  onLogActivity: (action: string) => void
  onLogout: () => void
}

type AdminTab = 'doctors' | 'receptionists' | 'patients' | 'activity'

const formatWhen = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const roleLabel = (role: string) =>
  role === 'admin' ? 'Admin' : role === 'receptionist' ? 'Receptionist' : 'Doctor'

export default function AdminDashboard({
  session,
  clinic,
  doctors,
  patients,
  activityLog,
  onAddDoctor,
  onDeleteDoctor,
  onClinicUpdated,
  onLogActivity,
  onLogout,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('doctors')
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState('')

  const handleAddReceptionist = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const result = addReceptionist(clinic.id, name, email)
    if (typeof result === 'string') {
      setFormError(result)
      return
    }
    const updated = result.find((c) => c.id === clinic.id)
    if (updated) {
      onClinicUpdated(updated)
    }
    onLogActivity(`Added receptionist ${name.trim()} (${email.trim()})`)
    setName('')
    setEmail('')
    setShowForm(false)
  }

  const handleRemoveReceptionist = (id: string, displayName: string) => {
    if (!window.confirm(`Remove ${displayName}? They will no longer be able to log in.`)) {
      return
    }
    const clinics = removeReceptionist(clinic.id, id)
    const updated = clinics.find((c) => c.id === clinic.id)
    if (updated) {
      onClinicUpdated(updated)
    }
    onLogActivity(`Removed receptionist ${displayName}`)
  }

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <div>
          <p className="view-kicker">Clinic Admin Dashboard</p>
          <h1>{clinic.name}</h1>
          <p className="admin-identity">
            Logged in as {session.name} ({session.email})
          </p>
        </div>
        <button className="btn-logout" onClick={onLogout} type="button">
          Logout
        </button>
      </header>

      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-value">{doctors.length}</span>
          <span className="stat-label">Doctors</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{clinic.receptionists.length}</span>
          <span className="stat-label">Receptionists</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{patients.length}</span>
          <span className="stat-label">Patients</span>
        </div>
      </div>

      <main className="admin-main">
        <div className="receptionist-tabs">
          <button
            className={`tab ${activeTab === 'doctors' ? 'active' : ''}`}
            onClick={() => setActiveTab('doctors')}
            type="button"
          >
            👨‍⚕️ Doctors
          </button>
          <button
            className={`tab ${activeTab === 'receptionists' ? 'active' : ''}`}
            onClick={() => setActiveTab('receptionists')}
            type="button"
          >
            🗂️ Receptionists
          </button>
          <button
            className={`tab ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
            type="button"
          >
            👥 Patients
          </button>
          <button
            className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
            type="button"
          >
            📋 Activity
          </button>
        </div>

        {activeTab === 'doctors' && (
          <DoctorManagement
            doctors={doctors}
            onAddDoctor={onAddDoctor}
            onDeleteDoctor={onDeleteDoctor}
          />
        )}

        {activeTab === 'receptionists' && (
          <div className="doctor-management">
            <div className="doctor-header">
              <h2>🗂️ Receptionists</h2>
              <button
                onClick={() => {
                  setShowForm(!showForm)
                  setFormError('')
                }}
                className="btn-primary"
                type="button"
              >
                {showForm ? 'Cancel' : '+ Add Receptionist'}
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleAddReceptionist} className="doctor-form">
                <div className="form-group">
                  <label>Receptionist Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jamie Lee"
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jamie@clinic.com"
                  />
                </div>

                {formError && <div className="error-message">{formError}</div>}

                <button type="submit" className="btn-primary">
                  Add Receptionist
                </button>
              </form>
            )}

            <div className="doctors-list">
              {clinic.receptionists.length === 0 ? (
                <p className="empty-state">
                  No receptionists yet. Add one so they can log in and manage
                  patients.
                </p>
              ) : (
                clinic.receptionists.map((receptionist) => (
                  <div key={receptionist.id} className="doctor-card">
                    <div className="doctor-info">
                      <h3>{receptionist.name}</h3>
                      <p className="email">{receptionist.email}</p>
                    </div>
                    <button
                      onClick={() =>
                        handleRemoveReceptionist(
                          receptionist.id,
                          receptionist.name,
                        )
                      }
                      className="btn-danger"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="doctor-management">
            <div className="doctor-header">
              <h2>👥 All Patients</h2>
            </div>
            <div className="doctors-list">
              {patients.length === 0 ? (
                <p className="empty-state">No patients yet.</p>
              ) : (
                patients.map((patient) => {
                  const doctor = doctors.find(
                    (d) => d.id === patient.assignedDoctorId,
                  )
                  return (
                    <div key={patient.id} className="doctor-card">
                      <div className="doctor-info">
                        <h3>{patient.name}</h3>
                        <p className="specialty">
                          {doctor
                            ? `Assigned to ${doctor.name}`
                            : 'Not assigned to a doctor'}
                        </p>
                        {patient.assignedBy && (
                          <p className="email">
                            Assigned by {patient.assignedBy.byName} (
                            {roleLabel(patient.assignedBy.byRole)}) on{' '}
                            {formatWhen(patient.assignedBy.at)}
                          </p>
                        )}
                        <p className="email">
                          {patient.conversations.length} consultation
                          {patient.conversations.length === 1 ? '' : 's'}
                          {patient.dob ? ` · DOB ${patient.dob}` : ''}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="doctor-management">
            <div className="doctor-header">
              <h2>📋 Activity Log</h2>
            </div>
            <div className="activity-list">
              {activityLog.length === 0 ? (
                <p className="empty-state">
                  No activity recorded yet. Actions like creating patients,
                  assigning doctors, and adding staff will appear here.
                </p>
              ) : (
                activityLog.map((entry) => (
                  <div key={entry.id} className="activity-entry">
                    <div className="activity-action">{entry.action}</div>
                    <div className="activity-meta">
                      {entry.actorName} ({roleLabel(entry.actorRole)}) ·{' '}
                      {formatWhen(entry.at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
