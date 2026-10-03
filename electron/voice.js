const { spawn: nodeSpawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const VOICE_ID = /^[A-Za-z0-9][A-Za-z0-9_.+-]{0,80}$/;
const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "st", "sr", "jr", "prof", "rev", "vs", "etc", "fig", "no"]);

const DEFAULT_VOICE = {
  enabled: false,
  id: "en-gb",
  variant: "",
  rate: 132,
  pitch: 38,
};

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeVoice(input) {
  const src = input && typeof input === "object" ? input : {};
  const id = VOICE_ID.test(String(src.id || "")) ? String(src.id) : DEFAULT_VOICE.id;
  const variant = src.variant && VOICE_ID.test(String(src.variant)) ? String(src.variant) : "";
  return {
    enabled: Boolean(src.enabled),
    id,
    variant,
    rate: clampInt(src.rate, 80, 450, DEFAULT_VOICE.rate),
    pitch: clampInt(src.pitch, 0, 99, DEFAULT_VOICE.pitch),
  };
}

function voiceArg(voice) {
  const normalized = normalizeVoice(voice);
  return normalized.variant ? `${normalized.id}+${normalized.variant}` : normalized.id;
}

function speechArgs(voice) {
  const normalized = normalizeVoice(voice);
  return ["--stdin", "-v", voiceArg(normalized), "-s", String(normalized.rate), "-p", String(normalized.pitch)];
}

function spokenText(raw) {
  let text = String(raw || "");
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  text = text.replace(/https?:\/\/\S+/g, " ");
  text = text.replace(/[*_~#>]+/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (!/[A-Za-z0-9]/.test(text)) return "";
  return text.slice(0, 1200);
}

function wordBefore(buffer, index) {
  let i = index - 1;
  while (i >= 0 && /[A-Za-z]/.test(buffer[i])) i -= 1;
  return buffer.slice(i + 1, index);
}

function takeReady(buffer, { flush = false } = {}) {
  const lines = [];
  let start = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const ch = buffer[i];
    const sentenceEnd = ch === "." || ch === "!" || ch === "?" || ch === "…" || ch === "\n";
    if (!sentenceEnd) continue;
    let end = i;
    if (ch !== "\n") {
      while (end + 1 < buffer.length && /[.!?…]/.test(buffer[end + 1])) end += 1;
      const next = buffer[end + 1];
      if (next == null) {
        if (!flush) break;
      } else if (!/\s/.test(next)) {
        continue;
      }
      if (ch === "." && /\d/.test(buffer[i - 1] || "") && /\d/.test(buffer[i + 1] || "")) continue;
      const word = wordBefore(buffer, i);
      if (ch === "." && (word.length === 1 || ABBREVIATIONS.has(word.toLowerCase()))) continue;
    }
    const piece = buffer.slice(start, ch === "\n" ? i : end + 1).trim();
    if (piece) lines.push(piece);
    start = end + 1;
    while (start < buffer.length && /\s/.test(buffer[start])) start += 1;
    i = start - 1;
  }
  let rest = buffer.slice(start);
  if (flush) {
    const tail = rest.trim();
    if (tail) lines.push(tail);
    rest = "";
  } else if (rest.length > 480) {
    const cut = rest.lastIndexOf(" ", 480);
    const at = cut > 40 ? cut : 480;
    const piece = rest.slice(0, at).trim();
    if (piece) lines.push(piece);
    rest = rest.slice(at).replace(/^\s+/, "");
  }
  return { lines, rest };
}

function parseVoices(stdout) {
  const voices = [];
  const variants = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const match = line.match(/^\s*\d+\s+(\S+)\s+\S+\/(\S+)\s+(\S+)\s+(\S+)/);
    if (!match) continue;
    const [, language, gender, name, file] = match;
    if (file.startsWith("mb/")) continue;
    const label = name.replace(/_/g, " ");
    const sex = gender === "F" || gender === "M" ? gender : "";
    if (language === "variant" || file.startsWith("!v/")) {
      if (!VOICE_ID.test(name)) continue;
      variants.push({ id: name, label, gender: sex });
      continue;
    }
    if (!VOICE_ID.test(language)) continue;
    voices.push({ id: language, label, gender: sex, language });
  }
  const seen = new Set();
  const unique = [];
  for (const voice of voices) {
    if (seen.has(voice.id)) continue;
    seen.add(voice.id);
    unique.push(voice);
  }
  unique.sort((a, b) => {
    const ae = a.id === "en" || a.id.startsWith("en-") ? 0 : 1;
    const be = b.id === "en" || b.id.startsWith("en-") ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.label.localeCompare(b.label);
  });
  const seenVariant = new Set();
  const uniqueVariants = [];
  for (const variant of variants) {
    if (seenVariant.has(variant.id)) continue;
    seenVariant.add(variant.id);
    uniqueVariants.push(variant);
  }
  uniqueVariants.sort((a, b) => a.label.localeCompare(b.label));
  return { voices: unique, variants: uniqueVariants };
}

