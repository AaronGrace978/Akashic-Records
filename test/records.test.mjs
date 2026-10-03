import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../src/js/records.js", import.meta.url), "utf8"), context);
const { Records } = context.window.AkashicState;

test("a short remark barely moves the veil, and keywords cannot be stacked", () => {
  const plain = new Records();
  plain.scoreUser("hi");
  assert.equal(plain.resonance, 4);

  const stacked = new Records();
  stacked.scoreUser("akasha veil soul destiny origin seek truth meaning");
  assert.equal(stacked.resonance, 16);
  assert.equal(stacked.ready, false);
});

test("the veil opens after real attention, and one sky or one seek is not enough", () => {
  const seeker = new Records();
  seeker.seek();
  seeker.witnessSky();
  seeker.noteReturn();
  assert.equal(seeker.resonance, 44);
  assert.equal(seeker.ready, false);

  const slow = new Records();
  for (let i = 0; i < 24; i++) slow.scoreUser("hi");
  assert.equal(slow.ready, false);
  slow.scoreUser("hi");
  assert.equal(slow.ready, true);
});

test("the voice receives only role and content", () => {
  const records = new Records();
  const entry = records.push("user", "hello", { who: "Seeker", think: "hidden", pinned: true });
  assert.equal(entry.pinned, true);
  const sent = records.messages()[1];
  assert.equal(sent.role, "user");
  assert.equal(sent.content, "hello");
  assert.deepEqual(Object.keys(sent).sort(), ["content", "role"]);
});
