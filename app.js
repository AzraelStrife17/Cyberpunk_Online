const STORAGE_KEY = "afterdark-workspace-v1";
const ATTRIBUTES = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"];
const CINEMATIC_ATTRIBUTE_TIERS = [
  { value: "major-hero", label: "Major hero", points: 80 },
  { value: "major-supporting", label: "Major supporting char.", points: 70 },
  { value: "minor-hero", label: "Minor hero", points: 75 },
  { value: "minor-support", label: "Minor support char.", points: 60 },
  { value: "average", label: "Average", points: 50 }
];
const NORMAL_SKILL_GROUPS = [
  { attribute: "ATTR", skills: ["Personal Grooming", "Wardrobe & Style"] },
  { attribute: "BODY", skills: ["Endurance", "Strength Feat", "Swimming"] },
  { attribute: "COOL / WILL", skills: ["Interrogation", "Intimidate", "Oratory", "Resist Torture/Drugs", "Streetwise"] },
  { attribute: "EMPATHY", skills: ["Human Perception", "Interview", "Leadership", "Seduction", "Social", "Persuasion & Fast Talk", "Perform"] },
  { attribute: "INT", skills: ["Accounting", "Anthropology", "Awareness/Notice", "Biology", "Botany", "Chemistry", "Composition", "Diagnose Illness", "Education & Gen. Know.", "Expert (pick subject)", "Gamble", "Geology", "History", "Language (choose)", "Mathematics", "Physics", "Programming", "Shadow/Track", "Stock Market", "System Knowledge", "Teaching", "Wilderness Survival", "Zoology"] },
  { attribute: "REF", skills: ["Archery", "Athletics", "Brawling", "Dance", "Dodge & Escape", "Driving", "Fencing", "Handgun", "Heavy Weapons", "Martial Art 1", "Martial Art 2", "Martial Art 3", "Melee", "Motorcycle", "Operate Heavy Machinery", "Pilot (Gyro)", "Pilot (Fixed Wing)", "Pilot (Dirigible)", "Pilot (Vect. Thrust Vehicle)", "Rifle", "Stealth", "Submachinegun"] },
  { attribute: "TECH", skills: ["Aero Tech", "AV Tech", "Basic Tech", "Cryotank Operation", "Cyberdeck Design", "CyberTech", "Demolitions", "Disguise", "Electronics", "Elect. Security", "First Aid", "Forgery", "Gyro Tech", "Pharmaceuticals", "Pick Lock", "Pick Pocket", "Play Instrument", "Weaponsmith"] }
];
const SPECIAL_SKILLS = ["Authority", "Charismatic Leadership", "Combat Sense", "Credibility", "Family", "Interface", "Jury Rig", "Medical Tech", "Resources", "Streetdeal"];
const BODY_LOCATIONS = [
  { key: "head", label: "Head" },
  { key: "torso", label: "Torso" },
  { key: "rightArm", label: "Right arm" },
  { key: "leftArm", label: "Left arm" },
  { key: "rightLeg", label: "Right leg" },
  { key: "leftLeg", label: "Left leg" }
];
const VIEWS = {
  dashboard: "OVERVIEW",
  characters: "CHARACTERS",
  campaigns: "CAMPAIGNS",
  sheet: "CHARACTER SHEET",
  board: "TACTICAL BOARD"
};
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const BOARD_COLUMNS = 20;
const BOARD_ROWS = 14;
const BOARD_CELL_SIZE = 32;
const MAX_CHARACTERS_PER_ACCOUNT = 10;
const MAX_CAMPAIGN_PLAYERS = 10;
const TERRAIN_TEMPLATES = [
  { name: "Cover block", widthMeters: 4, heightMeters: 4, color: "#62734b" },
  { name: "Low barrier", widthMeters: 8, heightMeters: 2, color: "#64717b" },
  { name: "Street vehicle", widthMeters: 6, heightMeters: 4, color: "#725e48" },
  { name: "Kiosk", widthMeters: 4, heightMeters: 4, color: "#526c70" }
];

function normalizeSkill(skill) {
  if (skill && typeof skill === "object") {
    return { name: String(skill.name ?? "").trim(), value: Number.isFinite(Number(skill.value)) ? Number(skill.value) : 0, special: Boolean(skill.special) };
  }
  const match = String(skill ?? "").trim().match(/^(.*?)(?:\s*:\s*(-?\d+))?$/);
  return { name: match?.[1]?.trim() ?? "", value: match?.[2] ? Number(match[2]) : 0, special: false };
}

function skillText(skills = []) {
  return skills.map(normalizeSkill).filter(skill => skill.name).map(skill => skill.value ? `${skill.name}: ${skill.value}` : skill.name).join(", ");
}

function skillEntries(text, previousSkills = []) {
  const previousSpecialSkills = new Set(previousSkills.map(normalizeSkill).filter(skill => skill.special).map(skill => skill.name.toLowerCase()));
  return String(text).split(",").map(entry => normalizeSkill(entry)).filter(skill => skill.name)
    .map(skill => ({ ...skill, special: previousSpecialSkills.has(skill.name.toLowerCase()) }));
}

function normalizeOptionalInteger(value, max) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

function readOptionalFormInteger(formData, name, max) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : undefined;
}

function normalizeBodyHealth(value) {
  return Object.fromEntries(BODY_LOCATIONS.map(({ key }) => {
    const location = value?.[key] || {};
    return [key, {
      current: normalizeOptionalInteger(location.current, 9999),
      max: normalizeOptionalInteger(location.max, 9999)
    }];
  }));
}

function normalizeBodyArmorSP(value) {
  return Object.fromEntries(BODY_LOCATIONS.map(({ key }) => [key, normalizeOptionalInteger(value?.[key], 9999)]));
}

function normalizeCharacter(character) {
  const current = character.healthCurrent;
  const maximum = character.healthMax;
  const eddies = Number(character.eddies);
  return {
    ...character,
    skills: Array.isArray(character.skills) ? character.skills.map(normalizeSkill).filter(skill => skill.name) : [],
    bodyHealth: normalizeBodyHealth(character.bodyHealth),
    bodyArmorSP: normalizeBodyArmorSP(character.bodyArmorSP),
    healthCurrent: current != null && Number.isFinite(Number(current)) ? Number(current) : null,
    healthMax: maximum != null && Number.isFinite(Number(maximum)) ? Number(maximum) : null,
    eddies: Number.isInteger(eddies) ? Math.max(0, Math.min(999999999, eddies)) : 0
  };
}

function demoWorkspace() {
  const renId = "demo-character-ren";
  const ivyId = "demo-character-ivy";
  const campaignId = "demo-campaign";
  return {
    demo: true,
    characters: [
      {
        id: renId, name: "Ren Kaito", role: "Solo", handle: "Kestrel",
        attributes: { INT: 7, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 6, MA: 7, BODY: 6, EMP: 5 },
        skills: [{ name: "Awareness", value: 5 }, { name: "Handgun", value: 6 }, { name: "Stealth", value: 4 }, { name: "First Aid", value: 3 }, { name: "Streetwise", value: 4 }],
        derived: ["Initiative: 8", "Wounds: 24", "Humanity: 50"],
        healthCurrent: 18, healthMax: 24, eddies: 1200,
        history: "Former corporate security. The job ended; the debts did not.",
        notes: "Keep one eye on the exits. Never take a second meeting at the same place.",
        createdAt: new Date().toISOString()
      },
      {
        id: ivyId, name: "Ivy Vex", role: "Techie", handle: "Patch",
        attributes: { INT: 8, REF: 6, TECH: 9, COOL: 6, ATTR: 4, LUCK: 5, MA: 5, BODY: 5, EMP: 7 },
        skills: [{ name: "Electronics", value: 7 }, { name: "Cybertech", value: 6 }, { name: "Basic Tech", value: 7 }, { name: "Education", value: 5 }, { name: "Bargain", value: 3 }],
        derived: ["Initiative: 6", "Wounds: 20", "Humanity: 70"],
        healthCurrent: 20, healthMax: 20, eddies: 850,
        history: "Neighborhood tech who can make old machines sing.",
        notes: "Has a contact in the southside repair market.",
        createdAt: new Date().toISOString()
      }
    ],
    campaigns: [{
      id: campaignId, name: "Neon on the Wire", gm: "Mara", description: "A quiet data theft turns into a very loud problem.", characterIds: [renId, ivyId],
      sessions: [{ id: "demo-session", title: "The Glasshouse Job", date: new Date().toISOString().slice(0, 10), notes: "The crew found an unexpected witness." }]
    }],
    gear: [
      { id: "demo-gear-1", name: "Compact handgun", category: "Weapon", quantity: 1, characterId: renId, details: "Custom entry · check your table's notes" },
      { id: "demo-gear-2", name: "Street jacket", category: "Armor", quantity: 1, characterId: renId, details: "Personal kit" },
      { id: "demo-gear-3", name: "Field repair kit", category: "Equipment", quantity: 1, characterId: ivyId, details: "Tools, tape, and a stubborn soldering iron" },
      { id: "demo-gear-4", name: "Neural interface", category: "Cyberware", quantity: 1, characterId: ivyId, details: "Custom entry · enter table-specific details" }
    ],
    activity: [
      { id: "demo-activity-1", text: "The crew logged a new session", detail: "Neon on the Wire", date: new Date().toISOString(), tone: "cyan" },
      { id: "demo-activity-2", text: "Ivy Vex joined the roster", detail: "Character added", date: new Date().toISOString(), tone: "acid" },
      { id: "demo-activity-3", text: "A new item was added to the ledger", detail: "Field repair kit", date: new Date().toISOString(), tone: "cyan" }
    ]
  };
}

function loadWorkspace() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const initial = demoWorkspace();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      initial.characters = initial.characters.map(normalizeCharacter);
      return initial;
    }
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.characters) || !Array.isArray(parsed.campaigns) || !Array.isArray(parsed.gear)) {
      throw new Error("Saved workspace has an invalid shape.");
    }
    const workspace = { demo: false, activity: [], recentlyOpenedCharacterIds: [], ...parsed, characters: parsed.characters.map(normalizeCharacter) };
    const staleDemoData = !workspace.demo && (
      workspace.campaigns.some(campaign => campaign.id === "demo-campaign") ||
      workspace.gear.some(item => String(item.id).startsWith("demo-")) ||
      workspace.activity.some(item => String(item.id).startsWith("demo-"))
    );
    if (staleDemoData) {
      workspace.campaigns = workspace.campaigns.filter(campaign => campaign.id !== "demo-campaign");
      workspace.gear = workspace.gear.filter(item => !String(item.id).startsWith("demo-"));
      workspace.activity = workspace.activity.filter(item => !String(item.id).startsWith("demo-"));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    }
    return workspace;
  } catch (error) {
    console.error("Could not load the saved workspace.", error);
    showToast("Couldn't load saved data. Check browser storage, then refresh to try again.", true);
    return { demo: false, characters: [], campaigns: [], gear: [], activity: [] };
  }
}

let workspace = loadWorkspace();
let signedInAccount = null;
let friendData = { friends: [], requests: [], messages: [] };
let friendSearchResults = [];
let friendSearchUsername = "";
let friendSearchPerformed = false;
let friendTab = "friends";
let selectedMessageFriendId = "";
let pendingCampaignInviteCode = new URLSearchParams(location.search).get("campaignInvite") || "";
let campaignRoster = [];
let campaignPlayerCount = 0;
let boardIsGm = false;
let sheetTab = "overview";
let selectedSheetCharacterId = "";
let catalogFilter = "All";
let catalogTypeFilter = "All";
let catalogSearch = "";
let catalogTargetCharacterId = "";
let activeView = "dashboard";
let boardTab = "terrain";
let activeBoardCampaignId = "";
let connectedCampaignId = "";
let activeBoardCampaignName = "";
let connectionStatus = "OFFLINE";
let activeGmKey = "";
let boardState = { tokens: [], terrain: [] };
let roomEvents = [];
let enemyTemplates = [];
let sheetRollResults = {};
let activeSocket = null;
let selectedBoardTokenId = "";
let selectedBoardPieceId = "";
let selectedBoardPieceKind = "";
let pendingBoardCharacterId = "";
let boardRollCharacterId = "";
let boardRollSkillName = "";
let boardRollAttribute = "REF";
let boardRollWeapon = "";
let boardRollTarget = 15;
let boardRollModifier = 0;
let toastTimer;
const dialog = document.getElementById("editor-dialog");
const dialogContent = document.getElementById("dialog-content");
const catalogDialog = document.getElementById("catalog-dialog");
const catalogDialogContent = document.getElementById("catalog-dialog-content");
const toast = document.getElementById("toast");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function saveWorkspace() {
  const saveState = document.getElementById("save-state");
  try {
    const savedWorkspace = {
      ...workspace,
      characters: signedInAccount ? [] : workspace.characters,
      campaigns: workspace.campaigns.map(({ gmKey, ...campaign }) => campaign)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedWorkspace));
    saveState.innerHTML = '<span class="save-dot"></span> SAVED LOCALLY';
    saveState.setAttribute("aria-label", "Changes saved locally");
    renderAll();
    return true;
  } catch (error) {
    console.error("Could not save the workspace.", error);
    saveState.innerHTML = '<span class="save-dot" style="background:var(--red);box-shadow:none"></span> SAVE FAILED';
    saveState.setAttribute("aria-label", "Saving failed");
    showToast("Couldn't save changes. Browser storage may be full or unavailable.", true);
    return false;
  }
}

function storedGmKey(campaignId) {
  try {
    return sessionStorage.getItem(`afterdark-gm-${campaignId}`) || "";
  } catch (error) {
    console.warn("Could not read the private GM key from this tab.", error);
    return "";
  }
}

function storeGmKey(campaignId, key) {
  try {
    sessionStorage.setItem(`afterdark-gm-${campaignId}`, key);
  } catch (error) {
    console.error("Could not save the private GM key in this browser tab.", error);
    showToast("Copy the GM key now; this browser could not store it for this tab.", true);
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function updateAccountControls() {
  const name = document.getElementById("account-name");
  const button = document.getElementById("account-button");
  if (!name || !button) return;
  name.textContent = signedInAccount ? `${signedInAccount.username} · ${signedInAccount.characters.length}/10` : "Local workspace";
  button.textContent = signedInAccount ? "Sign out" : "Sign in";
  button.dataset.action = signedInAccount ? "sign-out" : "open-auth";
  button.setAttribute("aria-label", signedInAccount ? `Sign out ${signedInAccount.username}` : "Sign in or create an account");
}

async function signOutAccount() {
  try {
    await apiRequest("/api/logout", { method: "POST" });
  } catch (error) {
    console.error("Could not sign out.", error);
    showToast("Could not confirm sign-out with the server.", true);
    return;
  }
  activeSocket?.close();
  activeSocket = null;
  signedInAccount = null;
  friendData = { friends: [], requests: [], messages: [] };
  friendSearchResults = [];
  friendSearchUsername = "";
  friendSearchPerformed = false;
  selectedMessageFriendId = "";
  boardIsGm = false;
  activeGmKey = "";
  enemyTemplates = [];
  boardState = { tokens: [], terrain: [] };
  roomEvents = [];
  campaignRoster = [];
  selectedBoardTokenId = "";
  selectedBoardPieceId = "";
  workspace.characters = [];
  workspace.catalog = [];
  selectedSheetCharacterId = "";
  updateAccountControls();
  renderAll();
  showToast("Signed out.");
}

async function loadAuthenticatedData(account) {
  signedInAccount = account;
  workspace.characters = (account.characters || []).map(normalizeCharacter);
  workspace.catalog = (await apiRequest("/api/catalog")).items;
  if (workspace.demo) {
    workspace.campaigns = [];
    workspace.gear = [];
    workspace.activity = [];
  }
  workspace.demo = false;
  saveWorkspace();
  updateAccountControls();
  renderAll();
  await refreshFriends();
}

async function initializeAccount() {
  updateAccountControls();
  try {
    const response = await apiRequest("/api/me");
    await loadAuthenticatedData(response.account);
    continuePendingCampaignInvite();
  } catch (error) {
    if (error.status !== 401) {
      console.error("Could not check the account session.", error);
      showToast("Couldn't connect to the account service. Start the server and refresh.", true);
    } else if (pendingCampaignInviteCode) {
      openAuthForm("login");
    }
  }
}

async function refreshFriends(showErrors = true) {
  if (!signedInAccount) {
    friendData = { friends: [], requests: [], messages: [] };
    renderDashboard();
    return;
  }
  try {
    friendData = await apiRequest("/api/friends");
    if (!friendData.friends.some(friend => friend.id === selectedMessageFriendId)) {
      selectedMessageFriendId = friendData.friends[0]?.id || "";
    }
    renderDashboard();
  } catch (error) {
    console.error("Could not load friends and messages.", error);
    if (showErrors) showToast(error.message || "Could not load friends and messages.", true);
  }
}

async function searchFriendUsers(form) {
  const username = String(new FormData(form).get("username") || "").trim();
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return showToast("Enter an exact username with 3–24 letters, numbers, or underscores.", true);
  try {
    const result = await apiRequest(`/api/users/search?username=${encodeURIComponent(username)}`);
    friendSearchResults = result.users;
    friendSearchUsername = username;
    friendSearchPerformed = true;
    renderDashboard();
  } catch (error) {
    showToast(error.message || "Could not search for that user.", true);
  }
}

async function updateFriendRequest(requestId, action) {
  try {
    if (action === "accept") {
      await apiRequest(`/api/friend-requests/${encodeURIComponent(requestId)}/accept`, { method: "POST", body: JSON.stringify({}) });
    } else {
      await apiRequest(`/api/friend-requests/${encodeURIComponent(requestId)}`, { method: "DELETE" });
    }
    await refreshFriends(false);
    showToast(action === "accept" ? "Friend request accepted." : "Friend request removed.");
  } catch (error) {
    showToast(error.message || "Could not update the friend request.", true);
  }
}

async function sendFriendRequest(userId) {
  try {
    await apiRequest("/api/friend-requests", { method: "POST", body: JSON.stringify({ toUserId: userId }) });
    await refreshFriends(false);
    showToast("Friend request sent.");
  } catch (error) {
    showToast(error.message || "Could not send the friend request.", true);
  }
}

async function sendDirectMessage(toUserId, text, campaignId = "") {
  const response = await apiRequest("/api/messages", {
    method: "POST",
    body: JSON.stringify({ toUserId, text, campaignId })
  });
  await refreshFriends(false);
  friendTab = "messages";
  selectedMessageFriendId = toUserId;
  renderDashboard();
  return response.message;
}

async function sendCampaignInvite(campaign, friendId) {
  const friend = friendData.friends.find(item => item.id === friendId);
  if (!friend || !signedInAccount) return showToast("Select one of your friends to invite.", true);
  try {
    await ensureCampaignRoom(campaign);
    await sendDirectMessage(friendId, `I'd like you to join "${campaign.name}".`, campaign.id);
    showToast(`Campaign invite sent to ${friend.username}. Your account is the game master.`);
  } catch (error) {
    showToast(error.message || "Could not send the campaign invite.", true);
  }
}

function continuePendingCampaignInvite() {
  if (!pendingCampaignInviteCode || !signedInAccount) return;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(pendingCampaignInviteCode)) {
    pendingCampaignInviteCode = "";
    history.replaceState(null, "", location.pathname);
    return showToast("That campaign invite link is invalid.", true);
  }
  const campaignId = pendingCampaignInviteCode;
  pendingCampaignInviteCode = "";
  history.replaceState(null, "", location.pathname);
  openJoinCampaignForm(campaignId);
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3300);
}

function addActivity(text, detail) {
  workspace.activity = [{ id: makeId(), text, detail, date: new Date().toISOString(), tone: "acid" }, ...(workspace.activity ?? [])].slice(0, 8);
}

function recordCharacterOpened(characterId) {
  if (!characterId) return;
  const recent = [characterId, ...(workspace.recentlyOpenedCharacterIds || []).filter(id => id !== characterId)].slice(0, 20);
  if (recent.length === (workspace.recentlyOpenedCharacterIds || []).length &&
    recent.every((id, index) => id === workspace.recentlyOpenedCharacterIds[index])) return;
  workspace.recentlyOpenedCharacterIds = recent;
  saveWorkspace();
}

function selectedCharacter(id) {
  return workspace.characters.find(character => character.id === id);
}

function itemsForCharacter(character) {
  const items = [...(character?.inventory || [])];
  for (const item of workspace.gear.filter(entry => entry.characterId === character?.id)) {
    if (!items.some(existing => existing.id === item.id)) items.push(item);
  }
  return items;
}

function skillChipBonusFor(character, skillName) {
  const normalizedName = String(skillName || "").trim().toLowerCase();
  if (!normalizedName) return 0;
  return itemsForCharacter(character)
    .filter(item => item.socketed && String(item.chipSkill || "").trim().toLowerCase() === normalizedName)
    .reduce((sum, item) => sum + (Number.isInteger(Number(item.chipBonus)) ? Number(item.chipBonus) : 0), 0);
}

function isWeaponItem(item) {
  return String(item?.category || "").toLowerCase() === "weapon";
}

function weaponCombatData(item) {
  const stats = String(item.weaponStats || item.description || item.details || "");
  const damageAndAmmo = stats.match(/damage(?:\/ammo)?:\s*([^;]+)/i)?.[1] || stats;
  const damageFormula = damageAndAmmo.match(/\b\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?/i)?.[0].replace(/\s+/g, "").toUpperCase() || "—";
  const ammoType = damageAndAmmo.match(/\(([^)]+)\)/)?.[1]?.trim() || "—";
  const capacity = Number(stats.match(/\bshots:\s*(\d+)/i)?.[1]) || 0;
  const rateOfFire = Number(stats.match(/\brof:\s*(\d+)/i)?.[1]) || 0;
  return { damageFormula, ammoType, capacity, rateOfFire };
}

function weaponSkillFor(character, item) {
  const skills = (character.skills || []).map(normalizeSkill).filter(skill => skill.name);
  const type = String(item.weaponType || "").toLowerCase();
  const aliases = [
    { match: /handgun|autopistol|revolver|pistol/, names: ["Handgun"] },
    { match: /submachine|\bsmg\b/, names: ["Submachinegun", "Submachine Gun", "SMG"] },
    { match: /shotgun/, names: ["Shotgun", "Rifle"] },
    { match: /rifle/, names: ["Rifle"] },
    { match: /heavy weapon|machine gun|launcher|grenade|flamethrower/, names: ["Heavy Weapons"] },
    { match: /melee|knife|sword|katana|blade/, names: ["Melee", "Fencing"] }
  ].find(entry => entry.match.test(type));
  const names = aliases?.names || [item.weaponType || ""];
  const skill = skills.find(entry => names.some(name => entry.name.toLowerCase() === name.toLowerCase()));
  const name = skill?.name || names[0] || item.weaponType || "Weapon skill";
  const naturalValue = skill?.value || 0;
  const chipBonus = skillChipBonusFor(character, name);
  return { name, naturalValue, chipBonus, value: naturalValue + chipBonus };
}

