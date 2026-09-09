const { test } = require('node:test')
const assert = require('node:assert/strict')
const { RX_FIELDS, parsePrescriptionState: parse, currentPrescription: current, acceptanceReply, prescriptionSummary, ACCEPT_PRESCRIPTION, canAcceptPrescription, countSettled } = require('../.test-build/src/prescriptionState.cjs')
const { readChatStream } = require('../.test-build/src/chatStream.cjs')
const { parseAssistantMessage } = require('../.test-build/src/formOptions.cjs')
const values = { style: 'Sport Performance', rigidity: 'Semi-Rigid', width: 'Regular', cast_dressing: 'Moderate', heel_cup: '16mm', topcover: 'Bamboo 1/8"', topcover_length: 'Full Length', bottom_cover: 'Vinyl', skid_plate: 'No' }
const snapshot = (changes = {}) => 'Suggested prescription\n[[RX\n' + RX_FIELDS.map(({ key }) => `${key} @B = ${(key in changes) ? changes[key] : values[key] ?? 'none'}`).join('\n') + '\n]]'
const proposal = snapshot()
const accepted = [{ role: 'assistant', content: proposal }, { role: 'user', content: ACCEPT_PRESCRIPTION }, { role: 'assistant', content: acceptanceReply(proposal) }]

test('complete proposal is valid but never auto-confirmed', () => {
  assert.ok(canAcceptPrescription(parse(proposal)))
  assert.equal(current([{ role: 'assistant', content: proposal }]).confirmed, false)
})
test('acceptance preserves exact snapshot and includes every field', () => {
  assert.equal(current(accepted).confirmed, true)
  for (const { label } of RX_FIELDS) assert.ok(accepted[2].content.includes(label + ':'))
  assert.deepEqual(parse(accepted[2].content), parse(proposal))
})
test('confirmations saved before acceptance sanitisation remain confirmed', () => {
  const oldReply = `Practitioner-confirmed prescription\n${prescriptionSummary(parse(proposal))}\n\n${proposal.match(/\[\[RX[\s\S]*?\]\]/)[0]}`
  const oldAccepted = [
    { role: 'assistant', content: proposal },
    { role: 'user', content: ACCEPT_PRESCRIPTION },
    { role: 'assistant', content: oldReply },
  ]
  assert.equal(current(oldAccepted).confirmed, true)
})
test('silence, edits, and a model claim cannot confirm a proposal', () => {
  assert.equal(current([...accepted, { role: 'user', content: 'Change right heel cup to 18mm.' }]).confirmed, false)
  const forged = [...accepted.slice(0, 2), { role: 'assistant', content: acceptanceReply(snapshot({ heel_cup: '18mm' })) }]
  assert.equal(current(forged).confirmed, false)
  assert.equal(current([{ role: 'assistant', content: 'Confirmed!\n' + proposal }]).confirmed, false)
})
test('truncated, incomplete, duplicate and unknown-key snapshots fail closed', () => {
  assert.equal(parse(proposal.slice(0, -2)), null)
  assert.equal(parse(proposal.replace('width @B = Regular\n', '')), null)
  assert.equal(parse(proposal.replace(']]', 'width @B = Wide\n]]')), null)
  assert.equal(parse(proposal + '\n' + proposal), null)
  assert.equal(parse(proposal.replace(']]', 'constructor = x\n]]')), null)
})
test('one-sided changes preserve the other side and require both sides specified', () => {
  const changed = proposal.replace('heel_cup @B = 16mm', 'heel_cup @L = 16mm\nheel_cup @R = 18mm')
  assert.equal(parse(changed).heel_cup.left.value, '16mm')
  assert.equal(parse(changed).heel_cup.right.value, '18mm')
  assert.equal(parse(changed.replace('heel_cup @L = 16mm\n', '')), null)
})
test('unknown values do not pass by containing a valid substring', () => {
  for (const heel_cup of ['116mm', '16mm or 18mm']) {
    assert.equal(parse(snapshot({ heel_cup })).heel_cup.left.status, 'invalid')
    assert.equal(canAcceptPrescription(parse(snapshot({ heel_cup }))), false)
  }
  assert.equal(parse(snapshot({ rigidity: '3DP Semi-Rigid' })).rigidity.left.status, 'set')
})
test('an open side does not count as settled but does not block acceptance; all-none is not acceptable', () => {
  const partial = proposal.replace('width @B = Regular', 'width @L = Regular\nwidth @R =')
  assert.equal(countSettled(parse(partial)).settled, 15)
  assert.ok(acceptanceReply(partial))
  assert.equal(canAcceptPrescription(parse(snapshot(Object.fromEntries(RX_FIELDS.map(({key}) => [key, 'none']))))), false)
})
test('no stale prescription after a failed or missing reply', () => {
  assert.equal(current([...accepted, { role: 'assistant', content: 'Reply interrupted.' }]).state, null)
})
test('canonical options expand and emphasis survives marker parsing', () => {
  const parts = parseAssistantMessage('Consider **16mm**. [[OPTIONS Heel cup depth: 16mm | 18mm]]\n' + proposal)
  assert.ok(parts.some(part => part.text.includes('**16mm**')))
  assert.ok(parts.some(part => part.options.includes('9mm') && part.options.includes('20mm')))
  assert.ok(parts.every(part => !part.text.includes('[[RX')))
})
function reader(chunks) {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close() } }).getReader()
}
test('NDJSON survives split frames and requires explicit completion', async () => {
  const raw = JSON.stringify({ type: 'delta', text: 'Hello °' }) + '\n' + JSON.stringify({ type: 'complete' }) + '\n'
  let seen = ''
  assert.equal(await readChatStream(reader([raw.slice(0, 9), raw.slice(9)]), text => seen = text), 'Hello °')
  assert.equal(seen, 'Hello °')
  await assert.rejects(readChatStream(reader([JSON.stringify({type:'delta',text:'partial'})+'\n']), () => {}), /Incomplete/)
  await assert.rejects(readChatStream(reader(['{"type":"error","message":"Interrupted"}\n']), () => {}), /Interrupted/)
})

