import { useState } from 'react'
import { createClinic, findUserByEmail, type Session } from '../auth'

interface AuthScreenProps {
  onLogin: (session: Session) => void
}

type AuthTab = 'login' | 'signup'

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [tab, setTab] = useState<AuthTab>('login')

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginError, setLoginError] = useState('')

  // Signup form
  const [clinicName, setClinicName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [signupError, setSignupError] = useState('')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    if (!loginEmail.trim()) {
      setLoginError('Email is required.')
      return
    }
    const session = findUserByEmail(loginEmail)
    if (!session) {
      setLoginError(
        'No account found for this email. Check the spelling, or ask your clinic admin to add you.',
      )
      return
    }
    onLogin(session)
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    setSignupError('')
    const result = createClinic(clinicName, adminName, adminEmail)
    if (typeof result === 'string') {
      setSignupError(result)
      return
    }
    onLogin({
      clinicId: result.id,
      clinicName: result.name,
      role: 'admin',
      userId: result.admin.id,
      name: result.admin.name,
      email: result.admin.email,
    })
  }

  return (
    <div className="doctor-login-container">
      <div className="doctor-login-card auth-card">
        <div className="leo-login-logo">
          <img alt="LEO Lab" src="/leo-logo.png" />
        </div>
        <p className="leo-tagline">Precision Custom Orthotics</p>
        <div className="login-header">
          <h1>LEOPA</h1>
          <p>Leading Edge Orthotics Prescription Assistant — Clinic sign in</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => setTab('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => setTab('signup')}
            type="button"
          >
            Create Clinic Account
          </button>
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your.email@clinic.com"
                autoFocus
              />
            </div>

            {loginError && <div className="error-message">{loginError}</div>}

            <button type="submit" className="btn-login">
              Login
            </button>

            <p className="auth-hint">
              Admins, receptionists, and doctors all log in here with their own
              email.
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="login-form">
            <div className="form-group">
              <label htmlFor="clinic-name">Clinic Name</label>
              <input
                id="clinic-name"
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="Downtown Foot Clinic"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-name">Your Name (Clinic Admin)</label>
              <input
                id="admin-name"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Alex Morgan"
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-email">Your Email</label>
              <input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@clinic.com"
              />
            </div>

            {signupError && <div className="error-message">{signupError}</div>}

            <button type="submit" className="btn-login">
              Create Clinic
            </button>

            <p className="auth-hint">
              You'll be the clinic admin and can add doctors and receptionists
              from your dashboard.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
