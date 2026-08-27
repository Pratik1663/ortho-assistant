import { useState } from 'react'
import type { Patient } from '../App'
import './ReceptionistView.css'

interface ReceptionistViewProps {
  patients: Patient[]
  onCreatePatient: (name: string, weight: number, dob: string) => void
  onDeletePatient: (id: string) => void
  onSwitchMode: () => void
}

export default function ReceptionistView({
  patients,
  onCreatePatient,
  onDeletePatient,
  onSwitchMode,
}: ReceptionistViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', weight: '', dob: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.name && formData.weight && formData.dob) {
      onCreatePatient(formData.name, parseInt(formData.weight), formData.dob)
      setFormData({ name: '', weight: '', dob: '' })
      setShowModal(false)
    }
  }

  return (
    <div className="receptionist-view">
      <header className="receptionist-header">
        <h1>Receptionist — Patient Management</h1>
        <button className="mode-toggle" onClick={onSwitchMode}>
          Switch to Doctor Mode
        </button>
      </header>

      <main className="receptionist-main">
        <section className="patient-list-section">
          <div className="section-header">
            <h2>Patients</h2>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              + New Patient
            </button>
          </div>

          {patients.length === 0 ? (
            <p className="empty-state">No patients yet. Create one to get started.</p>
          ) : (
            <div className="patient-cards">
              {patients.map((patient) => (
                <div key={patient.id} className="patient-card">
                  <div className="patient-info">
                    <h3>{patient.name}</h3>
                    <p>DOB: {patient.dob}</p>
                    <p>Weight: {patient.weight} lbs</p>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => onDeletePatient(patient.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Patient</h2>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Patient Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <input
                type="number"
                placeholder="Weight (lbs)"
                value={formData.weight}
                onChange={(e) =>
                  setFormData({ ...formData, weight: e.target.value })
                }
                required
              />
              <input
                type="date"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
                required
              />
              <div className="modal-buttons">
                <button type="submit" className="btn-primary">
                  Create Patient
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}