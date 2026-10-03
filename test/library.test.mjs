import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const lib = require("../electron/library.js");

test("a session needs an id and something the seeker said", () => {
  assert.equal(lib.sanitizeSession({ id: "a", messages: [{ role: "assistant", content: "only the voice" }] }), null);
  assert.equal(lib.sanitizeSession({ messages: [{ role: "user", content: "hello" }] }), null);
  const clean = lib.sanitizeSession({
    id: "sess-1",
    messages: [{ role: "user", content: "  where does the light go  ", who: "Seeker", pinned: true, think: "no" }],
  });
  assert.equal(clean.title, "where does the light go");
  assert.equal(clean.messages[0].pinned, true);
  assert.equal(clean.messages[0].content, "where does the light go");
});

test("the shelf keeps the newest inquiries and the active one", () => {
  let shelf = { activeId: null, sessions: [] };
  shelf = lib.upsertSession(shelf, {
    id: "old",
    updated: 10,
    created: 10,
    messages: [{ role: "user", content: "first" }],
  });
  shelf = lib.upsertSession(shelf, {
    id: "new",
    updated: 20,
    created: 20,
    witnessed: ["birth|1"],
    messages: [{ role: "user", content: "second" }],
  });
  shelf = lib.upsertSession(shelf, {
    id: "old",
    updated: 30,
    created: 999,
    messages: [{ role: "user", content: "first, continued" }],
  });
  assert.equal(shelf.activeId, "old");
  assert.equal(shelf.sessions[0].id, "old");
  assert.equal(shelf.sessions[0].created, 10);
  assert.deepEqual(shelf.sessions[1].witnessed, ["birth|1"]);
  const listed = lib.listShelf(shelf);
  assert.equal(listed.sessions.length, 2);
  assert.equal(listed.sessions[0].title, "first, continued");
});

test("place names keep their region and a tablet title stays a filename", () => {
  const places = lib.mapPlaces({
    results: [
      { name: "Paris", admin1: "Île-de-France", country: "France", latitude: 48.85, longitude: 2.35, timezone: "Europe/Paris" },
      { name: "Nowhere", latitude: null, longitude: 1 },
    ],
  });
  assert.equal(places.length, 1);
  assert.equal(places[0].label, "Paris, Île-de-France, France");
  assert.equal(places[0].timeZone, "Europe/Paris");
  assert.equal(lib.tabletName('a/b:c*ask'), "abcask.txt");
  assert.equal(lib.tabletName(""), "tablet.txt");
});
