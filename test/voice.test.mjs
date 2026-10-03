import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  DEFAULT_VOICE,
  VoiceAgent,
  candidateBinaries,
  locateBinary,
  normalizeVoice,
  parseVoices,
  speechArgs,
  spokenText,
  takeReady,
  voiceArg,
} = require("../electron/voice.js");

const VOICES = `
Pty Language       Age/Gender VoiceName          File                 Other Languages
 5  af              --/M      Afrikaans          gmw/af
 2  en-gb           --/M      English_(Great_Britain) gmw/en               (en 2)
 2  en-us           --/M      English_(America)  gmw/en-US            (en 3)
 5  en-us           --/F      us-mbrola-1        mb/mb-us1            (en 8)
 5  fr-fr           --/F      French_(France)    roa/fr
 5  variant         --/F      Alicia             !v/Alicia
 5  variant         --/M      Adam               !v/adam
`.trim();

test("voice listing keeps languages, drops mbrola, and separates variants", () => {
  const parsed = parseVoices(VOICES);
  assert.deepEqual(
    parsed.voices.map((voice) => voice.id),
    ["en-us", "en-gb", "af", "fr-fr"]
  );
  assert.equal(parsed.voices.find((voice) => voice.id === "en-gb").label, "English (Great Britain)");
  assert.equal(parsed.voices.find((voice) => voice.id === "fr-fr").gender, "F");
  assert.deepEqual(
    parsed.variants.map((voice) => voice.id),
    ["Adam", "Alicia"]
  );
});

test("speech options stay inside espeak-ng bounds and never put the words on the command line", () => {
  const voice = normalizeVoice({ enabled: true, id: "en-us", variant: "Alicia", rate: 999, pitch: -4 });
  assert.equal(voice.rate, 450);
  assert.equal(voice.pitch, 0);
  assert.equal(voiceArg(voice), "en-us+Alicia");
  assert.deepEqual(speechArgs(voice), ["--stdin", "-v", "en-us+Alicia", "-s", "450", "-p", "0"]);
  assert.equal(normalizeVoice({ id: "-w", variant: "../etc", rate: "slow" }).id, DEFAULT_VOICE.id);
  assert.equal(normalizeVoice({ id: "-w" }).variant, "");
});

test("spoken text drops markup and keeps the sentence", () => {
  const text = spokenText("See [the veil](https://example.com/x) and `static`. ```\ncode\n``` **Now.**");
  assert.equal(text.includes("http"), false);
  assert.equal(text.includes("`"), false);
  assert.equal(text.includes("*"), false);
  assert.match(text, /See the veil and static\./);
  assert.match(text, /Now\./);
  assert.equal(spokenText("..."), "");
});

test("sentences wait for a boundary, keep decimals, and flush the tail", () => {
  assert.deepEqual(takeReady("The veil"), { lines: [], rest: "The veil" });
  assert.deepEqual(takeReady("The veil is thin. The records"), {
    lines: ["The veil is thin."],
    rest: "The records",
  });
  assert.deepEqual(takeReady("Pi is 3.14 today. Done. "), {
    lines: ["Pi is 3.14 today.", "Done."],
    rest: "",
  });
  assert.deepEqual(takeReady("Ask Dr. Smith to wait. "), {
    lines: ["Ask Dr. Smith to wait."],
    rest: "",
  });
  assert.deepEqual(takeReady("Hello."), { lines: [], rest: "Hello." });
  assert.deepEqual(takeReady("Hello.", { flush: true }), { lines: ["Hello."], rest: "" });
});

test("the agent speaks one line at a time and stops the one in progress", async () => {
  const calls = [];
  const spawn = (bin, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      write(text) {
        child.written = text;
      },
      end() {
        child.ended = true;
      },
    };
    child.kill = () => {
      child.killed = true;
      child.emit("close", null);
    };
    calls.push({ bin, args, child });
    return child;
  };
  const agent = new VoiceAgent({ spawn, locate: () => "/usr/bin/espeak-ng" });
  const voice = { enabled: true, id: "en-gb", rate: 132, pitch: 38 };

  agent.feed("The veil is thin. Still forming", voice);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bin, "/usr/bin/espeak-ng");
  assert.deepEqual(calls[0].args, ["--stdin", "-v", "en-gb", "-s", "132", "-p", "38"]);
  assert.equal(calls[0].child.written, "The veil is thin.");
  assert.equal(calls[0].args.includes("The veil is thin."), false);

  agent.flush(voice);
  assert.equal(calls.length, 1);
  calls[0].child.emit("close", 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].child.written, "Still forming");

  agent.enqueue("One more line.", voice);
  agent.stop();
  assert.equal(calls[1].child.killed, true);
  assert.equal(calls.length, 2);
  assert.equal(agent.enqueue("   ", voice).skipped, true);
  assert.equal(agent.enqueue("Silent.", { enabled: false, id: "en-gb" }).skipped, true);
});

test("a missing espeak-ng binary is reported and nothing is spawned", () => {
  let spawned = false;
  const agent = new VoiceAgent({
    spawn: () => {
      spawned = true;
      return new EventEmitter();
    },
    locate: () => null,
  });
  const result = agent.enqueue("Hello.", { enabled: true, id: "en-gb" }, { force: true });
  assert.equal(result.missing, true);
  assert.equal(spawned, false);
});

test("an installed espeak-ng speaks the agent's line into a wav", { skip: !locateBinary() }, async () => {
  const binary = locateBinary();
  const status = await new VoiceAgent().status();
  assert.equal(status.available, true);
  assert.match(status.version, /^\d+\.\d+/);
  assert.ok(status.voices.some((voice) => voice.id === "en-gb"));
  assert.ok(status.variants.some((voice) => voice.id === "Alicia"));
  const dir = mkdtempSync(join(tmpdir(), "akashic-voice-"));
  const wav = join(dir, "line.wav");
  const voice = { enabled: true, id: "en-gb", variant: "Alicia", rate: 132, pitch: 38 };
  const spoken = spawnSync(binary, ["-w", wav, ...speechArgs(voice)], { input: "The veil is thin. The records are listening." });
  assert.equal(spoken.status, 0, spoken.stderr?.toString());
  assert.ok(statSync(wav).size > 1000);
  rmSync(dir, { recursive: true, force: true });
});

test("binary search only accepts espeak-ng and skips missing paths", () => {
  for (const candidate of candidateBinaries()) {
    assert.match(candidate, /espeak-ng(\.exe)?$/);
  }
  const found = locateBinary(
    {
      statSync(candidate) {
        if (candidate !== "/opt/espeak-ng") throw new Error("missing");
        return { isFile: () => true };
      },
    },
    ["/missing/espeak-ng", "/opt/espeak-ng"]
  );
  assert.equal(found, "/opt/espeak-ng");
  assert.equal(locateBinary({ statSync: () => { throw new Error("missing"); } }, ["/nope"]), null);
});
