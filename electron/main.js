const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { streamChat, listModels } = require("./providers");
const { sanitizeSession, upsertSession, listShelf, mapPlaces, tabletName } = require("./library");
const { VoiceAgent, DEFAULT_VOICE, normalizeVoice } = require("./voice");

const DEFAULT_SETTINGS = {
  provider: "ollama-cloud",
  model: "kimi-k2.6",
  temperature: 0.85,
  think: false,
  ollamaLocalUrl: "http://127.0.0.1:11434",
  customBaseUrl: "",
  customModel: "",
  keys: {
    ollama: "",
    openai: "",
    anthropic: "",
    groq: "",
    gemini: "",
    openrouter: "",
    custom: "",
  },
  hush: false,
  voice: { ...DEFAULT_VOICE },
  veil: { resonance: 0, opened: false },
};

function normalizeVeil(veil) {
  return {
    resonance: Math.max(0, Math.min(100, Number(veil?.resonance) || 0)),
    opened: Boolean(veil?.opened),
  };
}

let mainWindow = null;
let abortController = null;
const voiceAgent = new VoiceAgent();

function settingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function encrypt(value) {
  if (!value) return "";
  if (safeStorage.isEncryptionAvailable()) {
    return { enc: true, v: safeStorage.encryptString(value).toString("base64") };
  }
  return { enc: false, v: value };
}

function decrypt(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (!payload.v) return "";
  if (payload.enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(payload.v, "base64"));
    } catch {
      return "";
    }
  }
  return payload.v || "";
}

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
    const keys = { ...DEFAULT_SETTINGS.keys };
    if (raw.keys) {
      for (const k of Object.keys(keys)) keys[k] = decrypt(raw.keys[k]);
    }
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      keys,
      hush: Boolean(raw.hush),
      voice: normalizeVoice({ ...DEFAULT_SETTINGS.voice, ...(raw.voice || {}) }),
      veil: normalizeVeil(raw.veil),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      keys: { ...DEFAULT_SETTINGS.keys },
      voice: { ...DEFAULT_SETTINGS.voice },
      veil: { ...DEFAULT_SETTINGS.veil },
    };
  }
}

function shelfPath() {
  return path.join(app.getPath("userData"), "shelf.json");
}

function loadShelf() {
  try {
    const raw = JSON.parse(fs.readFileSync(shelfPath(), "utf8"));
    const sessions = Array.isArray(raw.sessions) ? raw.sessions.map(sanitizeSession).filter(Boolean) : [];
    return { activeId: raw.activeId || null, sessions };
  } catch {
    return { activeId: null, sessions: [] };
  }
}

function writeShelf(shelf) {
  fs.mkdirSync(path.dirname(shelfPath()), { recursive: true });
  fs.writeFileSync(shelfPath(), JSON.stringify(shelf));
}

function saveSettings(settings) {
  const keys = {};
  for (const k of Object.keys(DEFAULT_SETTINGS.keys)) {
    keys[k] = encrypt(settings.keys?.[k] || "");
  }
  const out = { ...settings, keys };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(out, null, 2));
}

function publicSettings(settings) {
  const keys = {};
  for (const [k, v] of Object.entries(settings.keys || {})) {
    keys[k] = v ? "••••••••" + v.slice(-4) : "";
    keys[`${k}Set`] = Boolean(v);
  }
  return { ...settings, keys };
}