function rollDie(sides) {
  const range = 0x100000000;
  const limit = range - (range % sides);
  const result = new Uint32Array(1);
  do {
    crypto.getRandomValues(result);
  } while (result[0] >= limit);
  return result[0] % sides + 1;
}

function rollD10() {
  return rollDie(10);
}

function parseDamageFormula(formula) {
  const match = /^(\d+)D(\d+)(?:([+-])(\d+))?$/i.exec(String(formula || "").trim());
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[4] || 0) * (match[3] === "-" ? -1 : 1);
  if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(sides) || sides < 2 || sides > 1000 || Math.abs(modifier) > 999) return null;
  return { count, sides, modifier };
}

function publishCharacterRoll(character, event) {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN || connectionStatus !== "LIVE") return;
  if (!campaignRoster.some(entry => entry.id === character.id)) return;
  sendRoomEvent({ ...event, source: "sheet", kind: "roll", characterId: character.id, characterName: character.name });
}

function rememberSheetRoll(character, result) {
  sheetRollResults[character.id] = result;
  for (const id of ["sheet-roll-result", "sheet-overview-roll-result"]) {
    const output = document.getElementById(id);
    if (output) output.textContent = result;
  }
}

function initials(name = "?") {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] ?? "").join("").toUpperCase() || "?";
}

function characterCard(character) {
  const attrCells = ATTRIBUTES.map(attribute => `<div class="attr-cell"><span>${attribute}</span><strong>${escapeHtml(character.attributes?.[attribute] ?? "—")}</strong></div>`).join("");
  const portrait = character.portraitUrl
    ? `<img class="portrait" src="${escapeHtml(character.portraitUrl)}" alt="${escapeHtml(character.name)} portrait">`
    : `<div class="portrait" aria-hidden="true">${escapeHtml(initials(character.name))}</div>`;
  return `<article class="character-card">
    <div class="card-top">
      <div class="card-person">${portrait}<div><p class="card-kicker">${escapeHtml(character.handle || "NO HANDLE")}</p><h3>${escapeHtml(character.name)}</h3><p>${escapeHtml(character.role || "Role not set")}</p></div></div>
      <div class="card-actions">
        <button class="icon-button" type="button" data-action="open-character-sheet" data-id="${escapeHtml(character.id)}" aria-label="Open ${escapeHtml(character.name)} character sheet" title="Character sheet">▣</button>
        <button class="icon-button" type="button" data-action="open-character-board" data-id="${escapeHtml(character.id)}" aria-label="Play ${escapeHtml(character.name)} on the tactical board" title="Open tactical board">▦</button>
        <button class="icon-button" type="button" data-action="duplicate-character" data-id="${escapeHtml(character.id)}" aria-label="Duplicate ${escapeHtml(character.name)}" title="Duplicate">⧉</button>
        <button class="icon-button" type="button" data-action="edit-character" data-id="${escapeHtml(character.id)}" aria-label="Edit ${escapeHtml(character.name)}" title="Edit">✎</button>
        <button class="icon-button" type="button" data-action="delete-character" data-id="${escapeHtml(character.id)}" aria-label="Delete ${escapeHtml(character.name)}" title="Delete">×</button>
      </div>
    </div>
    <div class="card-attrs">${attrCells}</div>
    <div class="card-bottom"><small>${(character.skills ?? []).length} skills · ${(character.derived ?? []).length} custom values</small><span class="tag tag-neutral">${escapeHtml(character.role || "UNASSIGNED")}</span></div>
  </article>`;
}

function emptyState(kicker, title, copy, buttonLabel, action) {
  return `<div class="empty-state"><div><p class="empty-kicker">${escapeHtml(kicker)}</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p><button class="button button-primary" type="button" data-new="${escapeHtml(action)}">${escapeHtml(buttonLabel)}</button></div></div>`;
}

function demoBanner() {
  if (!workspace.demo) return "";
  return `<div class="demo-banner"><div><strong>DEMO WORKSPACE</strong><p>Sample characters and campaign are here to explore. Clear this demo to start fresh.</p></div><button class="button button-quiet" type="button" data-action="clear-demo">Clear demo data</button></div>`;
}

function metricCard(label, value, detail) {
  return `<article class="metric-card"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-detail">${escapeHtml(detail)}</div></article>`;
}

function renderDashboard() {
  const characterById = new Map(workspace.characters.map(character => [character.id, character]));
  const recentCharacters = (workspace.recentlyOpenedCharacterIds || []).map(id => characterById.get(id)).filter(Boolean).slice(0, 3);
  const characterRows = recentCharacters.map(character => `
    <button class="character-row" type="button" data-action="open-character-sheet" data-id="${escapeHtml(character.id)}">
      ${character.portraitUrl
        ? `<img class="portrait" src="${escapeHtml(character.portraitUrl)}" alt="${escapeHtml(character.name)} portrait">`
        : `<span class="portrait" aria-hidden="true">${escapeHtml(initials(character.name))}</span>`}
      <span class="character-row-copy"><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.role || "Role not set")} · ${escapeHtml(character.handle || "No handle")}</small></span>
      <span class="character-level">OPEN →</span>
    </button>`).join("");
  const recentMessages = [...friendData.messages].slice(-5).reverse().map(message => {
    const sentByCurrentUser = message.fromUserId === signedInAccount?.id;
    const otherUsername = sentByCurrentUser ? message.toUsername : message.fromUsername;
    const campaignLink = message.campaignId
      ? `<a class="message-invite-link" href="/?campaignInvite=${encodeURIComponent(message.campaignId)}">Open campaign invite →</a>`
      : "";
    return `<article class="activity-item"><span class="activity-mark ${sentByCurrentUser ? "acid" : ""}"></span><div class="activity-copy"><strong>${sentByCurrentUser ? "To" : "From"} ${escapeHtml(otherUsername || "Friend")}</strong><p>${escapeHtml(message.text)}</p>${campaignLink}<small>${escapeHtml(new Date(message.createdAt).toLocaleString())}</small></div></article>`;
  }).join("");
  const latestCampaign = workspace.campaigns[0];
  const campaignsPreview = latestCampaign ? `<div class="campaign-strip"><div class="campaign-strip-icon" aria-hidden="true">▤</div><div class="campaign-strip-copy"><strong>${escapeHtml(latestCampaign.name)}</strong><small>${escapeHtml(latestCampaign.description || "No campaign notes yet.")}</small></div><span class="tag">${(latestCampaign.sessions ?? []).length} ${(latestCampaign.sessions ?? []).length === 1 ? "SESSION" : "SESSIONS"}</span></div>` :
    `<div class="campaign-strip"><div class="campaign-strip-copy"><strong>No campaign on the board yet</strong><small>Start one to keep sessions and crew notes together.</small></div><button class="button button-quiet" type="button" data-new="campaign">Create campaign</button></div>`;

  document.getElementById("dashboard-content").innerHTML = `${demoBanner()}
    <div class="section-grid stats-grid">${metricCard("PLAYER CHARACTERS", workspace.characters.length, "In your roster")}${metricCard("CAMPAIGNS", workspace.campaigns.length, "Stories in progress")}</div>
    <div class="section-grid dashboard-grid">
      <section class="panel"><div class="panel-head"><div><p class="section-kicker">YOUR CREW</p><h2>Recently opened sheets</h2></div><button class="text-button" type="button" data-view-link="characters">View roster →</button></div><div class="panel-body">${characterRows ? `<div class="character-list">${characterRows}</div>` : `<div class="activity-copy">${workspace.characters.length ? "Open a character sheet to see it here." : "Create a character to start your roster."}</div>`}</div></section>
      <section class="panel"><div class="panel-head"><div><p class="section-kicker">YOUR NETWORK</p><h2>Friends</h2></div></div><div class="friend-tabs" role="tablist" aria-label="Friend tools"><button class="friend-tab ${friendTab === "friends" ? "active" : ""}" type="button" role="tab" aria-selected="${friendTab === "friends"}" data-friend-tab="friends">Friends</button><button class="friend-tab ${friendTab === "requests" ? "active" : ""}" type="button" role="tab" aria-selected="${friendTab === "requests"}" data-friend-tab="requests">Requests${friendData.requests.filter(item => item.toUserId === signedInAccount?.id).length ? ` · ${friendData.requests.filter(item => item.toUserId === signedInAccount?.id).length}` : ""}</button><button class="friend-tab ${friendTab === "messages" ? "active" : ""}" type="button" role="tab" aria-selected="${friendTab === "messages"}" data-friend-tab="messages">Messages</button></div><div class="panel-body friend-panel-body">${renderFriendPanel()}</div></section>
      <section class="panel dashboard-messages-panel"><div class="panel-head"><div><p class="section-kicker">THE LATEST</p><h2>Recent activity</h2></div><button class="text-button" type="button" data-action="refresh-friends">Refresh</button></div><div class="panel-body">${recentMessages ? `<div class="activity-list">${recentMessages}</div>` : `<div class="activity-copy">${signedInAccount ? "Recent messages from your friends will appear here." : "Sign in to see messages from friends."}</div>`}</div></section>
    </div>${campaignsPreview}`;
}

function renderFriendPanel() {
  if (!signedInAccount) return `<div class="board-empty-inline">Sign in to find friends and message them.</div><button class="button button-primary friend-sign-in" type="button" data-action="open-auth">Sign in</button>`;
  if (friendTab === "requests") {
    const incoming = friendData.requests.filter(item => item.toUserId === signedInAccount.id);
    const outgoing = friendData.requests.filter(item => item.fromUserId === signedInAccount.id);
    return `<div class="friend-request-list">${incoming.map(request => `<div class="friend-list-row"><div><strong>${escapeHtml(request.fromUsername)}</strong><small>Wants to connect</small></div><div class="friend-actions"><button class="button button-primary" type="button" data-action="accept-friend-request" data-id="${escapeHtml(request.id)}">Accept</button><button class="button button-quiet" type="button" data-action="decline-friend-request" data-id="${escapeHtml(request.id)}">Decline</button></div></div>`).join("")}${outgoing.map(request => `<div class="friend-list-row"><div><strong>${escapeHtml(request.toUsername)}</strong><small>Request pending</small></div><button class="button button-quiet" type="button" data-action="decline-friend-request" data-id="${escapeHtml(request.id)}">Cancel</button></div>`).join("")}${!incoming.length && !outgoing.length ? `<div class="activity-copy">No friend requests right now.</div>` : ""}</div>`;
  }
  if (friendTab === "messages") {
    const selectedFriend = friendData.friends.find(friend => friend.id === selectedMessageFriendId) || friendData.friends[0];
    if (!selectedFriend) return `<div class="board-empty-inline">Add a friend before sending messages.</div>`;
    selectedMessageFriendId = selectedFriend.id;
    const conversation = friendData.messages.filter(message =>
      (message.fromUserId === signedInAccount.id && message.toUserId === selectedFriend.id) ||
      (message.fromUserId === selectedFriend.id && message.toUserId === signedInAccount.id)
    );
    return `<label class="form-field friend-conversation-select"><span class="field-label">Conversation</span><select class="field-select" data-friend-conversation>${friendData.friends.map(friend => `<option value="${escapeHtml(friend.id)}" ${friend.id === selectedFriend.id ? "selected" : ""}>${escapeHtml(friend.username)}</option>`).join("")}</select></label>
      <div class="friend-conversation">${conversation.map(message => `<article class="direct-message ${message.fromUserId === signedInAccount.id ? "sent" : ""}"><strong>${escapeHtml(message.fromUsername)}</strong><p>${escapeHtml(message.text)}</p>${message.campaignId ? `<a class="message-invite-link" href="/?campaignInvite=${encodeURIComponent(message.campaignId)}">Join ${escapeHtml(message.campaignName || "campaign")} →</a>` : ""}<small>${escapeHtml(new Date(message.createdAt).toLocaleString())}</small></article>`).join("") || `<div class="activity-copy">Start a conversation with ${escapeHtml(selectedFriend.username)}.</div>`}</div>
      <form class="friend-message-form" id="friend-message-form"><label class="form-field"><span class="field-label">Message</span><textarea class="field-textarea" name="text" maxlength="2000" rows="2" required placeholder="Write a message…"></textarea></label><button class="button button-primary" type="submit">Send message</button></form>`;
  }
  const friendRows = friendData.friends.map(friend => `<div class="friend-list-row"><div><strong>${escapeHtml(friend.username)}</strong><small>Friend</small></div><button class="button button-quiet" type="button" data-action="open-friend-messages" data-id="${escapeHtml(friend.id)}">Message</button></div>`).join("");
  const searchRows = friendSearchResults.map(user => {
    const isFriend = friendData.friends.some(friend => friend.id === user.id);
    const isOutgoing = friendData.requests.some(request => request.fromUserId === signedInAccount.id && request.toUserId === user.id);
    const isIncoming = friendData.requests.find(request => request.fromUserId === user.id && request.toUserId === signedInAccount.id);
    const button = isFriend
      ? `<button class="button button-quiet" type="button" disabled>Friends</button>`
      : isOutgoing
        ? `<button class="button button-quiet" type="button" disabled>Request sent</button>`
        : isIncoming
          ? `<button class="button button-primary" type="button" data-action="accept-friend-request" data-id="${escapeHtml(isIncoming.id)}">Accept request</button>`
          : `<button class="button button-quiet" type="button" data-action="send-friend-request" data-id="${escapeHtml(user.id)}">Add friend</button>`;
    return `<div class="friend-list-row"><div><strong>${escapeHtml(user.username)}</strong><small>Afterdark user</small></div>${button}</div>`;
  }).join("");
  return `<form class="friend-search-form" id="friend-search-form"><label class="form-field"><span class="field-label">Find a user by username</span><input class="field-input" type="search" name="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required placeholder="Enter exact username" value="${escapeHtml(friendSearchUsername)}"></label><button class="button button-primary" type="submit">Search</button></form>
    ${friendSearchResults.length ? `<div class="friend-search-results">${searchRows}</div>` : friendSearchPerformed ? `<div class="activity-copy">No user found with that username.</div>` : ""}
    <div class="friend-list">${friendRows || (!friendSearchResults.length && !friendSearchPerformed ? `<div class="activity-copy">Search for a username to send a friend request.</div>` : "")}</div>`;
}

function renderCharacters() {
  const createButton = document.querySelector('#view-characters [data-new="character"]');
  if (createButton) {
    const atLimit = Boolean(signedInAccount && workspace.characters.length >= MAX_CHARACTERS_PER_ACCOUNT);
    createButton.disabled = atLimit;
    createButton.title = atLimit ? `This account has reached its ${MAX_CHARACTERS_PER_ACCOUNT}-character limit.` : "";
  }
  const content = workspace.characters.length
    ? `<div class="section-head"><div><p class="section-kicker">ROSTER</p><h2>${workspace.characters.length} ${workspace.characters.length === 1 ? "character" : "characters"}</h2><p class="page-subtitle">${signedInAccount ? `${workspace.characters.length}/${MAX_CHARACTERS_PER_ACCOUNT} characters used on this account.` : "Sign in to create, own, and sync characters."}</p></div></div><div class="character-grid">${workspace.characters.map(characterCard).join("")}</div>`
    : emptyState("ROSTER EMPTY", "A blank page in a loud city.", "Create a character to keep attributes, skills, notes, and history in one place.", "Create a character", "character");
  document.getElementById("characters-content").innerHTML = `${demoBanner()}${content}`;
}

function renderCampaigns() {
  const campaigns = workspace.campaigns.map(campaign => {
    const characterNames = (campaign.characterIds ?? []).map(id => selectedCharacter(id)?.name).filter(Boolean);
    const sessions = campaign.sessions ?? [];
    return `<article class="campaign-card">
      <div class="card-top"><div><p class="card-kicker">CAMPAIGN</p><h3>${escapeHtml(campaign.name)}</h3></div><div class="card-actions"><button class="icon-button" type="button" data-action="edit-campaign" data-id="${escapeHtml(campaign.id)}" aria-label="Edit ${escapeHtml(campaign.name)}" title="Edit campaign">✎</button><button class="icon-button" type="button" data-action="delete-campaign" data-id="${escapeHtml(campaign.id)}" aria-label="Delete ${escapeHtml(campaign.name)}" title="Delete campaign">×</button></div></div>
      <p>${escapeHtml(campaign.description || "No campaign notes yet.")}</p>
      <div class="campaign-meta"><span class="tag tag-neutral">${escapeHtml(campaign.gm ? `GM · ${campaign.gm}` : "GM NOT SET")}</span><span class="tag tag-cyan">${characterNames.length} ${characterNames.length === 1 ? "CHARACTER" : "CHARACTERS"}</span></div>
      <div class="session-list">${sessions.length ? sessions.map(session => `<div class="session-entry"><time>${escapeHtml(session.date || "NO DATE")}</time><div><strong>${escapeHtml(session.title)}</strong><small>${escapeHtml(session.notes || "No session notes.")}</small></div><div class="card-actions"><button class="icon-button" type="button" data-action="edit-session" data-id="${escapeHtml(campaign.id)}" data-session-id="${escapeHtml(session.id)}" aria-label="Edit ${escapeHtml(session.title)}">✎</button><button class="icon-button" type="button" data-action="delete-session" data-id="${escapeHtml(campaign.id)}" data-session-id="${escapeHtml(session.id)}" aria-label="Delete ${escapeHtml(session.title)}">×</button></div></div>`).join("") : `<span class="field-hint">No sessions logged yet.</span>`}</div>
      <div class="card-bottom campaign-actions"><small>${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ${(campaign.characterIds ?? []).length} linked</small><div><button class="button button-quiet" type="button" data-action="copy-campaign-code" data-id="${escapeHtml(campaign.id)}">Invite</button><button class="button button-quiet" type="button" data-action="add-session" data-id="${escapeHtml(campaign.id)}">＋ Add session</button><button class="button button-primary" type="button" data-action="open-campaign-board" data-id="${escapeHtml(campaign.id)}">Play board</button></div></div>
    </article>`;
  }).join("");
  document.getElementById("campaigns-content").innerHTML = `${demoBanner()}${campaigns ? `<div class="campaign-grid">${campaigns}</div>` : emptyState("NO CAMPAIGNS", "Make room for a story.", "Create a campaign to organize your crew, session notes, and next job.", "Create a campaign", "campaign")}`;
}

function itemDetail(item) {
  return [item.weaponType, item.weaponStats, item.customNotes, item.details, item.description, item.sourceReference].filter(Boolean).join(" · ") || "No details";
}

