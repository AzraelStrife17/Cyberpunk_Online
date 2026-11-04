export const ATTRIBUTES = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"];
export const BODY_LOCATIONS = [
  { key: "head", label: "Head" },
  { key: "torso", label: "Torso" },
  { key: "rightArm", label: "Right arm" },
  { key: "leftArm", label: "Left arm" },
  { key: "rightLeg", label: "Right leg" },
  { key: "leftLeg", label: "Left leg" }
];

export function normalizeSkill(skill) {
  if (skill && typeof skill === "object") {
    return { name: String(skill.name ?? "").trim(), value: Number.isFinite(Number(skill.value)) ? Number(skill.value) : 0, special: Boolean(skill.special) };
  }
  const match = String(skill ?? "").trim().match(/^(.*?)(?:\s*:\s*(-?\d+))?$/);
  return { name: match?.[1]?.trim() ?? "", value: match?.[2] ? Number(match[2]) : 0, special: false };
}

export function skillText(skills = []) {
  return skills.map(normalizeSkill).filter(skill => skill.name).map(skill => skill.value ? `${skill.name}: ${skill.value}` : skill.name).join(", ");
}

export function skillEntries(text, previousSkills = []) {
  const previousSpecialSkills = new Set(previousSkills.map(normalizeSkill).filter(skill => skill.special).map(skill => skill.name.toLowerCase()));
  return String(text).split(",").map(entry => normalizeSkill(entry)).filter(skill => skill.name)
    .map(skill => ({ ...skill, special: previousSpecialSkills.has(skill.name.toLowerCase()) }));
}

export function normalizeOptionalInteger(value, max) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

export function readOptionalFormInteger(formData, name, max) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : undefined;
}

export function normalizeBodyHealth(value) {
  return Object.fromEntries(BODY_LOCATIONS.map(({ key }) => {
    const location = value?.[key] || {};
    return [key, {
      current: normalizeOptionalInteger(location.current, 9999),
      max: normalizeOptionalInteger(location.max, 9999)
    }];
  }));
}

export function normalizeBodyArmorSP(value) {
  return Object.fromEntries(BODY_LOCATIONS.map(({ key }) => [key, normalizeOptionalInteger(value?.[key], 9999)]));
}

export function startingHumanityFor(character) {
  return Math.max(0, Number(character.attributes?.EMP) || 0) * 10;
}

export function currentHumanityFor(character) {
  const maximum = startingHumanityFor(character);
  const humanity = Number(character.humanity);
  return isValidHumanityAmount(humanity, maximum) ? humanity : maximum;
}

export function currentEmpathyFor(character) {
  const original = Number(character.attributes?.EMP) || 0;
  return Math.min(original, Math.ceil(currentHumanityFor(character) / 10));
}

export function isValidHumanityAmount(value, maximum) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= maximum
    && Math.abs(amount * 2 - Math.round(amount * 2)) < 1e-8;
}

export function humanityLossForItem(item) {
  if (String(item?.category || "").toLowerCase() !== "cyberware") return "0";
  return String(item.humanityLoss ?? "5").trim() || "5";
}

export function staticHumanityLoss(notation) {
  const match = String(notation).trim().match(/^(\d+(?:\.\d+)?)(?:\s*pts?)?$/i);
  return match ? Number(match[1]) : null;
}

export function humanityLossChoices(notation) {
  const choices = String(notation).split("/");
  return choices.length === 2 && choices.every(choice => /^\d+d\d+(?:\+\d+)?$/i.test(choice))
    ? choices
    : [];
}

export function validHumanityLossNotation(value) {
  const notation = String(value ?? "").replace(/\s+/g, "");
  const fixed = notation.match(/^(\d+(?:\.\d+)?)(?:pts?)?$/i);
  if (fixed) return isValidHumanityAmount(Number(fixed[1]), 9999);
  if (!/^\d+d\d+(?:\+\d+)?(?:\/(?:\d+(?:\.\d+)?|\d+d\d+(?:\+\d+)?|pair))?$/i.test(notation)) return false;
  const divisor = notation.match(/\/(\d+(?:\.\d+)?)$/);
  return !divisor || Number(divisor[1]) === 1 || Number(divisor[1]) === 2;
}

export function normalizeCharacter(character) {
  const current = character.healthCurrent;
  const maximum = character.healthMax;
  const eddies = Number(character.eddies);
  const inventory = Array.isArray(character.inventory)
    ? character.inventory.map(item => ({
      ...item,
      humanityLoss: humanityLossForItem(item),
      humanityCharged: Boolean(item.humanityCharged || (item.equipped && character.humanity != null)),
      humanityLossPaid: isValidHumanityAmount(item.humanityLossPaid, 9999) ? Number(item.humanityLossPaid) : 0
    }))
    : [];
  const humanityMaximum = startingHumanityFor(character);
  const installedLoss = inventory
    .filter(item => item.equipped && String(item.category || "").toLowerCase() === "cyberware")
    .reduce((sum, item) => sum + (Number.isFinite(item.humanityLossPaid) && item.humanityLossPaid > 0
      ? item.humanityLossPaid
      : staticHumanityLoss(humanityLossForItem(item)) || 0), 0);
  const humanity = character.humanity == null || character.humanity === ""
    ? Math.max(0, humanityMaximum - installedLoss)
    : Number(character.humanity);
  return {
    ...character,
    skills: Array.isArray(character.skills) ? character.skills.map(normalizeSkill).filter(skill => skill.name) : [],
    inventory,
    humanity: isValidHumanityAmount(humanity, humanityMaximum) ? humanity : Math.max(0, humanityMaximum - installedLoss),
    bodyHealth: normalizeBodyHealth(character.bodyHealth),
    bodyArmorSP: normalizeBodyArmorSP(character.bodyArmorSP),
    healthCurrent: current != null && Number.isFinite(Number(current)) ? Number(current) : null,
    healthMax: maximum != null && Number.isFinite(Number(maximum)) ? Number(maximum) : null,
    eddies: Number.isInteger(eddies) ? Math.max(0, Math.min(999999999, eddies)) : 0
  };
}
