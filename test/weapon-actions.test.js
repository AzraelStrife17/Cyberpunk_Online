import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  consumeWeaponRounds,
  formatWeaponStats,
  isWeaponActionItem,
  loadedRoundsFor,
  parseDamageFormula,
  reloadWeapon,
  usesAmmunition,
  validateCyberwareWeapon,
  validateCustomWeapon,
  weaponAttackTotal,
  weaponCombatData,
  weaponSkillNamesForType
} from "../weapon-actions.js";

const catalog = JSON.parse(await readFile(new URL("../catalog/cyberware-summaries.json", import.meta.url), "utf8"));
const weaponCyberware = catalog.filter(item => item.weaponType);
const weapons = JSON.parse(await readFile(new URL("../catalog/weapon-summaries.json", import.meta.url), "utf8"));
const ammoCatalog = JSON.parse(await readFile(new URL("../catalog/ammo-summaries.json", import.meta.url), "utf8"));

test("catalog marks exactly the intended cyberware as weapon actions", () => {
  const expected = {
    "Scratchers": "Melee",
    "Implanted Fangs (Vampires)": "Melee",
    "Rippers": "Melee",
    "Wolvers": "Melee",
    "Big Knucks": "Melee",
    "Slice N' Dice": "Melee",
    "Cybersnake": "Melee",
    "Dartgun": "Handgun",
    "Ripper Hand": "Melee",
    "Hammer Hand": "Melee",
    "BuzzHand": "Melee",
    "Spike Hand": "Melee",
    "Talon Foot": "Melee",
    "Spike Heel Foot": "Melee",
    "Grenade Launcher (Cyberlimb)": "Heavy Weapons",
    "Micro-Missile Launcher": "Heavy Weapons",
    "Popup Gun": "Handgun",
    "Flame Thrower (Cyberlimb)": "Heavy Weapons",
    "2 Shot Capacitor Laser": "Heavy Weapons"
  };
  assert.deepEqual(
    Object.fromEntries(weaponCyberware.map(item => [item.name, item.weaponType])),
    expected
  );
  assert.ok(weaponCyberware.every(item => item.category === "Cyberware" && isWeaponActionItem(item)));
});

test("weapon-capable cyberware without damage formulas can still make attack actions", () => {
  const ripperHand = weaponCyberware.find(item => item.name === "Ripper Hand");
  assert.ok(isWeaponActionItem(ripperHand));
  assert.equal(weaponCombatData(ripperHand).damageFormula, "—");
});

test("ordinary cyberware remains excluded unless it has a damage formula", () => {
  assert.equal(isWeaponActionItem({ category: "Cyberware", name: "Biomonitor" }), false);
  assert.equal(isWeaponActionItem({ category: "Cyberware", weaponStats: "Damage: 2d6" }), true);
});

test("ordinary weapons remain attack actions and non-weapons do not", () => {
  assert.equal(isWeaponActionItem({ category: "Weapon" }), true);
  assert.equal(isWeaponActionItem({ category: "Gear" }), false);
});

test("damage formulas enforce supported dice and modifier bounds", () => {
  assert.deepEqual(parseDamageFormula("2d6+1"), { count: 2, sides: 6, modifier: 1 });
  assert.deepEqual(parseDamageFormula("3D10-2"), { count: 3, sides: 10, modifier: -2 });
  assert.equal(parseDamageFormula("0d6"), null);
  assert.equal(parseDamageFormula("2d1"), null);
  assert.equal(parseDamageFormula("101d6"), null);
  assert.equal(parseDamageFormula("not damage"), null);
});

test("custom weapon creation validates fields and produces usable combat stats", () => {
  const customWeapon = {
    weaponType: "Handgun",
    ammoType: "9mm",
    concealability: "J",
    weaponAccuracy: 2,
    shots: 6,
    rateOfFire: 2,
    damageDice: 2,
    damageDieType: 6,
    damageBonus: 1,
    reliability: "ST",
    rangeMm: 50000
  };
  assert.equal(validateCustomWeapon(customWeapon), "");
  const weapon = {
    category: "Weapon",
    ...customWeapon,
    weaponStats: formatWeaponStats(customWeapon)
  };
  assert.deepEqual(weaponCombatData(weapon), {
    damageFormula: "2D6+1",
    ammoType: "9mm",
    capacity: 6,
    rateOfFire: 2,
    weaponAccuracy: 2,
    concealability: "J",
    reliability: "ST",
    rangeMm: 50000
  });
  assert.deepEqual(weaponSkillNamesForType(weapon.weaponType), ["Handgun"]);
  assert.equal(weaponAttackTotal(7, 8, 5, weapon), 22);
  assert.equal(validateCustomWeapon({ ...customWeapon, weaponAccuracy: 4 }), "Weapon accuracy must be a whole number from -3 to +3.");
  assert.equal(validateCustomWeapon({ ...customWeapon, ammoType: "" }), "Enter an ammunition type.");
});

