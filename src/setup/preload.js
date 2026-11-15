const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("setup", {
  info: () => ipcRenderer.invoke("setup:info"),
  start: () => ipcRenderer.send("setup:start"),
  cancel: () => ipcRenderer.send("setup:cancel"),
  token: (/** @type {string} */ t) => ipcRenderer.invoke("setup:token", t),
  cli: () => ipcRenderer.invoke("setup:cli"),
  open: (/** @type {string} */ url) => ipcRenderer.send("setup:open", url),
  finish: (/** @type {boolean} */ openAtLogin) => ipcRenderer.send("setup:finish", openAtLogin),
  close: () => ipcRenderer.send("setup:close"),
  on: (/** @type {string} */ channel, /** @type {(v: any) => void} */ fn) =>
    ipcRenderer.on(`setup:${channel}`, (_e, v) => fn(v)),
});
