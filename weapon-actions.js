export const WEAPON_TYPE_OPTIONS = [
  "Handgun",
  "Light autopistol",
  "Medium autopistol",
  "Heavy autopistol",
  "Very heavy autopistol",
  "Submachinegun",
  "Light submachinegun",
  "Medium submachinegun",
  "Heavy submachinegun",
  "Rifle",
  "Assault rifle",
  "Shotgun",
  "Heavy weapon",
  "Melee",
  "Exotic handgun",
  "Exotic"
];

export const WEAPON_CONCEALABILITY_OPTIONS = ["P", "J", "L", "N"];
export const WEAPON_RELIABILITY_OPTIONS = ["ST", "UR", "VR", "NA"];
export const WEAPON_DAMAGE_DIE_OPTIONS = [4, 6, 8, 10, 12, 20, 100];

export function parseDamageFormula(formula) {
  const match = /^(\d+)D(\d+)(?:([+-])(\d+))?$/i.exec(String(formula || "").trim());
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[4] || 0) * (match[3] === "-" ? -1 : 1);
  if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(sides) || sides < 2 || sides > 1000 || Math.abs(modifier) > 999) return null;
  return { count, sides, modifier };
}

export function weaponCombatData(item) {
  const stats = String(item?.weaponStats || item?.description || item?.details || "");
  const damageAndAmmo = stats.match(/damage(?:\/ammo)?:\s*([^;]+)/i)?.[1] || stats;
  const damageFormula = damageAndAmmo.match(/\b\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?/i)?.[0].replace(/\s+/g, "").toUpperCase() || "—";
  const ammoType = String(item?.ammoType || damageAndAmmo.match(/\(([^)]+)\)/)?.[1] || "").trim();
  const statsNumber = (label, fallback = 0) => {
    const value = stats.match(new RegExp(`\\b${label}:\\s*(-?\\d+)`, "i"))?.[1];
    return value == null ? fallback : Number(value);
  };
  const fieldNumber = (field, label) => item?.[field] == null || item[field] === ""
    ? statsNumber(label)
    : Number(item[field]);
  const capacity = fieldNumber("shots", "shots");
  const rateOfFire = fieldNumber("rateOfFire", "ROF");
  const weaponAccuracy = fieldNumber("weaponAccuracy", "WA");
  const concealability = String(item?.concealability || stats.match(/\bconcealability:\s*([^;]+)/i)?.[1] || "").trim();
  const reliability = String(item?.reliability || stats.match(/\breliability:\s*([^;]+)/i)?.[1] || "").trim();
  const storedRange = fieldNumber("rangeMm", "range");
  const rangeMm = item?.rangeMm != null && item.rangeMm !== ""
    ? storedRange
    : stats.match(/\brange:\s*(\d+)\s*m(?:m)?\b/i)
      ? Number(stats.match(/\brange:\s*(\d+)\s*m(?:m)?\b/i)[1]) * (stats.match(/\brange:\s*\d+\s*(mm)\b/i) ? 1 : 1000)
      : 0;
  return { damageFormula, ammoType, capacity, rateOfFire, weaponAccuracy, concealability, reliability, rangeMm };
}

export function isWeaponItem(item) {
  return String(item?.category || "").toLowerCase() === "weapon";
}

export function usesAmmunition(item) {
  const combat = weaponCombatData(item);
  return isWeaponActionItem(item) && Boolean(combat.ammoType) && combat.capacity > 0;
}

export function loadedRoundsFor(item) {
  if (!usesAmmunition(item)) return null;
  const capacity = weaponCombatData(item).capacity;
  if (item?.ammoLoaded == null || item.ammoLoaded === "") return capacity;
  const loaded = Number(item.ammoLoaded);
  return Number.isInteger(loaded) && loaded >= 0 ? Math.min(loaded, capacity) : capacity;
}

