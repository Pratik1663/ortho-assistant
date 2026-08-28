// Task Block 6 — Clinic accounts, staff sub-accounts, and sessions.
// All data stays in this browser's localStorage (no server-side storage),
// consistent with the app's existing privacy design.

export type Role = 'admin' | 'receptionist' | 'doctor'

export interface StaffMember {
  id: string
  name: string
  email: string
  createdAt: string
}

export interface Clinic {
  id: string
  name: string
  createdAt: string
  admin: StaffMember
  receptionists: StaffMember[]
}

export interface Session {
  clinicId: string
  clinicName: string
  role: Role
  userId: string
  name: string
  email: string
}

const CLINICS_KEY = 'orthotic_clinics_v1'
const SESSION_KEY = 'orthotic_session_v1'
const LEGACY_STATE_KEY = 'orthotic_app_state'

export const clinicStateKey = (clinicId: string) =>
  `orthotic_app_state_${clinicId}`

const createId = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
}

const normaliseEmail = (email: string) => email.trim().toLowerCase()

const isStaffMember = (value: unknown): value is StaffMember => {
  if (typeof value !== 'object' || value === null) return false
  const member = value as Record<string, unknown>
  return (
    typeof member.id === 'string' &&
    typeof member.name === 'string' &&
    typeof member.email === 'string'
  )
}

export const loadClinics = (): Clinic[] => {
  try {
    const saved = localStorage.getItem(CLINICS_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (typeof item !== 'object' || item === null) return []
      const clinic = item as Record<string, unknown>
      if (
        typeof clinic.id !== 'string' ||
        typeof clinic.name !== 'string' ||
        !isStaffMember(clinic.admin)
      ) {
        return []
      }
      return [
        {
          id: clinic.id,
          name: clinic.name,
          createdAt:
            typeof clinic.createdAt === 'string'
              ? clinic.createdAt
              : new Date().toISOString(),
          admin: clinic.admin,
          receptionists: Array.isArray(clinic.receptionists)
            ? clinic.receptionists.filter(isStaffMember)
            : [],
        },
      ]
    })
  } catch (error) {
    console.error('Failed to load clinics:', error)
    return []
  }
}

export const saveClinics = (clinics: Clinic[]) => {
  try {
    localStorage.setItem(CLINICS_KEY, JSON.stringify(clinics))
  } catch (error) {
    console.error('Failed to save clinics:', error)
  }
}

export const loadSession = (): Session | null => {
  try {
    const saved = localStorage.getItem(SESSION_KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Record<string, unknown>
    if (
      typeof parsed.clinicId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.email !== 'string' ||
      (parsed.role !== 'admin' &&
        parsed.role !== 'receptionist' &&
        parsed.role !== 'doctor')
    ) {
      return null
    }
    // The clinic must still exist.
    const clinic = loadClinics().find((c) => c.id === parsed.clinicId)
    if (!clinic) return null
    return {
      clinicId: parsed.clinicId,
      clinicName: clinic.name,
      role: parsed.role,
      userId: parsed.userId,
      name: parsed.name,
      email: parsed.email,
    }
  } catch (error) {
    console.error('Failed to load session:', error)
    return null
  }
}

export const saveSession = (session: Session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.error('Failed to clear session:', error)
  }
}

// Read the doctors list out of a clinic's saved app state without needing
// the full App normalisation logic.
const loadClinicDoctors = (
  clinicId: string,
): { id: string; name: string; email: string }[] => {
  try {
    const saved = localStorage.getItem(clinicStateKey(clinicId))
    if (!saved) return []
    const parsed = JSON.parse(saved) as Record<string, unknown>
    if (!Array.isArray(parsed.doctors)) return []
    return parsed.doctors.filter(isStaffMember)
  } catch {
    return []
  }
}

