import { createServer } from "node:http";
import { readFile, mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { promisify } from "node:util";
import { WebSocketServer, WebSocket } from "ws";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "campaign-state.json");
const DEFAULT_CATALOG_FILES = ["weapon-summaries.json", "equipment-summaries.json", "cyberware-summaries.json", "skill-chip-summaries.json"]
  .map(file => path.join(ROOT, "catalog", file));
const PORTRAIT_DIR = path.join(DATA_DIR, "portraits");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8000);
const BOARD_COLUMNS = 20;
const BOARD_ROWS = 14;
const MAX_EVENTS = 80;
const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_CHARACTERS_PER_ACCOUNT = 10;
const MAX_CAMPAIGN_PLAYERS = 10;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PORTRAIT_BYTES = 2 * 1024 * 1024;
const ATTRIBUTE_KEYS = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"];
const BODY_LOCATION_KEYS = ["head", "torso", "rightArm", "leftArm", "rightLeg", "leftLeg"];
const SPECIAL_SKILL_NAMES = ["Authority", "Charismatic Leadership", "Combat Sense", "Credibility", "Family", "Interface", "Jury Rig", "Medical Tech", "Resources", "Streetdeal"];
const CINEMATIC_ATTRIBUTE_POOLS = {
  "major-hero": 80,
  "major-supporting": 70,
  "minor-hero": 75,
  "minor-support": 60,
  average: 50
};
const ENEMY_TEMPLATES = [
  { name: "Corner lookout", role: "Street lookout", attributes: { REF: 5, COOL: 4, BODY: 5 }, health: { current: 12, max: 12 }, gear: ["Compact sidearm", "Old radio"] },
  { name: "Railyard bruiser", role: "Railyard bruiser", attributes: { REF: 4, COOL: 5, BODY: 8 }, health: { current: 20, max: 20 }, gear: ["Heavy gloves", "Reinforced coat"] }
];
const scrypt = promisify(scryptCallback);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

let store = { rooms: {}, accounts: {}, sessions: {}, catalog: [] };
let defaultCatalog = [];
let saveQueue = Promise.resolve();
const authAttempts = new Map();

function boundedText(value, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function finiteInteger(value, fallback = 0, min = -1000, max = 1000) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

function sanitizeAttributes(value) {
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = finiteInteger(value?.[key], 0, 0, 10);
  }
  return attributes;
}

function validOptionalInteger(value, max) {
  if (value == null || value === "") return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max;
}

function validBodyHealth(value) {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  return BODY_LOCATION_KEYS.every(key => {
    const location = value[key];
    return location == null || (typeof location === "object" && !Array.isArray(location)
      && validOptionalInteger(location.current, 9999) && validOptionalInteger(location.max, 9999));
  });
}

function validBodyArmorSP(value) {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  return BODY_LOCATION_KEYS.every(key => validOptionalInteger(value[key], 9999));
}

function sanitizeBodyHealth(value, fallback) {
  const source = value === undefined ? fallback : value;
  return Object.fromEntries(BODY_LOCATION_KEYS.map(key => {
    const location = source?.[key] || {};
    return [key, {
      current: location.current == null || location.current === "" ? null : finiteInteger(location.current, 0, 0, 9999),
      max: location.max == null || location.max === "" ? null : finiteInteger(location.max, 0, 0, 9999)
    }];
  }));
}

function sanitizeBodyArmorSP(value, fallback) {
  const source = value === undefined ? fallback : value;
  return Object.fromEntries(BODY_LOCATION_KEYS.map(key => {
    const armorSP = source?.[key];
    return [key, armorSP == null || armorSP === "" ? null : finiteInteger(armorSP, 0, 0, 9999)];
  }));
}

function validInventoryChipData(inventory) {
  if (!Array.isArray(inventory)) return true;
  return inventory.every(item => {
    if (!item || typeof item !== "object") return true;
    const chipSkill = boundedText(item.chipSkill, 80);
    const hasChipData = chipSkill || item.socketed || (item.chipBonus != null && item.chipBonus !== "");
    if (hasChipData && boundedText(item.category, 40).toLowerCase() !== "cyberware") return false;
    return validOptionalInteger(item.chipBonus, 9999) && (!item.socketed || Boolean(chipSkill));
  });
}

function sanitizeInitialAttributeGeneration(input, attributes) {
  if (!input || typeof input !== "object") return null;
  const allocated = ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributes[key], 0);
  if (input.method === "rolled") {
    if (!Array.isArray(input.rolls) || input.rolls.length !== ATTRIBUTE_KEYS.length
      || input.rolls.some(roll => !Number.isInteger(roll) || roll < 1 || roll > 10)) return null;
    const total = input.rolls.reduce((sum, roll) => sum + roll, 0);
    return input.total === total && allocated === total
      ? { method: "rolled", rolls: [...input.rolls], total }
      : null;
  }
  if (input.method === "cinematic") {
    const total = Object.hasOwn(CINEMATIC_ATTRIBUTE_POOLS, input.tier) ? CINEMATIC_ATTRIBUTE_POOLS[input.tier] : null;
    return total && allocated === total ? { method: "cinematic", tier: input.tier, total } : null;
  }
  if (input.method === "copy" && input.total === allocated) {
    return { method: "copy", total: allocated };
  }
  return null;
}

function sanitizeInitialSkillGeneration(input, skills) {
  if (!input || typeof input !== "object") return null;
  const total = skills.reduce((sum, skill) => sum + skill.value, 0);
  if (input.method === "creation") {
    const normalSkills = skills.filter(skill => !skill.special);
    const specialSkills = skills.filter(skill => skill.special);
    const names = skills.map(skill => skill.name.toLowerCase());
    const requestedNormals = Array.isArray(input.normalSkills) ? input.normalSkills.map(name => boundedText(name, 80)) : [];
    if (total !== 40 || input.total !== 40 || normalSkills.length !== 9 || specialSkills.length !== 1
      || skills.some(skill => skill.value < 1) || new Set(names).size !== skills.length
      || !SPECIAL_SKILL_NAMES.includes(specialSkills[0]?.name)
      || requestedNormals.length !== 9 || new Set(requestedNormals.map(name => name.toLowerCase())).size !== 9
      || requestedNormals.some(name => !normalSkills.some(skill => skill.name === name))
      || boundedText(input.specialSkill, 80) !== specialSkills[0].name) return null;
    return {
      method: "creation",
      normalSkills: normalSkills.map(skill => skill.name),
      specialSkill: specialSkills[0].name,
      total
    };
  }
  if (input.method === "copy" && input.total === total) return { method: "copy", total };
  return null;
}

