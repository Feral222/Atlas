const ALLOWED_VOICES = new Set(["alloy","ash","ballad","coral","echo","sage","shimmer","verse","marin","cedar"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Atlas-Password",
  "Cache-Control": "no-store",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({
        ok: true,
        service: "ATLAS Realtime Voice",
        version: "0.5.0",
        status: "online",
        model: "gpt-realtime-2.1-mini",
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const expectedPassword = process.env.ATLAS_ACCESS_PASSWORD;

    if (!apiKey || !expectedPassword) {
      return json({ error: "ATLAS server configuration is incomplete." }, 500);
    }

    const suppliedPassword = request.headers.get("x-atlas-password") || "";
    if (suppliedPassword !== expectedPassword) {
      return json({ error: "Unauthorized." }, 401);
    }

    let body = {};
    try { body = await request.json(); } catch {}

    const requestedVoice =
      typeof body.voice === "string" && ALLOWED_VOICES.has(body.voice)
        ? body.voice
        : "marin";

    const openAIResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "atlas-primary-user",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 60 },
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1-mini",
          output_modalities: ["audio"],
          instructions: `You are ATLAS, the voice intelligence inside a private personal operating system.

Speak naturally, warmly, and concisely. You are calm, capable, practical, and never theatrical.
The user should feel like they are talking to a highly competent personal AI assistant.

Current stage:
- This is ATLAS 0.5 Voice.
- You can hold a realtime spoken conversation.
- You do not yet have action tools connected.
- Never claim you created, changed, deleted, filed, moved, scheduled, sent, uploaded, downloaded, or otherwise acted on data unless a tool result explicitly confirms it.
- If asked to perform an unavailable action, briefly explain that the action layer is coming next and offer the closest useful help you can provide now.

Privacy:
- Treat user-provided information as private.
- Never ask the user to say passwords, API keys, or secret credentials aloud.`,
          max_output_tokens: 1000,
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "en"
              },
              turn_detection: {
                type: "semantic_vad",
                eagerness: "medium",
                create_response: true,
                interrupt_response: true
              }
            },
            output: {
              voice: requestedVoice
            }
          }
        }
      }),
    });

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error("Realtime client secret error:", data);
      return json({
        error: "ATLAS could not start a realtime voice session.",
        detail: data?.error?.message || `OpenAI returned ${openAIResponse.status}.`
      }, 502);
    }

    return json({
      ok: true,
      value: data.value,
      expires_at: data.expires_at,
      voice: requestedVoice,
      model: data?.session?.model || "gpt-realtime-2.1-mini"
    });
  },
};
