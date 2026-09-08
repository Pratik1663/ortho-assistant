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

function Cell({
  side,
  onClick,
  label,
}: {
  side: FieldSide
  onClick?: () => void
  label?: string
}) {
  const body = renderValue(side)
  if (!onClick) {
    return body
  }
  return (
    <span
      aria-label={label}
      className="rx-cell-hit"
      onClick={(event) => {
        // The row toggles the editor; a cell click targets one foot, so it
        // must not also fire the row handler.
        event.stopPropagation()
        onClick()
      }}
      role="button"
      tabIndex={0}
    >
      {body}
    </span>
  )
}

function renderValue(side: FieldSide) {
  if (side.status === 'open') {
    // Deliberately empty rather than dashed. An unanswered field should read as
    // unanswered at a glance; that is the whole reason the panel exists.
    return <span className="rx-cell open" aria-label="Not yet decided" />
  }
  if (side.status === 'invalid') {
    // A value that is not on the form is worse than a missing one, because it
    // reads as decided. Marked rather than hidden, so it can be corrected.
    return (
      <span
        className="rx-cell invalid"
        title="Not an option on the LEO Lab form — check this before ordering"
      >
        {side.value}
        <span aria-hidden="true" className="rx-flag">
          !
        </span>
      </span>
    )
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
  // Which foot the open editor will change. Null means the field as a whole.
  const [target, setTarget] = useState<'L' | 'R' | null>(null)
  const { settled, total, left, right } = countSettled(state)
  const flagged = RX_FIELDS.filter(
    (field) =>
      state[field.key].left.status === 'invalid' ||
      state[field.key].right.status === 'invalid',
  ).length

  const editable = Boolean(onEdit) && !disabled

  /**
   * Which foot an edit applies to.
   *
   * Clicking the row means the field as a whole: both feet when they match,
   * and the panel says so. Clicking a single cell means that foot only, which
   * is how one side is changed without disturbing the other — the case that
   * matters when a matched pair needs to come apart.
   */
  const choose = (key: string, label: string, value?: string, side?: 'L' | 'R') => {
    const entry = state[key]
    const split =
      entry.left.status !== entry.right.status || entry.left.value !== entry.right.value
    onEdit?.({ key, label, side: side ?? (split ? 'R' : undefined), value })
    setEditing(null)
    setTarget(null)
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
        {flagged > 0 && (
          <span className="rx-panel-flag">
            {flagged} to check
          </span>
        )}
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
                      ? () => {
                          setTarget(null)
                          setEditing((current) =>
                            current === field.key ? null : field.key,
                          )
                        }
                      : undefined
                  }
                  role={editable ? 'button' : undefined}
                  tabIndex={editable ? 0 : undefined}
                >
                  <span className="rx-label">{field.label}</span>
                  <Cell
                    label={`${field.label}, left foot`}
                    onClick={
                      editable
                        ? () => {
                            setEditing(field.key)
                            setTarget('L')
                          }
                        : undefined
                    }
                    side={entry.left}
                  />
                  <Cell
                    label={`${field.label}, right foot`}
                    onClick={
                      editable
                        ? () => {
                            setEditing(field.key)
                            setTarget('R')
                          }
                        : undefined
                    }
                    side={entry.right}
                  />
                </div>

                {isEditing && (
                  <div className="rx-edit">
                    <span className="rx-edit-scope">
                      {target === 'L'
                        ? 'Left foot'
                        : target === 'R'
                          ? 'Right foot'
                          : 'Both feet'}
                    </span>
                    {options ? (
                      options.map((option) => (
                        <button
                          className="option-chip"
                          key={option}
                          onClick={() =>
                            choose(field.key, field.label, option, target ?? undefined)
                          }
                          type="button"
                        >
                          {option}
                        </button>
                      ))
                    ) : (
                      <button
                        className="option-chip"
                        onClick={() =>
                          choose(field.key, field.label, undefined, target ?? undefined)
                        }
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