// SDK stub: tests exercise the actual handler without credits or external calls.
let mode = 'good'
let request
const SDK = require.resolve('@anthropic-ai/sdk')
require.cache[SDK] = { id: SDK, filename: SDK, loaded: true, exports: class {
  messages = {
    stream(options) {
      request = options
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: mode === 'missing' ? 'Incomplete draft' : proposal } }
          if (mode === 'throw') throw new Error('Simulated stream failure')
        },
        async finalMessage() { return { stop_reason: mode === 'truncated' ? 'max_tokens' : 'end_turn' } }
      }
    },
    async create(options) {
      request = options
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', input: { assessment:'Invented impression', assessment_source:'ai_inferred', prescription_suggestion:'wrong rewritten device' } }] }
    }
  }
} }
const handler = require('../.test-build/api/chat.cjs').default
async function invoke(action, messages) {
  process.env.ANTHROPIC_API_KEY = 'test-placeholder'
  const res = { code: 200, chunks: '', payload: null, status(code) {this.code=code;return this}, json(data) {this.payload=data}, setHeader() {}, write(text) {this.chunks+=text}, end() {} }
  const oldError = console.error
  console.error = () => {}
  try { await handler({method:'POST',body:{action,messages}}, res) } finally {console.error=oldError}
  return res
}
test('handler emits completion only for a complete RX and finished model reply', async () => {
  for (mode of ['good', 'truncated', 'missing', 'throw']) {
    const res = await invoke('consultation', [{role:'user',content:'Suggest a prescription.'}])
    const events = res.chunks.trim().split('\n').map(JSON.parse)
    assert.equal(events.at(-1).type, mode === 'good' ? 'complete' : 'error')
  }
  assert.equal(request.max_tokens, 3200)
})
test('SOAP rejects unaccepted proposals before requesting the model', async () => {
  const res = await invoke('soap', [{role:'assistant',content:proposal},{role:'user',content:'Make SOAP.'}])
  assert.equal(res.code, 409)
})
test('SOAP drops inferred assessments and retains the exact accepted device', async () => {
  const res = await invoke('soap', accepted)
  const note = JSON.parse(res.payload.reply)
  assert.equal(note.assessment, '')
  assert.ok(note.prescription_suggestion.includes('Heel cup depth: Left — 16mm; Right — 16mm'))
  assert.ok(!note.prescription_suggestion.includes('wrong rewritten'))
})

