import assert from "node:assert/strict";
import test from "node:test";
import {
  currentEmpathyFor,
  currentHumanityFor,
  normalizeCharacter,
  normalizeSkill,
  skillEntries,
  skillText,
  startingHumanityFor,
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

test("humanity loss notation accepts supported values and rejects invalid divisors", () => {
  assert.equal(validHumanityLossNotation("5"), true);
  assert.equal(validHumanityLossNotation("2D6/2"), true);
  assert.equal(validHumanityLossNotation("2D6/3"), false);
  assert.equal(validHumanityLossNotation("not a formula"), false);
});
