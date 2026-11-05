import assert from "node:assert/strict";
import test from "node:test";
import {
  currentEmpathyFor,
  currentHumanityFor,
  effectiveAttributesFor,
  normalizeCharacter,
  normalizeSkill,
  skillEntries,
  skillText,
  startingHumanityFor,
  validAttributeBonuses,
  validHumanityLossNotation
} from "../shared/character-domain.js";

test("skill normalization keeps names, values, and special-skill identity", () => {
  assert.deepEqual(normalizeSkill("Handgun: 4"), { name: "Handgun", value: 4, special: false });
  assert.equal(skillText([{ name: "Streetdeal", value: 3, special: true }]), "Streetdeal: 3");
  assert.deepEqual(skillEntries("Streetdeal: 3, Handgun: 4", [{ name: "Streetdeal", special: true }]), [
    { name: "Streetdeal", value: 3, special: true },
    { name: "Handgun", value: 4, special: false }
  ]);
});

test("character normalization clamps values and derives humanity and body state", () => {
  const character = normalizeCharacter({
    attributes: { EMP: 5 },
    inventory: [{ category: "Cyberware", equipped: true, humanityLoss: "5" }],
    skills: ["Handgun: 4"],
    bodyHealth: { head: { current: 8, max: 10 } },
    bodyArmorSP: { head: 12 },
    eddies: 1000000000
  });
  assert.equal(character.humanity, 45);
  assert.equal(startingHumanityFor(character), 50);
  assert.equal(currentHumanityFor({ ...character, humanity: 39.5 }), 39.5);
  assert.equal(currentEmpathyFor({ ...character, humanity: 39.5 }), 4);
  assert.equal(character.skills[0].name, "Handgun");
  assert.deepEqual(character.bodyHealth.head, { current: 8, max: 10 });
  assert.equal(character.bodyArmorSP.head, 12);
  assert.equal(character.eddies, 999999999);
});

test("NPC normalization preserves an unrestricted skill pool and board footprint", () => {
  const npc = normalizeCharacter({
    isNpc: true,
    boardWidth: 2,
    boardHeight: 2,
    skills: [{ name: "Heavy Weapons", value: 80 }, { name: "Driving", value: 70 }]
  });
  assert.equal(npc.isNpc, true);
  assert.equal(npc.skills.reduce((sum, skill) => sum + skill.value, 0), 150);
  assert.equal(npc.boardWidth, 2);
  assert.equal(npc.boardHeight, 2);
});

test("humanity loss notation accepts supported values and rejects invalid divisors", () => {
  assert.equal(validHumanityLossNotation("5"), true);
  assert.equal(validHumanityLossNotation("2D6/2"), true);
  assert.equal(validHumanityLossNotation("2D6/3"), false);
  assert.equal(validHumanityLossNotation("not a formula"), false);
});

test("installed cyberware raises effective attributes without changing the base cap", () => {
  const character = normalizeCharacter({
    attributes: { BODY: 8, REF: 6 },
    inventory: [{ category: "Cyberware", equipped: true, attributeBonuses: { BODY: 4 } }]
  });
  assert.equal(effectiveAttributesFor(character).BODY, 12);
  assert.equal(character.attributes.BODY, 8);
  assert.equal(effectiveAttributesFor({ ...character, inventory: [{ ...character.inventory[0], equipped: false }] }).BODY, 8);
});

test("attribute bonuses are limited to cyberware and supported modifiers", () => {
  assert.equal(validAttributeBonuses({ BODY: 4 }, "Cyberware"), true);
  assert.equal(validAttributeBonuses({ BODY: 4 }, "Equipment"), false);
  assert.equal(validAttributeBonuses({ EMP: 4 }, "Cyberware"), false);
  assert.equal(validAttributeBonuses({ BODY: 101 }, "Cyberware"), false);
});
