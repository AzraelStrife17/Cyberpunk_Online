import assert from "node:assert/strict";
import test from "node:test";
import { migrateStoreData, STORE_SCHEMA_VERSION } from "../server/store-migrations.js";

test("versionless campaign data upgrades without losing existing fields", () => {
  const legacyStore = { rooms: { room1: { name: "Campaign" } }, accounts: { player1: { username: "Player" } } };
  const result = migrateStoreData(legacyStore);
  assert.equal(result.sourceVersion, 0);
  assert.equal(result.migrated, true);
  assert.equal(result.data.schemaVersion, STORE_SCHEMA_VERSION);
  assert.deepEqual(result.data.rooms, legacyStore.rooms);
  assert.deepEqual(result.data.accounts, legacyStore.accounts);
});

test("current campaign data is not migrated again", () => {
  const currentStore = { schemaVersion: STORE_SCHEMA_VERSION, rooms: {} };
  const result = migrateStoreData(currentStore);
  assert.equal(result.migrated, false);
  assert.equal(result.data, currentStore);
});

test("invalid and future campaign schema versions fail explicitly", () => {
  assert.throws(() => migrateStoreData({ schemaVersion: -1 }), /invalid schema version/i);
  assert.throws(() => migrateStoreData({ schemaVersion: STORE_SCHEMA_VERSION + 1 }), /newer than this server supports/i);
  assert.throws(() => migrateStoreData(null), /invalid shape/i);
});
