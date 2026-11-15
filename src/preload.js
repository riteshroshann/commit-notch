const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notch", {
  init: () => ipcRenderer.invoke("init"),
  hover: (/** @type {boolean} */ inside) => ipcRenderer.send("hover", inside),
  refresh: () => ipcRenderer.send("refresh"),
  quit: () => ipcRenderer.send("quit"),
  menu: () => ipcRenderer.send("menu"),
  saveToken: (/** @type {string} */ t) => ipcRenderer.invoke("save-token", t),
  on: (/** @type {string} */ channel, /** @type {(v: any) => void} */ fn) => ipcRenderer.on(channel, (_e, v) => fn(v)),
});