function renderCatalogSearchResults() {
  const results = document.getElementById("catalog-results");
  if (!results) return;
  const catalog = workspace.catalog || [];
  const categories = ["All", ...new Set(catalog.map(item => item.category).filter(Boolean))];
  if (!categories.includes(catalogFilter)) catalogFilter = "All";
  const categorySelect = document.getElementById("catalog-category-filter");
  if (categorySelect) {
    categorySelect.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category === "All" ? "All categories" : category)}</option>`).join("");
    categorySelect.value = catalogFilter;
  }
  const weaponTypes = [...new Set(catalog.filter(item => String(item.category || "").toLowerCase() === "weapon").map(item => item.weaponType).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const typeSelect = document.getElementById("catalog-type-filter");
  if (typeSelect) {
    typeSelect.innerHTML = ["All", ...weaponTypes].map(type => `<option value="${escapeHtml(type)}">${escapeHtml(type === "All" ? "All weapon types" : type)}</option>`).join("");
    if (![...typeSelect.options].some(option => option.value === catalogTypeFilter)) catalogTypeFilter = "All";
    typeSelect.value = catalogTypeFilter;
    typeSelect.disabled = catalogFilter !== "All" && catalogFilter.toLowerCase() !== "weapon";
  }
  const categoryItems = catalog.filter(item => catalogFilter === "All" || item.category === catalogFilter);
  const typeItems = catalogTypeFilter === "All"
    ? categoryItems
    : categoryItems.filter(item => String(item.category || "").toLowerCase() === "weapon" && String(item.weaponType || "").toLowerCase() === catalogTypeFilter.toLowerCase());
  const query = catalogSearch.trim().toLocaleLowerCase();
  const exactNameMatches = query ? typeItems.filter(item => item.name.trim().toLocaleLowerCase() === query) : [];
  const catalogItems = exactNameMatches.length
    ? exactNameMatches
    : query ? typeItems.filter(item => item.name.toLocaleLowerCase().includes(query)) : typeItems;
  const character = selectedCharacter(catalogTargetCharacterId);
  results.innerHTML = catalogItems.length
    ? catalogItems.map(item => {
      const needsLevelledPurchase = Number.isInteger(Number(item.pricePerLevel)) && Number(item.pricePerLevel) > 0;
      const needsFlatPurchase = Number.isInteger(Number(item.purchaseCost)) && Number(item.purchaseCost) > 0;
      const needsPurchase = needsLevelledPurchase || needsFlatPurchase || Boolean(item.chipSkill);
      const action = needsPurchase ? "purchase-catalog-item" : "add-catalog-item";
      const label = needsPurchase ? needsLevelledPurchase || item.chipSkill ? "Purchase chip" : "Purchase" : "＋ Add to inventory";
      return `<tr><td><strong>${escapeHtml(item.name)}</strong><span class="gear-detail">${escapeHtml(itemDetail(item))}</span></td><td><span class="tag tag-neutral">${escapeHtml(item.category)}</span></td><td>${escapeHtml(item.cost || "—")}</td><td><button class="button button-quiet" type="button" data-action="${action}" data-id="${escapeHtml(item.id)}" data-character-id="${escapeHtml(catalogTargetCharacterId)}" aria-label="${needsPurchase ? "Purchase" : "Add"} ${escapeHtml(item.name)} ${needsPurchase ? "for" : "to"} ${escapeHtml(character?.name || "character")}">${label}</button></td></tr>`;
    }).join("")
    : `<tr><td colspan="4" class="table-empty">${catalog.length ? `No catalog entries match${query ? ` "${escapeHtml(catalogSearch.trim())}"` : " these filters"}. Try another name or type.` : "No catalog entries are available yet."}</td></tr>`;
  const count = document.getElementById("catalog-result-count");
  if (count) count.textContent = `${catalogItems.length} ${catalogItems.length === 1 ? "match" : "matches"} · adding to ${character?.name || "character"}`;
}

function openCatalogSearch(characterId) {
  if (!signedInAccount) return openAuthForm("login");
  const character = selectedCharacter(characterId);
  if (!character) return showToast("Choose a character before searching the item catalog.", true);
  catalogTargetCharacterId = character.id;
  catalogFilter = "All";
  catalogTypeFilter = "All";
  catalogSearch = "";
  const catalog = workspace.catalog || [];
  catalogDialogContent.innerHTML = `<div class="catalog-drawer">
    <header class="catalog-drawer-head"><div><p class="section-kicker">ITEM CATALOG</p><h2 id="catalog-dialog-title">Gear &amp; cyberware</h2><p>Searching for ${escapeHtml(character.name)}. Choose an item to add it to this character.</p></div><button class="icon-button" type="button" data-action="close-catalog-search" aria-label="Close item search">×</button></header>
    <div class="catalog-drawer-actions"><button class="button" type="button" data-action="import-catalog">Import CSV / JSON</button><button class="button button-quiet" type="button" data-action="new-catalog-item">＋ Add custom catalog item</button><input id="catalog-file" class="sr-only" type="file" accept=".csv,.json,text/csv,application/json" aria-label="Import item catalog"></div>
    <div class="catalog-drawer-filters"><label class="catalog-search-field"><span class="field-label">SEARCH ITEMS</span><input id="catalog-search" class="input-control" type="search" placeholder="Type an item name..." autocomplete="off"></label><div class="catalog-filter-selects"><label><span class="field-label">CATEGORY</span><select id="catalog-category-filter" class="select-control"></select></label><label><span class="field-label">WEAPON TYPE</span><select id="catalog-type-filter" class="select-control"></select></label></div><p class="field-hint" id="catalog-result-count"></p></div>
    <div class="table-wrap catalog-results-scroll"><table class="gear-table catalog-results-table"><thead><tr><th>ITEM</th><th>CATEGORY</th><th>COST</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="catalog-results"></tbody></table></div>
  </div>`;
  if (!catalogDialog.open) catalogDialog.showModal();
  renderCatalogSearchResults();
  catalogDialog.querySelector("#catalog-search").focus();
}

function renderCharacterActions(character, inventory) {
  const equippedWeapons = inventory.filter(item => isWeaponItem(item) && item.equipped);
  const attackRows = equippedWeapons.length ? equippedWeapons.map((item, index) => {
    const combat = weaponCombatData(item);
    const skill = weaponSkillFor(character, item);
    const ref = Number(character.attributes?.REF || 0);
    const bonus = ref + skill.value;
    const maximumRounds = combat.rateOfFire || combat.capacity || 1;
    const damageButton = parseDamageFormula(combat.damageFormula)
      ? `<button class="damage-formula" type="button" data-action="sheet-damage-roll" data-character-id="${escapeHtml(character.id)}" data-id="${escapeHtml(item.id)}" aria-label="Roll ${escapeHtml(combat.damageFormula)} damage for ${escapeHtml(item.name)}">${escapeHtml(combat.damageFormula)}</button>`
      : `<span class="damage-formula-unavailable">${escapeHtml(combat.damageFormula)}</span>`;
    return `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><span class="gear-detail">${escapeHtml(item.weaponType || "Weapon")}</span></td>
      <td><span class="weapon-ammo">${escapeHtml(combat.ammoType)}</span><small>${combat.capacity ? `${combat.capacity} in magazine` : "capacity not listed"}${combat.rateOfFire ? ` · ROF ${combat.rateOfFire}` : ""}</small></td>
      <td><label class="sr-only" for="attack-rounds-${index}">Rounds fired from ${escapeHtml(item.name)}</label><input id="attack-rounds-${index}" class="input-control rounds-fired" type="number" min="1" max="${maximumRounds}" value="1" data-rounds-item-id="${escapeHtml(item.id)}"></td>
      <td><button class="button button-primary hit-roll-button" type="button" data-action="sheet-attack-roll" data-character-id="${escapeHtml(character.id)}" data-id="${escapeHtml(item.id)}" data-rounds-input-id="attack-rounds-${index}" aria-label="Roll hit check for ${escapeHtml(item.name)} with bonus ${bonus}">Hit +${bonus} · Roll d10</button><small>${escapeHtml(skill.name)} ${escapeHtml(skill.naturalValue)}${skill.chipBonus ? ` + ${escapeHtml(skill.chipBonus)} chip` : ""} + REF ${ref}</small></td>
      <td>${damageButton}</td>
    </tr>`;
  }).join("") : `<tr><td class="table-empty" colspan="5">${inventory.some(isWeaponItem) ? "Equip a weapon in Gear & cyberware to use it here." : "Add a weapon to this character's inventory to set up an attack."}</td></tr>`;
  const skillsByName = new Map((character.skills || []).map(normalizeSkill).filter(skill => skill.name).map(skill => [skill.name.toLowerCase(), skill]));
  for (const item of inventory.filter(entry => entry.socketed && entry.chipSkill)) {
    const key = String(item.chipSkill).trim().toLowerCase();
    if (!skillsByName.has(key)) skillsByName.set(key, { name: String(item.chipSkill).trim(), value: 0, special: false });
  }
  const skills = [...skillsByName.values()];
  const skillOptions = skills.length
    ? skills.map((skill, index) => {
      const chipBonus = skillChipBonusFor(character, skill.name);
      const total = skill.value + chipBonus;
      const label = chipBonus ? `+${skill.value} natural, +${chipBonus} chip = +${total}` : `+${skill.value}`;
      return `<option value="${escapeHtml(skill.name)}" data-skill-value="${escapeHtml(total)}" data-natural-skill-value="${escapeHtml(skill.value)}" data-chip-bonus="${escapeHtml(chipBonus)}" ${index === 0 ? "selected" : ""}>${escapeHtml(skill.name)} (${label})</option>`;
    }).join("")
    : `<option value="" data-skill-value="0">No skill (0)</option>`;
  const result = sheetRollResults[character.id] || "Roll results will appear here. If this character is linked to an active campaign, they will also appear in its board feed.";
  return `<section class="panel sheet-action-table-panel"><div class="panel-head"><div><p class="section-kicker">ACTIONS</p><h2>Weapon actions</h2></div></div><div class="panel-body"><p class="field-hint">The GM confirms hits. Damage is rolled here, but never applied automatically.</p><div class="table-wrap action-table-wrap"><table class="gear-table weapon-action-table"><thead><tr><th>WEAPON</th><th>AMMUNITION</th><th>ROUNDS FIRED</th><th>HIT CHECK</th><th>DAMAGE ROLL</th></tr></thead><tbody>${attackRows}</tbody></table></div></div></section>
    <section class="panel"><div class="panel-head"><div><p class="section-kicker">SKILL CHECKS</p><h2>Roll from this sheet</h2></div></div><div class="panel-body"><div class="sheet-skill-roll-controls">
      <label class="board-form-field"><span>Attribute</span><select id="sheet-skill-attribute">${ATTRIBUTES.map(attribute => `<option value="${attribute}" ${attribute === "REF" ? "selected" : ""}>${attribute} · ${escapeHtml(character.attributes?.[attribute] ?? 0)}</option>`).join("")}</select></label>
      <label class="board-form-field"><span>Skill</span><select id="sheet-skill-select">${skillOptions}</select></label>
      <label class="board-form-field"><span>Target</span><input id="sheet-roll-target" type="number" value="15"></label>
      <label class="board-form-field"><span>Modifier</span><input id="sheet-roll-modifier" type="number" value="0"></label>
      <button class="button button-primary" type="button" data-action="sheet-skill-roll" data-character-id="${escapeHtml(character.id)}">Roll skill check</button>
    </div><p id="sheet-roll-result" class="sheet-roll-result" role="status" aria-live="polite">${escapeHtml(result)}</p></div></section>`;
}

function renderSheet() {
  const selector = document.getElementById("sheet-character");
  const target = document.getElementById("sheet-content");
  if (!selector || !target) return;
  const previous = selectedSheetCharacterId || selector.value;
  selector.innerHTML = workspace.characters.map(character => `<option value="${escapeHtml(character.id)}">${escapeHtml(character.name)}</option>`).join("");
  const character = workspace.characters.find(item => item.id === previous) || workspace.characters[0];
  if (!character) {
    selector.disabled = true;
    target.innerHTML = emptyState("NO CHARACTERS", "Start your roster.", signedInAccount ? "Create a character to begin their sheet." : "Sign in or create an account to create a character sheet.", "Create a character", "character");
    return;
  }
  selector.disabled = false;
  selector.value = character.id;
  selectedSheetCharacterId = character.id;
  const inventory = itemsForCharacter(character);
  const portrait = character.portraitUrl
    ? `<img class="sheet-portrait" src="${escapeHtml(character.portraitUrl)}" alt="${escapeHtml(character.name)} portrait">`
    : `<div class="sheet-portrait sheet-portrait-placeholder" aria-hidden="true">${escapeHtml(initials(character.name))}</div>`;
  const tabs = `<div class="sheet-tabs" role="tablist" aria-label="Character sheet sections"><button class="sheet-tab ${sheetTab === "overview" ? "active" : ""}" type="button" role="tab" aria-selected="${sheetTab === "overview"}" data-sheet-tab="overview">Overview</button><button class="sheet-tab ${sheetTab === "gear" ? "active" : ""}" type="button" role="tab" aria-selected="${sheetTab === "gear"}" data-sheet-tab="gear">Gear &amp; cyberware <span>${inventory.length}</span></button><button class="sheet-tab ${sheetTab === "backstory" ? "active" : ""}" type="button" role="tab" aria-selected="${sheetTab === "backstory"}" data-sheet-tab="backstory">Back story</button></div>`;
  if (sheetTab === "gear") {
    const rows = inventory.length ? inventory.map(item => {
      const chipDetails = item.chipSkill ? `<span class="gear-detail">Skill chip · ${escapeHtml(item.chipSkill)} +${escapeHtml(item.chipBonus ?? 0)}${item.socketed ? " · socketed" : ""}</span>` : "";
      const socketButton = item.chipSkill ? `<button class="button button-quiet equip-button" type="button" data-action="toggle-socketed" data-id="${escapeHtml(item.id)}" data-character-id="${escapeHtml(character.id)}" aria-pressed="${Boolean(item.socketed)}">${item.socketed ? "Socketed" : "Socket chip"}</button>` : "";
      return `<tr><td><strong>${escapeHtml(item.name)}</strong><span class="gear-detail">${escapeHtml(itemDetail(item))}</span>${chipDetails}</td><td>${escapeHtml(item.category || "Other")}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.weight || "—")}</td><td>${escapeHtml(item.cost || "—")}</td><td><button class="button button-quiet equip-button" type="button" data-action="edit-gear" data-id="${escapeHtml(item.id)}">Edit</button>${socketButton}<button class="button button-quiet equip-button" type="button" data-action="toggle-equipped" data-id="${escapeHtml(item.id)}" data-character-id="${escapeHtml(character.id)}" aria-pressed="${Boolean(item.equipped)}">${item.equipped ? "Equipped" : "Equip"}</button><button class="icon-button" type="button" data-action="delete-gear" data-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">×</button></td></tr>`;
    }).join("") : `<tr><td colspan="6" class="table-empty">No inventory yet. Add something from the catalog or enter a custom item.</td></tr>`;
    target.innerHTML = `${tabs}<div class="sheet-inventory-toolbar"><div><p class="section-kicker">CARRIED BY ${escapeHtml(character.name.toUpperCase())}</p><p class="page-subtitle">${inventory.length} ${inventory.length === 1 ? "item" : "items"} in inventory</p></div><div class="sheet-inventory-actions"><button class="button button-primary" type="button" data-action="open-catalog-search" data-character-id="${escapeHtml(character.id)}">Search item catalog</button><button class="button" type="button" data-action="open-custom-gear" data-character-id="${escapeHtml(character.id)}">＋ Custom item</button></div></div><div class="table-wrap sheet-inventory-table"><table class="gear-table"><thead><tr><th>ITEM</th><th>CATEGORY</th><th>QTY</th><th>WEIGHT</th><th>COST</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
    return;
  }
  if (sheetTab === "backstory") {
    target.innerHTML = `${tabs}<div class="section-grid sheet-body-grid"><section class="panel"><div class="panel-head"><div><p class="section-kicker">CHARACTER HISTORY</p><h2>Back story</h2></div></div><div class="panel-body"><div class="note-box">${escapeHtml(character.history || "No back story added.")}</div></div></section><section class="panel"><div class="panel-head"><div><p class="section-kicker">CHARACTER NOTES</p><h2>Notes</h2></div></div><div class="panel-body"><div class="note-box">${escapeHtml(character.notes || "No notes added.")}</div></div></section></div>`;
    return;
  }
  const attributes = ATTRIBUTES.map(attribute => `<div class="attr-cell"><span>${attribute}</span><strong>${escapeHtml(character.attributes?.[attribute] ?? "—")}</strong></div>`).join("");
  const socketedChips = inventory.filter(item => item.socketed && item.chipSkill);
  const naturalSkills = (character.skills || []).map(normalizeSkill).filter(skill => skill.name);
  const naturalSkillRows = naturalSkills.map(skill => `<div class="sheet-chip-skill-row"><span><strong>${escapeHtml(skill.name)}${skill.special ? " · Special" : ""}</strong><small>Natural skill</small></span><b>+${escapeHtml(skill.value)}</b></div>`).join("") || `<span class="field-hint">No natural skills recorded.</span>`;
  const chippedSkillRows = socketedChips.map(item => `<div class="sheet-chip-skill-row"><span><strong>${escapeHtml(item.chipSkill)}</strong><small>${escapeHtml(item.name)}</small></span><b>+${escapeHtml(item.chipBonus ?? 0)}</b></div>`).join("") || `<span class="field-hint">No skill chips are socketed.</span>`;
  const bodyRows = BODY_LOCATIONS.map(({ key, label }) => {
    const health = character.bodyHealth?.[key] || {};
    const armorSP = character.bodyArmorSP?.[key] == null ? "—" : character.bodyArmorSP[key];
    return `<tr><th scope="row">${escapeHtml(label)}</th><td><input class="input-control body-health-input" type="number" min="0" max="9999" step="1" name="body-${key}-current" value="${escapeHtml(health.current ?? "")}" aria-label="${escapeHtml(label)} current limb health"></td><td><input class="input-control body-health-input" type="number" min="0" max="9999" step="1" name="body-${key}-max" value="${escapeHtml(health.max ?? "")}" aria-label="${escapeHtml(label)} maximum limb health"></td><td>${escapeHtml(armorSP)}</td></tr>`;
  }).join("");
  const derived = (character.derived ?? []).map(item => {
    const [label, ...rest] = String(item).split(":");
    return `<div class="derived-item"><span>${escapeHtml(label.trim())}</span><strong>${escapeHtml(rest.join(":").trim() || "—")}</strong></div>`;
  }).join("") || `<span class="field-hint">No custom values.</span>`;
  const lastRoll = sheetRollResults[character.id] || "No rolls yet.";
  const equippedItems = inventory.filter(item => item.equipped);
  target.innerHTML = `${tabs}<article class="sheet-hero">${portrait}<div class="sheet-identity"><p class="eyebrow">${escapeHtml(character.role || "CHARACTER")} · ${escapeHtml(character.handle || "NO HANDLE")}</p><h2>${escapeHtml(character.name)}</h2><span class="tag tag-cyan">${character.healthCurrent == null ? "LIFE NOT SET" : `${escapeHtml(character.healthCurrent)}${character.healthMax == null ? "" : ` / ${escapeHtml(character.healthMax)}`} LIFE`}</span></div><div class="sheet-actions"><button class="button" type="button" data-action="edit-character" data-id="${escapeHtml(character.id)}">Edit sheet</button><button class="button button-primary" type="button" data-action="open-character-board" data-id="${escapeHtml(character.id)}">▦ Play on board</button></div></article>
    <section class="panel sheet-vitals-panel"><div class="panel-head"><div><p class="section-kicker">LIFE</p><h2>Character health</h2></div></div><div class="panel-body"><form class="sheet-vitals-form" data-character-vitals-form data-vitals-kind="health" data-character-id="${escapeHtml(character.id)}"><label><span class="field-label">Current life</span><input class="field-input" type="number" name="healthCurrent" min="0" max="9999" step="1" value="${escapeHtml(character.healthCurrent ?? "")}" aria-label="Current life"></label><label><span class="field-label">Maximum life</span><input class="field-input" type="number" name="healthMax" min="0" max="9999" step="1" value="${escapeHtml(character.healthMax ?? "")}" aria-label="Maximum life"></label><button class="button button-primary" type="submit">Save health</button></form></div></section>
    <section class="panel sheet-latest-roll"><div class="panel-head"><div><p class="section-kicker">LATEST ROLL</p><h2>Roll result</h2></div></div><div class="panel-body"><p id="sheet-overview-roll-result" class="sheet-roll-result" role="status" aria-live="polite">${escapeHtml(lastRoll)}</p></div></section>
    <div class="section-grid sheet-body-grid"><section class="panel"><div class="panel-head"><div><p class="section-kicker">CHARACTERISTICS</p><h2>Attributes</h2></div></div><div class="panel-body"><div class="card-attrs sheet-attributes">${attributes}</div></div></section><section class="panel"><div class="panel-head"><div><p class="section-kicker">SKILL BONUSES</p><h2>Skills</h2></div></div><div class="panel-body"><div class="skill-summary-grid"><section><h3>Natural skills</h3><div class="sheet-chip-skills">${naturalSkillRows}</div></section><section><h3>Chipped skills</h3><div class="sheet-chip-skills">${chippedSkillRows}</div></section></div><p class="field-hint">Socketed chips with the same skill add together for skill and weapon rolls.</p></div></section>
    <section class="panel"><div class="panel-head"><div><p class="section-kicker">BODY STATUS</p><h2>Limb health &amp; armor</h2></div></div><div class="panel-body"><form data-character-vitals-form data-vitals-kind="body" data-character-id="${escapeHtml(character.id)}"><div class="table-wrap"><table class="body-status-table"><thead><tr><th>LOCATION</th><th>CURRENT</th><th>MAX</th><th>ARMOR SP</th></tr></thead><tbody>${bodyRows}</tbody></table></div><div class="sheet-vitals-submit"><button class="button button-primary" type="submit">Save limb health</button></div><p class="field-hint">Edit current limb health to track damage. Armor SP remains in Edit sheet.</p></form></div></section>
    ${renderCharacterActions(character, inventory)}
    <section class="panel sheet-eddies-panel"><div class="panel-head"><div><p class="section-kicker">CURRENCY</p><h2>Eddies</h2></div></div><div class="panel-body"><form class="eddies-form" data-eddies-form data-character-id="${escapeHtml(character.id)}"><label><span class="field-label">Current balance</span><input class="field-input" type="number" name="eddies" min="0" max="999999999" step="1" value="${escapeHtml(character.eddies)}" required></label><button class="button button-primary" type="submit">Save eddies</button></form><p class="field-hint">Maximum balance: 999,999,999.</p></div></section>
    <section class="panel"><div class="panel-head"><div><p class="section-kicker">TABLE VALUES</p><h2>Custom derived values</h2></div></div><div class="panel-body"><div class="derived-list">${derived}</div></div></section>
    <section class="panel sheet-preview-inventory"><div class="panel-head"><div><p class="section-kicker">CARRIED ITEMS</p><h2>Equipped gear</h2></div><button class="text-button" type="button" data-action="open-character-gear" data-id="${escapeHtml(character.id)}">Open inventory →</button></div><div class="panel-body">${equippedItems.length ? `<div class="activity-list">${equippedItems.slice(0, 5).map(item => `<div class="activity-item"><span class="activity-mark acid"></span><div class="activity-copy"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · QTY ${escapeHtml(item.quantity)}${item.weight ? ` · ${escapeHtml(item.weight)}` : ""}</small></div></div>`).join("")}</div>` : `<span class="field-hint">No items currently equipped.</span>`}</div></section></div>`;
}

function roomEventText(event) {
  if (event.kind === "roll") {
    const isAttack = event.rollKind === "attack";
    const type = isAttack ? "hit check" : "skill check";
    const descriptor = isAttack && event.weapon ? ` with ${event.weapon}` : ` using ${event.skill || "no skill"}`;
    const formula = event.privateStats
      ? `d10 ${escapeHtml(event.die)} + private bonus = <strong>${escapeHtml(event.total)}</strong>`
      : `d10 ${escapeHtml(event.die)} + ${escapeHtml(event.attribute)} ${escapeHtml(event.base)} + skill ${escapeHtml(event.skillValue)} + mod ${escapeHtml(event.modifier)} = <strong>${escapeHtml(event.total)}</strong>`;
    const target = event.target > 0
      ? ` vs ${escapeHtml(event.target)} <span class="tag ${event.success ? "tag-cyan" : "tag-neutral"}">${event.success ? "SUCCESS" : "MISS"}</span>`
      : "";
    const ammunition = isAttack && event.roundsFired ? ` · ${escapeHtml(event.roundsFired)} round${event.roundsFired === 1 ? "" : "s"}` : "";
    return `<strong>${escapeHtml(event.actor)}</strong> rolled a ${type} for <strong>${escapeHtml(event.characterName)}</strong>${escapeHtml(descriptor)}${ammunition}: ${formula}${target}`;
  }
  if (event.kind === "health") {
    const verb = event.delta > 0 ? "gained" : "lost";
    const current = event.current == null ? "" : ` (${escapeHtml(event.current)}${event.max > 0 ? `/${escapeHtml(event.max)}` : ""})`;
    return `<strong>${escapeHtml(event.actor)}</strong>: <strong>${escapeHtml(event.characterName)}</strong> ${verb} ${escapeHtml(Math.abs(event.delta))} life${current}.`;
  }
  return `<strong>${escapeHtml(event.actor || "TABLE")}</strong> ${escapeHtml(event.message || "updated the table.")}`;
}

function renderPalette() {
  const target = document.getElementById("board-palette-content");
  if (!target) return;
  if (!boardIsGm && boardTab !== "party") boardTab = "party";
  document.querySelectorAll(".board-tab").forEach(button => {
    const enabled = boardIsGm || button.dataset.boardTab === "party";
    button.hidden = !enabled;
    const active = enabled && button.dataset.boardTab === boardTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (boardTab === "party") {
    if (boardIsGm) {
      target.innerHTML = `<p class="palette-intro">Campaign characters shared by players. Drag one onto the board or use Add.</p>${campaignRoster.map((character, index) => {
        const placed = boardState.tokens.some(token => token.characterId === character.id);
        return `<button class="palette-card party-card" type="button" ${placed ? "disabled" : "draggable=\"true\""} data-palette-kind="character" data-palette-index="${index}" aria-label="${placed ? "Already on board: " : "Drag or add "}${escapeHtml(character.name)}"><span class="enemy-avatar">${character.portraitUrl ? `<img src="${escapeHtml(character.portraitUrl)}" alt="">` : escapeHtml(initials(character.name))}</span><span class="palette-card-copy"><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.ownerName || "Player")} · LIFE ${escapeHtml(character.healthCurrent ?? "—")}</small></span><span class="palette-add">${placed ? "✓" : "＋"}</span></button>`;
      }).join("") || `<div class="board-empty-inline">No characters are linked yet. Players can share their characters from this tab.</div>`}<p class="field-hint">Only the GM can place characters. Players can move their own character tokens, and the GM can move any token.</p>`;
    } else {
      const linked = new Set(campaignRoster.map(character => character.id));
      const ownCharacters = workspace.characters.map(character => {
        const alreadyLinked = linked.has(character.id);
        return `<div class="palette-card party-card"><span class="enemy-avatar">${character.portraitUrl ? `<img src="${escapeHtml(character.portraitUrl)}" alt="">` : escapeHtml(initials(character.name))}</span><span class="palette-card-copy"><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.role || "Character")}</small></span><button class="palette-add" type="button" data-action="link-character-room" data-id="${escapeHtml(character.id)}" ${alreadyLinked ? "disabled" : ""} aria-label="${alreadyLinked ? "Already shared" : `Share ${escapeHtml(character.name)} with the GM`}">${alreadyLinked ? "✓" : "＋"}</button></div>`;
      }).join("");
      target.innerHTML = `<p class="palette-intro">Share a character with the GM, who can place linked characters onto the board. You can move your own character token.</p>${ownCharacters || `<div class="board-empty-inline">Create a character before joining the table.</div>`}<p class="field-hint">${campaignPlayerCount}/${MAX_CAMPAIGN_PLAYERS} player accounts in the room.</p>`;
    }
    return;
  }
  if (!boardIsGm) return;
  if (boardTab === "terrain") {
    target.innerHTML = `<p class="palette-intro">Original scale props. Each tile covers 2 × 2 m.</p>${TERRAIN_TEMPLATES.map((item, index) => `<button class="palette-card terrain-card" type="button" draggable="true" data-palette-kind="terrain" data-palette-index="${index}" aria-label="Drag or add ${escapeHtml(item.name)}, ${item.widthMeters} by ${item.heightMeters} meters"><span class="palette-swatch" style="--piece-color:${item.color}"></span><span class="palette-card-copy"><strong>${escapeHtml(item.name)}</strong><small>${item.widthMeters} × ${item.heightMeters} m</small></span><span class="palette-add">＋</span></button>`).join("")}<p class="field-hint">Drag a prop onto the grid or tap + to place it.</p>`;
    return;
  }
  target.innerHTML = enemyTemplates.length
    ? `<p class="palette-intro">Editable, original sample adversaries. Update their details in your table as needed.</p>${enemyTemplates.map((item, index) => `<button class="palette-card enemy-card" type="button" draggable="true" data-palette-kind="enemy" data-palette-index="${index}" aria-label="Drag or add ${escapeHtml(item.name)}"><span class="enemy-avatar">${escapeHtml(initials(item.name))}</span><span class="palette-card-copy"><strong>${escapeHtml(item.name)}</strong><small>REF ${item.attributes.REF} · BODY ${item.attributes.BODY} · LIFE ${item.health.current}</small></span><span class="palette-add">＋</span><span class="palette-gear">${item.gear.map(escapeHtml).join(" · ")}</span></button>`).join("")}<p class="field-hint">Drag an adversary onto the grid or tap + to place it.</p>`
    : `<div class="board-empty-inline">Enemy templates are available after GM verification.</div>`;
}

function renderInitiative() {
  const ordered = [...boardState.tokens];
  if (boardIsGm) ordered.sort((a, b) => Number(b.initiative || 0) - Number(a.initiative || 0));
  if (!ordered.length) return `<div class="board-empty-inline">Place a character or enemy to start the initiative list.</div>`;
  return `<ol class="initiative-list">${ordered.map((token, index) => {
    const canSeeInitiative = boardIsGm || token.ownerUserId === signedInAccount?.id;
    return `<li class="initiative-row ${boardIsGm ? "gm-initiative-row" : ""} ${token.id === selectedBoardTokenId ? "selected" : ""}"><button type="button" class="initiative-select" data-action="select-board-token" data-id="${escapeHtml(token.id)}"><span class="initiative-rank">${index + 1}</span><span class="initiative-name">${escapeHtml(token.name)}<small>${escapeHtml(token.role || (token.kind === "enemy" ? "ENEMY" : "CHARACTER"))}</small></span></button><span class="initiative-value">${canSeeInitiative ? escapeHtml(token.initiative || 0) : "—"}</span>${boardIsGm ? `<label class="sr-only" for="initiative-${escapeHtml(token.id)}">Initiative for ${escapeHtml(token.name)}</label><input id="initiative-${escapeHtml(token.id)}" class="initiative-input" type="number" min="-1000" max="1000" value="${escapeHtml(token.initiative || 0)}" data-initiative-token="${escapeHtml(token.id)}">` : ""}</li>`;
  }).join("")}</ol>`;
}

function renderBoardEvents() {
  if (!roomEvents.length) return `<div class="board-empty-inline">Rolls, life changes, and table updates will appear here for everyone in this campaign.</div>`;
  return `<div class="board-event-list">${roomEvents.slice(-12).reverse().map(event => `<article class="board-event"><span class="event-time">${escapeHtml(event.timestamp ? new Date(event.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "")}</span><p>${roomEventText(event)}</p></article>`).join("")}</div>`;
}

function boardRollCharacters() {
  const enemies = boardIsGm ? boardState.tokens.filter(token => token.kind === "enemy").map(token => ({
    id: token.id,
    name: token.name,
    attributes: token.attributes || {},
    skills: [],
    inventory: []
  })) : [];
  const characters = [...workspace.characters, ...campaignRoster, ...enemies];
  return characters.filter((character, index) => characters.findIndex(candidate => candidate.id === character.id) === index);
}

function currentBoardCharacter() {
  const characters = boardRollCharacters();
  return characters.find(character => character.id === boardRollCharacterId) || characters[0] || null;
}

function renderBoardSide() {
  const target = document.getElementById("board-side-content");
  if (!target) return;
  const existingAttribute = document.getElementById("roll-attribute")?.value;
  const existingWeapon = document.getElementById("roll-weapon")?.value;
  const existingTarget = document.getElementById("roll-target")?.value;
  const existingModifier = document.getElementById("roll-modifier")?.value;
  if (existingAttribute) boardRollAttribute = existingAttribute;
  if (existingWeapon != null) boardRollWeapon = existingWeapon;
  if (existingTarget != null && Number.isFinite(Number(existingTarget))) boardRollTarget = Number(existingTarget);
  if (existingModifier != null && Number.isFinite(Number(existingModifier))) boardRollModifier = Number(existingModifier);
  const character = currentBoardCharacter();
  if (character && character.id !== boardRollCharacterId) boardRollCharacterId = character.id;
  const skillsByName = new Map((character?.skills ?? []).map(normalizeSkill).filter(skill => skill.name).map(skill => [skill.name.toLowerCase(), skill]));
  for (const item of itemsForCharacter(character).filter(entry => entry.socketed && entry.chipSkill)) {
    const key = String(item.chipSkill).trim().toLowerCase();
    if (!skillsByName.has(key)) skillsByName.set(key, { name: String(item.chipSkill).trim(), value: 0, special: false });
  }
  const skills = [...skillsByName.values()];
  if (!skills.some(skill => skill.name === boardRollSkillName)) boardRollSkillName = skills[0]?.name ?? "";
  const token = boardState.tokens.find(item => item.id === selectedBoardTokenId);
  if (!token && boardState.tokens.length) selectedBoardTokenId = boardState.tokens[0].id;
  const selectedToken = boardState.tokens.find(item => item.id === selectedBoardTokenId);
  const characterOptions = boardRollCharacters().map(item => `<option value="${escapeHtml(item.id)}" ${item.id === character?.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
  const skillOptions = skills.length ? skills.map(skill => {
    const chipBonus = skillChipBonusFor(character, skill.name);
    const total = skill.value + chipBonus;
    const label = chipBonus ? `+${skill.value} natural, +${chipBonus} chip = +${total}` : `+${skill.value}`;
    return `<option value="${escapeHtml(skill.name)}" data-skill-value="${escapeHtml(total)}" ${skill.name === boardRollSkillName ? "selected" : ""}>${escapeHtml(skill.name)} (${label})</option>`;
  }).join("") : `<option value="" data-skill-value="0">No skill (0)</option>`;
  const weaponOptions = itemsForCharacter(character).filter(isWeaponItem).map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("");
  const canInspectToken = boardIsGm || (selectedToken?.kind === "character" && selectedToken.ownerUserId === signedInAccount?.id);
  const tokenAttributes = canInspectToken ? Object.entries(selectedToken?.attributes ?? {}).map(([attribute, value]) => `${attribute} ${value}`).join(" · ") : "";
  const tokenGear = canInspectToken && selectedToken?.gear?.length ? selectedToken.gear.join(" · ") : "No gear listed.";
  const healthPanel = selectedToken ? canInspectToken
    ? `<div class="selected-token"><div class="selected-token-copy"><span class="card-kicker">${escapeHtml(selectedToken.kind === "enemy" ? "ENEMY" : "ON THE BOARD")}</span><strong>${escapeHtml(selectedToken.name)}</strong></div><span class="tag tag-cyan">${escapeHtml(selectedToken.health?.current ?? 0)}${selectedToken.health?.max ? `/${escapeHtml(selectedToken.health.max)}` : ""} LIFE</span></div>${tokenAttributes ? `<p class="token-stat-line">${escapeHtml(tokenAttributes)}</p>` : ""}<p class="token-gear-line"><span>GEAR</span> ${escapeHtml(tokenGear)}</p>${boardIsGm || selectedToken.ownerUserId === signedInAccount?.id ? `<div class="health-adjust-row"><label class="sr-only" for="health-adjust">Life amount</label><input id="health-adjust" class="input-control" type="number" min="1" value="1"><button class="button button-danger" type="button" data-action="adjust-health" data-delta="-1">− Damage</button><button class="button button-quiet" type="button" data-action="adjust-health" data-delta="1">＋ Heal</button></div><p class="field-hint">Life changes are manual; damage is never applied by an attack roll.</p>` : ""}`
    : `<div class="selected-token"><div class="selected-token-copy"><span class="card-kicker">ON THE BOARD</span><strong>${escapeHtml(selectedToken.name)}</strong></div></div><p class="field-hint">Only the GM can view this unit's attributes, gear, and life.</p>`
    : `<div class="board-empty-inline">Select a board token to view its details.</div>`;
  target.innerHTML = `<section class="board-side-panel"><div class="board-side-heading"><p class="section-kicker">TURN ORDER</p><h2>Initiative</h2></div>${renderInitiative()}</section>
    <section class="board-side-panel"><div class="board-side-heading"><p class="section-kicker">${boardIsGm ? "GM ROLLS" : "CHARACTER ROLLS"}</p><h2>${boardIsGm ? "Skill / attack check" : "Roll from your sheet"}</h2></div>${boardIsGm && character ? `<form class="board-roll-form" id="board-roll-form">
      <label class="board-form-field"><span>Character</span><select id="roll-character">${characterOptions}</select></label>
      <div class="board-form-split"><label class="board-form-field"><span>Attribute</span><select id="roll-attribute">${ATTRIBUTES.map(attribute => `<option value="${attribute}" ${attribute === boardRollAttribute ? "selected" : ""}>${attribute} · ${escapeHtml(character.attributes?.[attribute] ?? 0)}</option>`).join("")}</select></label><label class="board-form-field"><span>Skill</span><select id="roll-skill">${skillOptions}</select></label></div>
      <label class="board-form-field"><span>Weapon (attack only)</span><select id="roll-weapon"><option value="" ${boardRollWeapon ? "" : "selected"}>No weapon selected</option>${weaponOptions.replace(`value="${escapeHtml(boardRollWeapon)}"`, `value="${escapeHtml(boardRollWeapon)}" selected`)}</select></label>
      <div class="board-form-split"><label class="board-form-field"><span>Target</span><input id="roll-target" type="number" value="${escapeHtml(boardRollTarget)}"></label><label class="board-form-field"><span>Modifier</span><input id="roll-modifier" type="number" value="${escapeHtml(boardRollModifier)}"></label></div>
      <p class="roll-formula">1d10 + attribute + skill + modifier vs target. Damage is entered separately.</p>
      <div class="roll-buttons"><button class="button button-primary" type="button" data-action="roll" data-roll-kind="skill">Roll skill</button><button class="button" type="button" data-action="roll" data-roll-kind="attack">Roll attack</button></div>
    </form>` : boardIsGm ? `<div class="board-empty-inline">Create a character before rolling from the board.</div>` : `<div class="board-empty-inline">Players roll from their own character sheet. Linked character rolls appear in this campaign feed.</div>`}</section>
    <section class="board-side-panel"><div class="board-side-heading"><p class="section-kicker">LIFE TRACKER</p><h2>Health change</h2></div>${healthPanel}</section>
    <section class="board-side-panel board-activity-panel"><div class="board-side-heading"><p class="section-kicker">LIVE CAMPAIGN FEED</p><h2>Table activity</h2></div>${renderBoardEvents()}</section>`;
}