function sanitizeCharacter(input, existing = {}) {
  if (!input || typeof input !== "object") return null;
  const isNewCharacter = !existing.id;
  if (!validBodyHealth(input.bodyHealth) || !validBodyArmorSP(input.bodyArmorSP) || !validInventoryChipData(input.inventory)) return null;
  for (const key of ATTRIBUTE_KEYS) {
    const value = input.attributes?.[key];
    if (isNewCharacter && (value == null || value === "" || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 10)) return null;
    if (value != null && value !== "" && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 10)) return null;
  }
  const name = boundedText(input.name, 80);
  if (!name) return null;
  const attributes = sanitizeAttributes(input.attributes);
  const attributeGeneration = isNewCharacter
    ? sanitizeInitialAttributeGeneration(input.attributeGeneration, attributes)
    : existing.attributeGeneration;
  if (isNewCharacter && !attributeGeneration) return null;
  const skills = Array.isArray(input.skills) ? input.skills.slice(0, 100).map(skill => {
    if (typeof skill === "string") return { name: boundedText(skill, 80), value: 0, special: false };
    return { name: boundedText(skill?.name, 80), value: finiteInteger(skill?.value, 0, -100, 100), special: Boolean(skill?.special) };
  }).filter(skill => skill.name) : [];
  const skillGeneration = isNewCharacter
    ? sanitizeInitialSkillGeneration(input.skillGeneration, skills)
    : existing.skillGeneration;
  if (isNewCharacter && !skillGeneration) return null;
  if (isNewCharacter && skillGeneration.method === "creation"
    && (!Array.isArray(input.skills) || input.skills.length !== 10
      || input.skills.some(skill => !skill || typeof skill !== "object"
        || !Number.isInteger(Number(skill.value)) || Number(skill.value) < 1 || Number(skill.value) > 40
        || typeof skill.special !== "boolean"))) return null;
  const derived = Array.isArray(input.derived) ? input.derived.slice(0, 50).map(item => boundedText(item, 180)).filter(Boolean) : [];
  const inventory = Array.isArray(input.inventory) ? input.inventory.slice(0, 200).map(item => ({
    id: boundedText(item?.id, 100) || randomUUID(),
    catalogId: boundedText(item?.catalogId, 100),
    name: boundedText(item?.name, 100),
    category: boundedText(item?.category, 40) || "Other",
    quantity: finiteInteger(item?.quantity, 1, 0, 9999),
    equipped: Boolean(item?.equipped),
    chipSkill: boundedText(item?.chipSkill, 80),
    chipBonus: item?.chipBonus == null || item.chipBonus === "" ? null : finiteInteger(item.chipBonus, 0, 0, 9999),
    socketed: Boolean(item?.socketed),
    description: boundedText(item?.description, 1000),
    weaponType: boundedText(item?.weaponType, 60),
    weaponStats: boundedText(item?.weaponStats, 1000),
    weight: boundedText(item?.weight, 40),
    cost: boundedText(item?.cost, 40),
    sourceReference: boundedText(item?.sourceReference, 180),
    customNotes: boundedText(item?.customNotes, 1000)
  })).filter(item => item.name) : existing.inventory || [];
  const healthCurrent = input.healthCurrent == null || input.healthCurrent === "" ? null : finiteInteger(input.healthCurrent, 0, 0, 9999);
  const healthMax = input.healthMax == null || input.healthMax === "" ? null : finiteInteger(input.healthMax, 0, 0, 9999);
  const eddies = input.eddies == null || input.eddies === "" ? finiteInteger(existing.eddies, 0, 0, 999999999) : Number(input.eddies);
  if (!Number.isInteger(eddies) || eddies < 0 || eddies > 999999999) return null;
  if (healthCurrent != null && healthMax != null && healthCurrent > healthMax) return null;
  return {
    ...existing,
    id: existing.id || randomUUID(),
    name,
    role: boundedText(input.role, 80),
    handle: boundedText(input.handle, 80),
    attributes,
    attributeGeneration,
    skills,
    skillGeneration,
    bodyHealth: sanitizeBodyHealth(input.bodyHealth, existing.bodyHealth),
    bodyArmorSP: sanitizeBodyArmorSP(input.bodyArmorSP, existing.bodyArmorSP),
    derived,
    inventory,
    healthCurrent,
    healthMax,
    eddies,
    history: boundedText(input.history, 5000),
    notes: boundedText(input.notes, 5000),
    createdAt: existing.createdAt || new Date().toISOString()
  };
}

function sanitizeCatalogItem(input) {
  if (!input || typeof input !== "object") return null;
  const name = boundedText(input.name, 100);
  if (!name) return null;
  const chipSkill = boundedText(input.chipSkill, 80);
  const chipSkillOptions = Array.isArray(input.chipSkillOptions)
    ? input.chipSkillOptions.slice(0, 10).map(option => boundedText(option, 80)).filter(Boolean)
    : [];
  const pricePerLevel = input.pricePerLevel == null || input.pricePerLevel === "" ? null : Number(input.pricePerLevel);
  const purchaseCost = input.purchaseCost == null || input.purchaseCost === "" ? null : Number(input.purchaseCost);
  if ((chipSkill && boundedText(input.category, 40).toLowerCase() !== "cyberware")
    || (chipSkillOptions.length && (boundedText(input.category, 40).toLowerCase() !== "cyberware"
      || new Set(chipSkillOptions.map(option => option.toLowerCase())).size !== chipSkillOptions.length))
    || (pricePerLevel != null && (!Number.isSafeInteger(pricePerLevel) || pricePerLevel <= 0 || pricePerLevel > 999999999))
    || (purchaseCost != null && (!Number.isSafeInteger(purchaseCost) || purchaseCost <= 0 || purchaseCost > 999999999))) return null;
  return {
    id: boundedText(input.id, 100) || randomUUID(),
    name,
    category: boundedText(input.category, 40) || "Other",
    description: boundedText(input.description, 1000),
    weaponType: boundedText(input.weaponType, 60),
    weaponStats: boundedText(input.weaponStats, 1000),
    chipSkill,
    chipSkillOptions,
    pricePerLevel,
    purchaseCost,
    weight: boundedText(input.weight, 40),
    cost: boundedText(input.cost, 40),
    sourceReference: boundedText(input.sourceReference, 180),
    customNotes: boundedText(input.customNotes, 1000),
    createdBy: boundedText(input.createdBy, 50)
  };
}

function catalogKey(item) {
  return `${item.category.toLowerCase()}\u0000${item.name.toLowerCase()}`;
}

function getCatalogItems() {
  const savedKeys = new Set(store.catalog.map(catalogKey));
  return [
    ...defaultCatalog.filter(item => !savedKeys.has(catalogKey(item))),
    ...store.catalog
  ];
}

