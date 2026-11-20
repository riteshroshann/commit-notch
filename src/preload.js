const { contextBridge, ipcRenderer } = require("electron");

const CHANNELS = new Set(["contributions", "time", "settings", "collapse", "open"]);

contextBridge.exposeInMainWorld("notch", {
  init: () => ipcRenderer.invoke("init"),
  areas: (/** @type {{ x: number, y: number, w: number, h: number }[]} */ boxes) => ipcRenderer.send("areas", boxes),
  refresh: () => ipcRenderer.send("refresh"),
  quit: () => ipcRenderer.send("quit"),
  menu: () => ipcRenderer.send("menu"),
  setup: () => ipcRenderer.send("setup"),
  accounts: () => ipcRenderer.invoke("accounts"),
  view: (/** @type {string} */ login) => ipcRenderer.send("view", login),
  on: (/** @type {string} */ channel, /** @type {(v: any) => void} */ fn) => {
    if (CHANNELS.has(channel)) ipcRenderer.on(channel, (_e, v) => fn(v));
  },
});
