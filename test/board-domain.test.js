import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_PRESETS,
  LEGACY_BOARD_PRESET,
  boardPresetFor,
  mergePlayerBoardUpdate,
  rescaleBoardPiece
} from "../shared/board-domain.js";

test("board presets match the requested sizes and meter scales", () => {
  assert.deepEqual(BOARD_PRESETS.map(({ columns, rows, metersPerSquare }) => ({
    columns, rows, metersPerSquare
  })), [
    { columns: 24, rows: 36, metersPerSquare: 1 },
    { columns: 24, rows: 36, metersPerSquare: 2 },
    { columns: 36, rows: 48, metersPerSquare: 5 },
    { columns: 36, rows: 48, metersPerSquare: 10 }
  ]);
  assert.deepEqual(boardPresetFor(LEGACY_BOARD_PRESET.id), LEGACY_BOARD_PRESET);
});

test("rescaling preserves relative positions and keeps pieces inside the target board", () => {
  const source = { columns: 24, rows: 36 };
  const target = { columns: 36, rows: 48 };
  assert.deepEqual(rescaleBoardPiece({ id: "unit", x: 12, y: 18, width: 2, height: 3 }, source, target), {
    id: "unit", x: 18, y: 24, width: 2, height: 3
  });
  assert.deepEqual(rescaleBoardPiece({ id: "edge", x: 23, y: 35, width: 4, height: 5 }, source, target), {
    id: "edge", x: 32, y: 43, width: 4, height: 5
  });
});

test("players can move their own token but cannot change the shared board preset", () => {
  const board = {
    presetId: "street-medium-2m",
    terrain: [],
    tokens: [{ id: "player", kind: "character", ownerUserId: "user-1", x: 2, y: 3, width: 1, height: 1 }]
  };
  const moved = { ...board, tokens: [{ ...board.tokens[0], x: 4, y: 5 }] };
  assert.deepEqual(mergePlayerBoardUpdate(moved, board, "user-1"), moved);
  assert.equal(mergePlayerBoardUpdate({ ...moved, presetId: "long-range-5m" }, board, "user-1"), null);
});