export function consumeWeaponRounds(item, rounds) {
  const combat = weaponCombatData(item);
  const maximumRounds = combat.rateOfFire || combat.capacity || 1;
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > maximumRounds) {
    return { error: `Rounds fired must be from 1 to ${maximumRounds}.` };
  }
  if (!usesAmmunition(item)) return { item: { ...item }, rounds };
  const loaded = loadedRoundsFor(item);
  if (rounds > loaded) return { error: `Only ${loaded} round${loaded === 1 ? "" : "s"} remain. Reload before firing.` };
  return { item: { ...item, ammoLoaded: loaded - rounds }, rounds };
}

export function reloadWeapon(item, inventory) {
  if (!usesAmmunition(item)) return { error: "This weapon does not use reloadable ammunition." };
  const combat = weaponCombatData(item);
  const loaded = loadedRoundsFor(item);
  const needed = combat.capacity - loaded;
  if (needed <= 0) return { error: "This weapon is already fully loaded." };
  const ammo = inventory.find(entry =>
    String(entry.category || "").toLowerCase() === "ammo"
    && String(entry.ammoType || entry.name || "").trim().toLowerCase() === combat.ammoType.toLowerCase()
  );
  const stock = Number(ammo?.quantity || 0);
  if (!ammo || !Number.isInteger(stock) || stock < 1) return { error: `No ${combat.ammoType} ammunition is available in inventory.` };
  const rounds = Math.min(needed, stock);
  return {
    weapon: { ...item, ammoLoaded: loaded + rounds },
    ammo: { ...ammo, quantity: stock - rounds },
    rounds,
    ammoType: combat.ammoType
  };
}

export function validateCustomWeapon(weapon) {
  if (!WEAPON_TYPE_OPTIONS.includes(weapon.weaponType)) return "Choose a weapon type.";
  if (weapon.weaponType !== "Melee" && !String(weapon.ammoType || "").trim()) return "Enter an ammunition type.";
  if (!WEAPON_CONCEALABILITY_OPTIONS.includes(weapon.concealability)) return "Choose a concealability type.";
  if (!Number.isInteger(weapon.weaponAccuracy) || weapon.weaponAccuracy < -3 || weapon.weaponAccuracy > 3) return "Weapon accuracy must be a whole number from -3 to +3.";
  if (!Number.isInteger(weapon.shots) || weapon.shots < 0 || weapon.shots > 9999) return "Shots must be a whole number from 0 to 9,999.";
  if (!Number.isInteger(weapon.rateOfFire) || weapon.rateOfFire < 1 || weapon.rateOfFire > 999) return "Rate of Fire must be a whole number from 1 to 999.";
  if (!Number.isInteger(weapon.damageDice) || weapon.damageDice < 1 || weapon.damageDice > 100) return "Damage dice must be a whole number from 1 to 100.";
  if (!WEAPON_DAMAGE_DIE_OPTIONS.includes(weapon.damageDieType)) return "Choose a valid damage die type.";
  if (!Number.isInteger(weapon.damageBonus) || Math.abs(weapon.damageBonus) > 999) return "Damage bonus must be a whole number from -999 to +999.";
  if (!WEAPON_RELIABILITY_OPTIONS.includes(weapon.reliability)) return "Choose a reliability rating.";
  if (!Number.isInteger(weapon.rangeMm) || weapon.rangeMm < 0 || weapon.rangeMm > 99999999) return "Range must be a whole number of millimeters.";
  return "";
}

