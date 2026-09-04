/**
 * Canonical option sets transcribed from the LEO Lab prescription form
 * (knowledge_base.md Section F), plus closed-set answers to LEOPA's own
 * clinical questions. These are the single source of truth for clickable
 * options in the Ask LEOPA conversation.
 *
 * WHY THIS FILE EXISTS
 * Two identical requests once returned different heel cup depth lists —
 * 16/18/20mm and 9/12/14/16/18/20mm. The short list was not an invention;
 * it was a silent truncation of a real set, which is harder to spot because
 * every value in it is correct. Rendering chips from this table instead of
 * from whatever the model emits means a truncated marker still shows the
 * full set of options the form actually offers.
 *
 * Only enumerated sets belong here. Anything the prescriber writes in —
 * degrees, millimetres, narrowing amounts — is typed, never chipped. A wrong
 * click on a number becomes a wrong device, and typing "4" is not friction
 * worth removing.
 */

export const FORM_OPTION_SETS: string[][] = [
  // F.12 — Posting: the kind is a closed set, the degrees are not.
  ['Extrinsic', 'Intrinsic'],
  ['Varus', 'Valgus'],
  // F.12 — Heel skive: side is a closed set, the millimetres are not.
  ['Medial', 'Lateral'],
  // F.11 — Heel cup depth, plus a custom value the prescriber may write in.
  ['9mm', '12mm', '14mm', '16mm', '18mm', '20mm'],
  // F.10 — Cast dressing. Tight to Arch is CLOSEST to the arch, Maximum is
  // farthest. This order must never be reversed. Moderate is the default.
  ['Tight to Arch', 'Minimum', 'Moderate', 'Maximum'],
  // F.5 — Topcover length.
  ['Full Length', 'Sulcus', '3/4'],
  // F.6 — Extra cushioning: placement, material, thickness.
  ['Full Length', 'Forefoot Only'],
  ['Puff', 'Poron'],
  ['1/16"', '1/8"'],
  // F.7 — Bottom cover.
  ['Vinyl', 'J-Suede', 'Cordura', 'Puff', 'Nyplex'],
  // F.9 — Rigidity. Family and level are named together, so both are sets.
  ['Poly', '3DP', 'Premium'],
  ['Flexible', 'Semi-Flexible', 'Semi-Rigid', 'Rigid'],
  ['2.3mm XT-Carbon', '2.6mm XT-Carbon', '1.5mm TL2100'],
  // F.4 — Topcover. One cover for the device, from one of three families.
  ['Vinyl', 'Foam', 'Fabric/Suede/Leather'],
  [
    'Black',
    'Grey',
    'Tan',
    'Blue',
    'Black Graphite',
    'Silver Graphite',
    'Flash Blue',
    'Flash Orange',
  ],
  [
    'Black',
    'Grey Swirl',
    'Pink Swirl',
    'Blue Swirl',
    'Pink/Purple',
    'Blue/Green',
    'Camo',
    'Perforated Black',
    'Pink Diabetic',
    'Black Diabetic',
  ],
  [
    'X-Static Poron 1/8" (Premium)',
    'Bamboo 1/8"',
    'ETC Black 1/16"',
    'ETC Black 1/8"',
    'ETC Blue 1/16"',
    'ETC Blue 1/8"',
    'Neoprene 1/16"',
    'Neoprene 1/8"',
    'Suede 1/16"',
    'Leather (Premium)',
  ],
  // F.3 — Orthotic width. Narrow takes a prescriber-supplied value.
  ['Regular', 'Wide', 'Narrow'],
  // F.8 — Skid plate, and any other yes/no question LEOPA asks.
  ['Yes', 'No'],
  // Closed-set answers to clinical questions that decide a form field.
  ['Present', 'Absent'],
  ['Prominent', 'Not prominent'],
  ['Tender', 'Not tender'],
  // Laterality, used across the form.
  ['Left', 'Right', 'Bilateral'],
]

/** Most chips in one group. Longer sets are the form's, not ours to trim. */
const MAX_OPTIONS_PER_GROUP = 8

/**
 * Most chip groups in one reply. A reply asking five questions could otherwise
 * put twenty-odd buttons on screen, which is worse than typing rather than
 * better. Groups beyond this are dropped and the question is answered by
 * typing, which always works.
 */
const MAX_GROUPS = 16

