const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Atlas-Password",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string",
    )
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 6000),
    }));
}

function outputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const pieces = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        pieces.push(content.text);
      }
    }
  }
  return pieces.join("\n").trim();
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({
        ok: true,
        service: "ATLAS Brain",
        version: "0.4.0",
        status: "online",
        model: "gpt-6-luna",
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const expectedPassword = process.env.ATLAS_ACCESS_PASSWORD;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!expectedPassword || !apiKey) {
      return json(
        {
          error:
            "ATLAS server configuration is incomplete. Required environment variables are missing.",
        },
        500,
      );
    }

    const suppliedPassword = request.headers.get("x-atlas-password") || "";
    if (suppliedPassword !== expectedPassword) {
      return json({ error: "Unauthorized." }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request." }, 400);
    }

    const message =
      typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return json({ error: "A message is required." }, 400);
    }

    if (message.length > 6000) {
      return json({ error: "Message is too long." }, 400);
    }

    const input = [
      ...cleanHistory(body?.history),
      { role: "user", content: message },
    ];

    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        store: false,
        reasoning: { effort: "low" },
        max_output_tokens: 1200,
        instructions: `You are ATLAS, the conversational intelligence at the center of a private personal operating system.

Your role is to help the owner understand, organize, plan, retrieve, and eventually act on information across ATLAS.

Personality:
- calm, capable, warm, concise, and practical
- never theatrical or overbearing
- you can use the ATLAS identity naturally, but do not role-play mythology

Important current limitation:
- This is ATLAS 0.4 Brain Stage 1.
- Right now you can converse and reason, but you do NOT yet have action tools.
- Never claim that you created, edited, filed, moved, deleted, scheduled, uploaded, downloaded, emailed, or otherwise changed anything unless a tool result in the conversation explicitly confirms it.
- When the owner asks for an action that is not yet connected, say what ATLAS will eventually be able to do and give the shortest useful next step.

Privacy:
- Treat all user-provided information as private.
- Do not ask for passwords, API keys, or other secret credentials in chat.`,
        input,
        safety_identifier: "atlas-primary-user",
      }),
    });

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error("OpenAI API error:", data);
      return json(
        {
          error: "ATLAS could not reach its model.",
          detail:
            data?.error?.message ||
            `OpenAI request failed with status ${openAIResponse.status}.`,
        },
        502,
      );
    }

    const reply = outputText(data);

    if (!reply) {
      return json({ error: "ATLAS received an empty model response." }, 502);
    }

    return json({
      ok: true,
      reply,
      model: data.model || "gpt-6-luna",
      usage: data.usage || null,
    });
  },
};
