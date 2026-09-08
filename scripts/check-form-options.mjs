#!/usr/bin/env node
/**
 * Fail the build when the client's option lists drift from the form.
 *
 * The LEO Lab form is transcribed in assets/knowledge_base.md Section F, which
 * is what LEOPA reads. The same lists exist again in src/formOptions.ts, which
 * is what draws the chips and validates the prescription panel. Nothing kept
 * the two in step, so changing a heel cup depth in one would leave the other
 * silently disagreeing — LEOPA saying one thing while the buttons offered
 * another.
 *
 * This does not generate one from the other. Generating would mean reshaping
 * Section F into something machine-readable, and its prose is written for the
 * model to read. A check catches the same failure and leaves the prose alone.
 *
 * Run by `npm run build` before tsc. Exits non-zero on any mismatch.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const knowledgeBase = readFileSync(join(root, 'assets/knowledge_base.md'), 'utf8')
const formOptions = readFileSync(join(root, 'src/formOptions.ts'), 'utf8')

/**
 * Which exported constant should match which section, and how to read the
 * section. Sections whose options carry prescriber-supplied values (posting
 * degrees, skive depths) are not listed — those are typed, never enumerated.
 */
const CHECKS = [
  { constant: 'WIDTH_OPTIONS', section: 'F.3' },
  { constant: 'TOPCOVER_LENGTH_OPTIONS', section: 'F.5' },
  { constant: 'BOTTOM_COVER_OPTIONS', section: 'F.7' },
  { constant: 'CAST_DRESSING_OPTIONS', section: 'F.10' },
  { constant: 'HEEL_CUP_OPTIONS', section: 'F.11' },
]

/** Strip the annotations Section F carries for the reader, not the form. */
function tidy(value) {
  return value
    .replace(/\*\*/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/—.*$/, '')
    .replace(/_+/g, '')
    .trim()
}

function sectionBody(id) {
  const match = knowledgeBase.match(
    new RegExp(`### ${id.replace('.', '\\.')} — [^\\n]*\\n([\\s\\S]*?)(?=\\n### |$)`),
  )
  return match ? match[1] : null
}

/**
 * Section F writes its option lists in bold, separated by · or →, with plain
 * prose around them ("One choice:", "or a custom value the prescriber writes
 * in"). Reading only the bold runs drops that prose without having to guess at
 * where a sentence ends.
 *
 * The first line carrying a separator is the list; later bold text is
 * commentary on it.
 */
function optionsFromSection(id) {
  const body = sectionBody(id)
  if (!body) {
    return null
  }

  // Section F wraps its lines, so rejoin before looking for the list.
  const lines = body.replace(/\n(?![\n#])/g, ' ').split('\n')

  for (const line of lines) {
    if (!line.includes('·') && !line.includes('→')) {
      continue
    }
    const bold = [...line.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1])
    if (bold.length === 0) {
      continue
    }
    const values = bold
      .join(' · ')
      .split(/·|→/)
      .map(tidy)
      .filter((value) => value.length > 0)

    if (values.length >= 2) {
      return values
    }
  }
  return null
}

function constantValues(name) {
  const match = formOptions.match(
    new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`),
  )
  if (!match) {
    return null
  }
  return [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) =>
    m[1].replace(/\\'/g, "'"),
  )
}

const normalise = (value) => value.toLowerCase().replace(/[\s"'·]/g, '')

let failures = 0

for (const { constant, section } of CHECKS) {
  const fromForm = optionsFromSection(section)
  const fromCode = constantValues(constant)

  if (!fromForm) {
    console.error(`✗ ${section}: could not read an option list from the knowledge base`)
    failures += 1
    continue
  }
  if (!fromCode) {
    console.error(`✗ ${constant}: not found in src/formOptions.ts`)
    failures += 1
    continue
  }

  const a = fromForm.map(normalise)
  const b = fromCode.map(normalise)
  const missing = fromForm.filter((_, i) => !b.includes(a[i]))
  const extra = fromCode.filter((_, i) => !a.includes(b[i]))

  if (missing.length > 0 || extra.length > 0) {
    failures += 1
    console.error(`✗ ${constant} does not match knowledge base ${section}`)
    if (missing.length > 0) {
      console.error(`    on the form but not in the code: ${missing.join(', ')}`)
    }
    if (extra.length > 0) {
      console.error(`    in the code but not on the form: ${extra.join(', ')}`)
    }
  } else {
    console.log(`✓ ${constant} matches ${section} (${fromCode.length} options)`)
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} form option mismatch${failures === 1 ? '' : 'es'}. ` +
      'The chips and the knowledge base disagree, so LEOPA would offer one set ' +
      'and the panel would accept another. Fix before deploying.',
  )
  process.exit(1)
}

console.log('\nForm options match the knowledge base.')