function renderBoard() {
  const campaign = workspace.campaigns.find(item => item.id === activeBoardCampaignId);
  const campaignName = campaign?.name || activeBoardCampaignName || "Shared campaign";
  const nameNode = document.getElementById("board-campaign-name");
  const codeNode = document.getElementById("board-room-code");
  const statusNode = document.getElementById("board-connection-status");
  const connectButton = document.getElementById("board-connect");
  const gmControls = document.getElementById("board-gm-controls");
  if (!nameNode || !codeNode || !statusNode || !connectButton) return;
  nameNode.textContent = `${campaignName} · ${activeBoardCampaignId ? "Room " + activeBoardCampaignId : "No room selected"}`;
  codeNode.textContent = activeBoardCampaignId || "—";
  statusNode.classList.toggle("connected", connectionStatus === "LIVE");
  statusNode.innerHTML = `<span class="connection-dot"></span> ${escapeHtml(connectionStatus)}`;
  connectButton.textContent = connectionStatus === "LIVE" ? "Reconnect" : connectionStatus === "CONNECTING" ? "Connecting…" : "Connect to campaign";
  gmControls.hidden = !boardIsGm;
  document.querySelector(".board-instructions [data-action=\"remove-board-piece\"]")?.toggleAttribute("hidden", !boardIsGm);
  document.querySelector(".gm-key-entry")?.toggleAttribute("hidden", boardIsGm);
  renderPalette();
  const topRuler = document.getElementById("board-ruler-top");
  const leftRuler = document.getElementById("board-ruler-left");
  const grid = document.getElementById("board-grid");
  if (!topRuler || !leftRuler || !grid) return;
  topRuler.innerHTML = Array.from({ length: BOARD_COLUMNS + 1 }, (_, index) => `<span>${index * 2}</span>`).join("");
  leftRuler.innerHTML = Array.from({ length: BOARD_ROWS }, (_, index) => `<span>${index * 2}</span>`).join("");
  const pieces = [
    ...boardState.terrain.map(piece => ({ ...piece, renderKind: "terrain" })),
    ...boardState.tokens.map(piece => ({ ...piece, renderKind: "token" }))
  ];
  grid.innerHTML = pieces.map(piece => {
    const ownCharacter = piece.renderKind === "token" && piece.kind === "character" && piece.ownerUserId === signedInAccount?.id;
    const canSeeStats = boardIsGm || ownCharacter;
    const canMove = boardIsGm || ownCharacter;
    const life = canSeeStats ? `<span class="piece-life">${escapeHtml(piece.health?.current ?? 0)}${piece.health?.max ? `/${escapeHtml(piece.health.max)}` : ""}</span>` : "";
    return `<button class="board-piece ${piece.renderKind === "token" ? `board-token ${piece.kind === "enemy" ? "enemy-token" : "character-token"}` : "terrain-piece"} ${piece.id === selectedBoardPieceId ? "piece-selected" : ""}" type="button" draggable="${canMove}" role="gridcell" data-piece-id="${escapeHtml(piece.id)}" data-piece-kind="${piece.renderKind}" aria-label="${escapeHtml(piece.name)}, ${piece.width * 2} by ${piece.height * 2} meters" style="grid-column:${piece.x + 1}/span ${piece.width};grid-row:${piece.y + 1}/span ${piece.height};${piece.renderKind === "terrain" ? `--piece-color:${escapeHtml(piece.color)}` : ""}">${piece.renderKind === "token" ? `${piece.portraitUrl ? `<img class="piece-portrait" src="${escapeHtml(piece.portraitUrl)}" alt="">` : `<span class="piece-initials">${escapeHtml(initials(piece.name))}</span>`}<span class="piece-label">${escapeHtml(piece.name)}</span>${life}` : `<span class="piece-label">${escapeHtml(piece.name)}</span>`}</button>`;
  }).join("");
  renderBoardSide();
}

function boardPositionFromEvent(event) {
  const grid = document.getElementById("board-grid");
  const rect = grid.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(BOARD_COLUMNS - 1, Math.floor((event.clientX - rect.left) / BOARD_CELL_SIZE))),
    y: Math.max(0, Math.min(BOARD_ROWS - 1, Math.floor((event.clientY - rect.top) / BOARD_CELL_SIZE)))
  };
}

function sendBoardUpdate() {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN || connectionStatus !== "LIVE") {
    showToast("Connect to the campaign room before changing its shared board.", true);
    return false;
  }
  activeSocket.send(JSON.stringify({ type: "board-update", board: boardState }));
  return true;
}

function addBoardPiece(kind, index, position = { x: 0, y: 0 }) {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN || connectionStatus !== "LIVE") return showToast("Connect to the campaign room before adding board pieces.", true);
  if (kind === "character") {
    if (!boardIsGm) return showToast("Only the GM can place campaign characters.", true);
    const character = campaignRoster[index];
    if (!character) return;
    if (boardState.tokens.some(token => token.characterId === character.id)) return showToast("That character is already on the board.");
    const token = {
      id: makeId(), kind: "character", name: character.name, role: character.role || "Character",
      x: Math.min(position.x, BOARD_COLUMNS - 1), y: Math.min(position.y, BOARD_ROWS - 1),
      width: 1, height: 1, attributes: character.attributes || {},       gear: [...new Set([...(character.inventory || []).map(item => item.name), ...workspace.gear.filter(item => item.characterId === character.id).map(item => item.name)])],
      health: { current: character.healthCurrent ?? 0, max: character.healthMax ?? 0 },
      initiative: 0, characterId: character.id, ownerUserId: character.ownerUserId, portraitUrl: character.portraitUrl || ""
    };
    boardState.tokens.push(token);
    selectedBoardTokenId = token.id;
    selectedBoardPieceId = token.id;
    selectedBoardPieceKind = "token";
    sendBoardUpdate();
    renderBoard();
    return;
  }
  if ((kind === "terrain" || kind === "enemy") && !boardIsGm) return showToast("Only the GM can place terrain or enemies.", true);
  if (kind === "terrain") {
    const template = TERRAIN_TEMPLATES[index];
    if (!template) return;
    boardState.terrain.push({
      id: makeId(), name: template.name, x: Math.min(position.x, BOARD_COLUMNS - Math.ceil(template.widthMeters / 2)),
      y: Math.min(position.y, BOARD_ROWS - Math.ceil(template.heightMeters / 2)),
      width: Math.ceil(template.widthMeters / 2), height: Math.ceil(template.heightMeters / 2), color: template.color
    });
    selectedBoardPieceId = boardState.terrain.at(-1).id;
    selectedBoardPieceKind = "terrain";
  } else {
    const template = enemyTemplates[index];
    if (!template) return;
    const token = {
      id: makeId(), kind: "enemy", name: template.name, role: template.role,
      x: Math.min(position.x, BOARD_COLUMNS - 1), y: Math.min(position.y, BOARD_ROWS - 1),
      width: 1, height: 1, attributes: template.attributes, gear: template.gear,
      health: template.health, initiative: 0, characterId: ""
    };
    boardState.tokens.push(token);
    selectedBoardTokenId = token.id;
    selectedBoardPieceId = token.id;
    selectedBoardPieceKind = "token";
  }
  sendBoardUpdate();
  renderBoard();
}

function addCharacterToken(characterId) {
  if (!boardIsGm) return showToast("The GM places campaign character tokens from the Party tab.", true);
  const character = selectedCharacter(characterId);
  if (!character) return;
  const existing = boardState.tokens.find(token => token.characterId === character.id);
  if (existing) {
    selectedBoardTokenId = existing.id;
    renderBoard();
    return;
  }
  const token = {
    id: makeId(), kind: "character", name: character.name, role: character.role || "Character",
    x: Math.min(boardState.tokens.length % BOARD_COLUMNS, BOARD_COLUMNS - 1),
    y: Math.min(Math.floor(boardState.tokens.length / BOARD_COLUMNS) % BOARD_ROWS, BOARD_ROWS - 1),
    width: 1, height: 1, attributes: character.attributes || {}, gear: [...(character.inventory || []).map(item => item.name), ...workspace.gear.filter(item => item.characterId === character.id).map(item => item.name)],
    health: { current: character.healthCurrent ?? 0, max: character.healthMax ?? 0 }, initiative: 0, characterId: character.id, ownerUserId: signedInAccount?.id || "", portraitUrl: character.portraitUrl || ""
  };
  boardState.tokens.push(token);
  selectedBoardTokenId = token.id;
  selectedBoardPieceId = token.id;
  selectedBoardPieceKind = "token";
  sendBoardUpdate();
  renderBoard();
}

function updateBoardPosition(event) {
  const raw = event.dataTransfer?.getData("application/afterdark-piece");
  if (!raw) return;
  let dragged;
  try {
    dragged = JSON.parse(raw);
  } catch (error) {
    console.warn("Ignored invalid board drag data.", error);
    return;
  }
  const position = boardPositionFromEvent(event);
  if (dragged.source === "palette") {
    addBoardPiece(dragged.kind, dragged.index, position);
    return;
  }
  if (dragged.source === "board") {
    const collection = dragged.kind === "token" ? boardState.tokens : boardState.terrain;
    const piece = collection.find(item => item.id === dragged.id);
    if (!piece) return;
    piece.x = Math.min(position.x, BOARD_COLUMNS - piece.width);
    piece.y = Math.min(position.y, BOARD_ROWS - piece.height);
    selectedBoardPieceId = piece.id;
    selectedBoardPieceKind = dragged.kind;
    sendBoardUpdate();
    renderBoard();
  }
}

function setInitiative(tokenId, value) {
  const token = boardState.tokens.find(item => item.id === tokenId);
  const initiative = Number(value);
  if (!token || !Number.isFinite(initiative)) return;
  token.initiative = Math.max(-1000, Math.min(1000, Math.trunc(initiative)));
  sendBoardUpdate();
  renderBoard();
}

