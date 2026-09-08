import {
  BOTTOM_COVER_OPTIONS,
  CAST_DRESSING_OPTIONS,
  HEEL_CUP_OPTIONS,
  RIGIDITY_LEVELS,
  PREMIUM_SHELL_OPTIONS,
  STYLE_OPTIONS,
  TOPCOVER_LENGTH_OPTIONS,
  WIDTH_OPTIONS,
  YES_NO_OPTIONS,
} from './formOptions.js'

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
  rigidity: [...RIGIDITY_LEVELS, ...PREMIUM_SHELL_OPTIONS],
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

export type FieldStatus = 'open' | 'set' | 'none' | 'invalid'

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

const normalise = (value: string) => value.toLowerCase().replace(/[\s"'·°]/g, '')

/**
 * Check a value against the form's own list where one exists.
 *
 * The panel is meant to be the thing the practitioner trusts at a glance, and
 * a value the model invented would otherwise render exactly as confidently as
 * one they chose. Only fields with a single closed set are checked; posting,
 * skives, topcover and the list fields hold free text by design and are left
 * alone rather than flagged wrongly.
 *
 * Match a complete canonical value after normalising whitespace and punctuation.
 * Rigidity may carry an explicit Poly, 3DP or Premium fabrication prefix.
 */
function isKnownValue(key: string, value: string): boolean {
  const options = FIELD_EDIT_OPTIONS[key]
  if (!options) {
    return true
  }
  const candidate = normalise(value)
  // Only the two supported fabrication prefixes are allowed on rigidity.
  const comparable = key === 'rigidity' ? candidate.replace(/^(3dp|poly|premium)/, '') : candidate
  return options.some((option) => comparable === normalise(option))
}

function classify(key: string, raw: string): FieldSide {
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
  if (!isKnownValue(key, value)) {
    return { status: 'invalid', value }
  }
  return { status: 'set', value }
}

/** True when the message carries a prescription block at all. */
export function hasPrescriptionState(content: string): boolean {
  return RX_BLOCK.test(content)
}

/**
 * Read the prescription out of an assistant message. Returns null when the
 * message carries no complete snapshot. Callers must not present an older
 * snapshot as current after a failed reply or a new practitioner message.
 */
export function parsePrescriptionState(content: string): PrescriptionState | null {
  const block = content.match(RX_BLOCK)
  if ((content.match(/\[\[RX\b/g) ?? []).length !== 1) return null
  if (!block) {
    return null
  }

  const state = blank()
  const seen = new Set<string>()

  for (const line of block[1].split('\n')) {
    const match = line.trim().match(RX_LINE)
    if (!line.trim()) continue
    if (!match) return null

    const [, rawKey, rawSide, rawValue] = match
    const key = rawKey.toLowerCase()
    if (!Object.prototype.hasOwnProperty.call(state, key)) return null

    const side = classify(key, rawValue)
    const which = (rawSide ?? 'B').toUpperCase()

    for (const foot of which === 'B' ? ['L', 'R'] : [which]) {
      const id = `${key}:${foot}`
      if (seen.has(id)) return null
      seen.add(id)
    }
    if (which === 'L' || which === 'B') {
      state[key].left = { ...side }
    }
    if (which === 'R' || which === 'B') {
      state[key].right = { ...side }
    }
  }

  return seen.size === RX_FIELDS.length * 2 ? state : null
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
    if (['set', 'none'].includes(entry.left.status) && ['set', 'none'].includes(entry.right.status)) {
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

/** Explicit acceptance is a local action, never a model-generated status. */
export const ACCEPT_PRESCRIPTION = 'I accept the current suggested prescription as displayed.'
type RxMessage = { role: 'user' | 'assistant'; content: string }

export function prescriptionSummary(state: PrescriptionState): string {
  return RX_FIELDS.map(({ key, label }) => {
    const { left, right } = state[key]
    const describe = (side: FieldSide) => side.status === 'open' ? 'Open' : side.value
    return `${label}: Left — ${describe(left)}; Right — ${describe(right)}`
  }).join('\n')
}

/**
 * A prescription can be accepted with fields still open.
 *
 * An open field is a deliberate outcome, not an incomplete one — a practitioner
 * who leaves posting blank is ordering no post, and blocking them until every
 * line is filled forces a value nobody wanted. What acceptance requires is that
 * something was actually decided, not that everything was.
 */
export function canAcceptPrescription(state: PrescriptionState): boolean {
  // A value that is not on the form still blocks acceptance — that is an error,
  // not a decision. So does a prescription where nothing at all was ordered.
  const noneInvalid = RX_FIELDS.every(
    ({ key }) =>
      state[key].left.status !== 'invalid' && state[key].right.status !== 'invalid',
  )
  const somethingOrdered = RX_FIELDS.some(
    ({ key }) => state[key].left.status === 'set' || state[key].right.status === 'set',
  )
  return noneInvalid && somethingOrdered
}

export function acceptanceReply(content: string): string | null {
  const state = parsePrescriptionState(content)
  if (!state || !canAcceptPrescription(state)) return null
  return `Practitioner-confirmed prescription\n${prescriptionSummary(state)}\n\n${content.match(RX_BLOCK)![0]}`
}

export function currentPrescription(messages: RxMessage[]): {
  state: PrescriptionState | null; confirmed: boolean
} {
  const last = messages[messages.length - 1]
  const state = last?.role === 'assistant' ? parsePrescriptionState(last.content) : null
  // Compare the deterministic summary against the exact snapshot accepted.
  const request = messages[messages.length - 2]
  const previous = messages[messages.length - 3]
  const confirmed = Boolean(state && request?.role === 'user' &&
    request.content === ACCEPT_PRESCRIPTION && previous?.role === 'assistant' &&
    acceptanceReply(previous.content) === last.content)
  return { state, confirmed }
}