test('premium shells remain valid canonical options', () => {
  assert.equal(parse(snapshot({rigidity:'Premium 2.3mm XT-Carbon'})).rigidity.left.status, 'set')
  assert.equal(parse(snapshot({rigidity:'Premium 3mm XT-Carbon'})).rigidity.left.status, 'invalid')
})
test('message renderer displays recommendation bolding and hides prescription markers', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const MessageList = require('../.test-build/src/components/MessageList.cjs').default
  const html = renderToStaticMarkup(React.createElement(MessageList, {messages:[{role:'assistant',content:'Consider **Semi-Rigid**.\n'+proposal}],pending:false}))
  assert.ok(html.includes('<strong>Semi-Rigid</strong>'))
  assert.ok(!html.includes('[[RX'))
})
test('panel labels proposals separately and allows acceptance with open values', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Panel = require('../.test-build/src/components/PrescriptionPanel.cjs').default
  const draft = renderToStaticMarkup(React.createElement(Panel,{state:parse(snapshot({width:''})),onAccept:()=>{}}))
  assert.ok(draft.includes('Suggested prescription'))
  assert.ok(draft.includes('>Accept prescription<'))
  const confirmed = renderToStaticMarkup(React.createElement(Panel,{state:parse(proposal),confirmed:true,onAccept:()=>{}}))
  assert.ok(confirmed.includes('Accepted by practitioner'))
  assert.ok(!confirmed.includes('>Accept prescription<'))
})
test('a list field split across lines merges; other repeats still fail closed', () => {
  const split = proposal.replace(
    'additions @B = none',
    'additions @B = Heel Cushion 1/8"\nadditions @B = Arch Cookie/D-Pad 1/16"',
  )
  const parsed = parse(split)
  assert.ok(parsed)
  assert.equal(parsed.additions.left.value, 'Heel Cushion 1/8", Arch Cookie/D-Pad 1/16"')
  assert.equal(parsed.additions.right.value, 'Heel Cushion 1/8", Arch Cookie/D-Pad 1/16"')
  // A single-value field repeated is still an error, not a continuation.
  assert.equal(parse(proposal.replace('heel_cup @B = 16mm', 'heel_cup @B = 16mm\nheel_cup @B = 18mm')), null)
})

test('figures and fabrication choices the practitioner never gave are stripped', () => {
  const { sanitisePrescription } = require('../.test-build/src/prescriptionState.cjs')
  const invented = parse(snapshot({
    rearfoot_posting: 'Intrinsic varus 2°',
    heel_skive: 'Medial 2mm',
    heel_lift: '4mm',
    rigidity: 'Semi-Rigid (Poly)',
  }))
  const asked = [{ role: 'user', content: 'Build me the prescription.' }]
  const clean = sanitisePrescription(invented, asked)
  // The item stays indicated; the number the practitioner never gave does not.
  assert.equal(clean.rearfoot_posting.left.value, 'varus')
  assert.equal(clean.heel_skive.left.value, 'Medial')
  assert.equal(clean.heel_lift.left.status, 'open')
  assert.equal(clean.rigidity.left.value, 'Semi-Rigid')
})

test('acceptance strips invented figures from the confirmed summary and snapshot', () => {
  const invented = snapshot({
    rearfoot_posting: 'Intrinsic varus 2°',
    heel_skive: 'Medial 3mm',
    heel_lift: '5mm bilateral',
    rigidity: 'Semi-Rigid (Poly)',
  })
  const history = [{ role: 'user', content: 'Build me the prescription.' }, { role: 'assistant', content: invented }]
  const reply = acceptanceReply(invented, history)

  assert.ok(reply)
  assert.doesNotMatch(reply, /2°|3mm|5mm|\bPoly\b|\bIntrinsic\b/i)
  assert.match(reply, /Rearfoot posting: Left — varus; Right — varus/)
  assert.match(reply, /Heel skive: Left — Medial; Right — Medial/)
  assert.match(reply, /Heel lift: Left — bilateral; Right — bilateral/)

  const acceptedHistory = [...history, { role: 'user', content: ACCEPT_PRESCRIPTION }, { role: 'assistant', content: reply }]
  const result = current(acceptedHistory)
  assert.equal(result.confirmed, true)
  assert.equal(result.state.heel_lift.left.value, 'bilateral')
})

test('figures and fabrication the practitioner did give are preserved exactly', () => {
  const { sanitisePrescription } = require('../.test-build/src/prescriptionState.cjs')
  const given = parse(snapshot({
    rearfoot_posting: 'Extrinsic varus 4°',
    heel_skive: 'Medial 3mm',
  }))
  const said = [{ role: 'user', content: 'Extrinsic, 4 degrees varus, 3mm medial skive.' }]
  const clean = sanitisePrescription(given, said)
  assert.equal(clean.rearfoot_posting.left.value, 'Extrinsic varus 4°')
  assert.equal(clean.heel_skive.left.value, 'Medial 3mm')
})