function candidateBinaries() {
  const names = process.platform === "win32" ? ["espeak-ng.exe"] : ["espeak-ng"];
  const extra = [];
  if (process.platform === "win32") {
    const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA].filter(Boolean);
    for (const root of roots) {
      extra.push(path.join(root, "eSpeak NG", "espeak-ng.exe"));
      extra.push(path.join(root, "espeak-ng", "espeak-ng.exe"));
    }
  } else if (process.platform === "darwin") {
    extra.push("/opt/homebrew/bin/espeak-ng", "/usr/local/bin/espeak-ng");
  } else {
    extra.push("/usr/bin/espeak-ng", "/usr/local/bin/espeak-ng");
  }
  const fromPath = [];
  for (const dir of (process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const name of names) fromPath.push(path.join(dir, name));
  }
  return [...extra, ...fromPath];
}

function locateBinary(fsImpl = fs, candidates = candidateBinaries()) {
  for (const candidate of candidates) {
    try {
      if (fsImpl.statSync(candidate).isFile()) return candidate;
    } catch {
      /* not this one */
    }
  }
  return null;
}

class VoiceAgent {
  constructor({ spawn = nodeSpawn, locate = locateBinary } = {}) {
    this.spawn = spawn;
    this.locate = locate;
    this.buffer = "";
    this.queue = [];
    this.current = null;
    this.catalog = null;
    this.probed = false;
    this.binary = null;
  }

  binaryPath() {
    if (!this.probed) {
      this.binary = this.locate();
      this.probed = true;
    }
    return this.binary;
  }

  run(binary, args) {
    return new Promise((resolve) => {
      let child;
      try {
        child = this.spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      } catch (error) {
        resolve({ code: -1, stdout: "", stderr: "", error });
        return;
      }
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => resolve({ code: -1, stdout, stderr, error }));
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  }

  async status() {
    const binary = this.binaryPath();
    if (!binary) return { available: false, binary: null, version: "", voices: [], variants: [] };
    if (!this.catalog) {
      const listed = await this.run(binary, ["--voices"]);
      const varied = await this.run(binary, ["--voices=variant"]);
      const versionRun = await this.run(binary, ["--version"]);
      const versionText = `${versionRun.stdout}\n${versionRun.stderr}`;
      const versionMatch = versionText.match(/eSpeak NG text-to-speech:\s*([0-9.]+)/);
      const catalogText = [listed.stdout, varied.stdout].filter(Boolean).join("\n");
      const parsed = catalogText.trim() ? parseVoices(catalogText) : { voices: [], variants: [] };
      this.catalog = {
        version: versionMatch ? versionMatch[1] : "",
        voices: parsed.voices,
        variants: parsed.variants,
      };
    }
    return { available: true, binary, ...this.catalog };
  }

  feed(chunk, voice) {
    const options = normalizeVoice(voice);
    if (!options.enabled) return;
    this.buffer += String(chunk || "");
    if (this.buffer.length > 24000) this.buffer = this.buffer.slice(-24000);
    this.drain(false, options);
  }

  flush(voice) {
    const options = normalizeVoice(voice);
    if (!options.enabled) {
      this.buffer = "";
      return;
    }
    this.drain(true, options);
  }

  drain(flush, options) {
    const pulled = takeReady(this.buffer, { flush });
    this.buffer = pulled.rest;
    for (const line of pulled.lines) this.enqueue(line, options);
  }

  enqueue(text, voice, { force = false } = {}) {
    const options = normalizeVoice(voice);
    if (!force && !options.enabled) return { ok: false, skipped: true };
    const clean = spokenText(text);
    if (!clean) return { ok: true, skipped: true };
    const binary = this.binaryPath();
    if (!binary) return { ok: false, missing: true };
    this.queue.push({ text: clean, options });
    this.pump();
    return { ok: true };
  }

  stop() {
    this.buffer = "";
    this.queue = [];
    const child = this.current;
    this.current = null;
    if (child) {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    }
  }

  pump() {
    if (this.current || this.queue.length === 0) return;
    const binary = this.binaryPath();
    if (!binary) {
      this.queue = [];
      return;
    }
    const job = this.queue.shift();
    let child;
    try {
      child = this.spawn(binary, speechArgs(job.options), {
        stdio: ["pipe", "ignore", "pipe"],
        windowsHide: true,
      });
    } catch {
      return;
    }
    this.current = child;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (this.current !== child) return;
      this.current = null;
      this.pump();
    };
    child.on("error", finish);
    child.on("close", finish);
    try {
      child.stdin.write(job.text);
      child.stdin.end();
    } catch {
      finish();
    }
  }
}

module.exports = {
  DEFAULT_VOICE,
  normalizeVoice,
  voiceArg,
  speechArgs,
  spokenText,
  takeReady,
  parseVoices,
  candidateBinaries,
  locateBinary,
  VoiceAgent,
};
