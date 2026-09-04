import { useState } from 'react'
import {
  FIELD_EDIT_OPTIONS,
  RX_FIELDS,
  countSettled,
  type FieldSide,
  type PrescriptionState,
} from '../prescriptionState'

export interface FieldEdit {
  /** Form-order key, e.g. heel_cup. */
  key: string
  /** Human label, used to phrase the change. */
  label: string
  /** The chosen value, or undefined when the field needs a conversation. */
  value?: string
  /** Named only when the feet currently differ. */
  side?: 'L' | 'R'
}

interface PrescriptionPanelProps {
  state: PrescriptionState
  onEdit?: (edit: FieldEdit) => void
  disabled?: boolean
}

function Cell({ side }: { side: FieldSide }) {
  if (side.status === 'open') {
    // Deliberately empty rather than dashed. An unanswered field should read as
    // unanswered at a glance; that is the whole reason the panel exists.
    return <span className="rx-cell open" aria-label="Not yet decided" />
  }
  return <span className={`rx-cell ${side.status}`}>{side.value}</span>
}

/**
 * The build so far, left foot and right foot side by side.
 *
 * Two columns rather than one list because asymmetry is the error that is
 * hardest to catch in prose. A left column filling up on a foot described as
 * unremarkable is obvious here and nearly invisible in a conversation.
 *
 * Rows are clickable so a field can be corrected where it is shown, rather
 * than by hunting back through the conversation for where it was decided.
 */
function PrescriptionPanel({ state, onEdit, disabled }: PrescriptionPanelProps) {
  // Collapsed by default. The header carries the counts, which is the part
  // worth seeing continuously; the rows are for when you want to check.
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const { settled, total, left, right } = countSettled(state)

  const editable = Boolean(onEdit) && !disabled

  const choose = (key: string, label: string, value?: string) => {
    const entry = state[key]
    // Only name a side when the feet currently differ. On a matched pair the
    // change applies to both, and naming one would quietly split them.
    const split =
      entry.left.status !== entry.right.status || entry.left.value !== entry.right.value
    onEdit?.({ key, label, side: split ? 'R' : undefined, value })
    setEditing(null)
  }

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
          {settled} of {total}
        </span>
        <span className="rx-panel-sides">
          <span className={`rx-side-count${left > 0 ? ' active' : ''}`}>L {left}</span>
          <span className={`rx-side-count${right > 0 ? ' active' : ''}`}>R {right}</span>
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
            const isOpen = entry.left.status === 'open' && entry.right.status === 'open'
            const options = FIELD_EDIT_OPTIONS[field.key]
            const isEditing = editing === field.key

            return (
              <div key={field.key}>
                <div
                  className={`rx-row${isOpen ? ' pending' : ''}${
                    editable ? ' editable' : ''
                  }${isEditing ? ' editing' : ''}`}
                  onClick={
                    editable
                      ? () =>
                          setEditing((current) =>
                            current === field.key ? null : field.key,
                          )
                      : undefined
                  }
                  role={editable ? 'button' : undefined}
                  tabIndex={editable ? 0 : undefined}
                >
                  <span className="rx-label">{field.label}</span>
                  <Cell side={entry.left} />
                  <Cell side={entry.right} />
                </div>

                {isEditing && (
                  <div className="rx-edit">
                    {options ? (
                      options.map((option) => (
                        <button
                          className="option-chip"
                          key={option}
                          onClick={() => choose(field.key, field.label, option)}
                          type="button"
                        >
                          {option}
                        </button>
                      ))
                    ) : (
                      <button
                        className="option-chip"
                        onClick={() => choose(field.key, field.label)}
                        type="button"
                      >
                        Change {field.label.toLowerCase()}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PrescriptionPanel
