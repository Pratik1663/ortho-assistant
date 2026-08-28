import { useState } from 'react'
import type { Doctor } from './DoctorManagement'

interface DoctorLoginProps {
  doctors: Doctor[]
  onLogin: (doctor: Doctor) => void
}

export default function DoctorLogin({ doctors, onLogin }: DoctorLoginProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    const doctor = doctors.find((d) => d.email.toLowerCase() === email.toLowerCase())

    if (!doctor) {
      setError('Doctor not found. Please check your email.')
      return
    }

    onLogin(doctor)
  }

  return (
    <div className="doctor-login-container">
      <div className="doctor-login-card">
        <div className="login-header">
          <h1>👨‍⚕️ Doctor Login</h1>
          <p>Orthotic Prescription Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@clinic.com"
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn-login">
            Login
          </button>
        </form>

        {doctors.length > 0 && (
          <div className="available-doctors">
            <p className="label">Available doctors:</p>
            <div className="doctor-list">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="doctor-item">
                  <span className="doctor-name">{doctor.name}</span>
                  <span className="doctor-email">{doctor.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {doctors.length === 0 && (
          <div className="no-doctors-message">
            <p>No doctors registered yet. Please ask the receptionist to add doctors.</p>
          </div>
        )}
      </div>
    </div>
  )
}
