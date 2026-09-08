/** NDJSON framing: a clean EOF alone never means the model finished. */
export async function readChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onText: (text: string) => void,
): Promise<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let complete = false
  const consume = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as { type: string; text?: string; message?: string }
    if (complete) throw new Error('Unexpected data after completion')
    if (event.type === 'delta' && typeof event.text === 'string') {
      text += event.text
      onText(text)
    } else if (event.type === 'complete') {
      complete = true
    } else {
      throw new Error(event.message ?? 'Invalid response stream')
    }
  }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffer.indexOf('\n')) >= 0) {
        consume(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
      }
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
    if (!complete || !text.trim()) throw new Error('Incomplete response')
    return text
  } finally {
    reader.releaseLock()
  }
}
