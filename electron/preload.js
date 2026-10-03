const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("akasha", {
  window: {
    minimize: () => ipcRenderer.send("win:minimize"),
    maximize: () => ipcRenderer.send("win:maximize"),
    close: () => ipcRenderer.send("win:close"),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (patch) => ipcRenderer.invoke("settings:set", patch),
  },
  models: {
    list: (provider) => ipcRenderer.invoke("models:list", provider),
  },
  shelf: {
    list: () => ipcRenderer.invoke("shelf:list"),
    active: () => ipcRenderer.invoke("shelf:active"),
    get: (id) => ipcRenderer.invoke("shelf:get", id),
    save: (session) => ipcRenderer.invoke("shelf:save", session),
    remove: (id) => ipcRenderer.invoke("shelf:remove", id),
    clearActive: () => ipcRenderer.invoke("shelf:clear-active"),
    flush: (payload) => ipcRenderer.sendSync("state:flush", payload),
  },
  places: {
    search: (query) => ipcRenderer.invoke("places:search", query),
  },
  tablet: {
    write: (payload) => ipcRenderer.invoke("tablet:write", payload),
  },
  voice: {
    status: () => ipcRenderer.invoke("voice:status"),
    feed: (text) => ipcRenderer.send("voice:feed", text),
    flush: () => ipcRenderer.send("voice:flush"),
    stop: () => ipcRenderer.send("voice:stop"),
    sample: (options) => ipcRenderer.invoke("voice:sample", options),
  },
  chat: {
    start: (payload) => ipcRenderer.invoke("chat:start", payload),
    abort: () => ipcRenderer.send("chat:abort"),
    onToken: (fn) => {
      const wrapped = (_e, data) => fn(data);
      ipcRenderer.on("chat:token", wrapped);
      return () => ipcRenderer.removeListener("chat:token", wrapped);
    },
    onThink: (fn) => {
      const wrapped = (_e, data) => fn(data);
      ipcRenderer.on("chat:think", wrapped);
      return () => ipcRenderer.removeListener("chat:think", wrapped);
    },
    onDone: (fn) => {
      const wrapped = (_e, data) => fn(data);
      ipcRenderer.on("chat:done", wrapped);
      return () => ipcRenderer.removeListener("chat:done", wrapped);
    },
    onError: (fn) => {
      const wrapped = (_e, data) => fn(data);
      ipcRenderer.on("chat:error", wrapped);
      return () => ipcRenderer.removeListener("chat:error", wrapped);
    },
  },
});
