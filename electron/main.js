const { app, BrowserWindow, ipcMain, safeStorage, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { streamChat, listModels } = require("./providers");

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
};

let mainWindow = null;
let abortController = null;

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
    return { ...DEFAULT_SETTINGS, ...raw, keys };
  } catch {
    return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_SETTINGS.keys } };
  }
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
  saveSettings(next);
  return publicSettings(next);
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

ipcMain.on("chat:abort", () => abortController?.abort());
