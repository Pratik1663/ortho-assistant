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
  // A conditional item must never become an unconditional order by stripping advice.
  if (/\b(if|unless|pending|consider|depending|confirm with|subject to|provided that)\b/i.test(value)) {
    return { status: 'invalid', value }
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
/**
 * Fields that legitimately hold several items, and so may arrive across more
 * than one line. Everything else holds exactly one value and a repeat is an
 * error rather than a continuation.
 */
const MERGEABLE_FIELDS = new Set(['shell_mods', 'additions'])

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

    // A field named twice for the same foot is usually a list split across two
    // lines — "additions @B = Met Pad" then "additions @B = Heel Cushion". That
    // is unambiguous, and discarding an otherwise sound prescription over a
    // formatting slip would be a harsh failure. So repeats of a list-bearing
    // field are merged. A repeat that contradicts itself, or repeats a field
    // that can only hold one value, still fails closed.
    const feet = which === 'B' ? ['L', 'R'] : [which]
    const mergeable = MERGEABLE_FIELDS.has(key)

    for (const foot of feet) {
      const id = `${key}:${foot}`
      if (seen.has(id) && !mergeable) return null
      seen.add(id)
    }

    const merge = (existing: FieldSide): FieldSide => {
      if (existing.status !== 'set' || side.status !== 'set') {
        return { ...side }
      }
      if (existing.value === side.value) {
        return existing
      }
      return { status: 'set', value: `${existing.value}, ${side.value}` }
    }

    if (which === 'L' || which === 'B') {
      state[key].left = mergeable ? merge(state[key].left) : { ...side }
    }
    if (which === 'R' || which === 'B') {
      state[key].right = mergeable ? merge(state[key].right) : { ...side }
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

function prescriptionBlock(state: PrescriptionState): string {
  const value = (side: FieldSide) => side.status === 'open'
    ? ''
    : side.status === 'none' ? 'none' : side.value
  const lines = RX_FIELDS.flatMap(({ key }) => [
    `${key} @L = ${value(state[key].left)}`,
    `${key} @R = ${value(state[key].right)}`,
  ])
  return `[[RX\n${lines.join('\n')}\n]]`
}

export function acceptanceReply(content: string, messages: RxMessage[] = []): string | null {
  const parsed = parsePrescriptionState(content)
  const state = parsed ? sanitisePrescription(parsed, messages) : null
  if (!state || !canAcceptPrescription(state)) return null
  return `Practitioner-confirmed prescription\n${prescriptionSummary(state)}\n\n${prescriptionBlock(state)}`
}

/** Match confirmations saved before acceptance-time sanitisation was introduced. */
function legacyAcceptanceReply(content: string): string | null {
  const state = parsePrescriptionState(content)
  if (!state || !canAcceptPrescription(state)) return null
  return `Practitioner-confirmed prescription\n${prescriptionSummary(state)}\n\n${content.match(RX_BLOCK)![0]}`
}


/**
 * Strip decisions the model is not entitled to make.
 *
 * Three things kept reappearing no matter how the prompt was worded: exact
 * posting degrees and skive depths the practitioner never gave, a choice of
 * intrinsic or extrinsic, and a shell named as Poly or 3DP. Each is a decision
 * that belongs to the prescriber or the lab, and each reads as settled once it
 * is written down.
 *
 * Prompt wording lost to prompt wording repeatedly, so this is done in code.
 * A figure survives only if it appears in something the practitioner actually
 * typed; otherwise the qualitative part is kept and the number is dropped.
 */
const NUMERIC_FIELDS = new Set(['rearfoot_posting', 'heel_skive', 'heel_lift'])
const FABRICATION_TERMS = /\b(intrinsic|extrinsic|poly ?pro|poly|3dp)\b/gi
const NUMBER_TOKEN = /\d+(?:\.\d+)?\s*(?:°|deg(?:rees)?|mm|cm)?/gi

function practitionerFigures(messages: RxMessage[]): Set<string> {
  const said = new Set<string>()
  for (const message of messages) {
    if (message.role !== 'user') continue
    for (const match of message.content.matchAll(/\d+(?:\.\d+)?/g)) {
      said.add(match[0])
    }
  }
  return said
}

function practitionerSaidFabrication(messages: RxMessage[]): boolean {
  return messages.some(
    (message) => message.role === 'user' && /\b(intrinsic|extrinsic|poly|3dp)\b/i.test(message.content),
  )
}

function stripUnearned(
  key: string,
  value: string,
  figures: Set<string>,
  keepFabrication: boolean,
): string {
  let out = value

  if (!keepFabrication) {
    out = out.replace(FABRICATION_TERMS, '')
  }

  if (NUMERIC_FIELDS.has(key)) {
    out = out.replace(NUMBER_TOKEN, (token) => {
      const digits = token.match(/\d+(?:\.\d+)?/)?.[0] ?? ''
      return figures.has(digits) ? token : ''
    })
  }

  // Tidy the punctuation left behind by a removed word or figure.
  out = out.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',')
  out = out.replace(/^[\s,;-]+|[\s,;-]+$/g, '').trim()
  return out
}

/**
 * Apply the above across a parsed prescription. A field left with nothing but
 * a direction ("Medial") keeps it — the item is still indicated, the figure is
 * simply the prescriber's to add. A field left with nothing at all becomes
 * open rather than silently reading as not ordered.
 */
export function sanitisePrescription(
  state: PrescriptionState,
  messages: RxMessage[],
): PrescriptionState {
  const figures = practitionerFigures(messages)
  const keepFabrication = practitionerSaidFabrication(messages)
  const next: PrescriptionState = {}

  for (const { key } of RX_FIELDS) {
    const entry = state[key]
    const clean = (side: FieldSide): FieldSide => {
      // Invalid values are cleaned too, not skipped. "Semi-Rigid (Poly)" fails
      // validation precisely because of the part that should not be there, and
      // stripping it leaves a value that is both correct and valid.
      if (side.status !== 'set' && side.status !== 'invalid') return { ...side }
      const value = stripUnearned(key, side.value, figures, keepFabrication)
      if (value.length === 0) return { status: 'open', value: '' }
      // Re-classify so a repaired value stops reading as an error.
      return classify(key, value)
    }
    next[key] = { left: clean(entry.left), right: clean(entry.right) }
  }

  return next
}


/**
 * The same strip, applied to the visible reply.
 *
 * The panel and the summary were already protected, but the prose was not — a
 * reply reading "heel lift 6mm bilaterally" while the summary said the
 * millimetres were open is worse than either alone, because the practitioner
 * reads the number, believes it, and only finds the disagreement after
 * accepting.
 *
 * Only figures attached to the three prescriber-owned fields are touched, and
 * only single figures: a range is guidance and stays, since "4 to 6mm" is
 * exactly what should be offered. Heel cup depths, thicknesses and everything
 * else the model is entitled to choose are left alone.
 */
const PROSE_FIGURE =
  /\b(heel lift|rearfoot post(?:ing)?|forefoot post(?:ing)?|medial skive|lateral skive|heel skive|skive)\b([^.\n]{0,40}?)(\d+(?:\.\d+)?)\s*(mm|°|deg(?:rees)?)/gi

export function sanitiseProse(text: string, messages: RxMessage[]): string {
  const figures = practitionerFigures(messages)

  return text.replace(PROSE_FIGURE, (whole, field, gap, digits, unit, offset: number) => {
    if (figures.has(digits)) return whole
    // A range reads as guidance rather than a decision, so it survives.
    const before = text.slice(Math.max(0, offset - 12), offset + whole.length + 6)
    if (/\d\s*(?:-|–|—|to)\s*\d/.test(before)) return whole
    return `${field}${gap}`.replace(/[\s,]+$/, '')
  })
}

export function currentPrescription(messages: RxMessage[]): {
  state: PrescriptionState | null; confirmed: boolean
} {
  const last = messages[messages.length - 1]
  const parsed = last?.role === 'assistant' ? parsePrescriptionState(last.content) : null
  const state = parsed ? sanitisePrescription(parsed, messages) : null
  // Compare the deterministic summary against the exact snapshot accepted.
  const request = messages[messages.length - 2]
  const previous = messages[messages.length - 3]
  const messagesBeforeAcceptance = messages.slice(0, -2)
  const matchesCurrent = previous?.role === 'assistant' &&
    acceptanceReply(previous.content, messagesBeforeAcceptance) === last.content
  // Existing browser records contain the old deterministic format. Continue to
  // recognise those exact snapshots, while `state` above is still sanitised for
  // the panel and downstream SOAP generation.
  const matchesLegacy = previous?.role === 'assistant' &&
    legacyAcceptanceReply(previous.content) === last.content
  const confirmed = Boolean(state && request?.role === 'user' &&
    request.content === ACCEPT_PRESCRIPTION && (matchesCurrent || matchesLegacy))
  return { state, confirmed }
}
