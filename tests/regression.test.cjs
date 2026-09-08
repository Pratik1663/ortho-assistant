const { test } = require('node:test')
const assert = require('node:assert/strict')
const { RX_FIELDS, parsePrescriptionState: parse, currentPrescription: current, acceptanceReply, ACCEPT_PRESCRIPTION, canAcceptPrescription, countSettled } = require('../.test-build/src/prescriptionState.cjs')
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
test('an open side does not count as settled; all-none is not acceptable', () => {
  const partial = proposal.replace('width @B = Regular', 'width @L = Regular\nwidth @R =')
  assert.equal(countSettled(parse(partial)).settled, 15)
  assert.equal(acceptanceReply(partial), null)
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
test('panel labels proposals separately and blocks acceptance with open values', () => {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const Panel = require('../.test-build/src/components/PrescriptionPanel.cjs').default
  const draft = renderToStaticMarkup(React.createElement(Panel,{state:parse(snapshot({width:''})),onAccept:()=>{}}))
  assert.ok(draft.includes('Suggested prescription'))
  assert.match(draft, /disabled=""[^>]*>Accept prescription/)
  const confirmed = renderToStaticMarkup(React.createElement(Panel,{state:parse(proposal),confirmed:true,onAccept:()=>{}}))
  assert.ok(confirmed.includes('Accepted by practitioner'))
  assert.ok(!confirmed.includes('>Accept prescription<'))
})
