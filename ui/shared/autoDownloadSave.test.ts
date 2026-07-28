import assert from "node:assert/strict";
import test from "node:test";
import { autoDownloadFileName, saveDownloadedTurn } from "./autoDownloadSave.ts";

void test("uses the filename expected by the existing play-turn workflow", () => {
  assert.equal(autoDownloadFileName("Civ7Save"), "(PYDT) Play This One!.Civ7Save");
});

void test("creates the configured directory and writes the downloaded data", () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const data = new Uint8Array([1, 2, 3]);

  const result = saveDownloadedTurn({
    saveDir: "/games/saves",
    saveExtension: "Civ6Save",
    data,
    fs: {
      existsSync: path => {
        calls.push({ operation: "exists", value: path });
        return false;
      },
      mkdirp: path => calls.push({ operation: "mkdirp", value: path }),
      writeFileSync: (path, contents) => calls.push({ operation: "write", value: [path, contents] }),
    },
    path: {
      join: (...paths) => paths.join("/"),
    },
  });

  assert.equal(result, "/games/saves/(PYDT) Play This One!.Civ6Save");
  assert.deepEqual(calls, [
    { operation: "exists", value: "/games/saves" },
    { operation: "mkdirp", value: "/games/saves" },
    { operation: "write", value: ["/games/saves/(PYDT) Play This One!.Civ6Save", data] },
  ]);
});