/**
 * Two markers, both optionally labelled with the field they answer:
 *   [[OPTIONS: Extrinsic | Intrinsic]]
 *   [[OPTIONS Heel cup depth: 9mm | 12mm | 14mm]]
 *   [[INPUT Rearfoot posting degrees: degrees]]
 * OPTIONS renders chips for a closed set. INPUT renders a small box beside the
 * question for a value the prescriber writes in, so a number can be answered
 * where it is asked rather than down in the message box.
 *
 * The label is what makes several answers stageable at once without them
 * running together into something ambiguous, so INPUT requires one.
 */
const MARKER =
  /\[\[(OPTIONS|INPUT)(?:[ \t]+([^:\]]+?))?[ \t]*:[ \t]*([^\]]*)\]\]/g

/**
 * A marker that has started but not finished arriving. While a reply streams
 * in, the closing brackets land last, so without this the raw marker text is
 * briefly visible in the bubble.
 */
const PARTIAL_MARKER = /\s*\[\[[^\]]*$/

const normalise = (value: string) => value.toLowerCase().replace(/[\s"'·]/g, '')

/**
 * If every value the model emitted belongs to one known set, return that whole
 * set. This repairs truncation without discarding sets we do not know about —
 * an unrecognised list is passed through untouched.
 *
 * Requires at least two values, because a single value like "Full Length"
 * appears in more than one set and cannot be resolved unambiguously.
 */
function expandToCanonicalSet(values: string[]): string[] {
  if (values.length < 2) {
    return values
  }

  const emitted = values.map(normalise)
  const match = FORM_OPTION_SETS.find((set) => {
    const known = set.map(normalise)
    return emitted.every((value) => known.includes(value))
  })

  return match ?? values
}

function cleanValues(raw: string): string[] {
  const seen = new Set<string>()
  const values = raw
    .split('|')
    .map((value) => value.trim())
    .filter((value) => {
      if (value.length === 0 || seen.has(normalise(value))) {
        return false
      }
      seen.add(normalise(value))
      return true
    })

  const expanded = expandToCanonicalSet(values)

  // A recognised set is the form's own list and is never trimmed — silently
  // dropping two foam colours would be the same failure as the truncated heel
  // cup list. Only an unrecognised list, which we cannot vouch for, is capped.
  return expanded === values ? expanded.slice(0, MAX_OPTIONS_PER_GROUP) : expanded
}

/**
 * One run of message text, with the options that belong to the question that
 * run ends on. Rendering these in order puts each set of chips directly under
 * its own question rather than in one pile at the bottom of the reply.
 */
export interface MessageSegment {
  text: string
  /** Which field these options answer, when the marker named one. */
  label?: string
  options: string[]
  /** Present when the question wants a typed value rather than a choice. */
  input?: { unit?: string }
}

/**
 * Split an assistant message into displayable runs of text and their options.
 * Safe to call on every message on every render; a message without markers
 * comes back as a single segment with its text unchanged and no options.
 */
export function parseAssistantMessage(content: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let cursor = 0
  let groups = 0

  MARKER.lastIndex = 0
  let match = MARKER.exec(content)

  while (match) {
    const [whole, kind, rawLabel, payload] = match
    const label = rawLabel?.trim() || undefined
    const text = content.slice(cursor, match.index).replace(/[ \t]+$/, '')
    const withinBudget = groups < MAX_GROUPS

    // An INPUT with no label could not be staged as a named answer, so it is
    // stripped and the question is answered in the message box instead.
    if (kind === 'INPUT' && label && withinBudget) {
      groups += 1
      segments.push({
        text,
        label,
        options: [],
        input: { unit: payload.trim() || undefined },
      })
    } else if (kind === 'OPTIONS' && withinBudget) {
      const options = cleanValues(payload)
      if (options.length > 0) {
        groups += 1
        segments.push({ text, label, options })
      } else if (text.length > 0) {
        segments.push({ text, options: [] })
      }
    } else if (text.length > 0) {
      // A marker we could not use still gets stripped; its text is kept so no
      // gap is left in the reply.
      segments.push({ text, options: [] })
    }

    cursor = match.index + whole.length
    match = MARKER.exec(content)
  }

  const tail = content.slice(cursor).replace(PARTIAL_MARKER, '')

  if (tail.length > 0 || segments.length === 0) {
    segments.push({ text: segments.length === 0 ? tail : tail, options: [] })
  }

  // Trim only the outer edges, so blank lines inside the reply survive.
  if (segments.length > 0) {
    segments[segments.length - 1].text = segments[segments.length - 1].text.replace(
      /\s+$/,
      '',
    )
  }

  return segments
}
