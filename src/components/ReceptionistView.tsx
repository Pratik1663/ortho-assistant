import { useState, type FormEvent } from 'react'
import type { Patient, PatientInput } from '../App'
import './ReceptionistView.css'

interface ReceptionistViewProps {
  patients: Patient[]
  onCreatePatient: (input: PatientInput) => void
  onUpdatePatient: (id: string, input: PatientInput) => void
  onDeletePatient: (id: string) => void
  onSwitchMode: () => void
}

interface PatientFormData {
  name: string
  weight: string
  dob: string
  complaint: string
  shoeSize: string
  footwearType: string
  activityLevel: string
  notes: string
}

const EMPTY_FORM: PatientFormData = {
  name: '',
  weight: '',
  dob: '',
  complaint: '',
  shoeSize: '',
  footwearType: '',
  activityLevel: '',
  notes: '',
}

export default function ReceptionistView({
  patients,
  onCreatePatient,
  onUpdatePatient,
  onDeletePatient,
  onSwitchMode,
}: ReceptionistViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null)
  const [formData, setFormData] = useState<PatientFormData>(EMPTY_FORM)

  const openCreateModal = () => {
    setEditingPatientId(null)
    setFormData(EMPTY_FORM)
    setShowModal(true)
  }

  const openEditModal = (patient: Patient) => {
    setEditingPatientId(patient.id)
    setFormData({
      name: patient.name,
      weight: patient.weight > 0 ? String(patient.weight) : '',
      dob: patient.dob,
      complaint: patient.complaint,
      shoeSize: patient.shoeSize,
      footwearType: patient.footwearType,
      activityLevel: patient.activityLevel,
      notes: patient.notes,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPatientId(null)
    setFormData(EMPTY_FORM)
  }

  const setField = (field: keyof PatientFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = formData.name.trim()
    const weight = formData.weight.trim() ? Number(formData.weight) : 0

    if (!name || !Number.isFinite(weight) || weight < 0) {
      return
    }

    const input: PatientInput = {
      name,
      weight,
      dob: formData.dob,
      complaint: formData.complaint.trim(),
      shoeSize: formData.shoeSize.trim(),
      footwearType: formData.footwearType.trim(),
      activityLevel: formData.activityLevel.trim(),
      notes: formData.notes.trim(),
    }

    if (editingPatientId) {
      onUpdatePatient(editingPatientId, input)
    } else {
      onCreatePatient(input)
    }
    closeModal()
  }

  const requestDelete = (patient: Patient) => {
    if (window.confirm(`Delete ${patient.name} and their consultation history?`)) {
      onDeletePatient(patient.id)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="receptionist-view">
      <header className="receptionist-header">
        <div>
          <p className="view-kicker">Orthotic Prescription Assistant</p>
          <h1>Patient Management</h1>
        </div>
        <button className="mode-toggle" onClick={onSwitchMode} type="button">
          Switch to Practitioner Mode
        </button>
      </header>

      <main className="receptionist-main">
        <section className="patient-list-section" aria-labelledby="patients-heading">
          <div className="section-header">
            <div>
              <h2 id="patients-heading">Patients</h2>
              <p>Patient files and consultations are stored only on this device.</p>
            </div>
            <button className="btn-primary" onClick={openCreateModal} type="button">
              + New Patient
            </button>
          </div>

          {patients.length === 0 ? (
            <div className="empty-state">
              <h3>No patients yet</h3>
              <p>Create a patient file to begin a consultation.</p>
            </div>
          ) : (
            <div className="patient-cards">
              {patients.map((patient) => (
                <article key={patient.id} className="patient-card">
                  <div className="patient-info">
                    <h3>{patient.name}</h3>
                    <p><span>DOB</span>{patient.dob || 'Not entered'}</p>
                    <p><span>Weight</span>{patient.weight > 0 ? `${patient.weight} lbs` : 'Not entered'}</p>
                    <p><span>Consultations</span>{patient.conversations.length}</p>
                    {patient.complaint && <p><span>Case</span>{patient.complaint}</p>}
                  </div>
                  <div className="patient-actions">
                    <button
                      className="btn-edit"
                      onClick={() => openEditModal(patient)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => requestDelete(patient)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div
            aria-labelledby="patient-modal-title"
            aria-modal="true"
            className="modal patient-modal-wide"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="view-kicker">Local patient file</p>
                <h2 id="patient-modal-title">
                  {editingPatientId ? 'Edit Patient' : 'Create New Patient'}
                </h2>
              </div>
              <button aria-label="Close" className="modal-close" onClick={closeModal} type="button">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="patient-form-grid">
                <label className="full-row">
                  Display name or label
                  <input
                    autoFocus
                    maxLength={100}
                    onChange={(event) => setField('name', event.target.value)}
                    placeholder="Initials or local label"
                    required
                    type="text"
                    value={formData.name}
                  />
                </label>
                <label>
                  Date of birth
                  <input
                    max={today}
                    onChange={(event) => setField('dob', event.target.value)}
                    type="date"
                    value={formData.dob}
                  />
                </label>
                <label>
                  Weight (lbs)
                  <input
                    min="0"
                    onChange={(event) => setField('weight', event.target.value)}
                    placeholder="Optional"
                    step="0.1"
                    type="number"
                    value={formData.weight}
                  />
                </label>
                <label className="full-row">
                  Chief complaint / case reason
                  <input
                    maxLength={250}
                    onChange={(event) => setField('complaint', event.target.value)}
                    placeholder="Optional"
                    type="text"
                    value={formData.complaint}
                  />
                </label>
                <label>
                  Shoe size
                  <input
                    maxLength={40}
                    onChange={(event) => setField('shoeSize', event.target.value)}
                    placeholder="Optional"
                    type="text"
                    value={formData.shoeSize}
                  />
                </label>
                <label>
                  Footwear type
                  <input
                    maxLength={100}
                    onChange={(event) => setField('footwearType', event.target.value)}
                    placeholder="Optional"
                    type="text"
                    value={formData.footwearType}
                  />
                </label>
                <label className="full-row">
                  Activity level
                  <input
                    maxLength={150}
                    onChange={(event) => setField('activityLevel', event.target.value)}
                    placeholder="Optional"
                    type="text"
                    value={formData.activityLevel}
                  />
                </label>
                <label className="full-row">
                  Assessment notes
                  <textarea
                    maxLength={3000}
                    onChange={(event) => setField('notes', event.target.value)}
                    placeholder="Optional"
                    rows={4}
                    value={formData.notes}
                  />
                </label>
              </div>
              <p className="privacy-form-note">
                The display name stays on this device and is not sent to the AI.
              </p>
              <div className="modal-buttons">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingPatientId ? 'Save Changes' : 'Create Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
