import type { Patient } from '../App'
import type { Doctor } from './DoctorManagement'

interface PatientAssignmentProps {
  patients: Patient[]
  doctors: Doctor[]
  onAssignPatient: (patientId: string, doctorId: string) => void
}

export default function PatientAssignment({
  patients,
  doctors,
  onAssignPatient,
}: PatientAssignmentProps) {
  const getAssignedDoctor = (doctorId: string | null) => {
    if (!doctorId) return 'Unassigned'
    return doctors.find((d) => d.id === doctorId)?.name || 'Unknown Doctor'
  }

  return (
    <div className="patient-assignment">
      <h2>🔗 Patient Assignments</h2>

      <div className="assignment-table">
        <div className="table-header">
          <div className="col-name">Patient Name</div>
          <div className="col-complaint">Complaint</div>
          <div className="col-doctor">Assigned Doctor</div>
          <div className="col-action">Change</div>
        </div>

        {patients.length === 0 ? (
          <p className="empty-state">No patients created yet</p>
        ) : (
          patients.map((patient) => (
            <div key={patient.id} className="table-row">
              <div className="col-name">{patient.name}</div>
              <div className="col-complaint">{patient.complaint}</div>
              <div className="col-doctor">{getAssignedDoctor(patient.assignedDoctorId)}</div>
              <div className="col-action">
                <select
                  value={patient.assignedDoctorId || ''}
                  onChange={(e) => {
                    onAssignPatient(patient.id, e.target.value)
                  }}
                  className="assign-select"
                >
                  <option value="">Unassigned</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