function createWindow() {
  const icon = path.join(__dirname, "..", "assets", "icon.png");
  if (process.platform === "win32") app.setAppUserModelId("com.akashic.records");

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#050508",
    frame: false,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "src", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on("win:minimize", () => mainWindow?.minimize());
ipcMain.on("win:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on("win:close", () => mainWindow?.close());

ipcMain.handle("settings:get", () => publicSettings(loadSettings()));

ipcMain.handle("settings:set", (_e, patch) => {
  const current = loadSettings();
  const next = { ...current, ...patch };
  if (patch.keys) {
    next.keys = { ...current.keys };
    for (const [k, v] of Object.entries(patch.keys)) {
      if (typeof v !== "string") continue;
      if (!v || v.startsWith("••••")) continue;
      next.keys[k] = v.trim();
    }
  }
  if (patch.veil) next.veil = normalizeVeil(patch.veil);
  if ("hush" in patch) next.hush = Boolean(patch.hush);
  if (patch.voice) next.voice = normalizeVoice({ ...current.voice, ...patch.voice });
  else next.voice = normalizeVoice(current.voice);
  if (patch.voice && !next.voice.enabled) voiceAgent.stop();
  saveSettings(next);
  return publicSettings(next);
});

ipcMain.handle("shelf:list", () => listShelf(loadShelf()));

ipcMain.handle("shelf:active", () => {
  const shelf = loadShelf();
  if (!shelf.activeId) return null;
  return shelf.sessions.find((session) => session.id === shelf.activeId) || null;
});

ipcMain.handle("shelf:get", (_e, id) => {
  const shelf = loadShelf();
  return shelf.sessions.find((session) => session.id === id) || null;
});

ipcMain.handle("shelf:save", (_e, session) => {
  const next = upsertSession(loadShelf(), session);
  writeShelf(next);
  return listShelf(next);
});

ipcMain.handle("shelf:remove", (_e, id) => {
  const shelf = loadShelf();
  const next = {
    activeId: shelf.activeId === id ? null : shelf.activeId,
    sessions: shelf.sessions.filter((session) => session.id !== id),
  };
  writeShelf(next);
  return listShelf(next);
});

ipcMain.handle("shelf:clear-active", () => {
  const shelf = loadShelf();
  shelf.activeId = null;
  writeShelf(shelf);
  return listShelf(shelf);
});

ipcMain.on("state:flush", (e, payload) => {
  try {
    if (payload?.veil) {
      const current = loadSettings();
      current.veil = normalizeVeil(payload.veil);
      saveSettings(current);
    }
    if (payload?.session) writeShelf(upsertSession(loadShelf(), payload.session));
    else if (payload?.clearActive) {
      const shelf = loadShelf();
      shelf.activeId = null;
      writeShelf(shelf);
    }
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});

ipcMain.handle("places:search", async (_e, query) => {
  const q = String(query || "").trim().slice(0, 80);
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AkashicRecords/1.1" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("The atlas could not be reached.");
  return mapPlaces(await res.json());
});

ipcMain.handle("tablet:write", async (_e, payload) => {
  const text = String(payload?.text || "");
  if (!text.trim()) return { ok: false, empty: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Keep this tablet",
    defaultPath: tabletName(payload?.title),
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, text, "utf8");
  return { ok: true, path: result.filePath };
});

ipcMain.handle("models:list", async (_e, provider) => {
  const settings = loadSettings();
  return listModels(settings, provider);
});

ipcMain.handle("chat:start", async (e, { messages }) => {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  const settings = loadSettings();
  const sender = e.sender;
  try {
    await streamChat(settings, {
      messages,
      signal: abortController.signal,
      onToken: (text) => {
        if (!sender.isDestroyed()) sender.send("chat:token", text);
      },
      onThink: (text) => {
        if (!sender.isDestroyed()) sender.send("chat:think", text);
      },
    });
    if (!sender.isDestroyed()) sender.send("chat:done", {});
    return { ok: true };
  } catch (err) {
    if (err.name === "AbortError") {
      if (!sender.isDestroyed()) sender.send("chat:done", { aborted: true });
      return { ok: false, aborted: true };
    }
    const message = err.message || String(err);
    if (!sender.isDestroyed()) sender.send("chat:error", message);
    return { ok: false, error: message };
  } finally {
    abortController = null;
  }
});

ipcMain.on("chat:abort", () => {
  abortController?.abort();
  voiceAgent.stop();
});

ipcMain.handle("voice:status", () => voiceAgent.status());

ipcMain.on("voice:feed", (_e, text) => {
  voiceAgent.feed(text, loadSettings().voice);
});

ipcMain.on("voice:flush", () => {
  voiceAgent.flush(loadSettings().voice);
});

ipcMain.on("voice:stop", () => voiceAgent.stop());

ipcMain.handle("voice:sample", (_e, patch) => {
  const voice = normalizeVoice({ ...loadSettings().voice, ...(patch || {}), enabled: true });
  voiceAgent.stop();
  return voiceAgent.enqueue("The veil is thin. The records are listening.", voice, { force: true });
});
