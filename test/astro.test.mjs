import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../src/js/astro.js", import.meta.url), "utf8"), context);
const A = context.window.AkashicAstro;

function near(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: ${actual} not within ${tol} of ${expected}`);
}

test("julian day of the J2000 epoch", () => {
  near(A.julianDay(2000, 1, 1, 12), 2451545.0, 1e-6, "jd");
});

test("ecliptic pole of Cancer maps to declination of the obliquity", () => {
  const eq = A.eclipticToEquatorial(90, 0);
  near(eq.ra, 90, 0.05, "ra");
  near(eq.dec, 23.4392911, 0.02, "dec");
  const spring = A.eclipticToEquatorial(0, 0);
  near(spring.ra, 0, 0.05, "spring ra");
  near(spring.dec, 0, 0.02, "spring dec");
});

test("galactic center falls in Sagittarius", () => {
  const gc = A.galacticToEquatorial(0, 0);
  near(gc.ra, 266.4, 0.3, "gc ra");
  near(gc.dec, -28.94, 0.3, "gc dec");
});

test("sun stands at the seasons", () => {
  const lon = (y, m, d, h) => A.sunLongitude(A.julianDay(y, m, d, h));
  const around = (value, target) => {
    const delta = Math.abs(((value - target + 540) % 360) - 180);
    assert.ok(delta < 2.2, `longitude ${value} not near ${target}`);
  };
  around(lon(2000, 3, 20, 7.6), 0);
  around(lon(2000, 6, 21, 1.8), 90);
  around(lon(2000, 9, 22, 17.5), 180);
  around(lon(2000, 12, 21, 13.6), 270);
  around(lon(2000, 1, 1, 12), 280.5);
});

test("a birth date resolves to the tropical sign and a real constellation", () => {
  const chart = A.chartFor({
    name: "Maria",
    date: "1992-04-17",
    time: "06:40",
    lat: 40.7128,
    lon: -74.006,
    place: "New York",
    timeZone: "America/New_York",
  });
  assert.equal(chart.error, null);
  assert.equal(chart.sun.sign.name, "Aries");
  assert.equal(chart.sun.constellationId, "aries");
  assert.ok(A.byId[chart.sun.among.constellation.id].zodiac);
  assert.ok(chart.moon.sign.name);
  assert.ok(chart.rising);
  assert.ok(A.SIGNS.some((sign) => sign.name === chart.rising.sign.name));
  assert.match(chart.copy.summary, /Maria/);
  assert.match(chart.copy.summary, /Aries/);
  assert.ok(chart.fov >= 40 && chart.fov <= 68, `fov ${chart.fov}`);
});

test("daylight time in New York is four hours behind UTC in April 1992", () => {
  const utc = A.civilToUtc(1992, 4, 17, 6, 40, "America/New_York");
  assert.equal(utc.toISOString().slice(0, 16), "1992-04-17T10:40");
});

test("season signs", () => {
  const signOn = (date) =>
    A.chartFor({ name: "A", date, time: "12:00", lat: 0, lon: 0, timeZone: "UTC" }).sun.sign.name;
  assert.equal(signOn("1991-08-10"), "Leo");
  assert.equal(signOn("2001-01-05"), "Capricorn");
  assert.equal(signOn("1988-03-10"), "Pisces");
  assert.equal(signOn("1977-11-02"), "Scorpio");
});

test("the catalog connects real stars", () => {
  const zodiac = A.constellations.filter((c) => c.zodiac);
  assert.equal(zodiac.length, 12);
  for (const sign of A.SIGNS) assert.ok(A.byId[sign.constellationId], sign.id);
  for (const c of A.constellations) {
    assert.ok(c.stars.length >= 3, c.id);
    assert.ok(c.lines.length >= 1, c.id);
    for (const [a, b] of c.lines) {
      assert.ok(Number.isInteger(a) && Number.isInteger(b), c.id);
      assert.notEqual(a, b);
    }
  }
});

test("projection centers the camera and lifts north", () => {
  const center = A.project(30, 10, 30, 10, 60, 800, 600);
  near(center.x, 400, 0.5, "cx");
  near(center.y, 300, 0.5, "cy");
  const north = A.project(30, 20, 30, 10, 60, 800, 600);
  near(north.x, 400, 1.5, "nx");
  assert.ok(north.y < 250 && north.y > 170, `north y ${north.y}`);
  assert.equal(A.project(30, 10, 210, 0, 20, 800, 600), null);
});

test("refuses a broken date and a latitude off the earth", () => {
  assert.ok(A.chartFor({ date: "" }).error);
  assert.ok(A.chartFor({ date: "1992-02-31" }).error);
  assert.ok(A.chartFor({ date: "1992-04-17", lat: 120, lon: 10 }).error);
  assert.equal(A.chartFor({ date: "1992-04-17" }).rising, null);
});
