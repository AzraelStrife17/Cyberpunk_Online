export const DEFAULT_BOARD_PRESET_ID = "street-medium-2m";
export const LEGACY_BOARD_PRESET_ID = "legacy-wide";

export const BOARD_PRESETS = Object.freeze([
  Object.freeze({
    id: "close-quarters-1m",
    label: "Close quarters · 24 x 36 squares · 1 m/square",
    columns: 24,
    rows: 36,
    metersPerSquare: 1
  }),
  Object.freeze({
    id: DEFAULT_BOARD_PRESET_ID,
    label: "Street / medium · 24 x 36 squares · 2 m/square",
    columns: 24,
    rows: 36,
    metersPerSquare: 2
  }),
  Object.freeze({
    id: "long-range-5m",
    label: "Long range · 36 x 48 squares · 5 m/square",
    columns: 36,
    rows: 48,
    metersPerSquare: 5
  }),
  Object.freeze({
    id: "long-range-10m",
    label: "Long range · 36 x 48 squares · 10 m/square",
    columns: 36,
    rows: 48,
    metersPerSquare: 10
  })
]);

export const LEGACY_BOARD_PRESET = Object.freeze({
  id: LEGACY_BOARD_PRESET_ID,
  label: "Existing wide board · 1000 x 1000 m · 2 m/square",
  columns: 500,
  rows: 500,
  metersPerSquare: 2
});

export function boardPresetFor(presetId) {
  if (presetId === LEGACY_BOARD_PRESET_ID) return LEGACY_BOARD_PRESET;
  return BOARD_PRESETS.find(preset => preset.id === presetId)
    || BOARD_PRESETS.find(preset => preset.id === DEFAULT_BOARD_PRESET_ID);
}

export function rescaleBoardPiece(piece, sourcePreset, targetPreset) {
  const width = Math.min(Math.max(1, Number(piece.width) || 1), targetPreset.columns);
  const height = Math.min(Math.max(1, Number(piece.height) || 1), targetPreset.rows);
  const scaledX = Math.round((Number(piece.x) || 0) * targetPreset.columns / sourcePreset.columns);
  const scaledY = Math.round((Number(piece.y) || 0) * targetPreset.rows / sourcePreset.rows);
  return {
    ...piece,
    width,
    height,
    x: Math.max(0, Math.min(targetPreset.columns - width, scaledX)),
    y: Math.max(0, Math.min(targetPreset.rows - height, scaledY))
  };
}

export function mergePlayerBoardUpdate(requestedBoard, currentBoard, userId) {
  if (requestedBoard.presetId !== currentBoard.presetId
    || JSON.stringify(requestedBoard.terrain) !== JSON.stringify(currentBoard.terrain)) return null;
  const requestedTokens = new Map(requestedBoard.tokens.map(token => [token.id, token]));
  if (requestedTokens.size !== currentBoard.tokens.length || requestedTokens.size !== requestedBoard.tokens.length) return null;
  const tokens = [];
  for (const previous of currentBoard.tokens) {
    const requested = requestedTokens.get(previous.id);
    if (!requested) return null;
    if (previous.kind === "character" && previous.ownerUserId === userId) {
      if (JSON.stringify({ ...previous, x: 0, y: 0 }) !== JSON.stringify({ ...requested, x: 0, y: 0 })) return null;
      tokens.push({ ...previous, x: requested.x, y: requested.y });
    } else {
      if (requested.x !== previous.x || requested.y !== previous.y) return null;
      tokens.push(previous);
    }
  }
  return { presetId: currentBoard.presetId, tokens, terrain: currentBoard.terrain };
}
