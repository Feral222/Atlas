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

  {type:"function",name:"browse_vault_folder",description:"Open a local folder visually in the ATLAS Library. List folders first to get its ID.",parameters:{type:"object",properties:{folder_id:{type:"string",description:"Folder ID, all, or unfiled"}},required:["folder_id"]}},
  {type:"function",name:"select_vault_items",description:"Visually multi-select files or folders by exact IDs. Search files/list folders first; do not guess IDs.",parameters:{type:"object",properties:{items:{type:"array",items:{type:"object",properties:{type:{type:"string",enum:["file","folder"]},id:{type:"string"}},required:["type","id"]}},replace:{type:"boolean"}},required:["items"]}},
  {type:"function",name:"select_all_vault_items",description:"Visually select all files and folders in the CURRENTLY OPEN folder only.",parameters:{type:"object",properties:{},additionalProperties:false}},
  {type:"function",name:"clear_vault_selection",description:"Clear selected items and exit multi-select mode.",parameters:{type:"object",properties:{},additionalProperties:false}},
  {type:"function",name:"get_vault_item_details",description:"Read metadata about one imported file or folder; does not read document content.",parameters:{type:"object",properties:{type:{type:"string",enum:["file","folder"]},id:{type:"string"}},required:["type","id"]}},
  {type:"function",name:"batch_vault_action",description:"Perform move, copy, tag, or delete on currently selected items. Copy and tag apply only to files. For delete, get explicit user confirmation; device confirmation dialog also appears. Report skipped items.",parameters:{type:"object",properties:{action:{type:"string",enum:["move","copy","tag","delete"]},folder_id:{type:"string"},tag:{type:"string"},confirmed:{type:"boolean"}},required:["action"]}},


  {type:"function",name:"list_vault_folders",description:"List folders and their exact IDs on this device before creating subfolders or moving files.",parameters:{type:"object",properties:{},additionalProperties:false}},
  {type:"function",name:"create_vault_folder",description:"Create a local folder, optionally inside an existing parent folder by exact parent_id. List folders first if parent is unknown.",parameters:{type:"object",properties:{name:{type:"string"},parent_id:{type:"string",description:"Existing folder ID or empty for root"}},required:["name"]}},
  {type:"function",name:"rename_vault_folder",description:"Rename an existing folder by exact ID. List folders first.",parameters:{type:"object",properties:{folder_id:{type:"string"},name:{type:"string"}},required:["folder_id","name"]}},
  {type:"function",name:"move_vault_folder",description:"Move an existing folder into another folder or root. List folders first.",parameters:{type:"object",properties:{folder_id:{type:"string"},parent_id:{type:"string",description:"Destination parent folder ID or empty for root"}},required:["folder_id","parent_id"]}},
  {type:"function",name:"search_vault_files",description:"Find imported files by filename, category, tags or folder path; empty query lists up to 40 files. Returns exact file IDs, not file contents.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}},
  {type:"function",name:"organize_vault_file",description:"Change an imported file's name, category, tags or folder. First search_vault_files and list_vault_folders to resolve exact IDs; ask if ambiguous. Does not alter file bytes.",parameters:{type:"object",properties:{file_id:{type:"string"},folder_id:{type:"string"},name:{type:"string"},category:{type:"string"},tags:{type:"array",items:{type:"string"}}},required:["file_id"]}},

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
        version: "0.6.4",
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

ATLAS 0.7.3 Actions + Voice + Local Vault:
- You have client-owned function tools that can search local ATLAS data, create or update tasks, mark tasks complete or incomplete, save Inbox notes, add structured records, add timeline events, and add people.
- Visual File Manager tools: browse folders, select individual or all visible items, read file metadata, and batch move/copy/tag/delete. Resolve exact IDs first. Copy and tag only support files. Never claim that file sharing or document content reading is available through AI. Ask explicit user permission before deletion, and the device will also show a confirmation. Never assume selected items persist after actions.\n- You can also create, rename and move local Vault folders, search imported files, and update file names, categories, tags and folder placement. Resolve exact IDs first using list_vault_folders and search_vault_files. Do not claim to read file contents or access the entire iPhone Files or Photos library. Never delete files through AI. Ask for clarification if names are ambiguous. Folders and file bytes remain on this device and do not cloud sync yet.\n- When the user asks ATLAS to perform one of those actions, USE the appropriate function tool rather than merely explaining how.
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
