/**
 * Canonical option sets transcribed from the LEO Lab prescription form
 * (knowledge_base.md Section F). These are the single source of truth for
 * clickable options in the Ask LEOPA conversation.
 *
 * WHY THIS FILE EXISTS
 * Two identical requests once returned different heel cup depth lists —
 * 16/18/20mm and 9/12/14/16/18/20mm. The short list was not an invention;
 * it was a silent truncation of a real set, which is harder to spot because
 * every value in it is correct. Rendering chips from this table instead of
 * from whatever the model emits means a truncated marker still shows the
 * full set of options the form actually offers.
 *
 * Only enumerated fields belong here. Anything the prescriber writes in —
 * degrees, millimetres, narrowing amounts — is typed, never chipped.
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
  // F.3 — Orthotic width. Narrow takes a prescriber-supplied value.
  ['Regular', 'Wide', 'Narrow'],
  // F.8 — Skid plate.
  ['Yes', 'No'],
  // Laterality, used across the form.
  ['Left', 'Right', 'Bilateral'],
]

/** Most chips we will ever render under one message. */
const MAX_OPTIONS = 8

/** Complete marker: [[OPTIONS: Extrinsic | Intrinsic]] */
const MARKER = /\[\[OPTIONS:\s*([^\]]*)\]\]/i

/**
 * A marker that has started but not finished arriving. While a reply streams
 * in, the closing brackets land last, so without this the raw marker text is
 * briefly visible in the bubble.
 */
const PARTIAL_MARKER = /\s*\[\[[^\]]*$/

const normalise = (value: string) =>
  value.toLowerCase().replace(/[\s"'·]/g, '')

/**
 * If every value the model emitted belongs to one known form set, return that
 * whole set. This repairs truncation without discarding sets we do not know
 * about — an unrecognised list is passed through untouched.
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

export interface ParsedAssistantMessage {
  /** Message text with the marker removed, safe to display. */
  text: string
  /** Clickable options, empty when the message carried no marker. */
  options: string[]
}

/**
 * Split an assistant message into displayable text and its clickable options.
 * Safe to call on every message on every render; messages without a marker
 * come back with their text unchanged and no options.
 */
export function parseAssistantMessage(
  content: string,
): ParsedAssistantMessage {
  const match = content.match(MARKER)

  if (!match) {
    return {
      text: content.replace(PARTIAL_MARKER, ''),
      options: [],
    }
  }

  const seen = new Set<string>()
  const values = match[1]
    .split('|')
    .map((value) => value.trim())
    .filter((value) => {
      if (value.length === 0 || seen.has(normalise(value))) {
        return false
      }
      seen.add(normalise(value))
      return true
    })

  return {
    text: content.replace(MARKER, '').trimEnd(),
    options: expandToCanonicalSet(values).slice(0, MAX_OPTIONS),
  }
}