function sendRoomEvent(event) {
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN || connectionStatus !== "LIVE") {
    showToast("Connect to the campaign room before rolling or changing life.", true);
    return false;
  }
  activeSocket.send(JSON.stringify({ type: "event", event }));
  return true;
}

function performSheetSkillRoll(characterId) {
  const character = selectedCharacter(characterId);
  if (!character) return showToast("Choose a character before rolling.", true);
  const skillSelect = document.getElementById("sheet-skill-select");
  const skillOption = skillSelect?.selectedOptions[0];
  const attribute = document.getElementById("sheet-skill-attribute")?.value || "REF";
  const modifier = Number(document.getElementById("sheet-roll-modifier")?.value || 0);
  const target = Number(document.getElementById("sheet-roll-target")?.value);
  if (!Number.isFinite(target) || !Number.isFinite(modifier)) return showToast("Enter a valid target and modifier.", true);
  const skillValue = Number(skillOption?.dataset.skillValue || 0);
  const naturalSkillValue = Number(skillOption?.dataset.naturalSkillValue || 0);
  const chipBonus = Number(skillOption?.dataset.chipBonus || 0);
  const base = Number(character.attributes?.[attribute] || 0);
  const die = rollD10();
  const total = die + base + skillValue + modifier;
  const skillName = skillOption?.value || "";
  const skillBreakdown = chipBonus ? `${naturalSkillValue} natural + ${chipBonus} chip = ${skillValue}` : `${skillValue}`;
  const result = `Skill check: d10 ${die} + ${attribute} ${base} + ${skillName || "no skill"} ${skillBreakdown} + modifier ${modifier} = ${total} vs ${target}. ${total >= target ? "Success" : "Failure"}.`;
  rememberSheetRoll(character, result);
  publishCharacterRoll(character, {
    rollKind: "skill", skill: skillName, attribute, die, base, skillValue, modifier, total, target, success: total >= target
  });
}

function performSheetAttackRoll(button) {
  const character = selectedCharacter(button.dataset.characterId);
  const item = itemsForCharacter(character).find(entry => entry.id === button.dataset.id);
  if (!character || !item || !item.equipped || !isWeaponItem(item)) {
    return showToast("Equip a weapon in this character's gear before making an attack roll.", true);
  }
  const combat = weaponCombatData(item);
  const input = document.getElementById(button.dataset.roundsInputId);
  const roundsFired = Number(input?.value);
  const maximumRounds = combat.rateOfFire || combat.capacity || 1;
  if (!Number.isInteger(roundsFired) || roundsFired < 1 || roundsFired > maximumRounds) {
    return showToast(`Rounds fired must be from 1 to ${maximumRounds}.`, true);
  }
  const skill = weaponSkillFor(character, item);
  const base = Number(character.attributes?.REF || 0);
  const bonus = base + skill.value;
  const die = rollD10();
  const total = die + bonus;
  const skillBreakdown = skill.chipBonus ? `${skill.naturalValue} natural + ${skill.chipBonus} chip = ${skill.value}` : `${skill.value}`;
  const result = `Hit roll with ${item.name}: d10 ${die} + ${skill.name} ${skillBreakdown} + REF ${base} = ${total}. The GM confirms whether it hits; damage is handled by the character who is hit.`;
  rememberSheetRoll(character, result);
  publishCharacterRoll(character, {
    rollKind: "attack", skill: skill.name, attribute: "REF", base, skillValue: skill.value, modifier: 0,
    die, total, target: 0, success: false, weapon: item.name, ammoType: combat.ammoType,
    damageFormula: combat.damageFormula, roundsFired
  });
}

function performSheetDamageRoll(button) {
  const character = selectedCharacter(button.dataset.characterId);
  const item = itemsForCharacter(character).find(entry => entry.id === button.dataset.id);
  if (!character || !item || !item.equipped || !isWeaponItem(item)) {
    return showToast("Equip a weapon in this character's gear before rolling damage.", true);
  }
  const formula = weaponCombatData(item).damageFormula;
  const parsed = parseDamageFormula(formula);
  if (!parsed) return showToast(`Could not roll the damage formula for ${item.name}.`, true);
  const dice = Array.from({ length: parsed.count }, () => rollDie(parsed.sides));
  const total = dice.reduce((sum, result) => sum + result, parsed.modifier);
  const modifier = parsed.modifier ? ` ${parsed.modifier > 0 ? "+" : "−"} ${Math.abs(parsed.modifier)}` : "";
  rememberSheetRoll(character, `Damage roll with ${item.name}: ${parsed.count}d${parsed.sides} [${dice.join(", ")}]${modifier} = ${total}.`);
}

function performRoll(rollKind) {
  if (!boardIsGm) return showToast("Players roll from their own character sheet.", true);
  const character = boardRollCharacters().find(item => item.id === document.getElementById("roll-character")?.value);
  if (!character) return showToast("Choose a character before rolling.", true);
  const skillSelect = document.getElementById("roll-skill");
  const selectedSkill = skillSelect?.selectedOptions[0];
  const skillName = selectedSkill?.value || "";
  const skillValue = Number(selectedSkill?.dataset.skillValue || 0);
  const attribute = document.getElementById("roll-attribute")?.value || "REF";
  const base = Number(character.attributes?.[attribute] || 0);
  const modifier = Number(document.getElementById("roll-modifier")?.value || 0);
  const target = Number(document.getElementById("roll-target")?.value);
  if (!Number.isFinite(target) || !Number.isFinite(modifier)) return showToast("Enter a valid target and modifier.", true);
  const dieResult = rollD10();
  const total = dieResult + base + skillValue + modifier;
  const weapon = rollKind === "attack" ? document.getElementById("roll-weapon")?.value || "" : "";
  if (!sendRoomEvent({
    source: "board", kind: "roll", rollKind, characterId: character.id, characterName: character.name, skill: skillName, attribute, weapon,
    die: dieResult, base, skillValue, modifier, total, target, success: total >= target
  })) return;
  showToast(`${rollKind === "attack" ? "Attack" : "Skill"} roll sent to the campaign.`);
}

function adjustSelectedHealth(deltaSign) {
  const token = boardState.tokens.find(item => item.id === selectedBoardTokenId);
  const canAdjust = boardIsGm || (token?.kind === "character" && token.ownerUserId === signedInAccount?.id);
  if (!canAdjust) return showToast("Only the GM or the character's owner can change this unit's life.", true);
  if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN || connectionStatus !== "LIVE") {
    return showToast("Connect to the campaign room before changing life.", true);
  }
  const amount = Math.max(1, Math.min(9999, Number(document.getElementById("health-adjust")?.value || 1)));
  if (!token || !Number.isFinite(amount)) return showToast("Select a board token and a valid life amount.", true);
  const delta = Math.trunc(amount) * deltaSign;
  const maximum = Number(token.health?.max || 0);
  const previous = Number(token.health?.current || 0);
  const current = maximum > 0 ? Math.max(0, Math.min(maximum, previous + delta)) : Math.max(0, previous + delta);
  const actualDelta = current - previous;
  if (!actualDelta) return showToast("No life change to apply.", true);
  token.health = { current, max: maximum };
  sendRoomEvent({ kind: "health", characterId: token.characterId || token.id, characterName: token.name, delta: actualDelta, current, max: maximum });
  renderBoard();
  showToast(`${token.name} ${actualDelta > 0 ? "gained" : "lost"} ${Math.abs(actualDelta)} life.`);
}

async function copyRoomCode(campaignId) {
  const code = campaignId || activeBoardCampaignId;
  if (!code) return showToast("Open a campaign board before copying a room code.", true);
  try {
    await navigator.clipboard.writeText(code);
    showToast("Campaign room code copied.");
  } catch (error) {
    console.warn("Clipboard access was unavailable.", error);
    showToast(`Copy this room code: ${code}`);
  }
}

async function copyGmKey() {
  const key = storedGmKey(activeBoardCampaignId);
  if (!key) return showToast("No private GM key is saved in this browser tab.", true);
  try {
    await navigator.clipboard.writeText(key);
    showToast("Private GM key copied. Share it only with the game master.");
  } catch (error) {
    console.warn("Clipboard access was unavailable.", error);
    showToast(`Private GM key: ${key}`);
  }
}

const campaignRoomSetups = new Map();

async function ensureCampaignRoom(campaign) {
  if (!signedInAccount) throw new Error("Sign in before creating a campaign room.");
  if (campaign.isJoined) return "";
  if (campaignRoomSetups.has(campaign.id)) return campaignRoomSetups.get(campaign.id);
  const setup = (async () => {
    let gmKey = storedGmKey(campaign.id);
    if (!gmKey) {
      let room = await apiRequest(`/api/campaigns/${encodeURIComponent(campaign.id)}`, {
        method: "POST", body: JSON.stringify({ name: campaign.name })
      });
      if (!room.gmKey) room = await apiRequest(`/api/campaigns/${encodeURIComponent(campaign.id)}/host`, {
        method: "POST", body: JSON.stringify({ name: campaign.name })
      });
      gmKey = room.gmKey;
      if (gmKey) storeGmKey(campaign.id, gmKey);
    }
    return gmKey;
  })();
  campaignRoomSetups.set(campaign.id, setup);
  try {
    return await setup;
  } finally {
    if (campaignRoomSetups.get(campaign.id) === setup) campaignRoomSetups.delete(campaign.id);
  }
}

function connectToCampaign(campaignId, campaignName, userName, gmKey = "") {
  if (!signedInAccount) return showToast("Sign in before joining a shared campaign.", true);
  if (!campaignId) return showToast("Select or join a campaign first.", true);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(campaignId)) return showToast("That campaign room code is invalid.", true);
  const cleanName = String(userName || signedInAccount.username).trim().slice(0, 50) || signedInAccount.username;
  activeBoardCampaignId = campaignId;
  activeBoardCampaignName = campaignName || "Shared campaign";
  activeGmKey = gmKey;
  boardIsGm = false;
  enemyTemplates = [];
  boardState = { tokens: [], terrain: [] };
  roomEvents = [];
  selectedBoardTokenId = "";
  selectedBoardPieceId = "";
  campaignRoster = [];
  workspace.playerName = cleanName;
  document.getElementById("board-player-name").value = cleanName;
  if (activeSocket) {
    activeSocket.onclose = null;
    activeSocket.close();
  }
  connectionStatus = "CONNECTING";
  renderBoard();
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const query = new URLSearchParams({ campaignId });
  const socket = new WebSocket(`${protocol}//${location.host}/ws?${query}`);
  activeSocket = socket;
  connectedCampaignId = campaignId;
  socket.addEventListener("open", () => {
    if (activeSocket !== socket) return;
    connectionStatus = "CONNECTING";
    if (activeGmKey) socket.send(JSON.stringify({ type: "gm-auth", key: activeGmKey }));
    renderBoard();
  });
  socket.addEventListener("message", messageEvent => {
    if (activeSocket !== socket) return;
    let message;
    try {
      message = JSON.parse(messageEvent.data);
    } catch (error) {
      console.error("Could not read the campaign server message.", error);
      showToast("Received an unreadable update from the campaign server.", true);
      return;
    }
    if (message.type === "room-state") {
      activeBoardCampaignName = message.room.name;
      boardState = message.room.board || { tokens: [], terrain: [] };
      roomEvents = message.room.events || [];
      const localCampaign = workspace.campaigns.find(item => item.id === campaignId);
      if (!localCampaign) {
        workspace.campaigns.push({ id: campaignId, name: activeBoardCampaignName, gm: "", description: "Joined shared campaign.", characterIds: [], sessions: [], isJoined: true });
      }
      saveWorkspace();
      renderBoard();
      refreshCampaignRoster();
      return;
    }
    if (message.type === "role") {
      connectionStatus = "LIVE";
      boardIsGm = message.role === "gm";
      if (boardIsGm) void refreshEnemyTemplates();
      else enemyTemplates = [];
      campaignPlayerCount = message.playerCount ?? campaignPlayerCount;
      renderBoard();
      refreshCampaignRoster();
      if (pendingBoardCharacterId) {
        const characterId = pendingBoardCharacterId;
        pendingBoardCharacterId = "";
        if (boardIsGm) addCharacterToken(characterId);
        else void linkCharacterToRoom(characterId);
      }
      return;
    }
    if (message.type === "roster-state") {
      campaignRoster = message.roster || [];
      campaignPlayerCount = message.playerCount ?? campaignPlayerCount;
      renderBoard();
      return;
    }
    if (message.type === "presence") {
      campaignPlayerCount = message.playerCount ?? campaignPlayerCount;
      renderPalette();
      return;
    }
    if (message.type === "board-state") {
      boardState = message.board || { tokens: [], terrain: [] };
      if (!boardState.tokens.some(item => item.id === selectedBoardTokenId)) selectedBoardTokenId = boardState.tokens[0]?.id || "";
      renderBoard();
      return;
    }
    if (message.type === "room-history") {
      roomEvents = message.events || [];
      renderBoardSide();
      return;
    }
    if (message.type === "room-event") {
      const item = message.event;
      if (!roomEvents.some(event => event.id === item.id)) roomEvents.push(item);
      roomEvents = roomEvents.slice(-80);
      if (item.kind === "health" && item.characterId) {
        const character = selectedCharacter(item.characterId);
        if (character && item.ownerUserId === signedInAccount?.id && item.current != null) {
          void saveCharacterHealth(character, item.current);
          return;
        }
      }
      renderBoardSide();
      return;
    }
    if (message.type === "error") showToast(message.message || "The campaign server rejected an update.", true);
  });
  socket.addEventListener("close", () => {
    if (activeSocket !== socket) return;
    connectionStatus = "OFFLINE";
    boardIsGm = false;
    enemyTemplates = [];
    boardState = { tokens: [], terrain: [] };
    roomEvents = [];
    selectedBoardTokenId = "";
    selectedBoardPieceId = "";
    renderBoard();
  });
  socket.addEventListener("error", error => {
    console.error("Could not connect to the campaign WebSocket.", error);
    if (activeSocket === socket) {
      connectionStatus = "OFFLINE";
      boardIsGm = false;
      enemyTemplates = [];
      boardState = { tokens: [], terrain: [] };
      roomEvents = [];
      selectedBoardTokenId = "";
      selectedBoardPieceId = "";
      renderBoard();
      showToast("Could not reach the campaign server. Start it with npm start and try again.", true);
    }
  });
  renderBoard();
}

async function openCampaignBoard(campaign, characterId = "") {
  if (!campaign) return showToast("That campaign could not be found.", true);
  if (!signedInAccount) return showToast("Sign in before opening a campaign board.", true);
  activeBoardCampaignId = campaign.id;
  activeBoardCampaignName = campaign.name;
  pendingBoardCharacterId = characterId;
  showView("board");
  renderBoard();
  if (activeSocket?.readyState === WebSocket.OPEN && connectionStatus === "LIVE" && connectedCampaignId === campaign.id) {
    if (characterId) {
      if (boardIsGm) addCharacterToken(characterId);
      else void linkCharacterToRoom(characterId);
    }
    pendingBoardCharacterId = "";
    return;
  }
  if (activeSocket?.readyState === WebSocket.OPEN && connectionStatus === "CONNECTING" && connectedCampaignId === campaign.id) return;
  let gmKey;
  try {
    gmKey = await ensureCampaignRoom(campaign);
  } catch (error) {
    showToast(error.message || "Could not create or join this campaign room.", true);
    return;
  }
  const typedKey = document.getElementById("board-gm-key").value.trim();
  connectToCampaign(campaign.id, campaign.name, document.getElementById("board-player-name").value || signedInAccount.username, typedKey || gmKey);
}

function openCharacterBoard(character) {
  if (!character) return;
  let campaign = workspace.campaigns.find(item => (item.characterIds ?? []).includes(character.id));
  if (!campaign) campaign = workspace.campaigns[0];
  if (!campaign) return showToast("Create or join a campaign before opening a shared board.", true);
  if (!(campaign.characterIds ?? []).includes(character.id)) {
    campaign.characterIds = [...(campaign.characterIds ?? []), character.id];
    workspace.demo = false;
    saveWorkspace();
  }
  openCampaignBoard(campaign, character.id);
}

function openJoinCampaignForm(campaignId = "") {
  if (!signedInAccount) return openAuthForm("login");
  const body = `${field("Campaign room code", "campaignId", campaignId, { required: true, hint: "Ask the campaign host to share the room code from their campaign card." })}${field("Your table name", "playerName", workspace.playerName || signedInAccount.username, { required: true })}${field("Private GM key (optional)", "gmKey", "", { hint: "Only the GM should enter this. Players leave it blank." })}`;
  dialogContent.innerHTML = formShell("Join a shared campaign", "Connect to a campaign room on the same running Afterdark server.", "join-form", body, "Join campaign");
  dialog.showModal();
  dialogContent.querySelector('[name="campaignId"]').focus();
}

function normalizeEnteredRoomId(value) {
  return String(value || "").trim();
}

function joinSharedCampaign(form) {
  const data = new FormData(form);
  const campaignId = normalizeEnteredRoomId(data.get("campaignId"));
  const playerName = String(data.get("playerName") || "").trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(campaignId) || !playerName) return showToast("Enter a valid room code and table name.", true);
  dialog.close();
  activeBoardCampaignId = campaignId;
  activeBoardCampaignName = "Shared campaign";
  pendingBoardCharacterId = "";
  showView("board");
  document.getElementById("board-player-name").value = playerName;
  document.getElementById("board-gm-key").value = String(data.get("gmKey") || "");
  connectToCampaign(campaignId, "", playerName, String(data.get("gmKey") || ""));
}

function renderAll() {
  renderDashboard();
  renderCharacters();
  renderCampaigns();
  renderSheet();
  renderBoard();
  document.getElementById("character-count").textContent = workspace.characters.length;
  updateAccountControls();
}

