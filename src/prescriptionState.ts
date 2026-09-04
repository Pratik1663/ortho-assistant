import {
  BOTTOM_COVER_OPTIONS,
  CAST_DRESSING_OPTIONS,
  HEEL_CUP_OPTIONS,
  RIGIDITY_LEVELS,
  STYLE_OPTIONS,
  TOPCOVER_LENGTH_OPTIONS,
  WIDTH_OPTIONS,
  YES_NO_OPTIONS,
} from './formOptions'

/**
 * The prescription as a structure rather than a conversation.
 *
 * LEOPA restates the whole build at the end of every consultation reply inside
 * an [[RX ...]] marker. The client strips that marker from the visible text and
 * renders it as a panel, so the practitioner can see the form filling in rather
 * than reconstructing it from twenty exchanges.
 *
 * Restating everything each turn rather than sending changes is deliberate: a
 * missed update would leave the panel quietly wrong, and a panel that is
 * quietly wrong is worse than no panel at all.
 */

/**
 * What clicking a field in the panel offers.
 *
 * Only fields with a single closed set get chips. Posting, skives, topcover and
 * the two list fields need a conversation — a heel skive is a side and a depth,
 * a topcover is a family and then a colour — so those hand back to LEOPA rather
 * than pretending a chip could settle them.
 */
export const FIELD_EDIT_OPTIONS: Record<string, string[]> = {
  style: STYLE_OPTIONS,
  rigidity: RIGIDITY_LEVELS,
  width: WIDTH_OPTIONS,
  cast_dressing: CAST_DRESSING_OPTIONS,
  heel_cup: HEEL_CUP_OPTIONS,
  topcover_length: TOPCOVER_LENGTH_OPTIONS,
  bottom_cover: BOTTOM_COVER_OPTIONS,
  skid_plate: YES_NO_OPTIONS,
}

/** Fields in the order they appear on the LEO Lab form. */
export const RX_FIELDS: { key: string; label: string; perSide: boolean }[] = [
  { key: 'style', label: 'Orthotic style', perSide: false },
  { key: 'rigidity', label: 'Shell rigidity', perSide: true },
  { key: 'width', label: 'Orthotic width', perSide: true },
  { key: 'cast_dressing', label: 'Cast dressing', perSide: true },
  { key: 'heel_cup', label: 'Heel cup depth', perSide: true },
  { key: 'rearfoot_posting', label: 'Rearfoot posting', perSide: true },
  { key: 'forefoot_posting', label: 'Forefoot posting', perSide: true },
  { key: 'heel_skive', label: 'Heel skive', perSide: true },
  { key: 'heel_lift', label: 'Heel lift', perSide: true },
  { key: 'shell_mods', label: 'Shell modifications', perSide: true },
  { key: 'additions', label: 'Additions', perSide: true },
  { key: 'topcover', label: 'Topcover', perSide: true },
  { key: 'topcover_length', label: 'Topcover length', perSide: true },
  { key: 'extra_cushioning', label: 'Extra cushioning', perSide: true },
  { key: 'bottom_cover', label: 'Bottom cover', perSide: true },
  { key: 'skid_plate', label: 'Skid plate', perSide: true },
]

export type FieldStatus = 'open' | 'set' | 'none'

export interface FieldSide {
  status: FieldStatus
  value: string
}

export interface PrescriptionField {
  left: FieldSide
  right: FieldSide
}

export type PrescriptionState = Record<string, PrescriptionField>

/** [[RX ... ]] — one field per line inside. */
const RX_BLOCK = /\[\[RX\s*([\s\S]*?)\]\]/

/** style @B = Sport Performance */
const RX_LINE = /^([a-z_]+)\s*(?:@([LRB]))?\s*=\s*(.*)$/i

const EMPTY: FieldSide = { status: 'open', value: '' }

function blank(): PrescriptionState {
  const state: PrescriptionState = {}
  for (const field of RX_FIELDS) {
    state[field.key] = { left: { ...EMPTY }, right: { ...EMPTY } }
  }
  return state
}

function classify(raw: string): FieldSide {
  const value = raw.trim()
  if (value.length === 0) {
    return { status: 'open', value: '' }
  }
  // A field decided against is not the same as one nobody has reached, and the
  // panel has to show the difference — an empty row is the thing that makes an
  // omission visible.
  if (/^(none|not ordered|n\/a|-|—)$/i.test(value)) {
    return { status: 'none', value: 'Not ordered' }
  }
  return { status: 'set', value }
}

/** True when the message carries a prescription block at all. */
export function hasPrescriptionState(content: string): boolean {
  return RX_BLOCK.test(content)
}

/**
 * Read the prescription out of an assistant message. Returns null when the
 * message carries no block, so the caller can keep showing the last one it had
 * rather than blanking the panel mid-conversation.
 */
export function parsePrescriptionState(content: string): PrescriptionState | null {
  const block = content.match(RX_BLOCK)
  if (!block) {
    return null
  }

  const state = blank()

  for (const line of block[1].split('\n')) {
    const match = line.trim().match(RX_LINE)
    if (!match) {
      continue
    }

    const [, rawKey, rawSide, rawValue] = match
    const key = rawKey.toLowerCase()
    if (!(key in state)) {
      continue
    }

    const side = classify(rawValue)
    const which = (rawSide ?? 'B').toUpperCase()

    if (which === 'L' || which === 'B') {
      state[key].left = { ...side }
    }
    if (which === 'R' || which === 'B') {
      state[key].right = { ...side }
    }
  }

  return state
}

/**
 * Counts for the panel header, which is all that shows when it is collapsed.
 * The per-side ordered counts are the important part: one glance tells you
 * whether a foot is being built that should not be.
 */
export function countSettled(state: PrescriptionState): {
  settled: number
  total: number
  left: number
  right: number
} {
  let settled = 0
  let left = 0
  let right = 0

  for (const field of RX_FIELDS) {
    const entry = state[field.key]
    if (entry.left.status !== 'open' || entry.right.status !== 'open') {
      settled += 1
    }
    if (entry.left.status === 'set') {
      left += 1
    }
    if (entry.right.status === 'set') {
      right += 1
    }
  }

  return { settled, total: RX_FIELDS.length, left, right }
}
