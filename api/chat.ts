import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const client = new Anthropic()

// Load system prompt from assets
const systemPromptPath = resolve(process.cwd(), 'assets', 'system_prompt.md')
const systemPrompt = readFileSync(systemPromptPath, 'utf-8')

interface PatientContext {
  name?: string
  age?: number
  weight?: number
  context?: string
}

interface RequestBody {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  patientContext?: PatientContext
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { messages, patientContext }: RequestBody = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' })
    }

    // Build final system prompt with patient context if provided
    let finalSystemPrompt = systemPrompt
    if (patientContext?.context) {
      finalSystemPrompt = `${systemPrompt}\n\n${patientContext.context}`
    }

    // Call Anthropic API
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: finalSystemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    })

    const reply =
      response.content[0].type === 'text' ? response.content[0].text : ''

    return res.status(200).json({ reply })
  } catch (error) {
    console.error('API error:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: errorMessage })
  }
}