export function validateCyberwareWeapon(weapon) {
  if (weapon.weaponType && weapon.weaponType !== "Heavy Weapons" && !WEAPON_TYPE_OPTIONS.includes(weapon.weaponType)) return "Choose a valid cyberware attack type.";
  if (weapon.concealability && !WEAPON_CONCEALABILITY_OPTIONS.includes(weapon.concealability)) return "Choose a valid concealability type.";
  if (weapon.weaponAccuracy != null && (!Number.isInteger(weapon.weaponAccuracy) || weapon.weaponAccuracy < -3 || weapon.weaponAccuracy > 3)) {
    return "Weapon accuracy must be a whole number from -3 to +3.";
  }
  if (weapon.shots != null && (!Number.isInteger(weapon.shots) || weapon.shots < 0 || weapon.shots > 9999)) {
    return "Shots must be a whole number from 0 to 9,999.";
  }
  if (weapon.rateOfFire != null && (!Number.isInteger(weapon.rateOfFire) || weapon.rateOfFire < 1 || weapon.rateOfFire > 999)) {
    return "Rate of Fire must be a whole number from 1 to 999.";
  }
  if (!Number.isInteger(weapon.damageDice) || weapon.damageDice < 1 || weapon.damageDice > 100) {
    return "Damage dice must be a whole number from 1 to 100.";
  }
  if (!WEAPON_DAMAGE_DIE_OPTIONS.includes(weapon.damageDieType)) return "Choose a valid damage die type.";
  if (weapon.damageBonus != null && (!Number.isInteger(weapon.damageBonus) || Math.abs(weapon.damageBonus) > 999)) {
    return "Damage bonus must be a whole number from -999 to +999.";
  }
  if (weapon.reliability && !WEAPON_RELIABILITY_OPTIONS.includes(weapon.reliability)) return "Choose a valid reliability rating.";
  if (weapon.rangeMm != null && (!Number.isInteger(weapon.rangeMm) || weapon.rangeMm < 0 || weapon.rangeMm > 99999999)) {
    return "Range must be a whole number of millimeters.";
  }
  return "";
}

export function formatWeaponStats(weapon) {
  const damageBonus = weapon.damageBonus ? `${weapon.damageBonus > 0 ? "+" : ""}${weapon.damageBonus}` : "";
  const damageAmmo = `${weapon.damageDice}D${weapon.damageDieType}${damageBonus}${weapon.ammoType ? ` (${weapon.ammoType})` : ""}`;
  return [
    weapon.weaponType ? `Type: ${weapon.weaponType}` : "",
    weapon.weaponAccuracy != null && weapon.weaponAccuracy !== "" ? `WA: ${weapon.weaponAccuracy}` : "",
    weapon.concealability ? `concealability: ${weapon.concealability}` : "",
    `damage/ammo: ${damageAmmo}`,
    weapon.shots != null && weapon.shots !== "" ? `shots: ${weapon.shots}` : "",
    weapon.rateOfFire != null && weapon.rateOfFire !== "" ? `ROF: ${weapon.rateOfFire}` : "",
    weapon.reliability ? `reliability: ${weapon.reliability}` : "",
    weapon.rangeMm != null && weapon.rangeMm !== "" ? `range: ${weapon.rangeMm}mm` : ""
  ].filter(Boolean).join("; ");
}

export function weaponSkillNamesForType(type) {
  const aliases = [
    { match: /handgun|autopistol|revolver|pistol/, names: ["Handgun"] },
    { match: /submachine|\bsmg\b/, names: ["Submachinegun", "Submachine Gun", "SMG"] },
    { match: /shotgun/, names: ["Shotgun", "Rifle"] },
    { match: /rifle/, names: ["Rifle"] },
    { match: /heavy weapon|machine gun|launcher|grenade|flamethrower/, names: ["Heavy Weapons"] },
    { match: /melee|knife|sword|katana|blade/, names: ["Melee", "Fencing"] }
  ].find(entry => entry.match.test(String(type || "").toLowerCase()));
  return aliases?.names || [type || ""];
}

export function weaponAttackTotal(die, reflex, skillValue, item) {
  return Number(die) + Number(reflex) + Number(skillValue) + weaponCombatData(item).weaponAccuracy;
}

export function hasCyberwareWeaponFeature(item) {
  if (String(item?.category || "").toLowerCase() !== "cyberware") return false;
  return Boolean(String(item.weaponType || "").trim() || parseDamageFormula(weaponCombatData(item).damageFormula));
}

export function isWeaponActionItem(item) {
  return isWeaponItem(item) || hasCyberwareWeaponFeature(item);
}