function roomIdIsValid(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function isTrustedHost(hostHeader) {
  try {
    const hostname = new URL(`http://${hostHeader}`).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const explicitlyAllowed = (process.env.ALLOWED_HOSTS || "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
    if (hostname === "localhost" || explicitlyAllowed.includes(hostname)) return true;
    if (isIP(hostname) === 4) {
      const octets = hostname.split(".").map(Number);
      return octets[0] === 127 || octets[0] === 10 || (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 169 && octets[1] === 254);
    }
    return hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:");
  } catch {
    return false;
  }
}

function normalizePiece(piece, kind) {
  if (!piece || typeof piece !== "object") return null;
  const id = boundedText(piece.id, 100);
  const name = boundedText(piece.name, 80);
  if (!id || !name) return null;
  const width = finiteInteger(piece.width, 1, 1, BOARD_COLUMNS);
  const height = finiteInteger(piece.height, 1, 1, BOARD_ROWS);
  const normalized = {
    id,
    kind: kind === "token" ? (piece.kind === "enemy" ? "enemy" : "character") : "terrain",
    name,
    x: finiteInteger(piece.x, 0, 0, BOARD_COLUMNS - width),
    y: finiteInteger(piece.y, 0, 0, BOARD_ROWS - height),
    width,
    height
  };
  if (kind === "token") {
    const attributes = {};
    for (const key of ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"]) {
      if (piece.attributes?.[key] != null) attributes[key] = finiteInteger(piece.attributes[key], 0, 0, 99);
    }
    normalized.characterId = boundedText(piece.characterId, 100);
    normalized.ownerUserId = boundedText(piece.ownerUserId, 100);
    normalized.health = piece.health && typeof piece.health === "object" ? {
      current: finiteInteger(piece.health.current, 0, 0, 9999),
      max: finiteInteger(piece.health.max, 0, 0, 9999)
    } : { current: 0, max: 0 };
    normalized.initiative = finiteInteger(piece.initiative, 0, -1000, 1000);
    normalized.attributes = attributes;
    normalized.gear = Array.isArray(piece.gear) ? piece.gear.slice(0, 20).map(item => boundedText(item, 100)).filter(Boolean) : [];
    normalized.role = boundedText(piece.role, 80);
  } else {
    normalized.color = /^#[0-9a-f]{6}$/i.test(piece.color) ? piece.color : "#717d65";
  }
  return normalized;
}

function normalizeBoard(board) {
  if (!board || typeof board !== "object") return { tokens: [], terrain: [] };
  return {
    tokens: Array.isArray(board.tokens) ? board.tokens.slice(0, 100).map(piece => normalizePiece(piece, "token")).filter(Boolean) : [],
    terrain: Array.isArray(board.terrain) ? board.terrain.slice(0, 100).map(piece => normalizePiece(piece, "terrain")).filter(Boolean) : []
  };
}

function sanitizeEvent(input, userName) {
  if (!input || typeof input !== "object") return null;
  const timestamp = new Date().toISOString();
  const actor = boundedText(userName, 50) || "Player";
  if (input.kind === "roll") {
    const kind = input.rollKind === "attack" ? "attack" : input.rollKind === "skill" ? "skill" : "";
    const source = input.source === "board" ? "board" : input.source === "sheet" ? "sheet" : "";
    if (!kind || !source) return null;
    return {
      id: randomUUID(), kind: "roll", rollKind: kind, source, actor, timestamp,
      characterId: boundedText(input.characterId, 100),
      characterName: boundedText(input.characterName, 80),
      skill: boundedText(input.skill, 80),
      attribute: boundedText(input.attribute, 12),
      weapon: boundedText(input.weapon, 80),
      ammoType: boundedText(input.ammoType, 40),
      damageFormula: boundedText(input.damageFormula, 40),
      roundsFired: finiteInteger(input.roundsFired, 1, 1, 100),
      die: finiteInteger(input.die, 1, 1, 10),
      base: finiteInteger(input.base, 0, -100, 100),
      skillValue: finiteInteger(input.skillValue, 0, -100, 100),
      modifier: finiteInteger(input.modifier, 0, -100, 100),
      total: finiteInteger(input.total, 0, -300, 300),
      target: finiteInteger(input.target, 0, -300, 300),
      success: Boolean(input.success)
    };
  }
  if (input.kind === "health") {
    const delta = finiteInteger(input.delta, 0, -9999, 9999);
    if (!delta) return null;
    return {
      id: randomUUID(), kind: "health", actor, timestamp,
      characterId: boundedText(input.characterId, 100),
      characterName: boundedText(input.characterName, 80),
      delta,
      current: finiteInteger(input.current, 0, 0, 9999),
      max: finiteInteger(input.max, 0, 0, 9999)
    };
  }
  return null;
}

async function loadDefaultCatalog() {
  const keys = new Set();
  const items = [];
  for (const file of DEFAULT_CATALOG_FILES) {
    const contents = await readFile(file, "utf8");
    const parsed = JSON.parse(contents);
    if (!Array.isArray(parsed)) throw new Error(`Default catalog ${path.basename(file)} must be a JSON array.`);
    for (const input of parsed) {
      const item = sanitizeCatalogItem({ ...input, createdBy: "Afterdark" });
      if (!item) throw new Error(`Default catalog ${path.basename(file)} contains an invalid item.`);
      const key = catalogKey(item);
      if (keys.has(key)) throw new Error(`Default catalogs contain a duplicate item: ${item.name}`);
      keys.add(key);
      item.id = `builtin-${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
      items.push(item);
    }
  }
  defaultCatalog = items;
}

async function loadStore() {
  try {
    const contents = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(contents);
    if (!parsed || !parsed.rooms || typeof parsed.rooms !== "object" || Array.isArray(parsed.rooms)) {
      throw new Error("Campaign state file has an invalid shape.");
    }
    const rooms = {};
    for (const [campaignId, room] of Object.entries(parsed.rooms)) {
      if (!roomIdIsValid(campaignId) || !room || typeof room !== "object") continue;
      rooms[campaignId] = {
        campaignId,
        name: boundedText(room.name, 120) || "Shared campaign",
        board: normalizeBoard(room.board),
        events: Array.isArray(room.events) ? room.events.filter(event => event && typeof event === "object" && typeof event.id === "string").slice(-MAX_EVENTS) : [],
        updatedAt: boundedText(room.updatedAt, 40) || new Date().toISOString(),
        ownerUserId: boundedText(room.ownerUserId, 100),
        gmKeyHash: boundedText(room.gmKeyHash, 128),
        roster: Array.isArray(room.roster) ? room.roster.filter(item => item && typeof item.characterId === "string").slice(0, 100) : []
      };
    }
    const accounts = parsed.accounts && typeof parsed.accounts === "object" ? Object.fromEntries(
        Object.entries(parsed.accounts).filter(([, account]) => account && typeof account.username === "string" && Array.isArray(account.characters))
          .map(([userId, account]) => [userId, {
            ...account,
            id: userId,
            usernameKey: account.usernameKey || account.username.toLowerCase(),
            characters: account.characters.map(character => sanitizeCharacter(character, character)).filter(Boolean)
          }])
      ) : {};
    const sessions = parsed.sessions && typeof parsed.sessions === "object" ? Object.fromEntries(
      Object.entries(parsed.sessions).filter(([, session]) => session && Number(session.expiresAt) > Date.now() && accounts[session.userId])
    ) : {};
    store = {
      rooms,
      accounts,
      sessions,
      catalog: Array.isArray(parsed.catalog) ? parsed.catalog.map(sanitizeCatalogItem).filter(Boolean).slice(0, 5000) : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      store = { rooms: {}, accounts: {}, sessions: {}, catalog: [] };
      return;
    }
    throw error;
  }
}

function persistStore() {
  const snapshot = JSON.stringify(store);
  saveQueue = saveQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    const temporaryFile = `${DATA_FILE}.tmp`;
    await writeFile(temporaryFile, snapshot, "utf8");
    await rename(temporaryFile, DATA_FILE);
  });
  return saveQueue;
}

function getRoom(campaignId, campaignName) {
  if (!store.rooms[campaignId]) {
    store.rooms[campaignId] = {
      campaignId,
      name: boundedText(campaignName, 120) || "Shared campaign",
      board: { tokens: [], terrain: [] },
      events: [],
      updatedAt: new Date().toISOString(),
      ownerUserId: "",
      gmKeyHash: "",
      roster: []
    };
  }
  return store.rooms[campaignId];
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function broadcast(roomId, payload) {
  const message = JSON.stringify(payload);
  for (const socket of clients) {
    if (socket.roomId === roomId && socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}

function jsonResponse(response, status, value, headers = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  response.end(JSON.stringify(value));
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function getSession(request) {
  const cookie = request.headers.cookie || "";
  const token = cookie.split(";").map(value => value.trim()).find(value => value.startsWith("afterdark_session="))?.slice("afterdark_session=".length);
  if (!token) return null;
  let decodedToken;
  try {
    decodedToken = decodeURIComponent(token);
  } catch {
    return null;
  }
  const sessionId = hashToken(decodedToken);
  const session = store.sessions[sessionId];
  if (!session || session.expiresAt <= Date.now()) {
    if (session) delete store.sessions[sessionId];
    return null;
  }
  const account = store.accounts[session.userId];
  return account ? { userId: session.userId, username: account.username, account } : null;
}

function validGmKey(room, key, userId) {
  return Boolean(room && room.ownerUserId === userId && room.gmKeyHash && key && hashToken(key) === room.gmKeyHash);
}

async function readRequestBody(request, maximum = MAX_MESSAGE_BYTES) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximum) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    const error = new Error("Expected an application/json request.");
    error.statusCode = 415;
    throw error;
  }
  const buffer = await readRequestBody(request);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    const error = new Error("Request JSON is invalid.");
    error.statusCode = 400;
    throw error;
  }
}

function requestOriginIsValid(request) {
  const originValue = request.headers.origin;
  if (!originValue) return false;
  try {
    const origin = new URL(originValue);
    return ["http:", "https:"].includes(origin.protocol) && origin.host === request.headers.host;
  } catch {
    return false;
  }
}

function allowAuthAttempt(request) {
  const key = request.socket.remoteAddress || "unknown";
  const recent = (authAttempts.get(key) || []).filter(timestamp => Date.now() - timestamp < 10 * 60 * 1000);
  if (recent.length >= 12) {
    authAttempts.set(key, recent);
    return false;
  }
  recent.push(Date.now());
  authAttempts.set(key, recent);
  return true;
}

async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  store.sessions[hashToken(token)] = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  await persistStore();
  return token;
}

function setSessionCookie(response, token) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  response.setHeader("set-cookie", `afterdark_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

function clearSessionCookie(response) {
  response.setHeader("set-cookie", "afterdark_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

function publicCharacter(character) {
  return {
    ...character,
    portraitUrl: character.portraitId ? `/api/portraits/${encodeURIComponent(character.portraitId)}` : ""
  };
}

function publicAccount(session) {
  return {
    id: session.userId,
    username: session.username,
    maxCharacters: MAX_CHARACTERS_PER_ACCOUNT,
    characters: session.account.characters.map(publicCharacter)
  };
}

function ownerAccountOfCharacter(characterId) {
  for (const [userId, account] of Object.entries(store.accounts)) {
    const character = account.characters.find(item => item.id === characterId);
    if (character) return { userId, account, character };
  }
  return null;
}

function publicRoster(room, viewerId, isGm) {
  return room.roster.map(entry => {
    const owner = store.accounts[entry.userId];
    const character = owner?.characters.find(item => item.id === entry.characterId);
    if (!character || (!isGm && entry.userId !== viewerId)) return null;
    return { ...publicCharacter(character), ownerUserId: entry.userId, ownerName: owner.username };
  }).filter(Boolean);
}

function linkedPlayerCount(room) {
  return new Set(room.roster.filter(entry => entry.userId !== room.ownerUserId).map(entry => entry.userId)).size;
}

function connectedPlayerCount(roomId) {
  const ownerUserId = store.rooms[roomId]?.ownerUserId;
  return new Set([...clients].filter(socket => socket.roomId === roomId && !socket.isGm && socket.userId !== ownerUserId).map(socket => socket.userId)).size;
}

function broadcastRoster(room) {
  for (const socket of clients) {
    if (socket.roomId !== room.campaignId || socket.readyState !== WebSocket.OPEN) continue;
    send(socket, { type: "roster-state", roster: publicRoster(room, socket.userId, socket.isGm), playerCount: linkedPlayerCount(room) });
  }
}

function boardForViewer(board, socket) {
  if (socket.isGm) return board;
  return {
    terrain: board.terrain,
    tokens: board.tokens.map(token => {
      if (token.kind === "character" && token.ownerUserId === socket.userId) return token;
      const { attributes, gear, health, initiative, characterId, ownerUserId, ...publicToken } = token;
      return publicToken;
    })
  };
}

function eventForViewer(event, socket) {
  if (socket.isGm || event.ownerUserId === socket.userId) return event;
  if (event.kind === "roll") {
    const {
      characterId, ownerUserId, skill, attribute, base, skillValue, modifier,
      ammoType, damageFormula, ...publicEvent
    } = event;
    return { ...publicEvent, privateStats: true };
  }
  if (event.kind === "health") {
    const { characterId, ownerUserId, current, max, ...publicEvent } = event;
    return publicEvent;
  }
  return event;
}

function broadcastBoardState(room) {
  for (const socket of clients) {
    if (socket.roomId !== room.campaignId || socket.readyState !== WebSocket.OPEN) continue;
    send(socket, { type: "board-state", board: boardForViewer(room.board, socket) });
  }
}

function broadcastRoomEvent(roomId, event) {
  for (const socket of clients) {
    if (socket.roomId !== roomId || socket.readyState !== WebSocket.OPEN) continue;
    send(socket, { type: "room-event", event: eventForViewer(event, socket) });
  }
}

function mergePlayerBoardUpdate(requestedBoard, currentBoard, userId) {
  if (JSON.stringify(requestedBoard.terrain) !== JSON.stringify(currentBoard.terrain)) return null;
  const requestedTokens = new Map(requestedBoard.tokens.map(token => [token.id, token]));
  if (requestedTokens.size !== currentBoard.tokens.length || requestedTokens.size !== requestedBoard.tokens.length) return null;
  const tokens = [];
  for (const previous of currentBoard.tokens) {
    const requested = requestedTokens.get(previous.id);
    if (!requested) return null;
    if (previous.kind === "character" && previous.ownerUserId === userId) {
      if (JSON.stringify({ ...previous, x: 0, y: 0 }) !== JSON.stringify({ ...requested, x: 0, y: 0 })) return null;
      tokens.push({ ...previous, x: requested.x, y: requested.y });
    } else {
      if (requested.x !== previous.x || requested.y !== previous.y) return null;
      tokens.push(previous);
    }
  }
  return { tokens, terrain: currentBoard.terrain };
}

async function handleApi(request, response, requestUrl) {
  const pathname = requestUrl.pathname;
  if (pathname === "/api/register" || pathname === "/api/login") {
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    if (!requestOriginIsValid(request)) return jsonResponse(response, 403, { error: "Request origin was rejected." });
    if (!allowAuthAttempt(request)) return jsonResponse(response, 429, { error: "Too many account attempts. Try again in ten minutes." });
    const input = await readJsonBody(request, 8 * 1024);
    const username = boundedText(input.username, 32);
    const password = typeof input.password === "string" ? input.password : "";
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return jsonResponse(response, 400, { error: "Use a 3–24 character username with letters, numbers, or underscores." });
    if (password.length < 12 || password.length > 200) return jsonResponse(response, 400, { error: "Password must be at least 12 characters." });
    const usernameKey = username.toLowerCase();
    const found = Object.entries(store.accounts).find(([, account]) => account.usernameKey === usernameKey);
    if (pathname === "/api/register") {
      if (found) return jsonResponse(response, 409, { error: "That username is already in use." });
      const salt = randomBytes(16).toString("hex");
      const passwordHash = (await scrypt(password, salt, 64)).toString("hex");
      const userId = randomUUID();
      store.accounts[userId] = { id: userId, username, usernameKey, salt, passwordHash, characters: [] };
      const token = await createSession(userId);
      setSessionCookie(response, token);
      return jsonResponse(response, 201, { account: publicAccount({ userId, username, account: store.accounts[userId] }) });
    }
    if (!found) return jsonResponse(response, 401, { error: "Username or password is incorrect." });
    const [userId, account] = found;
    const attempted = await scrypt(password, account.salt, 64);
    const expected = Buffer.from(account.passwordHash, "hex");
    if (attempted.length !== expected.length || !timingSafeEqual(attempted, expected)) {
      return jsonResponse(response, 401, { error: "Username or password is incorrect." });
    }
    const token = await createSession(userId);
    setSessionCookie(response, token);
    return jsonResponse(response, 200, { account: publicAccount({ userId, username: account.username, account }) });
  }

  if (pathname === "/api/logout") {
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    if (!requestOriginIsValid(request)) return jsonResponse(response, 403, { error: "Request origin was rejected." });
    const cookie = request.headers.cookie || "";
    const token = cookie.split(";").map(value => value.trim()).find(value => value.startsWith("afterdark_session="))?.slice("afterdark_session=".length);
    if (token) delete store.sessions[hashToken(decodeURIComponent(token))];
    await persistStore();
    clearSessionCookie(response);
    return jsonResponse(response, 200, { ok: true });
  }

  const session = getSession(request);
  if (pathname === "/api/me") {
    if (request.method !== "GET") return jsonResponse(response, 405, { error: "Method not allowed." });
    return session ? jsonResponse(response, 200, { account: publicAccount(session) }) : jsonResponse(response, 401, { error: "Sign in to continue." });
  }
  if (!session) return jsonResponse(response, 401, { error: "Sign in to continue." });
  if (!["GET", "HEAD"].includes(request.method) && !requestOriginIsValid(request)) {
    return jsonResponse(response, 403, { error: "Request origin was rejected." });
  }

  if (pathname === "/api/characters") {
    if (request.method === "GET") return jsonResponse(response, 200, { characters: session.account.characters.map(publicCharacter), maxCharacters: MAX_CHARACTERS_PER_ACCOUNT });
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    if (session.account.characters.length >= MAX_CHARACTERS_PER_ACCOUNT) return jsonResponse(response, 409, { error: `Each account can create up to ${MAX_CHARACTERS_PER_ACCOUNT} characters.` });
    const input = await readJsonBody(request);
    const character = sanitizeCharacter(input);
    if (!character) return jsonResponse(response, 400, { error: "Enter valid character details, allocate a valid attribute pool with values from 0 to 10, and choose 9 normal skills plus 1 special skill totaling exactly 40 points." });
    session.account.characters.push(character);
    await persistStore();
    return jsonResponse(response, 201, { character: publicCharacter(character), count: session.account.characters.length, maxCharacters: MAX_CHARACTERS_PER_ACCOUNT });
  }

  const characterMatch = pathname.match(/^\/api\/characters\/([A-Za-z0-9_-]+)$/);
  if (characterMatch) {
    const characterId = characterMatch[1];
    const index = session.account.characters.findIndex(character => character.id === characterId);
    if (index < 0) return jsonResponse(response, 404, { error: "Character not found in this account." });
    if (request.method === "PUT") {
      const input = await readJsonBody(request);
      const character = sanitizeCharacter(input, session.account.characters[index]);
      if (!character) return jsonResponse(response, 400, { error: "Enter a valid character name, health values, and whole-number eddies from 0 to 999,999,999." });
      session.account.characters[index] = character;
      for (const room of Object.values(store.rooms)) {
        let roomBoardChanged = false;
        for (const token of room.board.tokens) {
          if (token.kind !== "character" || token.characterId !== character.id || token.ownerUserId !== session.userId) continue;
          token.name = character.name;
          token.role = character.role || "Character";
          token.attributes = { ...character.attributes };
          token.health = { current: character.healthCurrent ?? 0, max: character.healthMax ?? 0 };
          token.gear = (character.inventory || []).slice(0, 20).map(item => item.name);
          roomBoardChanged = true;
        }
        if (roomBoardChanged) broadcastBoardState(room);
        if (room.roster.some(entry => entry.characterId === character.id)) broadcastRoster(room);
      }
      await persistStore();
      return jsonResponse(response, 200, { character: publicCharacter(character) });
    }
    if (request.method === "DELETE") {
      const character = session.account.characters[index];
      session.account.characters.splice(index, 1);
      for (const room of Object.values(store.rooms)) {
        const rosterChanged = room.roster.some(entry => entry.characterId === characterId);
        const boardChanged = room.board.tokens.some(token => token.characterId === characterId || token.id === characterId);
        room.roster = room.roster.filter(entry => entry.characterId !== characterId);
        room.board.tokens = room.board.tokens.filter(token => token.characterId !== characterId && token.id !== characterId);
        if (boardChanged) broadcastBoardState(room);
        if (rosterChanged) broadcastRoster(room);
      }
      if (character.portraitId) await unlink(path.join(PORTRAIT_DIR, path.basename(character.portraitId))).catch(error => {
        if (error.code !== "ENOENT") throw error;
      });
      await persistStore();
      return jsonResponse(response, 200, { ok: true });
    }
    return jsonResponse(response, 405, { error: "Method not allowed." });
  }

  const portraitUploadMatch = pathname.match(/^\/api\/characters\/([A-Za-z0-9_-]+)\/portrait$/);
  if (portraitUploadMatch) {
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    if (!requestOriginIsValid(request)) return jsonResponse(response, 403, { error: "Request origin was rejected." });
    const character = session.account.characters.find(item => item.id === portraitUploadMatch[1]);
    if (!character) return jsonResponse(response, 404, { error: "Character not found in this account." });
    const mime = request.headers["content-type"]?.split(";")[0].toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return jsonResponse(response, 415, { error: "Portrait must be a JPEG, PNG, or WebP image." });
    const image = await readRequestBody(request, MAX_PORTRAIT_BYTES);
    const isJpeg = mime === "image/jpeg" && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
    const isPng = mime === "image/png" && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = mime === "image/webp" && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP";
    if (!image.length || !(isJpeg || isPng || isWebp)) return jsonResponse(response, 400, { error: "The uploaded file is not a valid supported image." });
    const oldPortraitId = character.portraitId;
    const oldExtension = character.portraitExtension;
    const portraitId = randomUUID();
    const extension = mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : ".webp";
    await mkdir(PORTRAIT_DIR, { recursive: true });
    await writeFile(path.join(PORTRAIT_DIR, `${portraitId}${extension}`), image, { flag: "wx" });
    character.portraitId = portraitId;
    character.portraitMime = mime;
    character.portraitExtension = extension;
    await persistStore();
    if (oldPortraitId) {
      if (oldExtension && [".jpg", ".png", ".webp"].includes(oldExtension)) {
        await unlink(path.join(PORTRAIT_DIR, `${oldPortraitId}${oldExtension}`)).catch(error => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }
    return jsonResponse(response, 200, { character: publicCharacter(character) });
  }

  const portraitMatch = pathname.match(/^\/api\/portraits\/([0-9a-f-]{36})$/i);
  if (portraitMatch) {
    const portraitId = portraitMatch[1];
    const character = session.account.characters.find(item => item.portraitId === portraitId);
    if (!character) return jsonResponse(response, 404, { error: "Portrait not found." });
    if (request.method === "POST") {
      if (!requestOriginIsValid(request)) return jsonResponse(response, 403, { error: "Request origin was rejected." });
      const mime = request.headers["content-type"]?.split(";")[0].toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return jsonResponse(response, 415, { error: "Portrait must be a JPEG, PNG, or WebP image." });
      const image = await readRequestBody(request, MAX_PORTRAIT_BYTES);
      const isJpeg = mime === "image/jpeg" && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
      const isPng = mime === "image/png" && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const isWebp = mime === "image/webp" && image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP";
      if (!image.length || !(isJpeg || isPng || isWebp)) return jsonResponse(response, 400, { error: "The uploaded file is not a valid supported image." });
      await mkdir(PORTRAIT_DIR, { recursive: true });
      const extension = mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : ".webp";
      const portraitFile = path.join(PORTRAIT_DIR, `${portraitId}${extension}`);
      await writeFile(portraitFile, image, { flag: "wx" }).catch(async error => {
        if (error.code !== "EEXIST") throw error;
        await writeFile(portraitFile, image);
      });
      character.portraitId = portraitId;
      character.portraitMime = mime;
      character.portraitExtension = extension;
      await persistStore();
      return jsonResponse(response, 200, { portraitUrl: `/api/portraits/${portraitId}` });
    }
    if (request.method !== "GET") return jsonResponse(response, 405, { error: "Method not allowed." });
    if (!character.portraitExtension || ![".jpg", ".png", ".webp"].includes(character.portraitExtension)) return jsonResponse(response, 404, { error: "Portrait not found." });
    try {
      const image = await readFile(path.join(PORTRAIT_DIR, `${portraitId}${character.portraitExtension}`));
      response.writeHead(200, { "content-type": character.portraitMime || "application/octet-stream", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" });
      response.end(image);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return jsonResponse(response, 404, { error: "Portrait not found." });
    }
    return;
  }

  if (pathname === "/api/catalog") {
    if (request.method === "GET") return jsonResponse(response, 200, { items: getCatalogItems() });
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    const input = await readJsonBody(request);
    const item = sanitizeCatalogItem({ ...input, createdBy: session.username });
    if (!item) return jsonResponse(response, 400, { error: "A catalog item needs a name." });
    if (getCatalogItems().some(existing => catalogKey(existing) === catalogKey(item))) {
      return jsonResponse(response, 409, { error: "That catalog item already exists in this category." });
    }
    store.catalog.push(item);
    await persistStore();
    return jsonResponse(response, 201, { item });
  }

  if (pathname === "/api/catalog/import") {
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    const input = await readJsonBody(request, 2 * 1024 * 1024);
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 1000) {
      return jsonResponse(response, 400, { error: "Import between 1 and 1000 catalog items at a time." });
    }
    let imported = 0;
    for (const raw of input.items) {
      const item = sanitizeCatalogItem({ ...raw, createdBy: session.username });
      if (!item || getCatalogItems().some(existing => catalogKey(existing) === catalogKey(item))) continue;
      store.catalog.push(item);
      imported += 1;
    }
    await persistStore();
    return jsonResponse(response, 200, { imported, items: getCatalogItems() });
  }

  const campaignMatch = pathname.match(/^\/api\/campaigns\/([A-Za-z0-9_-]+)$/);
  if (campaignMatch) {
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    const input = await readJsonBody(request);
    const room = getRoom(campaignMatch[1], input.name);
    if (room.ownerUserId && room.ownerUserId !== session.userId) return jsonResponse(response, 409, { error: "That room code is already in use." });
    if (room.ownerUserId === session.userId && room.gmKeyHash) {
      return jsonResponse(response, 200, { campaignId: room.campaignId, name: room.name, gmKey: "" });
    }
    const gmKey = randomBytes(32).toString("base64url");
    room.ownerUserId = session.userId;
    room.gmKeyHash = hashToken(gmKey);
    room.name = boundedText(input.name, 120) || room.name;
    await persistStore();
    return jsonResponse(response, 201, { campaignId: room.campaignId, name: room.name, gmKey });
  }

  const hostMatch = pathname.match(/^\/api\/campaigns\/([A-Za-z0-9_-]+)\/host$/);
  if (hostMatch) {
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    const campaignId = hostMatch[1];
    const input = await readJsonBody(request);
    const room = getRoom(campaignId, input.name);
    if (room.ownerUserId && room.ownerUserId !== session.userId) return jsonResponse(response, 403, { error: "Only the campaign host can access the GM key." });
    const gmKey = randomBytes(32).toString("base64url");
    room.ownerUserId = session.userId;
    room.gmKeyHash = hashToken(gmKey);
    room.name = boundedText(input.name, 120) || room.name;
    await persistStore();
    return jsonResponse(response, 200, { gmKey, campaignId: room.campaignId, name: room.name });
  }

  const rosterMatch = pathname.match(/^\/api\/campaigns\/([A-Za-z0-9_-]+)\/roster$/);
  if (rosterMatch) {
    const room = store.rooms[rosterMatch[1]];
    if (!room) return jsonResponse(response, 404, { error: "Campaign room not found." });
    const isGm = validGmKey(room, request.headers["x-gm-key"], session.userId);
    if (request.method === "GET") return jsonResponse(response, 200, { roster: publicRoster(room, session.userId, isGm), isGm, playerCount: linkedPlayerCount(room), maxPlayers: MAX_CAMPAIGN_PLAYERS });
    if (request.method !== "POST") return jsonResponse(response, 405, { error: "Method not allowed." });
    const input = await readJsonBody(request);
    if (!Array.isArray(input.characterIds)) return jsonResponse(response, 400, { error: "Choose at least one of your characters." });
    const ownedIds = new Set(session.account.characters.map(character => character.id));
    const alreadyLinkedToRoom = room.roster.some(entry => entry.userId === session.userId);
    if (!alreadyLinkedToRoom && session.userId !== room.ownerUserId && linkedPlayerCount(room) >= MAX_CAMPAIGN_PLAYERS) {
      return jsonResponse(response, 409, { error: `This campaign already has ${MAX_CAMPAIGN_PLAYERS} players.` });
    }
    for (const characterId of input.characterIds) {
      if (!ownedIds.has(characterId)) return jsonResponse(response, 403, { error: "You can only share characters that belong to your account." });
      if (!room.roster.some(entry => entry.characterId === characterId)) room.roster.push({ characterId, userId: session.userId });
    }
    await persistStore();
    broadcastRoster(room);
    return jsonResponse(response, 200, { roster: publicRoster(room, session.userId, isGm), isGm, playerCount: linkedPlayerCount(room), maxPlayers: MAX_CAMPAIGN_PLAYERS });
  }

  const enemyTemplateMatch = pathname.match(/^\/api\/campaigns\/([A-Za-z0-9_-]+)\/enemy-templates$/);
  if (enemyTemplateMatch) {
    if (request.method !== "GET") return jsonResponse(response, 405, { error: "Method not allowed." });
    const room = store.rooms[enemyTemplateMatch[1]];
    if (!room) return jsonResponse(response, 404, { error: "Campaign room not found." });
    if (!validGmKey(room, request.headers["x-gm-key"], session.userId)) {
      return jsonResponse(response, 403, { error: "Only the GM can view enemy templates." });
    }
    return jsonResponse(response, 200, { enemies: ENEMY_TEMPLATES });
  }

  return jsonResponse(response, 404, { error: "API endpoint not found." });
}

async function serveFile(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    try {
      await handleApi(request, response, requestUrl);
    } catch (error) {
      if (error.statusCode) return jsonResponse(response, error.statusCode, { error: error.message });
      console.error("API request failed.", error);
      if (!response.headersSent) jsonResponse(response, 500, { error: "The request could not be completed." });
      else response.destroy(error);
    }
    return;
  }
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400);
    response.end("Invalid path");
    return;
  }
  const requestedPath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || filePath.startsWith(path.join(ROOT, "data")) || filePath.includes(`${path.sep}node_modules${path.sep}`)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  try {
    const contents = await readFile(filePath);
    response.writeHead(200, { "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream", "x-content-type-options": "nosniff" });
    response.end(contents);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "EISDIR") {
      console.error("Static file read failed.", error);
      response.writeHead(500);
      response.end("Internal server error");
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  }
}

const clients = new Set();
const httpServer = createServer((request, response) => {
  void serveFile(request, response);
});
const websocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

httpServer.on("upgrade", (request, socket, head) => {
  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  } catch {
    socket.destroy();
    return;
  }
  const requestHost = request.headers.host || "";
  let originIsValid = true;
  if (request.headers.origin) {
    try {
      const origin = new URL(request.headers.origin);
      originIsValid = ["http:", "https:"].includes(origin.protocol) && origin.host === requestHost;
    } catch {
      originIsValid = false;
    }
  }
  const session = getSession(request);
  const room = store.rooms[url.searchParams.get("campaignId")];
  if (!isTrustedHost(requestHost) || !originIsValid || !session || !room || url.pathname !== "/ws" || !roomIdIsValid(url.searchParams.get("campaignId"))) {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }
  const connectedPlayers = new Set([...clients].filter(client => client.roomId === room.campaignId && !client.isGm && client.userId !== room.ownerUserId).map(client => client.userId));
  if (room.ownerUserId !== session.userId && !connectedPlayers.has(session.userId) && connectedPlayers.size >= MAX_CAMPAIGN_PLAYERS) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\nRetry-After: 30\r\n\r\n");
    socket.destroy();
    return;
  }
  request.session = session;
  websocketServer.handleUpgrade(request, socket, head, websocket => {
    websocketServer.emit("connection", websocket, request, url);
  });
});

websocketServer.on("connection", async (socket, request, url) => {
  const campaignId = url.searchParams.get("campaignId");
  const campaignName = boundedText(url.searchParams.get("campaignName"), 120);
  socket.roomId = campaignId;
  socket.userId = request.session.userId;
  socket.userName = request.session.username;
  socket.isGm = false;
  socket.messageTimes = [];
  clients.add(socket);
  const room = getRoom(campaignId, campaignName);
  if (campaignName && room.name === "Shared campaign") room.name = campaignName;
  room.updatedAt = new Date().toISOString();
  try {
    await persistStore();
  } catch (error) {
    console.error("Could not save campaign room state.", error);
    send(socket, { type: "error", message: "The shared room could not be saved on the server." });
  }
  send(socket, {
    type: "room-state",
    room: {
      campaignId: room.campaignId,
      name: room.name,
      board: boardForViewer(room.board, socket),
      events: room.events.map(event => eventForViewer(event, socket))
    }
  });
  const joined = {
    id: randomUUID(), kind: "notice", actor: "TABLE", timestamp: new Date().toISOString(),
    message: `${socket.userName} joined the table.`
  };
  room.events.push(joined);
  room.events = room.events.slice(-MAX_EVENTS);
  room.updatedAt = joined.timestamp;
  void persistStore().catch(error => console.error("Could not save table join event.", error));
  broadcastRoomEvent(campaignId, joined);
  send(socket, { type: "role", role: "player", maxPlayers: MAX_CAMPAIGN_PLAYERS, playerCount: connectedPlayerCount(campaignId) });

  socket.on("message", data => {
    const now = Date.now();
    socket.messageTimes = socket.messageTimes.filter(time => now - time < 5000);
    if (socket.messageTimes.length >= 60) {
      send(socket, { type: "error", message: "Too many updates. Please slow down." });
      return;
    }
    socket.messageTimes.push(now);
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      console.warn("Rejected malformed WebSocket JSON.", error.message);
      send(socket, { type: "error", message: "That update could not be read." });
      return;
    }
    if (message.type === "gm-auth") {
      if (validGmKey(room, message.key, socket.userId)) {
        socket.isGm = true;
        send(socket, { type: "role", role: "gm", maxPlayers: MAX_CAMPAIGN_PLAYERS, playerCount: connectedPlayerCount(campaignId) });
        send(socket, { type: "board-state", board: room.board });
        send(socket, { type: "room-history", events: room.events });
        broadcastRoomEvent(campaignId, {
          id: randomUUID(), kind: "notice", actor: "TABLE", timestamp: new Date().toISOString(),
          message: `${socket.userName} is the game master.`
        });
      } else {
        send(socket, { type: "error", message: "That GM key is invalid for this account." });
      }
      return;
    }
    if (message.type === "board-update") {
      const requestedBoard = normalizeBoard(message.board);
      if (!socket.isGm) {
        const mergedBoard = mergePlayerBoardUpdate(requestedBoard, room.board, socket.userId);
        if (!mergedBoard) {
          send(socket, { type: "error", message: "Players can only move their own character tokens." });
          return;
        }
        room.board = mergedBoard;
      } else {
        room.board = requestedBoard;
      }
      room.updatedAt = new Date().toISOString();
      void persistStore().catch(error => console.error("Could not save shared board state.", error));
      broadcastBoardState(room);
      return;
    }
    if (message.type === "event") {
      const event = sanitizeEvent(message.event, socket.userName);
      if (!event) {
        send(socket, { type: "error", message: "That roll or health update was invalid." });
        return;
      }
      if (event.kind === "roll") {
        if (!socket.isGm && event.source !== "sheet") {
          send(socket, { type: "error", message: "Only the GM can roll from the campaign board." });
          return;
        }
        const characterOwner = event.characterId ? ownerAccountOfCharacter(event.characterId) : null;
        const boardToken = event.characterId
          ? room.board.tokens.find(item => item.id === event.characterId || item.characterId === event.characterId)
          : null;
        if (!socket.isGm) {
          const isOwnedAndLinked = characterOwner?.userId === socket.userId &&
            room.roster.some(entry => entry.characterId === event.characterId && entry.userId === socket.userId);
          if (!isOwnedAndLinked) {
            send(socket, { type: "error", message: "Only a linked character can publish a roll to this campaign." });
            return;
          }
          event.characterName = characterOwner.character.name;
          event.ownerUserId = socket.userId;
        } else {
          if (event.characterId && !characterOwner && !boardToken) {
            send(socket, { type: "error", message: "That character or board unit could not be found." });
            return;
          }
          if (characterOwner && characterOwner.userId !== socket.userId &&
            !room.roster.some(entry => entry.characterId === event.characterId)) {
            send(socket, { type: "error", message: "That character is not linked to this campaign." });
            return;
          }
          if (boardToken?.kind === "character" && boardToken.ownerUserId !== socket.userId &&
            !room.roster.some(entry => entry.characterId === boardToken.characterId)) {
            send(socket, { type: "error", message: "That character is not linked to this campaign." });
            return;
          }
          event.characterName = characterOwner?.character.name || boardToken?.name || event.characterName;
          event.ownerUserId = characterOwner?.userId || boardToken?.ownerUserId || "";
        }
      }
      if (event.kind === "health") {
        const token = room.board.tokens.find(item => item.id === event.characterId || item.characterId === event.characterId);
        if (!token || (!socket.isGm && (token.kind !== "character" || token.ownerUserId !== socket.userId))) {
          send(socket, { type: "error", message: "Players can only change life for their own character tokens." });
          return;
        }
        const maximum = Number(token.health.max || 0);
        const current = event.current;
        if ((!socket.isGm && maximum && current > maximum) || current < 0) {
          send(socket, { type: "error", message: "Life must remain within this character's current range." });
          return;
        }
        const actualDelta = current - Number(token.health.current || 0);
        if (!actualDelta) {
          send(socket, { type: "error", message: "That life update would not change the current value." });
          return;
        }
        token.health.current = current;
        event.characterId = token.characterId || token.id;
        event.ownerUserId = token.ownerUserId || "";
        event.characterName = token.name;
        event.delta = actualDelta;
        event.current = current;
        event.max = maximum;
      }
      room.events.push(event);
      room.events = room.events.slice(-MAX_EVENTS);
      room.updatedAt = event.timestamp;
      void persistStore().catch(error => console.error("Could not save campaign event.", error));
      if (event.kind === "health") broadcastBoardState(room);
      broadcastRoomEvent(campaignId, event);
      return;
    }
    send(socket, { type: "error", message: "That update type is not supported." });
  });
  socket.on("close", () => {
    clients.delete(socket);
    for (const client of clients) {
      if (client.roomId === campaignId && client.readyState === WebSocket.OPEN) {
        send(client, { type: "presence", playerCount: connectedPlayerCount(campaignId), maxPlayers: MAX_CAMPAIGN_PLAYERS });
      }
    }
  });
  socket.on("error", error => console.error("WebSocket connection error.", error));
});

await loadDefaultCatalog();
await loadStore();
httpServer.listen(PORT, HOST, () => {
  console.log(`Afterdark listening at http://${HOST}:${PORT}`);
  console.log("For a trusted local network, set HOST=0.0.0.0 and share this computer's LAN address.");
});