/** True if this email already belongs to any admin, receptionist, or doctor in any clinic. */
export const isEmailTaken = (email: string): boolean => {
  const target = normaliseEmail(email)
  if (!target) return false
  const clinics = loadClinics()
  for (const clinic of clinics) {
    if (normaliseEmail(clinic.admin.email) === target) return true
    if (clinic.receptionists.some((r) => normaliseEmail(r.email) === target)) {
      return true
    }
    if (
      loadClinicDoctors(clinic.id).some((d) => normaliseEmail(d.email) === target)
    ) {
      return true
    }
  }
  return false
}

/** Find a user by email across all clinics and roles. */
export const findUserByEmail = (email: string): Session | null => {
  const target = normaliseEmail(email)
  if (!target) return null
  const clinics = loadClinics()
  for (const clinic of clinics) {
    if (normaliseEmail(clinic.admin.email) === target) {
      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        role: 'admin',
        userId: clinic.admin.id,
        name: clinic.admin.name,
        email: clinic.admin.email,
      }
    }
    const receptionist = clinic.receptionists.find(
      (r) => normaliseEmail(r.email) === target,
    )
    if (receptionist) {
      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        role: 'receptionist',
        userId: receptionist.id,
        name: receptionist.name,
        email: receptionist.email,
      }
    }
    const doctor = loadClinicDoctors(clinic.id).find(
      (d) => normaliseEmail(d.email) === target,
    )
    if (doctor) {
      return {
        clinicId: clinic.id,
        clinicName: clinic.name,
        role: 'doctor',
        userId: doctor.id,
        name: doctor.name,
        email: doctor.email,
      }
    }
  }
  return null
}

/**
 * Create a new clinic with an admin account. Returns the new clinic, or an
 * error message string if the email is already in use.
 * If this is the very first clinic and data from the pre-clinic version of the
 * app exists, that data is migrated into the new clinic so nothing is lost.
 */
export const createClinic = (
  clinicName: string,
  adminName: string,
  adminEmail: string,
): Clinic | string => {
  const name = clinicName.trim()
  const admin = adminName.trim()
  const email = adminEmail.trim()
  if (!name || !admin || !email) {
    return 'All fields are required.'
  }
  if (isEmailTaken(email)) {
    return 'This email is already in use. Please use a different email.'
  }

  const clinics = loadClinics()
  const clinic: Clinic = {
    id: createId('clinic'),
    name,
    createdAt: new Date().toISOString(),
    admin: {
      id: createId('admin'),
      name: admin,
      email,
      createdAt: new Date().toISOString(),
    },
    receptionists: [],
  }

  // Migrate legacy (pre-Task-Block-6) data into the first clinic created.
  if (clinics.length === 0) {
    try {
      const legacy = localStorage.getItem(LEGACY_STATE_KEY)
      if (legacy) {
        localStorage.setItem(clinicStateKey(clinic.id), legacy)
      }
    } catch (error) {
      console.error('Legacy data migration failed:', error)
    }
  }

  saveClinics([...clinics, clinic])
  return clinic
}

export const addReceptionist = (
  clinicId: string,
  name: string,
  email: string,
): Clinic[] | string => {
  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  if (!trimmedName || !trimmedEmail) {
    return 'Name and email are required.'
  }
  if (isEmailTaken(trimmedEmail)) {
    return 'This email is already in use. Please use a different email.'
  }
  const clinics = loadClinics().map((clinic) =>
    clinic.id === clinicId
      ? {
          ...clinic,
          receptionists: [
            ...clinic.receptionists,
            {
              id: createId('receptionist'),
              name: trimmedName,
              email: trimmedEmail,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      : clinic,
  )
  saveClinics(clinics)
  return clinics
}

export const removeReceptionist = (
  clinicId: string,
  receptionistId: string,
): Clinic[] => {
  const clinics = loadClinics().map((clinic) =>
    clinic.id === clinicId
      ? {
          ...clinic,
          receptionists: clinic.receptionists.filter(
            (r) => r.id !== receptionistId,
          ),
        }
      : clinic,
  )
  saveClinics(clinics)
  return clinics
}

export const getClinic = (clinicId: string): Clinic | null =>
  loadClinics().find((c) => c.id === clinicId) ?? null