function showView(view) {
  if (!VIEWS[view]) return;
  if (view === "sheet") {
    const character = selectedCharacter(selectedSheetCharacterId) || workspace.characters[0];
    if (character) {
      selectedSheetCharacterId = character.id;
      recordCharacterOpened(character.id);
    }
  }
  activeView = view;
  document.querySelectorAll(".view-panel").forEach(panel => {
    const active = panel.id === `view-${view}`;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  document.getElementById("crumb-current").textContent = VIEWS[view];
}

function field(label, name, value = "", options = {}) {
  const required = options.required ? "required" : "";
  const full = options.full ? " full" : "";
  const hint = options.hint ? `<span class="field-hint">${escapeHtml(options.hint)}</span>` : "";
  if (options.textarea) {
    return `<label class="form-field${full}"><span class="field-label">${escapeHtml(label)}</span><textarea class="field-textarea" name="${escapeHtml(name)}" ${required} ${options.rows ? `rows="${options.rows}"` : ""}>${escapeHtml(value)}</textarea>${hint}</label>`;
  }
  const type = options.type || "text";
  const attrs = options.min != null ? `min="${options.min}"` : "";
  return `<label class="form-field${full}"><span class="field-label">${escapeHtml(label)}</span><input class="field-input" type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${required} ${attrs}>${hint}</label>`;
}

function selectField(label, name, options, selected, allowBlank = false) {
  const rows = options.map(option => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
  return `<label class="form-field"><span class="field-label">${escapeHtml(label)}</span><select class="field-select" name="${escapeHtml(name)}">${allowBlank ? `<option value="">Unassigned</option>` : ""}${rows}</select></label>`;
}

function bodyStatusFields(character) {
  const rows = BODY_LOCATIONS.map(({ key, label }) => {
    const health = character?.bodyHealth?.[key] || {};
    const armorSP = character?.bodyArmorSP?.[key] ?? "";
    return `<div class="body-status-edit-row"><strong>${escapeHtml(label)}</strong><label><span>Current</span><input class="field-input" type="number" min="0" max="9999" step="1" name="body-${key}-current" value="${escapeHtml(health.current ?? "")}" aria-label="${escapeHtml(label)} current limb health"></label><label><span>Max</span><input class="field-input" type="number" min="0" max="9999" step="1" name="body-${key}-max" value="${escapeHtml(health.max ?? "")}" aria-label="${escapeHtml(label)} maximum limb health"></label><label><span>Armor SP</span><input class="field-input" type="number" min="0" max="9999" step="1" name="armor-${key}-sp" value="${escapeHtml(armorSP)}" aria-label="${escapeHtml(label)} armor SP"></label></div>`;
  }).join("");
  return `<section class="form-field full body-status-fields"><div><span class="field-label">Limb health and body armor</span><span class="field-hint">Manual values only. Armor and damage rules can be added later.</span></div><div class="body-status-edit-grid">${rows}</div></section>`;
}

function formShell(title, subtitle, formName, body, submitLabel = "Save changes") {
  return `<div class="dialog-head"><div><p class="eyebrow">AFTERDARK · YOUR TABLE</p><h2 id="dialog-title">${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button class="icon-button" type="button" data-action="close-dialog" aria-label="Close dialog">×</button></div>
    <form class="dialog-form" name="${escapeHtml(formName)}"><div class="form-grid">${body}</div><div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-dialog">Cancel</button><button class="button button-primary" type="submit">${escapeHtml(submitLabel)}</button></div></form>`;
}

function selectedAttributeRolls(form) {
  const rawRolls = String(form.elements.attributeRolls?.value ?? "").trim();
  if (!rawRolls) return null;
  const rolls = rawRolls.split(",").map(Number);
  return rolls.length === ATTRIBUTES.length && rolls.every(roll => Number.isInteger(roll) && roll >= 1 && roll <= 10) ? rolls : null;
}

function selectedAttributePointPool(form) {
  const method = form.querySelector('[name="attributeMethod"]:checked')?.value;
  if (method === "rolled") {
    const rolls = selectedAttributeRolls(form);
    return rolls ? rolls.reduce((sum, roll) => sum + roll, 0) : null;
  }
  if (method === "cinematic") {
    return CINEMATIC_ATTRIBUTE_TIERS.find(tier => tier.value === form.elements.cinematicTier.value)?.points ?? null;
  }
  return null;
}

function updateAttributeAllocation(form) {
  if (form.dataset.id) return;
  const method = form.querySelector('[name="attributeMethod"]:checked')?.value;
  const rollPanel = form.querySelector('[data-attribute-panel="rolled"]');
  const cinematicPanel = form.querySelector('[data-attribute-panel="cinematic"]');
  if (rollPanel) rollPanel.hidden = method !== "rolled";
  if (cinematicPanel) cinematicPanel.hidden = method !== "cinematic";
  const status = form.querySelector("#attribute-points-status");
  if (!status) return;
  const pool = selectedAttributePointPool(form);
  if (pool == null) {
    status.textContent = method === "cinematic"
      ? "Choose a cinematic tier to set the attribute point pool."
      : "Roll nine d10 to set the attribute point pool.";
    status.classList.remove("is-complete", "is-over");
    return;
  }
  const allocated = ATTRIBUTES.reduce((sum, attribute) => {
    const value = Number(form.elements.namedItem(`attr-${attribute}`).value);
    return sum + (Number.isInteger(value) && value >= 0 && value <= 10 ? value : 0);
  }, 0);
  const remaining = pool - allocated;
  status.textContent = remaining === 0
    ? `Allocated ${allocated} / ${pool} points. All points allocated.`
    : remaining > 0
      ? `Allocated ${allocated} / ${pool} points. ${remaining} left to allocate.`
      : `Allocated ${allocated} / ${pool} points. ${Math.abs(remaining)} over the pool.`;
  status.classList.toggle("is-complete", remaining === 0);
  status.classList.toggle("is-over", remaining < 0);
}

function rollAttributePointPool(form) {
  const rolls = Array.from({ length: ATTRIBUTES.length }, () => Math.floor(Math.random() * 10) + 1);
  form.querySelector('[name="attributeMethod"][value="rolled"]').checked = true;
  form.elements.attributeRolls.value = rolls.join(",");
  const total = rolls.reduce((sum, roll) => sum + roll, 0);
  form.querySelector("#attribute-roll-results").textContent = `9d10: ${rolls.join(" + ")} = ${total} points.`;
  updateAttributeAllocation(form);
}

function initialAttributeGeneration(form, allocated) {
  const method = form.querySelector('[name="attributeMethod"]:checked')?.value;
  if (method === "rolled") {
    const rolls = selectedAttributeRolls(form);
    if (!rolls) return null;
    const total = rolls.reduce((sum, roll) => sum + roll, 0);
    return allocated === total ? { method, rolls, total } : null;
  }
  if (method === "cinematic") {
    const tier = CINEMATIC_ATTRIBUTE_TIERS.find(option => option.value === form.elements.cinematicTier.value);
    return tier && allocated === tier.points ? { method, tier: tier.value, total: tier.points } : null;
  }
  return null;
}

function initialSkillGeneration(form) {
  const normalRows = [...form.querySelectorAll(".skill-picker-row")].filter(row => row.querySelector('[name="normalSkill"]').checked);
  const specialName = String(form.elements.specialSkill.value || "").trim();
  if (normalRows.length !== 9 || !specialName) return null;
  const skills = normalRows.map(row => ({
    name: row.querySelector('[name="normalSkill"]').value,
    value: Number(row.querySelector('[name="normalSkillPoints"]').value),
    special: false
  }));
  skills.push({
    name: specialName,
    value: Number(form.elements.specialSkillPoints.value),
    special: true
  });
  if (skills.some(skill => !Number.isInteger(skill.value) || skill.value < 1 || skill.value > 40)
    || skills.reduce((sum, skill) => sum + skill.value, 0) !== 40) return null;
  return {
    skills,
    generation: { method: "creation", normalSkills: skills.filter(skill => !skill.special).map(skill => skill.name), specialSkill: specialName, total: 40 }
  };
}

function updateSkillAllocation(form) {
  if (form.dataset.id) return;
  const rows = [...form.querySelectorAll(".skill-picker-row")];
  const selectedRows = rows.filter(row => row.querySelector('[name="normalSkill"]').checked);
  for (const row of rows) {
    const checkbox = row.querySelector('[name="normalSkill"]');
    const points = row.querySelector('[name="normalSkillPoints"]');
    points.disabled = !checkbox.checked;
    checkbox.disabled = selectedRows.length >= 9 && !checkbox.checked;
  }
  const specialName = String(form.elements.specialSkill.value || "").trim();
  const specialPoints = form.elements.specialSkillPoints;
  specialPoints.disabled = !specialName;
  const allocatedValues = selectedRows.map(row => Number(row.querySelector('[name="normalSkillPoints"]').value));
  if (specialName) allocatedValues.push(Number(specialPoints.value));
  const invalidPoints = allocatedValues.some(value => !Number.isInteger(value) || value < 1 || value > 40);
  const allocated = allocatedValues.reduce((sum, value) => sum + (Number.isInteger(value) ? value : 0), 0);
  const complete = selectedRows.length === 9 && Boolean(specialName) && !invalidPoints && allocated === 40;
  const status = form.querySelector("#skill-points-status");
  if (!status) return;
  status.textContent = `Normal skills: ${selectedRows.length} / 9. Special skill: ${specialName ? "selected" : "not selected"}. Points: ${allocated} / 40${invalidPoints ? " (each selected skill needs at least 1 whole point)" : ""}${allocated > 40 ? ` (${allocated - 40} over)` : ""}.`;
  status.classList.toggle("is-complete", complete);
  status.classList.toggle("is-over", invalidPoints || allocated > 40);
}

function startingSkillPicker() {
  const groups = NORMAL_SKILL_GROUPS.map((group, groupIndex) => `<section class="skill-picker-group"><h4>${escapeHtml(group.attribute)}</h4>${group.skills.map((skill, skillIndex) => {
    const id = `normal-skill-${groupIndex}-${skillIndex}`;
    return `<div class="skill-picker-row"><label for="${id}"><input id="${id}" type="checkbox" name="normalSkill" value="${escapeHtml(skill)}"><span>${escapeHtml(skill)}</span></label><input class="skill-point-input" type="number" name="normalSkillPoints" min="1" max="40" step="1" value="1" disabled aria-label="Points for ${escapeHtml(skill)}"></div>`;
  }).join("")}</section>`).join("");
  return `<section class="form-field full skill-creation-fields"><div><span class="field-label">Starting skills</span><span class="field-hint">Choose 9 normal skills and 1 special skill. Assign at least 1 point to each and spend exactly 40 points. This selection limit applies only to initial character creation; add more skills later by editing the character.</span></div><div class="skill-creation-grid"><section class="skill-picker-panel"><h3>Normal skills <span>Choose 9</span></h3><div class="skill-picker-list">${groups}</div></section><section class="skill-picker-panel special-skill-panel"><h3>Special skill <span>Choose 1</span></h3><label class="form-field"><span class="field-label">Special ability</span><select class="field-select" name="specialSkill"><option value="">Choose one</option>${SPECIAL_SKILLS.map(skill => `<option value="${escapeHtml(skill)}">${escapeHtml(skill)}</option>`).join("")}</select></label><label class="form-field"><span class="field-label">Points</span><input class="field-input skill-point-input" type="number" name="specialSkillPoints" min="1" max="40" step="1" value="1" disabled></label></section></div><div class="skill-points-status" id="skill-points-status" aria-live="polite">Normal skills: 0 / 9. Special skill: not selected. Points: 0 / 40.</div></section>`;
}

function openCharacterForm(character) {
  const attrs = ATTRIBUTES.map(attribute => `<label class="attribute-field"><span>${attribute}</span><input type="number" min="0" max="10" step="1" name="attr-${attribute}" value="${escapeHtml(character?.attributes?.[attribute] ?? (character ? "" : 0))}" aria-label="${attribute} attribute"></label>`).join("");
  const attributeCreation = character ? "" : `<div class="form-field full"><span class="field-label">Attribute point method</span><div class="attribute-method-options">
      <label><input type="radio" name="attributeMethod" value="rolled" checked> Roll 9d10</label>
      <label><input type="radio" name="attributeMethod" value="cinematic"> Cinematic point pool</label>
    </div></div>
    <div class="form-field full attribute-method-panel" data-attribute-panel="rolled"><span class="field-hint">Roll nine ten-sided dice, then allocate the entire total below.</span><button class="button button-quiet" type="button" data-action="roll-attribute-pool">Roll nine d10</button><span class="field-hint" id="attribute-roll-results" aria-live="polite">Roll the dice to determine your attribute points.</span></div>
    <label class="form-field full attribute-method-panel" data-attribute-panel="cinematic" hidden><span class="field-label">Cinematic tier</span><select class="field-select" name="cinematicTier"><option value="">Choose a tier</option>${CINEMATIC_ATTRIBUTE_TIERS.map(tier => `<option value="${tier.value}">${tier.label} — ${tier.points} points</option>`).join("")}</select></label>
    <input type="hidden" name="attributeRolls" value="">
    <div class="attribute-points-status form-field full" id="attribute-points-status" aria-live="polite"></div>`;
  const skillFields = character
    ? field("Skills", "skills", skillText(character.skills ?? []), { full: true, hint: "Separate skills with commas. Add a table-entered value with a colon, e.g. Handgun: 6. You can add skills beyond the initial creation selections." })
    : startingSkillPicker();
  const body = `${field("Character name", "name", character?.name ?? "", { required: true })}${field("Role / class", "role", character?.role ?? "")}
    ${field("Handle / callsign", "handle", character?.handle ?? "")}${attributeCreation}<div class="form-field full"><span class="field-label">Attributes</span><div class="attributes-form">${attrs}</div></div>
    ${skillFields}
    ${bodyStatusFields(character)}
    ${field("Current life", "healthCurrent", character?.healthCurrent ?? "", { type: "number", min: 0 })}
    ${field("Maximum life", "healthMax", character?.healthMax ?? "", { type: "number", min: 0, hint: "Leave blank if your table does not track a maximum." })}
    <label class="form-field full"><span class="field-label">Portrait</span><input class="field-input" type="file" name="portrait" accept="image/jpeg,image/png,image/webp"><span class="field-hint">Optional JPEG, PNG, or WebP image up to 2 MB. Stored on this app server.</span></label>
    ${field("Custom derived values", "derived", (character?.derived ?? []).join("\\n"), { full: true, textarea: true, hint: "One per line, such as Initiative: 8. Values are user-defined, not rule calculations." })}
    ${field("History", "history", character?.history ?? "", { full: true, textarea: true })}
    ${field("Notes", "notes", character?.notes ?? "", { full: true, textarea: true })}`;
  dialogContent.innerHTML = formShell(character ? "Edit character" : "Create a character", character ? "Build a sheet with the details that matter at your table." : "Roll 9d10 or choose a cinematic pool; allocate every point, with a maximum of 10 per attribute.", "character-form", body, character ? "Save character" : "Create character");
  if (character) dialogContent.querySelector("form").dataset.id = character.id;
  dialog.showModal();
  if (!character) {
    const form = dialogContent.querySelector('form[name="character-form"]');
    updateAttributeAllocation(form);
    updateSkillAllocation(form);
  }
  dialogContent.querySelector('[name="name"]').focus();
}

function openCampaignForm(campaign) {
  const options = workspace.characters.map(character => `<option value="${escapeHtml(character.id)}" ${(campaign?.characterIds ?? []).includes(character.id) ? "selected" : ""}>${escapeHtml(character.name)}</option>`).join("");
  const friendOptions = friendData.friends.map(friend => `<option value="${escapeHtml(friend.id)}">${escapeHtml(friend.username)}</option>`).join("");
  const gameMasterField = signedInAccount && !campaign?.isJoined
    ? `<label class="form-field"><span class="field-label">Game master</span><input class="field-input" type="text" value="${escapeHtml(campaign?.gm || signedInAccount.username)}" readonly><span class="field-hint">The account that creates this campaign is its game master.</span></label>`
    : field("Game master / organizer", "gm", campaign?.gm ?? "");
  const body = `${field("Campaign name", "name", campaign?.name ?? "", { required: true })}${gameMasterField}
    ${field("Campaign notes", "description", campaign?.description ?? "", { full: true, textarea: true })}
    <label class="form-field full"><span class="field-label">Linked characters</span><select class="field-select" name="characterIds" multiple size="${Math.max(3, Math.min(6, workspace.characters.length || 3))}" aria-describedby="campaign-character-hint">${options}</select><span class="field-hint" id="campaign-character-hint">Use Ctrl (Windows) or Command (Mac) to select multiple characters.</span></label>
    ${!campaign && signedInAccount ? `<label class="form-field full"><span class="field-label">Invite a friend</span><select class="field-select" name="inviteFriendId"><option value="">Create without an invite</option>${friendOptions}</select><span class="field-hint">${friendOptions ? "The friend will receive a direct message with a link to join this campaign." : "Add a friend before creating the campaign to send an invite."}</span></label>` : ""}`;
  dialogContent.innerHTML = formShell(campaign ? "Edit campaign" : "Create a campaign", "Keep your crew and campaign notes together.", "campaign-form", body, campaign ? "Save campaign" : "Create campaign");
  if (campaign) dialogContent.querySelector("form").dataset.id = campaign.id;
  dialog.showModal();
  dialogContent.querySelector('[name="name"]').focus();
}

function openGearForm(item, characterId = "") {
  const categories = ["Weapon", "Armor", "Equipment", "Cyberware", "Ammunition", "Other"].map(category => ({ value: category, label: category }));
  const owners = workspace.characters.map(character => ({ value: character.id, label: character.name }));
  const isEditing = Boolean(item?.id);
  const body = `${field("Item name", "name", item?.name ?? "", { required: true })}${selectField("Category", "category", categories, item?.category ?? "Equipment")}
    ${field("Quantity", "quantity", item?.quantity ?? 1, { type: "number", min: 0, required: true })}${selectField("Assign to", "characterId", owners, item?.characterId ?? characterId, true)}
    ${field("Description", "description", item?.description ?? item?.details ?? "", { full: true, textarea: true, hint: "A short custom description or table-specific information." })}
    ${field("Weapon type", "weaponType", item?.weaponType ?? "", { hint: "Optional; e.g. Heavy handgun." })}
    ${field("Weapon stats", "weaponStats", item?.weaponStats ?? "", { full: true, textarea: true, hint: "Optional table-entered stats, kept as custom data." })}
    ${field("Weight", "weight", item?.weight ?? "")}${field("Cost", "cost", item?.cost ?? "")}
    ${field("Source citation", "sourceReference", item?.sourceReference ?? "", { full: true, hint: "Optional book and page reference." })}
    <div class="form-field full chip-config-fields"><span class="field-label">Skill chip setup · cyberware only</span><span class="field-hint">Link a skill chip to a skill and enter its table-specific bonus. Socketed chips appear in the character-sheet summary.</span><div class="chip-config-row">${field("Chip skill", "chipSkill", item?.chipSkill ?? "", { hint: "Leave blank for non-skill-chip cyberware." })}<label class="form-field"><span class="field-label">Chip bonus</span><input class="field-input" type="number" name="chipBonus" min="0" max="9999" step="1" value="${escapeHtml(item?.chipBonus ?? "")}"></label></div><label class="chip-socket-toggle"><input type="checkbox" name="socketed" ${item?.socketed ? "checked" : ""}><span>Socket this skill chip</span></label></div>
    ${field("Custom notes", "customNotes", item?.customNotes ?? "", { full: true, textarea: true })}`;
  dialogContent.innerHTML = formShell(isEditing ? "Edit ledger item" : "Add a ledger item", "Use your own descriptions and table-specific details.", "gear-form", body, isEditing ? "Save item" : "Add item");
  const form = dialogContent.querySelector("form");
  if (isEditing) form.dataset.id = item.id;
  form.dataset.catalogId = item?.catalogId ?? "";
  form.dataset.originalCharacterId = characterId;
  dialog.showModal();
  dialogContent.querySelector('[name="name"]').focus();
}

function openAuthForm(mode = "login") {
  const isRegister = mode === "register";
  const body = `${field("Username", "username", "", { required: true, hint: "3–24 letters, numbers, or underscores." })}<label class="form-field"><span class="field-label">Password</span><input class="field-input" type="password" name="password" minlength="12" maxlength="200" required autocomplete="${isRegister ? "new-password" : "current-password"}"><span class="field-hint">At least 12 characters.</span></label><div class="form-field full auth-switch"><span>${isRegister ? "Already have an account?" : "New to Afterdark?"}</span><button class="text-button" type="button" data-action="switch-auth-mode" data-mode="${isRegister ? "login" : "register"}">${isRegister ? "Sign in" : "Create account"}</button></div>`;
  dialogContent.innerHTML = formShell(isRegister ? "Create your account" : "Sign in", "Your characters and portrait uploads follow your account.", "auth-form", body, isRegister ? "Create account" : "Sign in");
  dialogContent.querySelector("form").dataset.mode = mode;
  dialog.showModal();
  dialogContent.querySelector('[name="username"]').focus();
}

function openCatalogItemForm(item) {
  const body = `${field("Item name", "name", item?.name ?? "", { required: true })}${field("Category", "category", item?.category ?? "Other")}
    ${field("Weapon type", "weaponType", item?.weaponType ?? "", { hint: "For weapon entries, e.g. Heavy handgun or Medium handgun." })}
    ${field("Weapon stats", "weaponStats", item?.weaponStats ?? "", { full: true, textarea: true, hint: "Enter table-specific stat values; this is custom user data." })}
    ${field("Description", "description", item?.description ?? "", { full: true, textarea: true })}
    ${field("Weight", "weight", item?.weight ?? "")}${field("Cost", "cost", item?.cost ?? "")}
    ${field("Skill chip skill", "chipSkill", item?.chipSkill ?? "", { hint: "Optional; use for a cyberware chip that grants a skill." })}${field("Price per chip level", "pricePerLevel", item?.pricePerLevel ?? "", { type: "number", min: 1, hint: "Optional numeric Eddies price for each chip level." })}${field("Flat purchase price", "purchaseCost", item?.purchaseCost ?? "", { type: "number", min: 1, hint: "Optional fixed price for a non-levelled catalog item." })}
    ${field("Source citation", "sourceReference", item?.sourceReference ?? "", { full: true, hint: "Optional book and page reference." })}
    ${field("Custom notes", "customNotes", item?.customNotes ?? "", { full: true, textarea: true, hint: "Catalog entries are original/custom data. Add the source item list when you are ready." })}`;
  dialogContent.innerHTML = formShell("Add a catalog item", "Add one custom record to the server's item catalog.", "catalog-item-form", body, "Save catalog item");
  dialog.showModal();
  dialogContent.querySelector('[name="name"]').focus();
}

function openSessionForm(campaign, session) {
  const body = `${field("Session title", "title", session?.title ?? "", { required: true })}${field("Date", "date", session?.date ?? new Date().toISOString().slice(0, 10), { type: "date" })}${field("Session notes", "notes", session?.notes ?? "", { full: true, textarea: true })}`;
  dialogContent.innerHTML = formShell(`${session ? "Edit" : "Add"} session · ${campaign.name}`, "Log a session in this campaign.", "session-form", body, session ? "Save session" : "Save session");
  dialog.showModal();
  dialogContent.querySelector('[name="title"]').focus();
  const form = dialogContent.querySelector("form");
  form.dataset.campaignId = campaign.id;
  if (session) form.dataset.sessionId = session.id;
}

function openForm(type, id, secondaryId) {
  if (type === "character") {
    if (!signedInAccount) return openAuthForm("login");
    if (!id && workspace.characters.length >= MAX_CHARACTERS_PER_ACCOUNT) return showToast(`Each account can create up to ${MAX_CHARACTERS_PER_ACCOUNT} characters.`, true);
    openCharacterForm(id ? selectedCharacter(id) : null);
  }
  if (type === "campaign") openCampaignForm(id ? workspace.campaigns.find(campaign => campaign.id === id) : null);
  if (type === "gear") openGearForm(id ? workspace.gear.find(item => item.id === id) : null, secondaryId || "");
  if (type === "catalog-item") openCatalogItemForm();
  if (type === "session") {
    const campaign = workspace.campaigns.find(item => item.id === id);
    if (campaign) openSessionForm(campaign, secondaryId ? campaign.sessions?.find(session => session.id === secondaryId) : null);
  }
}

function formValues(form) {
  return new FormData(form);
}

async function saveCharacterToAccount(character, previous, form, showSavedMessage = true) {
  if (!signedInAccount) {
    showToast("Sign in to save characters to your account.", true);
    return false;
  }
  let portraitUploadError = "";
  try {
    const response = await apiRequest(previous ? `/api/characters/${encodeURIComponent(character.id)}` : "/api/characters", {
      method: previous ? "PUT" : "POST",
      body: JSON.stringify(character)
    });
    const savedCharacter = normalizeCharacter(response.character);
    const portrait = form?.querySelector('[name="portrait"]')?.files?.[0];
    if (portrait) {
      try {
        const upload = await fetch(`/api/characters/${encodeURIComponent(savedCharacter.id)}/portrait`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": portrait.type },
          body: portrait
        });
        const result = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(result.error || "Portrait upload failed.");
        Object.assign(savedCharacter, result.character);
      } catch (error) {
        portraitUploadError = error.message || "Portrait upload failed.";
      }
    }
    if (previous) workspace.characters = workspace.characters.map(item => item.id === savedCharacter.id ? savedCharacter : item);
    else workspace.characters.push(savedCharacter);
    signedInAccount.characters = workspace.characters;
    workspace.demo = false;
    addActivity(previous ? `${savedCharacter.name}'s sheet was updated` : `${savedCharacter.name} joined the roster`, previous ? "Character updated" : "Character added");
    const locallySaved = saveWorkspace();
    if (!locallySaved) renderAll();
    dialog.close();
    updateAccountControls();
    if (showSavedMessage) {
      showToast(portraitUploadError
        ? `Character saved, but portrait upload failed: ${portraitUploadError}`
        : previous ? "Character saved." : "Character created.", Boolean(portraitUploadError));
    } else if (portraitUploadError) {
      showToast(`Character saved, but portrait upload failed: ${portraitUploadError}`, true);
    }
    return true;
  } catch (error) {
    console.error("Could not save the account character.", error);
    showToast(error.message || "Could not save this character.", true);
    return false;
  }
}

async function saveCharacterEddies(form) {
  const character = selectedCharacter(form.dataset.characterId);
  const eddies = Number(new FormData(form).get("eddies"));
  if (!character) return showToast("Choose a character before updating eddies.", true);
  if (!Number.isInteger(eddies) || eddies < 0 || eddies > 999999999) {
    showToast("Eddies must be a whole number from 0 to 999,999,999.", true);
    form.elements.eddies.focus();
    return;
  }
  const updatedCharacter = { ...character, eddies };
  if (signedInAccount) {
    if (await saveCharacterToAccount(updatedCharacter, character, null, false)) showToast("Eddies updated.");
    return;
  }
  workspace.characters = workspace.characters.map(item => item.id === character.id ? updatedCharacter : item);
  workspace.demo = false;
  if (saveWorkspace()) showToast("Eddies updated.");
}

async function persistCharacterVitals(character, changes, showSavedMessage = false) {
  const updatedCharacter = normalizeCharacter({ ...character, ...changes });
  if (updatedCharacter.healthCurrent != null && updatedCharacter.healthMax != null
    && updatedCharacter.healthCurrent > updatedCharacter.healthMax) {
    showToast("Current life cannot exceed maximum life.", true);
    return false;
  }
  if (BODY_LOCATIONS.some(({ key }) => {
    const health = updatedCharacter.bodyHealth[key];
    return health.current != null && health.max != null && health.current > health.max;
  })) {
    showToast("Current limb health cannot exceed its maximum.", true);
    return false;
  }
  try {
    let savedCharacter = updatedCharacter;
    if (signedInAccount) {
      const response = await apiRequest(`/api/characters/${encodeURIComponent(character.id)}`, {
        method: "PUT",
        body: JSON.stringify(updatedCharacter)
      });
      savedCharacter = normalizeCharacter(response.character);
    }
    workspace.characters = workspace.characters.map(item => item.id === savedCharacter.id ? savedCharacter : item);
    if (signedInAccount) signedInAccount.characters = workspace.characters;
    workspace.demo = false;
    if (!saveWorkspace()) return false;
    if (showSavedMessage) showToast("Character health saved.");
    return true;
  } catch (error) {
    console.error("Could not save character health and limb status.", error);
    showToast(error.message || "Could not save character health and limb status.", true);
    return false;
  }
}

async function saveSheetVitals(form) {
  const character = selectedCharacter(form.dataset.characterId);
  if (!character) return showToast("Choose a character before updating health.", true);
  const data = new FormData(form);
  const kind = form.dataset.vitalsKind;
  const changes = {};
  if (kind === "health") {
    const healthCurrent = readOptionalFormInteger(data, "healthCurrent", 9999);
    const healthMax = readOptionalFormInteger(data, "healthMax", 9999);
    if (healthCurrent === undefined || healthMax === undefined) {
      showToast("Life values must be whole numbers from 0 to 9,999.", true);
      return;
    }
    changes.healthCurrent = healthCurrent;
    changes.healthMax = healthMax;
  } else if (kind === "body") {
    const bodyHealth = Object.fromEntries(BODY_LOCATIONS.map(({ key }) => [key, {
      current: readOptionalFormInteger(data, `body-${key}-current`, 9999),
      max: readOptionalFormInteger(data, `body-${key}-max`, 9999)
    }]));
    if (BODY_LOCATIONS.some(({ key }) => bodyHealth[key].current === undefined || bodyHealth[key].max === undefined)) {
      showToast("Limb health values must be whole numbers from 0 to 9,999.", true);
      return;
    }
    changes.bodyHealth = bodyHealth;
  } else {
    showToast("This health form could not be saved.", true);
    return;
  }
  await persistCharacterVitals(character, changes, true);
}

async function saveCharacterHealth(character, healthCurrent) {
  await persistCharacterVitals(character, { healthCurrent });
}

async function addCatalogItem(item) {
  try {
    const result = await apiRequest("/api/catalog", { method: "POST", body: JSON.stringify(item) });
    workspace.catalog.push(result.item);
    dialog.close();
    showToast(`${result.item.name} added to the catalog.`);
    if (catalogTargetCharacterId) openCatalogSearch(catalogTargetCharacterId);
  } catch (error) {
    showToast(error.message || "Could not add that catalog item.", true);
  }
}

async function addCatalogItemToCharacter(characterId, catalogId) {
  const character = selectedCharacter(characterId);
  const catalogItem = workspace.catalog?.find(item => item.id === catalogId);
  if (!character || !catalogItem) return showToast("Choose an item from the catalog first.", true);
  if (!signedInAccount) return showToast("Sign in to save character inventory.", true);
  const updatedCharacter = { ...character, inventory: [...(character.inventory || []), {
    id: makeId(), catalogId: catalogItem.id, name: catalogItem.name, category: catalogItem.category, quantity: 1, equipped: false,
    chipSkill: catalogItem.chipSkill || "", chipBonus: null, socketed: false,
    description: catalogItem.description, weaponType: catalogItem.weaponType, weaponStats: catalogItem.weaponStats,
    weight: catalogItem.weight, cost: catalogItem.cost, sourceReference: catalogItem.sourceReference, customNotes: catalogItem.customNotes
  }] };
  const saved = await saveCharacterToAccount(updatedCharacter, character, null, false);
  if (saved) {
    if (catalogDialog.open) catalogDialog.close();
    showToast(`${catalogItem.name} added to ${character.name}'s inventory.`);
  }
}

function openCatalogPurchaseForm(characterId, catalogId) {
  const character = selectedCharacter(characterId);
  const item = workspace.catalog?.find(entry => entry.id === catalogId);
  if (!character || !item) return showToast("Choose an item from the catalog first.", true);
  if (!signedInAccount) return showToast("Sign in to purchase catalog items.", true);
  const pricePerLevel = Number(item.pricePerLevel);
  const purchaseCost = Number(item.purchaseCost);
  const hasLevelPrice = Number.isInteger(pricePerLevel) && pricePerLevel > 0;
  const hasFlatPrice = Number.isInteger(purchaseCost) && purchaseCost > 0;
  const manualPrice = Boolean(item.chipSkill) && !hasLevelPrice && !hasFlatPrice;
  const isLevelled = hasLevelPrice || manualPrice;
  if (!isLevelled && !hasFlatPrice) {
    return showToast("This catalog item does not have a purchase price.", true);
  }
  const skillChoiceField = item.chipSkillOptions?.length
    ? `<label class="form-field"><span class="field-label">Skill slot</span><select class="field-select" name="chipSkillOption" required>${item.chipSkillOptions.map(skill => `<option value="${escapeHtml(skill)}">${escapeHtml(skill)}</option>`).join("")}</select></label>`
    : "";
  const levelField = isLevelled
    ? `<label class="form-field"><span class="field-label">Chip level</span><input class="field-input" type="number" name="chipLevel" min="1" max="10" step="1" value="1" required><span class="field-hint">Choose a level from 1 to 10. The chip bonus equals its level.</span></label>`
    : "";
  const manualPriceField = manualPrice
    ? `<label class="form-field"><span class="field-label">Price per level (eb)</span><input class="field-input" type="number" name="chipPricePerLevel" min="1" max="999999999" step="1" required><span class="field-hint">Set the referee-approved price for each level.</span></label>`
    : "";
  const subtitle = manualPrice
    ? `Referee-priced chip. Enter a per-level price. Current balance: ${Number(character.eddies || 0).toLocaleString()} eb.`
    : isLevelled
      ? `${pricePerLevel} eb per level. Current balance: ${Number(character.eddies || 0).toLocaleString()} eb.`
    : `Cost: ${purchaseCost} eb. Current balance: ${Number(character.eddies || 0).toLocaleString()} eb.`;
  dialogContent.innerHTML = formShell(`Purchase ${item.name}`, subtitle, "catalog-purchase-form",
    `${skillChoiceField}${manualPriceField}${levelField}<p class="form-field full purchase-total" id="catalog-purchase-total" aria-live="polite"></p>`, "Purchase");
  const form = dialogContent.querySelector('form[name="catalog-purchase-form"]');
  form.dataset.characterId = character.id;
  form.dataset.catalogItemId = item.id;
  form.dataset.levelled = String(isLevelled);
  form.dataset.manualPrice = String(manualPrice);
  if (catalogDialog.open) catalogDialog.close();
  dialog.showModal();
  updateCatalogPurchaseTotal(form);
  form.querySelector('[name="chipLevel"]')?.focus();
}

function updateCatalogPurchaseTotal(form) {
  if (!form) return;
  const item = workspace.catalog?.find(entry => entry.id === form.dataset.catalogItemId);
  const character = selectedCharacter(form.dataset.characterId);
  const target = form.querySelector("#catalog-purchase-total");
  if (!item || !character || !target) return;
  const levelled = form.dataset.levelled === "true";
  const level = Number(form.elements.chipLevel?.value);
  const pricePerLevel = form.dataset.manualPrice === "true" ? Number(form.elements.chipPricePerLevel?.value) : Number(item.pricePerLevel);
  const totalCost = levelled ? pricePerLevel * level : Number(item.purchaseCost);
  const valid = Number.isSafeInteger(totalCost) && totalCost > 0
    && (form.dataset.manualPrice !== "true" || Number.isSafeInteger(pricePerLevel) && pricePerLevel > 0)
    && (!levelled || Number.isInteger(level) && level >= 1 && level <= 10);
  if (!valid) {
    target.textContent = form.dataset.manualPrice === "true"
      ? "Enter a positive whole-number per-level price and a chip level from 1 to 10."
      : "Enter a whole-number chip level from 1 to 10.";
    target.classList.remove("is-over");
    return;
  }
  const balanceAfter = Number(character.eddies || 0) - totalCost;
  target.textContent = `Total: ${totalCost.toLocaleString()} eb${levelled ? ` (${level} × ${pricePerLevel.toLocaleString()} eb)` : ""}. ${balanceAfter >= 0
    ? `Balance after purchase: ${balanceAfter.toLocaleString()} eb.`
    : `Insufficient balance by ${Math.abs(balanceAfter).toLocaleString()} eb; current balance: ${Number(character.eddies || 0).toLocaleString()} eb.`}`;
  target.classList.toggle("is-over", balanceAfter < 0);
}

async function purchaseCatalogItem(form) {
  if (!signedInAccount) return showToast("Sign in to purchase catalog items.", true);
  const character = selectedCharacter(form.dataset.characterId);
  const item = workspace.catalog?.find(entry => entry.id === form.dataset.catalogItemId);
  if (!character || !item) return showToast("The selected character or catalog item is no longer available.", true);
  const levelled = form.dataset.levelled === "true";
  const data = new FormData(form);
  const level = Number(data.get("chipLevel"));
  const pricePerLevel = form.dataset.manualPrice === "true" ? Number(data.get("chipPricePerLevel")) : Number(item.pricePerLevel);
  if (levelled && (!Number.isInteger(level) || level < 1 || level > 10)) {
    return showToast("Chip level must be a whole number from 1 to 10.", true);
  }
  if (form.dataset.manualPrice === "true" && (!Number.isSafeInteger(pricePerLevel) || pricePerLevel <= 0)) {
    return showToast("Enter a positive whole-number per-level Eddies price.", true);
  }
  const selectedChipSkill = String(data.get("chipSkillOption") || item.chipSkill || "").trim();
  if (item.chipSkillOptions?.length && !item.chipSkillOptions.includes(selectedChipSkill)) {
    return showToast("Choose a valid skill slot for this chip.", true);
  }
  const totalCost = levelled ? pricePerLevel * level : Number(item.purchaseCost);
  if (!Number.isSafeInteger(totalCost) || totalCost <= 0) return showToast("The catalog price is invalid.", true);
  const currentEddies = Number(character.eddies ?? 0);
  if (currentEddies < totalCost) {
    return showToast(`Not enough Eddies. ${totalCost.toLocaleString()} required; balance is ${currentEddies.toLocaleString()}.`, true);
  }
  const inventoryItem = {
    id: makeId(),
    catalogId: item.id,
    name: levelled ? `${item.name} (Level ${level})` : item.name,
    category: item.category,
    quantity: 1,
    equipped: false,
    chipSkill: selectedChipSkill,
    chipBonus: levelled ? level : null,
    socketed: false,
    description: item.description,
    weaponType: item.weaponType,
    weaponStats: item.weaponStats,
    weight: item.weight,
    cost: `${totalCost.toLocaleString()} eb`,
    sourceReference: item.sourceReference,
    customNotes: item.customNotes
  };
  const updatedCharacter = {
    ...character,
    eddies: currentEddies - totalCost,
    inventory: [...(character.inventory || []), inventoryItem]
  };
  if (await saveCharacterToAccount(updatedCharacter, character, null, false)) {
    showToast(`${inventoryItem.name} purchased for ${totalCost.toLocaleString()} eb.`);
  }
}

async function linkCharacterToRoom(characterId) {
  if (!signedInAccount || !activeBoardCampaignId) return showToast("Sign in and connect to a campaign first.", true);
  try {
    const response = await apiRequest(`/api/campaigns/${encodeURIComponent(activeBoardCampaignId)}/roster`, {
      method: "POST",
      headers: activeGmKey ? { "x-gm-key": activeGmKey } : {},
      body: JSON.stringify({ characterIds: [characterId] })
    });
    campaignRoster = response.roster;
    campaignPlayerCount = response.playerCount ?? campaignPlayerCount;
    renderBoard();
    showToast("Character shared with the campaign GM.");
  } catch (error) {
    showToast(error.message || "Could not share the character.", true);
  }
}

async function refreshCampaignRoster() {
  if (!signedInAccount || !activeBoardCampaignId) return;
  try {
    const response = await apiRequest(`/api/campaigns/${encodeURIComponent(activeBoardCampaignId)}/roster`, {
      headers: activeGmKey ? { "x-gm-key": activeGmKey } : {}
    });
    campaignRoster = response.roster;
    campaignPlayerCount = response.playerCount ?? campaignPlayerCount;
    renderBoard();
  } catch (error) {
    console.error("Could not load campaign roster.", error);
    showToast(error.message || "Could not load campaign roster.", true);
  }
}

async function refreshEnemyTemplates() {
  if (!boardIsGm || !activeGmKey || !activeBoardCampaignId) return;
  const campaignId = activeBoardCampaignId;
  try {
    const response = await apiRequest(`/api/campaigns/${encodeURIComponent(campaignId)}/enemy-templates`, {
      headers: { "x-gm-key": activeGmKey }
    });
    if (!boardIsGm || activeBoardCampaignId !== campaignId) return;
    enemyTemplates = response.enemies;
    renderPalette();
  } catch (error) {
    console.error("Could not load GM enemy templates.", error);
    showToast(error.message || "Could not load enemy templates.", true);
  }
}

async function submitAccountForm(form) {
  const data = formValues(form);
  try {
    const response = await apiRequest(form.dataset.mode === "register" ? "/api/register" : "/api/login", {
      method: "POST",
      body: JSON.stringify({ username: data.get("username"), password: data.get("password") })
    });
    await loadAuthenticatedData(response.account);
    dialog.close();
    showToast(`Signed in as ${response.account.username}.`);
    continuePendingCampaignInvite();
  } catch (error) {
    showToast(error.message || "Could not sign in.", true);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(header => header.toLowerCase().replace(/[\s_-]+/g, ""));
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))).map(item => ({
    name: item.name,
    category: item.category || "Other",
    description: item.description || "",
    weaponType: item.weapontype || item.type || "",
    weaponStats: item.weaponstats || item.stats || "",
    weight: item.weight || "",
    cost: item.cost || "",
    chipSkill: item.chipskill || "",
    pricePerLevel: item.priceperlevel ? Number(item.priceperlevel) : null,
    purchaseCost: item.purchasecost ? Number(item.purchasecost) : null,
    sourceReference: item.sourcereference || item.source || "",
    customNotes: item.customnotes || item.notes || ""
  })).filter(item => item.name);
}

