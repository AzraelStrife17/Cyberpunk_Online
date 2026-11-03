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
  const stats = String(item.weaponStats || item.description || item.details || "");
  const damageAndAmmo = stats.match(/damage(?:\/ammo)?:\s*([^;]+)/i)?.[1] || stats;
  const damageFormula = damageAndAmmo.match(/\b\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?/i)?.[0].replace(/\s+/g, "").toUpperCase() || "—";
  const ammoType = damageAndAmmo.match(/\(([^)]+)\)/)?.[1]?.trim() || "—";
  const capacity = Number(stats.match(/\bshots:\s*(\d+)/i)?.[1]) || 0;
  const rateOfFire = Number(stats.match(/\brof:\s*(\d+)/i)?.[1]) || 0;
  return { damageFormula, ammoType, capacity, rateOfFire };
}

function isWeaponItem(item) {
  return String(item?.category || "").toLowerCase() === "weapon";
}

function hasCyberwareWeaponFeature(item) {
  if (String(item?.category || "").toLowerCase() !== "cyberware") return false;
  return Boolean(String(item.weaponType || "").trim() || parseDamageFormula(weaponCombatData(item).damageFormula));
}

export function isWeaponActionItem(item) {
  return isWeaponItem(item) || hasCyberwareWeaponFeature(item);
}
