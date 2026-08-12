import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  method?: string;
  body?: unknown;
};

type ChatResponse = {
  status(code: number): ChatResponse;
  json(body: { reply: string } | { error: string }): void;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    Object.keys(message).length === 2 &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const requestBody = body as Record<string, unknown>;
  if (Object.keys(requestBody).length !== 1 || !Array.isArray(requestBody.messages)) {
    return null;
  }

  return requestBody.messages.every(isChatMessage) ? requestBody.messages : null;
}

export default async function handler(req: ChatRequest, res: ChatResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const messages = parseMessages(req.body);
  if (messages === null) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server not configured" });
    return;
  }

  try {
    const assetsDirectory = join(process.cwd(), "assets");
    const systemPrompt = readFileSync(join(assetsDirectory, "system_prompt.md"), "utf8");
    const knowledgeBase = readFileSync(join(assetsDirectory, "knowledge_base.md"), "utf8");
    const system = systemPrompt.replace("{{KNOWLEDGE_BASE}}", knowledgeBase);

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages,
    });
    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    res.status(200).json({ reply });
  } catch (error: unknown) {
    console.error("Anthropic API request failed", error);
    res.status(502).json({ error: "Something went wrong \u2014 try again" });
  }
}