test('prose figures the practitioner never gave are stripped; ranges survive', () => {
  const { sanitiseProse } = require('../.test-build/src/prescriptionState.cjs')
  const asked = [{ role: 'user', content: 'Build me the prescription.' }]
  assert.equal(
    sanitiseProse('Heel lift 6mm bilaterally reduces tension.', asked),
    'Heel lift bilaterally reduces tension.',
  )
  // A range is guidance, not a decision, so it stays.
  assert.match(sanitiseProse('Medial skive 2-4mm depending on correction.', asked), /2-4mm/)
  // A heel cup depth is the model's to choose and must not be touched.
  assert.match(sanitiseProse('Heel cup 16mm contains the fat pad.', asked), /16mm/)
  // A figure the practitioner gave is preserved.
  const said = [{ role: 'user', content: 'Use a 6mm lift.' }]
  assert.match(sanitiseProse('Heel lift 6mm bilaterally.', said), /6mm/)
})

test('conditional modifications cannot be accepted as unconditional orders', () => {
  for (const value of ['Fascial Accommodation (if arch contact tender — pending Q2)', 'Heel Cushion, consider additional padding', 'SAMPLE RESPONSE unless confirmed']) {
    const draft = snapshot({ additions: value })
    assert.equal(current([{role:'assistant', content:draft}]).state.additions.left.status, 'invalid')
    assert.equal(acceptanceReply(draft, []), null)
  }
})
test('heel cup ranges require a single selection and one-sided edits preserve the opposite value', () => {
  assert.equal(acceptanceReply(snapshot({heel_cup:'14–16 mm'}), []), null)
  const draft = proposal.replace('heel_cup @B = 16mm', 'heel_cup @L = 12mm\nheel_cup @R = 16mm')
  const state = parse(acceptanceReply(draft, []))
  assert.equal(state.heel_cup.left.value, '12mm')
  assert.equal(state.heel_cup.right.value, '16mm')
})
test('panel exposes open values and explains conditional acceptance blockers', () => {
  const React = require('react')
  const {renderToStaticMarkup} = require('react-dom/server')
  const Panel = require('../.test-build/src/components/PrescriptionPanel.cjs').default
  const html = renderToStaticMarkup(React.createElement(Panel, {state:parse(snapshot({heel_lift:'', additions:'SAMPLE RESPONSE (pending answer)'})), onAccept:()=>{}}))
  assert.ok(html.includes('>Open</span>'))
  assert.ok(html.includes('Resolve the flagged values'))
  assert.ok(html.includes('disabled=""'))
})

test('questions outside a complete snapshot block acceptance', () => {
  for (const question of ['Heel pain character [[OPTIONS Heel pain: Focal | Diffuse]]', 'Is heel pain focal or diffuse?', 'Depth [[INPUT Depth: mm]]']) {
    const draft = question + '\n' + proposal
    assert.equal(acceptanceReply(draft, []), null)
    assert.equal(current([{role:'assistant', content:draft}]).pendingQuestions, true)
    const legacy = `Practitioner-confirmed prescription\n${prescriptionSummary(parse(draft))}\n\n${draft.match(/\[\[RX[\s\S]*?\]\]/)[0]}`
    assert.equal(current([{role:'assistant',content:draft},{role:'user',content:ACCEPT_PRESCRIPTION},{role:'assistant',content:legacy}]).confirmed, false)
  }
})
test('answered question followed by a refreshed proposal can be accepted', () => {
  const history = [{role:'assistant',content:'Select an option?\n'+proposal},{role:'user',content:'SAMPLE RESPONSE'},{role:'assistant',content:proposal}]
  const reply = acceptanceReply(proposal, history)
  assert.ok(reply)
  assert.equal(current([...history,{role:'user',content:ACCEPT_PRESCRIPTION},{role:'assistant',content:reply}]).confirmed,true)
})
test('pending questions disable panel acceptance even with all fields valid', () => {
  const React = require('react')
  const {renderToStaticMarkup} = require('react-dom/server')
  const Panel = require('../.test-build/src/components/PrescriptionPanel.cjs').default
  const html = renderToStaticMarkup(React.createElement(Panel,{state:parse(proposal),pendingQuestions:true,onAccept:()=>{}}))
  assert.ok(html.includes('Answer the questions below'))
  assert.match(html, /disabled=""[^>]*>Accept prescription/)
})