async function importCatalogFile(file) {
  if (!signedInAccount) return showToast("Sign in to import catalog items.", true);
  try {
    const text = await file.text();
    const items = file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseCsv(text);
    if (!Array.isArray(items) || !items.length) throw new Error("The file must contain a non-empty array of catalog items.");
    const response = await apiRequest("/api/catalog/import", { method: "POST", body: JSON.stringify({ items }) });
    workspace.catalog = response.items;
    renderCatalogSearchResults();
    showToast(`Imported ${response.imported} catalog items.`);
  } catch (error) {
    console.error("Could not import catalog file.", error);
    showToast(error.message || "Could not import this catalog file.", true);
  }
}

function persistForm(form) {
  const data = formValues(form);
  const name = String(data.get("name") ?? "").trim();
  const formType = form.getAttribute("name");
  if (formType === "auth-form") {
    void submitAccountForm(form);
    return;
  }
  if (formType === "join-form") {
    joinSharedCampaign(form);
    return;
  }
  if (formType === "catalog-purchase-form") {
    void purchaseCatalogItem(form);
    return;
  }
  if (formType === "character-form") {
    if (!signedInAccount) return showToast("Sign in before creating or editing characters.", true);
    if (!name) return showToast("A character needs a name.", true);
    const id = form.dataset.id || makeId();
    const previous = selectedCharacter(id);
    const attributes = Object.fromEntries(ATTRIBUTES.map(attribute => {
      const raw = String(data.get(`attr-${attribute}`) ?? "").trim();
      return [attribute, raw === "" ? "" : Number(raw)];
    }));
    if (!previous && Object.values(attributes).some(value => value === "")) {
      return showToast("Enter a value for every attribute.", true);
    }
    if (Object.values(attributes).some(value => value !== "" && (!Number.isInteger(value) || value < 0 || value > 10))) {
      return showToast("Attributes must be whole numbers from 0 to 10.", true);
    }
    let attributeGeneration;
    let skills = skillEntries(data.get("skills"), previous?.skills ?? []);
    let skillGeneration;
    if (!previous) {
      const method = form.querySelector('[name="attributeMethod"]:checked')?.value;
      const pointPool = selectedAttributePointPool(form);
      if (pointPool == null) {
        return showToast(method === "cinematic"
          ? "Choose a cinematic tier before assigning attributes."
          : "Roll nine d10 before assigning attributes.", true);
      }
      const allocated = Object.values(attributes).reduce((sum, value) => sum + value, 0);
      if (allocated !== pointPool) {
        const remaining = pointPool - allocated;
        return showToast(remaining > 0
          ? `Allocate all ${pointPool} attribute points; ${remaining} remain.`
          : `Attribute allocation exceeds the ${pointPool}-point pool by ${Math.abs(remaining)}.`, true);
      }
      attributeGeneration = initialAttributeGeneration(form, allocated);
      if (!attributeGeneration) return showToast("The attribute point pool is invalid. Roll again or choose a cinematic tier.", true);
      const startingSkills = initialSkillGeneration(form);
      if (!startingSkills) return showToast("Choose 9 normal skills and 1 special skill, give each at least 1 point, and allocate exactly 40 skill points.", true);
      skills = startingSkills.skills;
      skillGeneration = startingSkills.generation;
    }
    const bodyHealth = Object.fromEntries(BODY_LOCATIONS.map(({ key }) => [key, {
      current: readOptionalFormInteger(data, `body-${key}-current`, 9999),
      max: readOptionalFormInteger(data, `body-${key}-max`, 9999)
    }]));
    const bodyArmorSP = Object.fromEntries(BODY_LOCATIONS.map(({ key }) => [key, readOptionalFormInteger(data, `armor-${key}-sp`, 9999)]));
    if (BODY_LOCATIONS.some(({ key }) => bodyHealth[key].current === undefined || bodyHealth[key].max === undefined || bodyArmorSP[key] === undefined)) {
      return showToast("Limb health and armor SP must be whole numbers within their allowed ranges.", true);
    }
    const character = {
      id, name, role: String(data.get("role") ?? "").trim(), handle: String(data.get("handle") ?? "").trim(),
      attributes, skills,
      bodyHealth, bodyArmorSP,
      ...(attributeGeneration ? { attributeGeneration } : {}),
      ...(skillGeneration ? { skillGeneration } : {}),
      derived: String(data.get("derived") ?? "").split(/\r?\n/).map(item => item.trim()).filter(Boolean),
      healthCurrent: data.get("healthCurrent") === "" ? null : Number(data.get("healthCurrent")),
      healthMax: data.get("healthMax") === "" ? null : Number(data.get("healthMax")),
      history: String(data.get("history") ?? "").trim(), notes: String(data.get("notes") ?? "").trim(),
      createdAt: previous?.createdAt || new Date().toISOString()
    };
    if (character.healthCurrent != null && character.healthMax != null && character.healthCurrent > character.healthMax) {
      return showToast("Current life cannot exceed maximum life.", true);
    }
    void saveCharacterToAccount(character, previous, form);
    return;
  } else if (formType === "campaign-form") {
    if (!name) return showToast("A campaign needs a name.", true);
    const id = form.dataset.id || makeId();
    const previous = workspace.campaigns.find(campaign => campaign.id === id);
    const inviteFriendId = previous ? "" : String(data.get("inviteFriendId") || "");
    const campaign = {
      id, name, gm: previous?.gm || (previous?.isJoined ? "" : signedInAccount?.username) || String(data.get("gm") ?? "").trim(), description: String(data.get("description") ?? "").trim(),
      characterIds: data.getAll("characterIds").map(String),
      sessions: previous?.sessions ?? []
    };
    if (previous) workspace.campaigns = workspace.campaigns.map(item => item.id === id ? campaign : item);
    else workspace.campaigns.push(campaign);
    addActivity(previous ? `${name} was updated` : `${name} was created`, "Campaign");
    if (!finishSave(previous ? "Campaign saved." : signedInAccount ? "Campaign created; setting up game master access." : "Campaign created.")) return;
    if (inviteFriendId) void sendCampaignInvite(campaign, inviteFriendId);
    else if (!previous && signedInAccount) {
      void ensureCampaignRoom(campaign)
        .then(() => showToast("Campaign ready. You are its game master."))
        .catch(error => showToast(`Campaign was created, but game master setup failed: ${error.message || "unknown error"}`, true));
    }
  } else if (formType === "gear-form") {
    if (!name) return showToast("An item needs a name.", true);
    const id = form.dataset.id || makeId();
    const storedGear = workspace.gear.find(entry => entry.id === id);
    const storedInventory = workspace.characters.flatMap(character => character.inventory || []).find(entry => entry.id === id);
    const category = String(data.get("category") ?? "Other");
    const chipSkill = String(data.get("chipSkill") ?? "").trim();
    const chipBonus = readOptionalFormInteger(data, "chipBonus", 9999);
    const socketed = Boolean(data.get("socketed"));
    if (chipBonus === undefined) return showToast("Skill-chip bonuses must be whole numbers from 0 to 9,999.", true);
    if ((chipSkill || chipBonus != null || socketed) && category.toLowerCase() !== "cyberware") {
      return showToast("Skill-chip details can only be saved on cyberware.", true);
    }
    if ((chipBonus != null || socketed) && !chipSkill) return showToast("Enter the skill linked to this chip before setting its bonus or socketing it.", true);
    const item = {
      id, name, category, quantity: Math.max(0, Number(data.get("quantity") || 0)),
      characterId: String(data.get("characterId") ?? ""), description: String(data.get("description") ?? "").trim(),
      details: String(data.get("description") ?? "").trim(), weight: String(data.get("weight") ?? "").trim(),
      weaponType: String(data.get("weaponType") ?? "").trim(), weaponStats: String(data.get("weaponStats") ?? "").trim(),
      cost: String(data.get("cost") ?? "").trim(), customNotes: String(data.get("customNotes") ?? "").trim(),
      sourceReference: String(data.get("sourceReference") ?? "").trim(),
      chipSkill, chipBonus: chipSkill ? chipBonus ?? 0 : null, socketed,
      equipped: Boolean(storedGear?.equipped || storedInventory?.equipped),
      catalogId: form.dataset.catalogId || ""
    };
    const previous = workspace.gear.some(entry => entry.id === id);
    const owner = selectedCharacter(item.characterId);
    const previousOwnerId = form.dataset.originalCharacterId;
    if (previousOwnerId && owner && previousOwnerId !== owner.id) {
      return showToast("Remove the item from its current character before assigning it elsewhere.", true);
    }
    if (owner && signedInAccount) {
      workspace.gear = workspace.gear.filter(entry => entry.id !== id);
      const inventoryItem = {
        id: item.id, catalogId: item.catalogId, name: item.name, category: item.category, quantity: item.quantity,
        description: item.description, weaponType: item.weaponType, weaponStats: item.weaponStats,
        weight: item.weight, cost: item.cost, sourceReference: item.sourceReference, customNotes: item.customNotes,
        chipSkill: item.chipSkill, chipBonus: item.chipBonus, socketed: item.socketed, equipped: item.equipped
      };
      owner.inventory = owner.inventory || [];
      if (owner.inventory.some(entry => entry.id === id)) owner.inventory = owner.inventory.map(entry => entry.id === id ? inventoryItem : entry);
      else owner.inventory.push(inventoryItem);
      addActivity(`${name} was added to ${owner.name}'s inventory`, "Inventory updated");
      void saveCharacterToAccount(owner, owner, null);
      return;
    }
    if (previous) workspace.gear = workspace.gear.map(entry => entry.id === id ? item : entry);
    else workspace.gear.push(item);
    if (previousOwnerId && signedInAccount) {
      const previousOwner = selectedCharacter(previousOwnerId);
      if (previousOwner) {
        previousOwner.inventory = (previousOwner.inventory || []).filter(entry => entry.id !== id);
        void saveCharacterToAccount(previousOwner, previousOwner, null);
      }
    }
    addActivity(`${name} was added to the ledger`, previous ? "Gear updated" : "Gear added");
    finishSave(previous ? "Item saved." : "Item added.");
  } else if (formType === "catalog-item-form") {
    if (!signedInAccount) return showToast("Sign in to add items to the shared catalog.", true);
    if (!name) return showToast("A catalog item needs a name.", true);
    const pricePerLevel = readOptionalFormInteger(data, "pricePerLevel", 999999999);
    const purchaseCost = readOptionalFormInteger(data, "purchaseCost", 999999999);
    if (pricePerLevel === undefined || purchaseCost === undefined || pricePerLevel === 0 || purchaseCost === 0) {
      return showToast("Catalog prices must be positive whole Eddies amounts.", true);
    }
    void addCatalogItem({
      name, category: String(data.get("category") || "Other").trim(), description: String(data.get("description") || "").trim(),
      weaponType: String(data.get("weaponType") || "").trim(), weaponStats: String(data.get("weaponStats") || "").trim(),
      weight: String(data.get("weight") || "").trim(), cost: String(data.get("cost") || "").trim(),
      chipSkill: String(data.get("chipSkill") || "").trim(), pricePerLevel, purchaseCost,
      sourceReference: String(data.get("sourceReference") || "").trim(),
      customNotes: String(data.get("customNotes") || "").trim()
    });
  } else if (formType === "session-form") {
    const title = String(data.get("title") ?? "").trim();
    if (!title) return showToast("A session needs a title.", true);
    const campaign = workspace.campaigns.find(item => item.id === form.dataset.campaignId);
    if (!campaign) return showToast("That campaign could not be found.", true);
    campaign.sessions = campaign.sessions ?? [];
    const updatedSession = { id: form.dataset.sessionId || makeId(), title, date: String(data.get("date") ?? ""), notes: String(data.get("notes") ?? "").trim() };
    const isUpdate = campaign.sessions.some(session => session.id === updatedSession.id);
    if (isUpdate) campaign.sessions = campaign.sessions.map(session => session.id === updatedSession.id ? updatedSession : session);
    else campaign.sessions.unshift(updatedSession);
    addActivity(isUpdate ? `A session in ${campaign.name} was updated` : `A session was logged in ${campaign.name}`, title);
    finishSave(isUpdate ? "Session updated." : "Session saved.");
  }
}

