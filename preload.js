'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = new Set([
  'app:info', 'settings:set',
  'dialog:openDirectory', 'dialog:openFile', 'dialog:saveFile',
  'fs:read', 'fs:write', 'fs:exists', 'fs:mkdir', 'fs:readdir', 'fs:rm', 'fs:rename',
  'shell:openPath', 'shell:showItem', 'shell:openExternal',
  'window:minimize', 'window:maximize', 'window:close', 'window:fullscreen',
  'build:start', 'app:run', 'app:stop',
  'toolchain:install', 'toolchain:detect',
]);

const EVENTS = new Set([
  'build:output', 'build:state', 'app:output', 'app:exited',
  'toolchain:output', 'window:state',
]);

contextBridge.exposeInMainWorld('bik', {
  invoke(channel, ...args) {
    if (!INVOKE.has(channel)) return Promise.reject(new Error('blocked channel: ' + channel));
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel, cb) {
    if (!EVENTS.has(channel)) return () => {};
    const fn = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, fn);
    return () => ipcRenderer.removeListener(channel, fn);
  },
  platform: process.platform,
});
