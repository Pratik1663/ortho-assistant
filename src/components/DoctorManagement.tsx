import { useState } from 'react'

export interface Doctor {
  id: string
  name: string
  email: string
  specialty: string
  createdAt: string
}

interface DoctorManagementProps {
  doctors: Doctor[]
  onAddDoctor: (doctor: Doctor) => void
  onDeleteDoctor: (doctorId: string) => void
}

export default function DoctorManagement({
  doctors,
  onAddDoctor,
  onDeleteDoctor,
}: DoctorManagementProps) {
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    specialty: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.email.trim() || !formData.specialty.trim()) {
      alert('All fields required')
      return
    }

    const newDoctor: Doctor = {
      id: `doctor-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      specialty: formData.specialty,
      createdAt: new Date().toISOString(),
    }

    onAddDoctor(newDoctor)
    setFormData({ name: '', email: '', specialty: '' })
    setShowForm(false)
  }

  return (
    <div className="doctor-management">
      <div className="doctor-header">
        <h2>👨‍⚕️ Doctors</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Add Doctor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="doctor-form">
          <div className="form-group">
            <label>Doctor Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Dr. John Doe"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@clinic.com"
            />
          </div>

          <div className="form-group">
            <label>Specialty</label>
            <select
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            >
              <option value="">Select specialty</option>
              <option value="Podiatrist">Podiatrist</option>
              <option value="Chiropodist">Chiropodist</option>
              <option value="Physician">Physician</option>
              <option value="Orthotist">Orthotist</option>
            </select>
          </div>

          <button type="submit" className="btn-primary">
            Add Doctor
          </button>
        </form>
      )}

      <div className="doctors-list">
        {doctors.length === 0 ? (
          <p className="empty-state">No doctors added yet</p>
        ) : (
          doctors.map((doctor) => (
            <div key={doctor.id} className="doctor-card">
              <div className="doctor-info">
                <h3>{doctor.name}</h3>
                <p className="specialty">{doctor.specialty}</p>
                <p className="email">{doctor.email}</p>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete ${doctor.name}?`)) {
                    onDeleteDoctor(doctor.id)
                  }
                }}
                className="btn-danger"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
