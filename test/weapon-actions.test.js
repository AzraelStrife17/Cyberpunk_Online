import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isWeaponActionItem, parseDamageFormula, weaponCombatData } from "../weapon-actions.js";

const catalog = JSON.parse(await readFile(new URL("../catalog/cyberware-summaries.json", import.meta.url), "utf8"));
const weaponCyberware = catalog.filter(item => item.weaponType);

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
