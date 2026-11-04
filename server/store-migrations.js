export const STORE_SCHEMA_VERSION = 1;

const MIGRATIONS = [
  data => ({ ...data, schemaVersion: 1 })
];

export function migrateStoreData(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Campaign state file has an invalid shape.");
  }
  let version = input.schemaVersion === undefined ? 0 : input.schemaVersion;
  if (!Number.isInteger(version) || version < 0) {
    throw new Error("Campaign state file has an invalid schema version.");
  }
  if (version > STORE_SCHEMA_VERSION) {
    throw new Error(`Campaign state schema version ${version} is newer than this server supports.`);
  }
  const sourceVersion = version;
  let data = input;
  while (version < STORE_SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`No campaign state migration exists for version ${version}.`);
    data = migrate(data);
    version = data.schemaVersion;
  }
  return { data, migrated: sourceVersion < STORE_SCHEMA_VERSION, sourceVersion };
}
