import { get, put } from "@vercel/blob";
import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "0.6.4";
const PATHNAME = "atlas-sync/state-v1.enc";
const COLLECTIONS = ["tasks", "notes", "events", "people", "records"];
const MAX_BODY = 1_500_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Atlas-Password",
  "Cache-Control": "no-store",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function auth(request) {
  const expected = process.env.ATLAS_ACCESS_PASSWORD;
  const supplied = request.headers.get("x-atlas-password") || "";
  return !!expected && safeEqual(supplied, expected);
}
function syncKey() {
  const raw = process.env.ATLAS_SYNC_KEY;
  if (!raw) throw new Error("ATLAS_SYNC_KEY is not configured.");
  return createHash("sha256").update(raw).digest();
}
function encryptObject(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", syncKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: "A256GCM",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}
function decryptObject(text) {
  const env = JSON.parse(text);
  if (!env || env.v !== 1) throw new Error("Unsupported ATLAS sync envelope.");
  const decipher = createDecipheriv("aes-256-gcm", syncKey(), Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(env.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString("utf8"));
}
function blankState() {
  const objects = {};
  const tombstones = {};
  for (const c of COLLECTIONS) { objects[c] = {}; tombstones[c] = {}; }
  return {
    version: 1,
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    objects,
    tombstones,
    chat: { messages: {}, clearedAt: "" },
    categories: {},
  };
}
function normalizeState(raw) {
  const base = blankState();
  if (!raw || typeof raw !== "object") return base;
  base.revision = Number(raw.revision || 0) || 0;
  base.updatedAt = raw.updatedAt || base.updatedAt;
  for (const c of COLLECTIONS) {
    base.objects[c] = raw.objects?.[c] && typeof raw.objects[c] === "object" ? raw.objects[c] : {};
    base.tombstones[c] = raw.tombstones?.[c] && typeof raw.tombstones[c] === "object" ? raw.tombstones[c] : {};
  }
  base.chat.messages = raw.chat?.messages && typeof raw.chat.messages === "object" ? raw.chat.messages : {};
  base.chat.clearedAt = raw.chat?.clearedAt || "";
  base.categories = raw.categories && typeof raw.categories === "object" ? raw.categories : {};
  return base;
}
async function loadState() {
  const result = await get(PATHNAME, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return { state: blankState(), exists: false, etag: "" };
  const text = await new Response(result.stream).text();
  return { state: normalizeState(decryptObject(text)), exists: true, etag: result.blob?.etag || "" };
}
async function saveState(state, etag = "") {
  const options = {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  };
  if (etag) options.ifMatch = etag;
  return put(PATHNAME, encryptObject(state), options);
}
function stamp(value, fallback = "") {
  const d = new Date(value || fallback || 0);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
function messageId(m) {
  if (m?._syncId) return String(m._syncId);
  const raw = [m?.role || "", m?.at || "", m?.source || "", m?.content || ""].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}
function mergeSeed(state, seed, at) {
  if (!seed || typeof seed !== "object") return false;
  let changed = false;
  for (const c of COLLECTIONS) {
    for (const item of Array.isArray(seed.data?.[c]) ? seed.data[c] : []) {
      const id = String(item?.id || "");
      if (!id || state.tombstones[c][id] || state.objects[c][id]) continue;
      state.objects[c][id] = { item, updatedAt: at };
      changed = true;
    }
  }
  for (const m of Array.isArray(seed.chat) ? seed.chat : []) {
    const id = messageId(m);
    const msgAt = m?.at || at;
    if (state.chat.clearedAt && stamp(msgAt) <= stamp(state.chat.clearedAt)) continue;
    if (!state.chat.messages[id]) {
      state.chat.messages[id] = { message: { ...m, _syncId: id }, updatedAt: msgAt };
      changed = true;
    }
  }
  for (const name of Array.isArray(seed.customCategories) ? seed.customCategories : []) {
    const key = String(name || "").trim().toLowerCase();
    if (!key || state.categories[key]) continue;
    state.categories[key] = { name: String(name).trim(), updatedAt: at };
    changed = true;
  }
  return changed;
}
function applyOp(state, op) {
  if (!op || typeof op !== "object") return false;
  const at = op.at || new Date().toISOString();
  if (op.type === "upsert" && COLLECTIONS.includes(op.collection) && op.item?.id) {
    const c = op.collection, id = String(op.item.id);
    const tomb = state.tombstones[c][id];
    const existing = state.objects[c][id];
    if (tomb && stamp(tomb) > stamp(at)) return false;
    if (existing && stamp(existing.updatedAt) > stamp(at)) return false;
    delete state.tombstones[c][id];
    state.objects[c][id] = { item: op.item, updatedAt: at };
    return true;
  }
  if (op.type === "delete" && COLLECTIONS.includes(op.collection) && op.id) {
    const c = op.collection, id = String(op.id);
    const existingTomb = state.tombstones[c][id];
    if (existingTomb && stamp(existingTomb) > stamp(at)) return false;
    delete state.objects[c][id];
    state.tombstones[c][id] = at;
    return true;
  }
  if (op.type === "chat_upsert" && op.message) {
    const id = messageId(op.message);
    const msgAt = op.message.at || at;
    if (state.chat.clearedAt && stamp(msgAt) <= stamp(state.chat.clearedAt)) return false;
    const existing = state.chat.messages[id];
    if (existing && stamp(existing.updatedAt) > stamp(at)) return false;
    state.chat.messages[id] = { message: { ...op.message, _syncId: id }, updatedAt: at };
    return true;
  }
  if (op.type === "chat_clear") {
    if (stamp(state.chat.clearedAt) > stamp(at)) return false;
    state.chat.clearedAt = at;
    for (const [id, entry] of Object.entries(state.chat.messages)) {
      if (stamp(entry.message?.at || entry.updatedAt) <= stamp(at)) delete state.chat.messages[id];
    }
    return true;
  }
  if (op.type === "category_add" && op.name) {
    const key = String(op.name).trim().toLowerCase();
    if (!key) return false;
    const existing = state.categories[key];
    if (existing && stamp(existing.updatedAt) > stamp(at)) return false;
    state.categories[key] = { name: String(op.name).trim(), updatedAt: at };
    return true;
  }
  return false;
}
function clientState(state) {
  const data = { version: 3, tasks: [], notes: [], events: [], people: [], records: [] };
  for (const c of COLLECTIONS) {
    data[c] = Object.values(state.objects[c])
      .sort((a, b) => stamp(b.updatedAt) - stamp(a.updatedAt))
      .map(x => x.item);
  }
  const chat = Object.values(state.chat.messages)
    .map(x => x.message)
    .filter(m => !state.chat.clearedAt || stamp(m?.at) > stamp(state.chat.clearedAt))
    .sort((a, b) => stamp(a?.at) - stamp(b?.at))
    .slice(-100);
  const customCategories = Object.values(state.categories)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(x => x.name);
  return { data, chat, customCategories };
}
async function performSync(payload) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadState();
    const state = loaded.state;
    const now = new Date().toISOString();
    let changed = mergeSeed(state, payload.seed, now);
    const ops = Array.isArray(payload.ops) ? payload.ops.slice(0, 1000) : [];
    for (const op of ops) changed = applyOp(state, op) || changed;
    if (changed || !loaded.exists) {
      state.revision = Number(state.revision || 0) + 1;
      state.updatedAt = now;
      try {
        await saveState(state, loaded.etag);
      } catch (error) {
        const name = String(error?.name || "");
        const msg = String(error?.message || "");
        if ((name.includes("Precondition") || msg.includes("precondition") || msg.includes("412")) && attempt < 2) continue;
        throw error;
      }
    }
    return {
      revision: state.revision,
      updated_at: state.updatedAt,
      state: clientState(state),
    };
  }
  throw new Error("ATLAS sync conflict retry limit reached.");
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method === "GET") {
      return json({
        ok: true,
        service: "ATLAS Private Sync",
        version: VERSION,
        status: "online",
        storage: "private-encrypted",
        syncs: ["chat", "tasks", "notes", "records", "timeline", "people", "categories"],
        local_only: ["documents", "photos"],
      });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (!auth(request)) return json({ error: "Unauthorized." }, 401);
    if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: "ATLAS sync storage is not configured." }, 503);
    if (!process.env.ATLAS_SYNC_KEY) return json({ error: "ATLAS sync encryption is not configured." }, 503);

    const length = Number(request.headers.get("content-length") || 0);
    if (length > MAX_BODY) return json({ error: "Sync payload is too large." }, 413);

    try {
      const payload = await request.json();
      const result = await performSync(payload || {});
      return json({ ok: true, ...result });
    } catch (error) {
      console.error("ATLAS sync error:", error);
      return json({ error: "ATLAS sync failed.", detail: "The private sync store could not be updated." }, 500);
    }
  },
};
