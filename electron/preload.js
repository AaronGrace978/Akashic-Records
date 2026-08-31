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
