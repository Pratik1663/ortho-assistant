import { useState } from 'react'
import {
  RX_FIELDS,
  countSettled,
  type FieldSide,
  type PrescriptionState,
} from '../prescriptionState'

interface PrescriptionPanelProps {
  state: PrescriptionState
}

function Cell({ side }: { side: FieldSide }) {
  if (side.status === 'open') {
    // Deliberately empty rather than dashed. An unanswered field should read as
    // unanswered at a glance; that is the whole reason the panel exists.
    return <span className="rx-cell open" aria-label="Not yet decided" />
  }
  return (
    <span className={`rx-cell ${side.status}`}>
      {side.value}
    </span>
  )
}

/**
 * The build so far, left foot and right foot side by side.
 *
 * Two columns rather than one list because asymmetry is the error that is
 * hardest to catch in prose. A left column filling up on a foot described as
 * unremarkable is obvious here and nearly invisible in a conversation.
 */
function PrescriptionPanel({ state }: PrescriptionPanelProps) {
  const [open, setOpen] = useState(true)
  const { settled, total } = countSettled(state)

  return (
    <div className={`rx-panel${open ? '' : ' collapsed'}`}>
      <button
        aria-expanded={open}
        className="rx-panel-header"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="rx-panel-title">Prescription</span>
        <span className="rx-panel-count">
          {settled} of {total} fields
        </span>
        <span aria-hidden="true" className="rx-panel-chevron">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="rx-panel-body">
          <div className="rx-row rx-head">
            <span className="rx-label" />
            <span className="rx-col-head">Left</span>
            <span className="rx-col-head">Right</span>
          </div>
          {RX_FIELDS.map((field) => {
            const entry = state[field.key]
            const isOpen =
              entry.left.status === 'open' && entry.right.status === 'open'

            return (
              <div className={`rx-row${isOpen ? ' pending' : ''}`} key={field.key}>
                <span className="rx-label">{field.label}</span>
                <Cell side={entry.left} />
                <Cell side={entry.right} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PrescriptionPanel
