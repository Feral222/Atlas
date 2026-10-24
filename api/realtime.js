const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Atlas-Password",
  "Cache-Control": "no-store",
};

const ACTION_TOOLS = [
  {
    type: "function",
    name: "create_task",
    description:
      "Create a new ATLAS task. Use when the user asks to add, create, remember, or schedule a task. This does not create an external calendar event.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        area: { type: "string" },
        due: {
          type: "string",
          description: "Due date as YYYY-MM-DD, or an empty string if no due date.",
        },
        priority: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["title"],
    },
  },
  {
    type: "function",
    name: "update_task",
    description:
      "Update an existing ATLAS task. If the exact task_id is unknown, call search_atlas first.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        area: { type: "string" },
        due: { type: "string", description: "YYYY-MM-DD, or empty string to clear." },
        priority: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["task_id"],
    },
  },
  {
    type: "function",
    name: "set_task_status",
    description:
      "Mark an existing ATLAS task completed or reopen it. If task_id is unknown, call search_atlas first.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        completed: { type: "boolean" },
      },
      required: ["task_id", "completed"],
    },
  },
  {
    type: "function",
    name: "create_note",
    description: "Save a quick note to the ATLAS Inbox.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    type: "function",
    name: "create_record",
    description: "Save a structured record in an ATLAS area.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        area: { type: "string" },
        type: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD, or empty if not applicable." },
        tags: { type: "array", items: { type: "string" } },
        details: { type: "string" },
      },
      required: ["title", "area"],
    },
  },
  {
    type: "function",
    name: "create_timeline_event",
    description: "Add a dated event to the ATLAS timeline.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD." },
        area: { type: "string" },
        details: { type: "string" },
      },
      required: ["title", "date"],
    },
  },
  {
    type: "function",
    name: "create_person",
    description: "Add a person to ATLAS People.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        relationship: { type: "string" },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    type: "function",
    name: "search_atlas",
    description:
      "Search local ATLAS data. Use before changing an existing task when you need its ID, and whenever the user asks to find, show, or retrieve information already in ATLAS.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        scope: {
          type: "string",
          enum: ["all", "tasks", "notes", "events", "records", "people", "documents"],
        },
      },
      required: ["query"],
    },
  },
];

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
        version: "0.6.3",
        status: "online",
        model: "gpt-realtime-2.1-mini",
        actions: ACTION_TOOLS.map((tool) => tool.name),
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
    try {
      body = await request.json();
    } catch {}

    const requestedVoice =
      typeof body.voice === "string" && ALLOWED_VOICES.has(body.voice)
        ? body.voice
        : "cedar";

    const clientNow =
      typeof body.client_now === "string"
        ? body.client_now
        : new Date().toISOString();
    const timezone = typeof body.timezone === "string" ? body.timezone : "";

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
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

Speak naturally, warmly, calmly, and concisely. You are practical and capable, not theatrical.

ATLAS 0.6.3 Actions + Voice Controls:
- You have client-owned function tools that can search local ATLAS data, create or update tasks, mark tasks complete or incomplete, save Inbox notes, add structured records, add timeline events, and add people.
- When the user asks ATLAS to perform one of those actions, USE the appropriate function tool rather than merely explaining how.
- Never claim an action succeeded until the function result says ok:true.
- If you need an existing task ID, call search_atlas first.
- If search_atlas returns multiple plausible matches, ask the user which one they mean instead of changing one arbitrarily.
- If a function result already satisfies the request, do not repeat the action. Confirm it briefly.
- Tool chains are allowed when needed, for example search_atlas followed by set_task_status.
- There is deliberately no delete tool in 0.6. Destructive deletion still requires the user's on-screen controls.
- Spoken control words “pause”/“mute” and “goodbye” are handled locally by the browser; do not reinterpret those exact standalone commands as ordinary conversation.
- If the user asks for a relative date, interpret it using the client time below.

Client local time: ${clientNow}
Client timezone: ${timezone}`,
            tools: ACTION_TOOLS,
            tool_choice: "auto",
            max_output_tokens: 1000,
            audio: {
              input: {
                noise_reduction: { type: "near_field" },
                transcription: {
                  model: "gpt-4o-mini-transcribe",
                  language: "en",
                },
                turn_detection: {
                  type: "semantic_vad",
                  eagerness: "medium",
                  create_response: true,
                  interrupt_response: true,
                },
              },
              output: { voice: requestedVoice },
            },
          },
        }),
      },
    );

    const data = await openAIResponse.json();

    if (!openAIResponse.ok) {
      console.error("Realtime client secret error:", data);
      return json(
        {
          error: "ATLAS could not start a realtime voice session.",
          detail:
            data?.error?.message ||
            `OpenAI returned ${openAIResponse.status}.`,
        },
        502,
      );
    }

    return json({
      ok: true,
      value: data.value,
      expires_at: data.expires_at,
      voice: requestedVoice,
      model: data?.session?.model || "gpt-realtime-2.1-mini",
    });
  },
};
