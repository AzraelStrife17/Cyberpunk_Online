export const ATTRIBUTES = ["INT", "REF", "TECH", "COOL", "ATTR", "LUCK", "MA", "BODY", "EMP"];
const MODIFIABLE_ATTRIBUTES = ATTRIBUTES.filter(attribute => attribute !== "EMP");
export const BODY_LOCATIONS = [
  { key: "head", label: "Head" },
  { key: "torso", label: "Torso" },
  { key: "rightArm", label: "Right arm" },
  { key: "leftArm", label: "Left arm" },
  { key: "rightLeg", label: "Right leg" },
  { key: "leftLeg", label: "Left leg" }
];
const ARMOR_LAYER_TYPES = ["standard", "subdermal", "skinweave"];
const ARMOR_CLASSES = ["light", "heavy"];

function validArmorInteger(value, max) {
  if (value == null || value === "") return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= max;
}

export function validArmorItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  if (!validArmorInteger(item.armorSP, 9999) || !validArmorInteger(item.armorEV, 99)) return false;
  if (item.armorLocations != null && (!Array.isArray(item.armorLocations)
    || item.armorLocations.some(location => !BODY_LOCATIONS.some(bodyLocation => bodyLocation.key === location))
    || new Set(item.armorLocations).size !== item.armorLocations.length)) return false;
  if (item.armorLayerType != null && !ARMOR_LAYER_TYPES.includes(item.armorLayerType)) return false;
  if (item.armorClass != null && item.armorClass !== "" && !ARMOR_CLASSES.includes(item.armorClass)) return false;
  if (item.armorLayerOrder != null) {
    const order = Number(item.armorLayerOrder);
    if (!Number.isInteger(order)
      || (item.armorLayerType === "skinweave" ? ![0, 1].includes(order)
        : String(item.category || "").toLowerCase() === "cyberware" ? order !== 1
          : order < 1 || order > 3)) return false;
  }
  return true;
}

export function normalizeArmorItem(item = {}) {
  const armorInteger = (value, max) => normalizeOptionalInteger(value, max);
  const armorLayerType = ARMOR_LAYER_TYPES.includes(item.armorLayerType) ? item.armorLayerType : "standard";
  const category = String(item.category || "").toLowerCase();
  return {
    armorSP: armorInteger(item.armorSP, 9999),
    armorEV: armorInteger(item.armorEV, 99),
    armorLocations: Array.isArray(item.armorLocations)
      ? [...new Set(item.armorLocations.filter(location => BODY_LOCATIONS.some(bodyLocation => bodyLocation.key === location)))]
      : [],
    armorLayerType,
    armorClass: ARMOR_CLASSES.includes(item.armorClass) ? item.armorClass : null,
    armorLayerOrder: armorLayerType === "skinweave" ? 0
      : category === "cyberware" ? 1
        : normalizeOptionalInteger(item.armorLayerOrder, 3) || 1
  };
}

export function armorLoadoutError(inventory) {
  if (inventory == null) return "";
  if (!Array.isArray(inventory) || inventory.some(item => !validArmorItem(item))) {
    return "Armor SP, EV, limb coverage, and layer settings must be valid.";
  }
  const layersByLocation = Object.fromEntries(BODY_LOCATIONS.map(({ key }) => [key, 0]));
  for (const item of inventory) {
    if (!item.equipped || Number(item.quantity ?? 1) <= 0) continue;
    const locations = item.armorLocations || [];
    if (item.armorSP != null && Number(item.armorSP) > 0 && !locations.length) {
      return `Choose at least one covered limb for ${item.name || "each equipped armor item"}.`;
    }
    if (item.armorLayerType === "skinweave") continue;
    const quantity = Math.max(1, Number(item.quantity) || 1);
    for (const location of locations) layersByLocation[location] += quantity;
  }
  const overLayeredLocation = BODY_LOCATIONS.find(({ key }) => layersByLocation[key] > 3);
  return overLayeredLocation ? `A limb can have no more than three armor layers (${overLayeredLocation.label} exceeds the limit).` : "";
}

const armorLayerBonus = difference => {
  if (difference <= 4) return 5;
  if (difference <= 8) return 4;
  if (difference <= 14) return 3;
  if (difference <= 20) return 2;
  if (difference <= 26) return 1;
  return 0;
};