function finishSave(message) {
  workspace.demo = false;
  const saved = saveWorkspace();
  if (saved) {
    dialog.close();
    showToast(message);
  }
  return saved;
}

function confirmAction(message) {
  return window.confirm(message);
}

async function toggleItemEquipped(characterId, itemId) {
  const character = selectedCharacter(characterId);
  if (!character) return;
  const inventoryItem = (character.inventory || []).find(item => item.id === itemId);
  const legacyItem = workspace.gear.find(item => item.id === itemId && item.characterId === character.id);
  const item = inventoryItem || legacyItem;
  if (!item) return showToast("That inventory item could not be found.", true);
  const nextEquipped = !item.equipped;
  if (signedInAccount) {
    const inventory = [...(character.inventory || [])];
    if (inventoryItem) {
      const index = inventory.findIndex(entry => entry.id === itemId);
      inventory[index] = { ...inventoryItem, equipped: nextEquipped };
    } else {
      inventory.push({ ...legacyItem, equipped: nextEquipped });
    }
    const saved = await saveCharacterToAccount({ ...character, inventory }, character, null, false);
    if (!saved) return;
    workspace.gear = workspace.gear.filter(entry => entry.id !== itemId);
    saveWorkspace();
  } else if (inventoryItem) {
    character.inventory = (character.inventory || []).map(entry => entry.id === itemId ? { ...entry, equipped: nextEquipped } : entry);
    saveWorkspace();
  } else {
    workspace.gear = workspace.gear.map(entry => entry.id === itemId ? { ...entry, equipped: nextEquipped } : entry);
    saveWorkspace();
  }
  showToast(`${item.name} ${nextEquipped ? "equipped" : "unequipped"}.`);
}

async function toggleSkillChipSocketed(characterId, itemId) {
  const character = selectedCharacter(characterId);
  if (!character) return;
  const inventoryItem = (character.inventory || []).find(item => item.id === itemId);
  const legacyItem = workspace.gear.find(item => item.id === itemId && item.characterId === character.id);
  const item = inventoryItem || legacyItem;
  if (!item || item.category?.toLowerCase() !== "cyberware" || !item.chipSkill) {
    return showToast("Configure a cyberware item with a linked skill before socketing it.", true);
  }
  const nextSocketed = !item.socketed;
  if (signedInAccount) {
    const inventory = [...(character.inventory || [])];
    if (inventoryItem) {
      const index = inventory.findIndex(entry => entry.id === itemId);
      inventory[index] = { ...inventoryItem, socketed: nextSocketed };
    } else {
      inventory.push({ ...legacyItem, socketed: nextSocketed });
    }
    const saved = await saveCharacterToAccount({ ...character, inventory }, character, null, false);
    if (!saved) return;
    workspace.gear = workspace.gear.filter(entry => entry.id !== itemId);
    saveWorkspace();
  } else if (inventoryItem) {
    character.inventory = (character.inventory || []).map(entry => entry.id === itemId ? { ...entry, socketed: nextSocketed } : entry);
    saveWorkspace();
  } else {
    workspace.gear = workspace.gear.map(entry => entry.id === itemId ? { ...entry, socketed: nextSocketed } : entry);
    saveWorkspace();
  }
  showToast(`${item.name} ${nextSocketed ? "socketed" : "removed from the socket"}.`);
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "refresh-friends") void refreshFriends();
  if (action === "send-friend-request") void sendFriendRequest(id);
  if (action === "accept-friend-request") void updateFriendRequest(id, "accept");
  if (action === "decline-friend-request") void updateFriendRequest(id, "decline");
  if (action === "open-friend-messages") {
    friendTab = "messages";
    selectedMessageFriendId = id;
    renderDashboard();
  }
  if (action === "close-dialog") dialog.close();
  if (action === "open-auth") openAuthForm("login");
  if (action === "switch-auth-mode") openAuthForm(button.dataset.mode);
  if (action === "sign-out") void signOutAccount();
  if (action === "join-campaign") openJoinCampaignForm();
  if (action === "open-campaign-board") {
    const campaign = workspace.campaigns.find(item => item.id === id);
    if (campaign) openCampaignBoard(campaign);
  }
  if (action === "open-character-board") openCharacterBoard(selectedCharacter(id));
  if (action === "copy-room-code") void copyRoomCode();
  if (action === "copy-campaign-code") {
    const campaign = workspace.campaigns.find(item => item.id === id);
    if (campaign) void (campaign.isJoined ? copyRoomCode(id) : ensureCampaignRoom(campaign).then(() => copyRoomCode(id))).catch(error => showToast(error.message, true));
  }
  if (action === "copy-gm-key") void copyGmKey();
  if (action === "link-character-room") void linkCharacterToRoom(id);
  if (action === "open-character-gear") {
    selectedSheetCharacterId = id;
    sheetTab = "gear";
    showView("sheet");
    renderSheet();
  }
  if (action === "open-catalog-search") openCatalogSearch(button.dataset.characterId);
  if (action === "close-catalog-search") catalogDialog.close();
  if (action === "open-custom-gear") openForm("gear", "", button.dataset.characterId);
  if (action === "toggle-equipped") void toggleItemEquipped(button.dataset.characterId, id);
  if (action === "toggle-socketed") void toggleSkillChipSocketed(button.dataset.characterId, id);
  if (action === "sheet-skill-roll") performSheetSkillRoll(button.dataset.characterId);
  if (action === "sheet-attack-roll") performSheetAttackRoll(button);
  if (action === "sheet-damage-roll") performSheetDamageRoll(button);
  if (action === "add-catalog-item") {
    void addCatalogItemToCharacter(button.dataset.characterId || catalogTargetCharacterId, id);
  }
  if (action === "purchase-catalog-item") openCatalogPurchaseForm(button.dataset.characterId || catalogTargetCharacterId, id);
  if (action === "import-catalog") document.getElementById("catalog-file")?.click();
  if (action === "new-catalog-item") {
    catalogDialog.close();
    openForm("catalog-item");
  }
  if (action === "roll-attribute-pool") {
    const form = button.closest('form[name="character-form"]');
    if (form) rollAttributePointPool(form);
  }
  if (action === "roll") performRoll(button.dataset.rollKind);
  if (action === "select-board-token") {
    selectedBoardTokenId = id;
    selectedBoardPieceId = id;
    selectedBoardPieceKind = "token";
    renderBoard();
  }
  if (action === "adjust-health") adjustSelectedHealth(Number(button.dataset.delta));
  if (action === "remove-board-piece") {
    if (!selectedBoardPieceId) return showToast("Select a piece on the board first.", true);
    if (!confirmAction("Remove the selected piece from the shared board?")) return;
    if (selectedBoardPieceKind === "terrain") boardState.terrain = boardState.terrain.filter(piece => piece.id !== selectedBoardPieceId);
    else {
      boardState.tokens = boardState.tokens.filter(piece => piece.id !== selectedBoardPieceId);
      if (selectedBoardTokenId === selectedBoardPieceId) selectedBoardTokenId = "";
    }
    selectedBoardPieceId = "";
    selectedBoardPieceKind = "";
    sendBoardUpdate();
    renderBoard();
  }
  if (action === "clear-demo") {
    if (!confirmAction("Clear the demo characters, campaign, sessions, and gear? This cannot be undone.")) return;
    workspace = { demo: false, characters: [], campaigns: [], gear: [], activity: [] };
    if (saveWorkspace()) showToast("Demo cleared. Your workspace is ready.");
  }
  if (action === "edit-character") openForm("character", id);
  if (action === "open-character-sheet") {
    selectedSheetCharacterId = id;
    sheetTab = "overview";
    showView("sheet");
    renderSheet();
  }
  if (action === "duplicate-character") {
    const original = selectedCharacter(id);
    if (!original) return;
    if (!signedInAccount) return showToast("Sign in to duplicate account characters.", true);
    const duplicate = {
      ...original,
      id: undefined,
      portraitUrl: "",
      name: `${original.name} (copy)`,
      inventory: [],
      attributeGeneration: {
        method: "copy",
        total: Object.values(original.attributes || {}).reduce((sum, value) => sum + Number(value || 0), 0)
      },
      skillGeneration: {
        method: "copy",
        total: (original.skills || []).reduce((sum, skill) => sum + Number(normalizeSkill(skill).value || 0), 0)
      },
      createdAt: new Date().toISOString()
    };
    void apiRequest("/api/characters", { method: "POST", body: JSON.stringify(duplicate) }).then(response => {
      workspace.characters.push(normalizeCharacter(response.character));
      signedInAccount.characters = workspace.characters;
      addActivity(`${response.character.name} was duplicated`, "Character added");
      saveWorkspace();
      showToast("Character duplicated.");
    }).catch(error => showToast(error.message || "Could not duplicate this character.", true));
  }
  if (action === "delete-character") {
    const character = selectedCharacter(id);
    if (!character || !confirmAction(`Delete ${character.name}? Their gear will become unassigned.`)) return;
    if (!signedInAccount) return showToast("Sign in to delete account characters.", true);
    void apiRequest(`/api/characters/${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {
      workspace.characters = workspace.characters.filter(item => item.id !== id);
      signedInAccount.characters = workspace.characters;
      workspace.gear = workspace.gear.map(item => item.characterId === id ? { ...item, characterId: "" } : item);
      workspace.campaigns = workspace.campaigns.map(campaign => ({ ...campaign, characterIds: (campaign.characterIds ?? []).filter(characterId => characterId !== id) }));
      workspace.demo = false;
      addActivity(`${character.name} was removed from the roster`, "Character deleted");
      saveWorkspace();
      showToast("Character deleted.");
    }).catch(error => showToast(error.message || "Could not delete the character.", true));
  }
  if (action === "edit-campaign") openForm("campaign", id);
  if (action === "delete-campaign") {
    const campaign = workspace.campaigns.find(item => item.id === id);
    if (!campaign || !confirmAction(`Delete ${campaign.name} and its session notes? Characters and gear will be kept.`)) return;
    workspace.campaigns = workspace.campaigns.filter(item => item.id !== id);
    workspace.demo = false;
    addActivity(`${campaign.name} was removed`, "Campaign deleted");
    if (saveWorkspace()) showToast("Campaign deleted.");
  }
  if (action === "add-session") openForm("session", id);
  if (action === "edit-session") openForm("session", id, button.dataset.sessionId);
  if (action === "delete-session") {
    const campaign = workspace.campaigns.find(item => item.id === id);
    const sessionId = button.dataset.sessionId;
    const session = campaign?.sessions?.find(item => item.id === sessionId);
    if (!campaign || !session || !confirmAction(`Delete session "${session.title}"?`)) return;
    campaign.sessions = campaign.sessions.filter(item => item.id !== sessionId);
    workspace.demo = false;
    addActivity(`A session was removed from ${campaign.name}`, session.title);
    if (saveWorkspace()) showToast("Session deleted.");
  }
  if (action === "edit-gear") {
    const item = workspace.gear.find(entry => entry.id === id);
    if (item) openGearForm(item, item.characterId || "");
    else {
      const owner = workspace.characters.find(character => (character.inventory || []).some(entry => entry.id === id));
      const inventoryItem = owner?.inventory.find(entry => entry.id === id);
      if (owner && inventoryItem) openGearForm(inventoryItem, owner.id);
    }
  }
  if (action === "delete-gear") {
    const item = workspace.gear.find(entry => entry.id === id);
    const inventoryOwner = workspace.characters.find(character => (character.inventory || []).some(entry => entry.id === id));
    if (!item && !inventoryOwner) return;
    const itemName = item?.name || inventoryOwner.inventory.find(entry => entry.id === id)?.name;
    if (!confirmAction(`Remove ${itemName} from the inventory ledger?`)) return;
    workspace.gear = workspace.gear.filter(entry => entry.id !== id);
    if (inventoryOwner && signedInAccount) {
      inventoryOwner.inventory = inventoryOwner.inventory.filter(entry => entry.id !== id);
      void saveCharacterToAccount(inventoryOwner, inventoryOwner, null);
    }
    workspace.demo = false;
    addActivity(`${itemName} was removed from the ledger`, "Gear deleted");
    if (saveWorkspace()) showToast("Item removed.");
  }
}

document.addEventListener("click", event => {
  const friendTabButton = event.target.closest("[data-friend-tab]");
  if (friendTabButton) {
    friendTab = friendTabButton.dataset.friendTab;
    renderDashboard();
    return;
  }
  const nav = event.target.closest("[data-view]");
  if (nav) {
    showView(nav.dataset.view);
    return;
  }
  const viewLink = event.target.closest("[data-view-link]");
  if (viewLink) {
    showView(viewLink.dataset.viewLink);
    return;
  }
  const create = event.target.closest("[data-new]");
  if (create) {
    openForm(create.dataset.new);
    return;
  }
  const sheetSection = event.target.closest("[data-sheet-tab]");
  if (sheetSection) {
    sheetTab = sheetSection.dataset.sheetTab;
    renderSheet();
    return;
  }
  const boardTabButton = event.target.closest("[data-board-tab]");
  if (boardTabButton) {
    boardTab = boardTabButton.dataset.boardTab;
    renderPalette();
    return;
  }
  const paletteItem = event.target.closest("[data-palette-kind]");
  if (paletteItem) {
    addBoardPiece(paletteItem.dataset.paletteKind, Number(paletteItem.dataset.paletteIndex));
    return;
  }
  const boardPiece = event.target.closest("[data-piece-id][data-piece-kind]");
  if (boardPiece) {
    selectedBoardPieceId = boardPiece.dataset.pieceId;
    selectedBoardPieceKind = boardPiece.dataset.pieceKind;
    if (selectedBoardPieceKind === "token") selectedBoardTokenId = selectedBoardPieceId;
    renderBoard();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    if (action.tagName === "A") event.preventDefault();
    handleAction(action);
  }
});

document.addEventListener("submit", event => {
  if (event.target.id === "friend-search-form") {
    event.preventDefault();
    void searchFriendUsers(event.target);
    return;
  }
  if (event.target.id === "friend-message-form") {
    event.preventDefault();
    const form = event.target;
    const friend = friendData.friends.find(item => item.id === selectedMessageFriendId);
    const text = String(new FormData(form).get("text") || "").trim();
    if (!friend || !text) return;
    void sendDirectMessage(friend.id, text).then(() => showToast(`Message sent to ${friend.username}.`))
      .catch(error => showToast(error.message || "Could not send your message.", true));
    return;
  }
  if (event.target.matches("[data-character-vitals-form]")) {
    event.preventDefault();
    void saveSheetVitals(event.target);
    return;
  }
  if (event.target.matches("[data-eddies-form]")) {
    event.preventDefault();
    void saveCharacterEddies(event.target);
    return;
  }
  if (event.target.matches(".dialog-form")) {
    event.preventDefault();
    persistForm(event.target);
  }
});

document.getElementById("sheet-character").addEventListener("change", event => {
  selectedSheetCharacterId = event.target.value;
  sheetTab = "overview";
  recordCharacterOpened(selectedSheetCharacterId);
});
document.addEventListener("change", event => {
  const conversation = event.target.closest("[data-friend-conversation]");
  if (conversation) {
    selectedMessageFriendId = conversation.value;
    renderDashboard();
  }
});
document.getElementById("board-connect").addEventListener("click", () => connectToCampaign(
  activeBoardCampaignId,
  activeBoardCampaignName,
  document.getElementById("board-player-name").value,
  document.getElementById("board-gm-key").value.trim()
));
document.addEventListener("change", event => {
  const characterForm = event.target.closest('form[name="character-form"]');
  if (characterForm && ["attributeMethod", "cinematicTier"].includes(event.target.name)) updateAttributeAllocation(characterForm);
  if (characterForm && ["normalSkill", "specialSkill"].includes(event.target.name)) updateSkillAllocation(characterForm);
  if (event.target.id === "catalog-file") {
    const file = event.target.files?.[0];
    if (file) void importCatalogFile(file);
    event.target.value = "";
  }
  const initiative = event.target.closest("[data-initiative-token]");
  if (initiative) setInitiative(initiative.dataset.initiativeToken, initiative.value);
  if (event.target.id === "roll-character") {
    boardRollCharacterId = event.target.value;
    boardRollSkillName = "";
    renderBoardSide();
  }
  if (event.target.id === "roll-skill") boardRollSkillName = event.target.value;
  if (event.target.id === "roll-attribute") boardRollAttribute = event.target.value;
  if (event.target.id === "roll-weapon") boardRollWeapon = event.target.value;
  if (event.target.id === "catalog-category-filter") {
    catalogFilter = event.target.value;
    if (catalogFilter.toLowerCase() !== "weapon") catalogTypeFilter = "All";
    const typeFilter = document.getElementById("catalog-type-filter");
    if (typeFilter) {
      typeFilter.value = catalogTypeFilter;
      typeFilter.disabled = catalogFilter !== "All" && catalogFilter.toLowerCase() !== "weapon";
    }
    renderCatalogSearchResults();
  }
  if (event.target.id === "catalog-type-filter") {
    catalogTypeFilter = event.target.value;
    renderCatalogSearchResults();
  }
});
document.addEventListener("input", event => {
  const characterForm = event.target.closest('form[name="character-form"]');
  if (characterForm && event.target.name.startsWith("attr-")) updateAttributeAllocation(characterForm);
  if (characterForm && ["normalSkillPoints", "specialSkillPoints"].includes(event.target.name)) updateSkillAllocation(characterForm);
  const purchaseForm = event.target.closest('form[name="catalog-purchase-form"]');
  if (purchaseForm && ["chipLevel", "chipPricePerLevel"].includes(event.target.name)) updateCatalogPurchaseTotal(purchaseForm);
  if (event.target.id === "catalog-search") {
    catalogSearch = event.target.value;
    renderCatalogSearchResults();
    return;
  }
  if (event.target.id === "roll-target" && Number.isFinite(Number(event.target.value))) boardRollTarget = Number(event.target.value);
  if (event.target.id === "roll-modifier" && Number.isFinite(Number(event.target.value))) boardRollModifier = Number(event.target.value);
});
document.addEventListener("dragstart", event => {
  const palette = event.target.closest("[data-palette-kind]");
  const piece = event.target.closest("[data-piece-id][data-piece-kind]");
  if (palette) {
    event.dataTransfer?.setData("application/afterdark-piece", JSON.stringify({ source: "palette", kind: palette.dataset.paletteKind, index: Number(palette.dataset.paletteIndex) }));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
  } else if (piece) {
    event.dataTransfer?.setData("application/afterdark-piece", JSON.stringify({ source: "board", kind: piece.dataset.pieceKind, id: piece.dataset.pieceId }));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
});
document.getElementById("board-grid").addEventListener("dragover", event => event.preventDefault());
document.getElementById("board-grid").addEventListener("drop", event => {
  event.preventDefault();
  updateBoardPosition(event);
});
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  const focusTarget = document.querySelector(`[data-new="${activeView === "campaigns" ? "campaign" : "character"}"]`);
  focusTarget?.focus();
});
catalogDialog.addEventListener("click", event => {
  if (event.target === catalogDialog) catalogDialog.close();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && dialog.open) dialog.close();
});

renderAll();
void initializeAccount();
