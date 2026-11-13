import assert from "node:assert/strict";
import test from "node:test";
import {
  armorCalculationFor,
  armorLoadoutError,
  currentEmpathyFor,
  currentHumanityFor,
  effectiveAttributesFor,
  normalizeArmorItem,
  normalizeCharacter,
  normalizeSkill,
  playerCharacterCount,
  skillEntries,
  skillText,
  startingHumanityFor,
  validAttributeBonuses,
  validHumanityLossNotation
} from "../shared/character-domain.js";

test("player character count excludes NPCs", () => {
  assert.equal(playerCharacterCount([
    { name: "Player 1", isNpc: false },
    { name: "NPC", isNpc: true },
    { name: "Player 2" }
  ]), 2);
});

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
    healthCurrent: 12,
    healthMax: 10,
    bodyArmorSP: { head: 12 },
    eddies: 1000000000
  });
  assert.equal(character.humanity, 45);
  assert.equal(startingHumanityFor(character), 50);
  assert.equal(currentHumanityFor({ ...character, humanity: 39.5 }), 39.5);
  assert.equal(currentEmpathyFor({ ...character, humanity: 39.5 }), 4);
  assert.equal(character.skills[0].name, "Handgun");
  assert.deepEqual(character.bodyHealth.head, { current: 8 });
  assert.equal(character.healthCurrent, 12);
  assert.equal(Object.hasOwn(character, "healthMax"), false);
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

test("armor SP layers apply the proportional bonus from inner to outer layers", () => {
  const character = { bodyArmorSP: {} };
  const armor = [
    { equipped: true, armorSP: 10, armorLocations: ["head"], armorLayerOrder: 1 },
    { equipped: true, armorSP: 18, armorLocations: ["head"], armorLayerOrder: 2 }
  ];
  assert.equal(armorCalculationFor(character, armor).limbs.head.sp, 22);
  armor.push({ equipped: true, armorSP: 25, armorLocations: ["head"], armorLayerOrder: 3 });
  assert.equal(armorCalculationFor(character, armor).limbs.head.sp, 30);
});

test("manual limb SP is the fallback when equipped armor has no configured SP", () => {
  const character = { bodyArmorSP: { head: 12 } };
  const armor = [{ equipped: true, armorSP: null, armorLocations: ["head"] }];
  assert.equal(armorCalculationFor(character, armor).limbs.head.sp, 12);
});

test("armor EV combines item values with the maximum limb layer penalty and lowers REF", () => {
  const character = {
    attributes: { REF: 10 },
    inventory: [
      { equipped: true, armorSP: 12, armorEV: 1, armorLayerType: "skinweave", armorLocations: ["head"] },
      { equipped: true, armorSP: 15, armorEV: 1, armorLayerType: "subdermal", armorLocations: ["head"] },
      { equipped: true, armorSP: 20, armorEV: 0, armorLayerType: "standard", armorLocations: ["head"] }
    ]
  };
  const armor = armorCalculationFor(character);
  assert.equal(armor.limbs.head.sp, 25);
  assert.equal(armor.limbs.head.layerCount, 2);
  assert.equal(armor.itemEV, 2);
  assert.equal(armor.layerEV, 1);
  assert.equal(armor.totalEV, 3);
  assert.equal(effectiveAttributesFor(character).REF, 7);
});

test("armor loadouts allow three worn layers, excluding Skin Weave, but reject a fourth", () => {
  const makeLayer = (name, type = "standard") => ({
    name,
    equipped: true,
    armorLocations: ["torso"],
    armorLayerType: type
  });
  const allowed = [makeLayer("Skin Weave", "skinweave"), makeLayer("Subdermal", "subdermal"), makeLayer("Layer 2"), makeLayer("Layer 3")];
  assert.equal(armorLoadoutError(allowed), "");
  assert.match(armorLoadoutError([...allowed, makeLayer("Layer 4")]), /Torso exceeds the limit/);
});

test("cyberware stays at layer 1 and Skin Weave calculates as the innermost layer", () => {
  assert.equal(normalizeArmorItem({ category: "Cyberware", armorLayerType: "subdermal", armorLayerOrder: 3 }).armorLayerOrder, 1);
  assert.equal(normalizeArmorItem({ category: "Cyberware", armorLayerType: "skinweave", armorLayerOrder: 2 }).armorLayerOrder, 0);
  const armor = armorCalculationFor({}, [
    { category: "Clothing", equipped: true, armorSP: 25, armorLocations: ["head"], armorLayerOrder: 2 },
    { category: "Cyberware", equipped: true, armorSP: 20, armorLocations: ["head"], armorLayerOrder: 3 },
    { category: "Cyberware", equipped: true, armorSP: 12, armorLocations: ["head"], armorLayerType: "skinweave", armorLayerOrder: 0 }
  ]);
  assert.equal(armor.limbs.head.sp, 30);
  assert.equal(armor.limbs.head.layerCount, 2);
});

test("attribute bonuses are limited to cyberware and supported modifiers", () => {
  assert.equal(validAttributeBonuses({ BODY: 4 }, "Cyberware"), true);
  assert.equal(validAttributeBonuses({ BODY: 4 }, "Equipment"), false);
  assert.equal(validAttributeBonuses({ EMP: 4 }, "Cyberware"), false);
  assert.equal(validAttributeBonuses({ BODY: 101 }, "Cyberware"), false);
});