export function armorCalculationFor(character, inventory = character?.inventory || []) {
  const equippedArmor = inventory.filter(item => item?.equipped && Number(item.quantity ?? 1) > 0
    && (item.armorSP != null || item.armorEV != null || item.armorLocations?.length));
  const itemEV = equippedArmor.reduce((sum, item) =>
    sum + (Number(item.armorEV) || 0) * Math.max(1, Number(item.quantity) || 1), 0);
  const limbs = Object.fromEntries(BODY_LOCATIONS.map(({ key }) => {
    const layers = [];
    for (const [index, item] of equippedArmor.entries()) {
      if (!item.armorLocations?.includes(key)) continue;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      for (let copy = 0; copy < quantity; copy += 1) {
        layers.push({
          sp: item.armorSP == null ? null : Number(item.armorSP),
          type: item.armorLayerType || "standard",
          order: item.armorLayerType === "skinweave" || String(item.category || "").toLowerCase() === "cyberware"
            ? 1
            : Number(item.armorLayerOrder) || 1,
          cyberware: String(item.category || "").toLowerCase() === "cyberware",
          index
        });
      }
    }
    layers.sort((first, second) =>
      first.order - second.order
      || (first.type === "skinweave" ? 0 : first.cyberware ? 1 : 2)
        - (second.type === "skinweave" ? 0 : second.cyberware ? 1 : 2)
      || first.index - second.index
    );
    const effectiveLayerCount = layers.filter(layer => layer.type !== "skinweave").length;
    let sp = null;
    for (const layer of layers) {
      if (layer.sp == null) continue;
      sp = sp == null ? layer.sp : layer.sp + armorLayerBonus(Math.abs(layer.sp - sp));
    }
    if (sp == null) sp = normalizeOptionalInteger(character?.bodyArmorSP?.[key], 9999);
    return [key, { sp, layerCount: effectiveLayerCount }];
  }));
  const maxLayerCount = Math.max(0, ...Object.values(limbs).map(limb => limb.layerCount));
  const layerEV = Math.max(0, maxLayerCount - 1);
  return { limbs, itemEV, layerEV, totalEV: itemEV + layerEV };
}

export function playerCharacterCount(characters = []) {
  return characters.filter(character => !character.isNpc).length;
}

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
      current: normalizeOptionalInteger(location.current, 9999)
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

export function validAttributeBonuses(value, category) {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (String(category || "").toLowerCase() !== "cyberware") return keys.length === 0;
  return keys.every(attribute => MODIFIABLE_ATTRIBUTES.includes(attribute)
    && Number.isInteger(Number(value[attribute]))
    && Number(value[attribute]) >= -100
    && Number(value[attribute]) <= 100);
}

export function normalizeAttributeBonuses(value, category) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || String(category || "").toLowerCase() !== "cyberware") return {};
  return Object.fromEntries(MODIFIABLE_ATTRIBUTES
    .filter(attribute => Number.isInteger(Number(value[attribute]))
      && Number(value[attribute]) >= -100
      && Number(value[attribute]) <= 100
      && Number(value[attribute]) !== 0)
    .map(attribute => [attribute, Number(value[attribute])]));
}

export function effectiveAttributesFor(character, inventory = character?.inventory || []) {
  const attributes = Object.fromEntries(ATTRIBUTES.map(attribute => [
    attribute,
    Number(character?.attributes?.[attribute]) || 0
  ]));
  for (const item of inventory) {
    if (!item?.equipped || Number(item.quantity ?? 1) <= 0
      || String(item.category || "").toLowerCase() !== "cyberware") continue;
    for (const [attribute, bonus] of Object.entries(normalizeAttributeBonuses(item.attributeBonuses, item.category))) {
      attributes[attribute] += bonus;
    }
  }
  attributes.REF -= armorCalculationFor(character, inventory).totalEV;
  return attributes;
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
  const { healthMax: _healthMax, ...characterWithoutHealthMax } = character;
  const eddies = Number(character.eddies);
  const inventory = Array.isArray(character.inventory)
    ? character.inventory.map(item => ({
      ...item,
      humanityLoss: humanityLossForItem(item),
      attributeBonuses: normalizeAttributeBonuses(item.attributeBonuses, item.category),
      ...normalizeArmorItem(item),
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
    ...characterWithoutHealthMax,
    isNpc: Boolean(character.isNpc),
    boardWidth: Number.isInteger(Number(character.boardWidth)) && Number(character.boardWidth) >= 1 && Number(character.boardWidth) <= 10
      ? Number(character.boardWidth)
      : 1,
    boardHeight: Number.isInteger(Number(character.boardHeight)) && Number(character.boardHeight) >= 1 && Number(character.boardHeight) <= 10
      ? Number(character.boardHeight)
      : 1,
    skills: Array.isArray(character.skills) ? character.skills.map(normalizeSkill).filter(skill => skill.name) : [],
    inventory,
    humanity: isValidHumanityAmount(humanity, humanityMaximum) ? humanity : Math.max(0, humanityMaximum - installedLoss),
    bodyHealth: normalizeBodyHealth(character.bodyHealth),
    bodyArmorSP: normalizeBodyArmorSP(character.bodyArmorSP),
    healthCurrent: current != null && Number.isFinite(Number(current)) ? Number(current) : null,
    eddies: Number.isInteger(eddies) ? Math.max(0, Math.min(999999999, eddies)) : 0
  };
}