test("cyberware weapon profiles require damage but keep other combat fields optional", () => {
  const profile = { damageDice: 1, damageDieType: 6 };
  assert.equal(validateCyberwareWeapon(profile), "");
  assert.match(validateCyberwareWeapon({}), /Damage dice/);
  assert.match(validateCyberwareWeapon({ ...profile, weaponAccuracy: 4 }), /Weapon accuracy/);
  const item = {
    category: "Cyberware",
    weaponStats: formatWeaponStats(profile)
  };
  assert.equal(isWeaponActionItem(item), true);
  assert.deepEqual(weaponCombatData(item), {
    damageFormula: "1D6",
    ammoType: "",
    capacity: 0,
    rateOfFire: 0,
    weaponAccuracy: 0,
    concealability: "",
    reliability: "",
    rangeMm: 0
  });
});

test("cyberware weapon profiles can optionally track ammunition and reloads", () => {
  const profile = {
    weaponType: "Handgun",
    ammoType: "9mm",
    shots: 6,
    rateOfFire: 2,
    damageDice: 1,
    damageDieType: 6
  };
  const weapon = {
    category: "Cyberware",
    ...profile,
    ammoLoaded: 2,
    weaponStats: formatWeaponStats(profile)
  };
  assert.equal(validateCyberwareWeapon(profile), "");
  assert.equal(usesAmmunition(weapon), true);
  assert.equal(consumeWeaponRounds(weapon, 2).item.ammoLoaded, 0);
  const reload = reloadWeapon(weapon, [{ id: "ammo", name: "9mm", category: "Ammo", quantity: 3 }]);
  assert.equal(reload.weapon.ammoLoaded, 5);
  assert.equal(reload.ammo.quantity, 0);
});

test("melee custom weapons do not require or track ammunition", () => {
  const melee = {
    weaponType: "Melee",
    ammoType: "",
    concealability: "N",
    weaponAccuracy: -1,
    shots: 0,
    rateOfFire: 1,
    damageDice: 1,
    damageDieType: 10,
    damageBonus: 0,
    reliability: "VR",
    rangeMm: 2000
  };
  assert.equal(validateCustomWeapon(melee), "");
  const weapon = { category: "Weapon", ...melee, weaponStats: formatWeaponStats(melee) };
  assert.equal(usesAmmunition(weapon), false);
  assert.deepEqual(weaponCombatData(weapon).damageFormula, "1D10");
});

test("preexisting weapon ammo types are all included in the catalog", () => {
  const existingAmmo = new Set(weapons.flatMap(item => {
    const stats = String(item.weaponStats || "");
    const match = stats.match(/damage\/ammo:\s*\d+D\d+(?:[+-]\d+)?\s*\(([^)]+)\)/i);
    return match ? [match[1].trim().toLowerCase()] : [];
  }));
  const catalogAmmo = new Set(ammoCatalog.map(item => item.name.toLowerCase()));
  assert.deepEqual([...existingAmmo].filter(type => !catalogAmmo.has(type)), []);
  assert.ok(ammoCatalog.every(item => item.category === "Ammo"));
});

test("firing consumes loaded rounds and blocks shots beyond the magazine", () => {
  const weapon = {
    id: "pistol",
    category: "Weapon",
    ammoType: "9mm",
    ammoLoaded: 1,
    weaponStats: "WA: 0; damage/ammo: 2D6 (9mm); shots: 6; ROF: 2"
  };
  assert.equal(loadedRoundsFor(weapon), 1);
  const fired = consumeWeaponRounds(weapon, 1);
  assert.equal(fired.item.ammoLoaded, 0);
  assert.match(consumeWeaponRounds(fired.item, 1).error, /Reload before firing/);
  assert.match(consumeWeaponRounds(weapon, 3).error, /Rounds fired must be from 1 to 2/);
});

test("reload transfers only available bullets up to magazine capacity", () => {
  const weapon = {
    id: "pistol",
    category: "Weapon",
    ammoType: "9mm",
    ammoLoaded: 0,
    weaponStats: "damage/ammo: 2D6 (9mm); shots: 6; ROF: 2"
  };
  const ammo = { id: "9mm-stock", name: "9mm", category: "Ammo", quantity: 3 };
  const reload = reloadWeapon(weapon, [ammo]);
  assert.equal(reload.rounds, 3);
  assert.equal(reload.weapon.ammoLoaded, 3);
  assert.equal(reload.ammo.quantity, 0);
  assert.equal(reload.ammoType, "9mm");
  assert.match(reloadWeapon(reload.weapon, [reload.ammo]).error, /No 9mm ammunition/);
  assert.match(reloadWeapon({ ...weapon, ammoLoaded: 6 }, [ammo]).error, /already fully loaded/);
});
