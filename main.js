'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = __dirname;
const HOME = os.homedir();
const DOTNET_DIR = process.env.BIKINSTUDIO_DOTNET_DIR || path.join(HOME, '.dotnet');
const DOTNET = path.join(DOTNET_DIR, 'dotnet');
const TOOLCHAIN = process.env.BIKINSTUDIO_TOOLCHAIN || path.join(HOME, '.local', 'share', 'bikinstudio');
const MONO_PREFIX = path.join(TOOLCHAIN, 'mono');
const MONO = path.join(MONO_PREFIX, 'usr', 'bin', 'mono');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

let mainWindow = null;
let server = null;
let serverPort = 0;
const children = new Set();

/* ------------------------------------------------------------------ */
/* static file server (needed so Monaco workers + ES modules work)     */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.vb': 'text/plain; charset=utf-8',
};

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') pathname = '/src/index.html';
        const file = path.normalize(path.join(ROOT, pathname));
        if (!file.startsWith(ROOT + path.sep)) {
          res.writeHead(403); res.end('Forbidden'); return;
        }
        const data = await fsp.readFile(file);
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve(serverPort);
    });
    server.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { ...opts, env: { ...process.env, ...(opts.env || {}) } });
    let out = '', err = '';
    child.stdout.on('data', d => { out += d; opts.onData && opts.onData(d.toString()); });
    child.stderr.on('data', d => { err += d; opts.onData && opts.onData(d.toString()); });
    child.on('error', e => resolve({ code: -1, out, err: err + e.message }));
    child.on('close', code => resolve({ code, out, err }));
  });
}

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function detectToolchain() {
  const info = {
    dotnet: { installed: false, path: DOTNET, version: null },
    mono: { installed: false, path: MONO, version: null },
    wine: { installed: false, path: null },
    gdiplus: false,
  };
  if (await exists(DOTNET)) {
    const r = await run(DOTNET, ['--version'], { timeout: 15000 });
    if (r.code === 0) { info.dotnet.installed = true; info.dotnet.version = r.out.trim(); }
  }
  if (!info.dotnet.installed) {
    const r = await run('dotnet', ['--version'], { timeout: 10000 });
    if (r.code === 0) { info.dotnet.installed = true; info.dotnet.path = 'dotnet'; info.dotnet.version = r.out.trim(); }
  }
  if (await exists(MONO)) {
    const r = await run(MONO, ['--version'], {
      timeout: 15000,
      env: { LD_LIBRARY_PATH: `${MONO_PREFIX}/usr/lib:${process.env.LD_LIBRARY_PATH || ''}`, MONO_PATH: `${MONO_PREFIX}/usr/lib/mono/4.5` },
    });
    if (r.code === 0) {
      info.mono.installed = true;
      info.mono.version = (r.out.split('\n')[0] || '').trim();
    }
  }
  const w = await run('wine', ['--version'], { timeout: 8000 });
  if (w.code === 0) { info.wine.installed = true; info.wine.path = 'wine'; info.wine.version = w.out.trim(); }
  info.gdiplus = await exists('/usr/lib/libgdiplus.so') || await exists('/usr/lib/x86_64-linux-gnu/libgdiplus.so.0') ||
    await exists(path.join(MONO_PREFIX, 'usr/lib/libgdiplus.so.0')) ||
    await exists(path.join(MONO_PREFIX, 'usr/lib/x86_64-linux-gnu/libgdiplus.so.0'));
  info.home = HOME;
  info.toolchainDir = TOOLCHAIN;
  info.appVersion = app.getVersion();
  return info;
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); } catch { return {}; }
}
function writeSettings(s) {
  try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s, null, 2)); } catch {}
}

/* ------------------------------------------------------------------ */
/* window                                                              */
/* ------------------------------------------------------------------ */

async function createWindow() {
  if (!server) await startServer();
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#1b1a22',
    icon: path.join(ROOT, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (e, details) => console.error('[renderer gone]', details));
  mainWindow.webContents.on('did-fail-load', (e, code, desc, url) => console.error('[load failed]', code, desc, url));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  const sendState = () => mainWindow && mainWindow.webContents.send('window:state', {
    maximized: mainWindow.isMaximized(), fullscreen: mainWindow.isFullScreen(),
  });
  mainWindow.on('maximize', sendState);
  mainWindow.on('unmaximize', sendState);
  mainWindow.on('enter-full-screen', sendState);
  mainWindow.on('leave-full-screen', sendState);
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle('app:info', async () => ({
  toolchain: await detectToolchain(),
  platform: process.platform,
  arch: process.arch,
  version: app.getVersion(),
  userData: app.getPath('userData'),
  settings: readSettings(),
}));

ipcMain.handle('settings:set', (e, patch) => {
  const s = { ...readSettings(), ...patch };
  writeSettings(s);
  return s;
});

ipcMain.handle('dialog:openDirectory', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:openFile', async (e, opts = {}) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: opts.filters || [{ name: 'All files', extensions: ['*'] }],
    defaultPath: opts.defaultPath,
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (e, opts = {}) => {
  const r = await dialog.showSaveDialog(mainWindow, {
    defaultPath: opts.defaultPath,
    filters: opts.filters || [{ name: 'All files', extensions: ['*'] }],
  });
  return r.canceled ? null : r.filePath;
});

ipcMain.handle('fs:read', async (e, p) => fsp.readFile(p, 'utf8'));
ipcMain.handle('fs:write', async (e, { path: p, content }) => {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, content, 'utf8');
  return true;
});
ipcMain.handle('fs:exists', async (e, p) => exists(p));
ipcMain.handle('fs:mkdir', async (e, p) => { await fsp.mkdir(p, { recursive: true }); return true; });
ipcMain.handle('fs:readdir', async (e, p) => {
  const items = await fsp.readdir(p, { withFileTypes: true });
  return items.map(i => ({ name: i.name, dir: i.isDirectory(), path: path.join(p, i.name) }));
});
ipcMain.handle('fs:rm', async (e, p) => { await fsp.rm(p, { recursive: true, force: true }); return true; });
ipcMain.handle('fs:rename', async (e, { from, to }) => { await fsp.rename(from, to); return true; });

ipcMain.handle('shell:openPath', async (e, p) => shell.openPath(p));
ipcMain.handle('shell:showItem', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('shell:openExternal', (e, url) => shell.openExternal(url));

ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
ipcMain.handle('window:fullscreen', () => {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

/* ------------------------------------------------------------------ */
/* build & run                                                         */
/* ------------------------------------------------------------------ */

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

ipcMain.handle('build:start', async (e, { dir, projectFile, configuration = 'Debug' }) => {
  const info = await detectToolchain();
  if (!info.dotnet.installed) {
    return { ok: false, code: -1, output: 'The .NET SDK is not installed.\nOpen Tools > Toolchain Manager and install the toolchain.', errors: [] };
  }
  send('build:output', `\n===== Build started (${configuration}) =====\n`);
  send('build:state', { running: true });
  const args = ['build', projectFile, '-c', configuration, '-v', 'minimal', '-nologo',
    '-p:GenerateDocumentationFile=false', '-p:WarningLevel=1'];
  const r = await run(info.dotnet.path, args, {
    cwd: dir,
    timeout: 1000 * 60 * 10,
    env: {
      DOTNET_CLI_TELEMETRY_OPTOUT: '1',
      DOTNET_NOLOGO: '1',
      DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1',
      MSBUILDDISABLENODEREUSE: '1',
      HOME: HOME,
      PATH: `${path.dirname(info.dotnet.path)}:${process.env.PATH}`,
    },
    onData: (d) => send('build:output', d),
  });
  const output = r.out + r.err;
  send('build:output', `\n===== Build finished with exit code ${r.code} =====\n`);
  send('build:state', { running: false, ok: r.code === 0 });
  const errors = [];
  const re = /(?:^|\n)\s*(?:[^\n]*?)([^\s(]+\.vb)\((\d+),(\d+)\)\s*:\s*(error|warning)\s+([A-Z]+\d+)\s*:\s*([^\n]*)/g;
  let m;
  while ((m = re.exec(output)) !== null) {
    errors.push({ file: m[1], line: +m[2], col: +m[3], severity: m[4], code: m[5], message: m[6].trim() });
  }
  if (r.code !== 0 && errors.length === 0) {
    const simple = /(?:^|\n)\s*(error|warning)\s+([A-Z]+\d+)\s*:\s*([^\n]*)/g;
    while ((m = simple.exec(output)) !== null) {
      errors.push({ file: '', line: 0, col: 0, severity: m[1], code: m[2], message: m[3].trim() });
    }
  }
  return { ok: r.code === 0, code: r.code, output, errors };
});

async function findBuiltExe(dir, configuration, assemblyName) {
  const candidates = [
    path.join(dir, 'bin', configuration, 'net472', `${assemblyName}.exe`),
    path.join(dir, 'bin', configuration, 'net472', `${assemblyName}.dll`),
  ];
  for (const c of candidates) if (await exists(c)) return c;
  const base = path.join(dir, 'bin', configuration);
  if (await exists(base)) {
    const stack = [base];
    while (stack.length) {
      const d = stack.pop();
      let items = [];
      try { items = await fsp.readdir(d, { withFileTypes: true }); } catch { continue; }
      for (const it of items) {
        const p = path.join(d, it.name);
        if (it.isDirectory()) stack.push(p);
        else if (it.name.toLowerCase() === `${assemblyName.toLowerCase()}.exe`) return p;
      }
    }
  }
  return null;
}

ipcMain.handle('app:run', async (e, { dir, configuration = 'Debug', assemblyName, projectFile }) => {
  const info = await detectToolchain();
  if (!info.mono.installed) {
    return {
      started: false, reason: 'mono-missing',
      message: 'Mono runtime is not installed. Open Tools > Toolchain Manager and install the toolchain so WinForms apps can run on Linux.',
    };
  }
  const exe = await findBuiltExe(dir, configuration, assemblyName);
  if (!exe) return { started: false, reason: 'no-build', message: 'No built executable found. Build the solution first.' };

  const env = {
    ...process.env,
    LD_LIBRARY_PATH: `${MONO_PREFIX}/usr/lib:${MONO_PREFIX}/usr/lib/x86_64-linux-gnu:${process.env.LD_LIBRARY_PATH || ''}`,
    MONO_PATH: `${MONO_PREFIX}/usr/lib/mono/4.5`,
    MONO_CONFIG: path.join(MONO_PREFIX, 'etc', 'mono', 'config'),
    DISPLAY: process.env.DISPLAY || ':0',
  };
  const child = spawn(MONO, [exe], { cwd: path.dirname(exe), env, detached: false });
  children.add(child);
  let out = '';
  child.stdout.on('data', d => { out += d; send('app:output', d.toString()); });
  child.stderr.on('data', d => { out += d; send('app:output', d.toString()); });
  child.on('error', (err) => {
    children.delete(child);
    send('app:exited', { code: -1, error: err.message });
  });
  child.on('close', (code) => {
    children.delete(child);
    send('app:exited', { code, output: out });
  });
  return { started: true, pid: child.pid, exe, message: `Running ${path.basename(exe)} with Mono.` };
});

ipcMain.handle('app:stop', () => {
  for (const c of children) { try { c.kill('SIGTERM'); } catch {} }
  children.clear();
  return true;
});

/* ------------------------------------------------------------------ */
/* toolchain installer                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle('toolchain:install', async () => {
  const script = path.join(ROOT, 'scripts', 'install-toolchain.sh');
  if (!(await exists(script))) return { ok: false, output: 'Installer script missing.' };
  send('toolchain:output', '\n=== BikinStudio toolchain installer ===\n');
  const child = spawn('bash', [script], { env: { ...process.env, HOME } });
  children.add(child);
  let out = '';
  const onData = (d) => { out += d; send('toolchain:output', d.toString()); };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  const code = await new Promise((resolve) => {
    child.on('error', () => resolve(-1));
    child.on('close', resolve);
  });
  children.delete(child);
  send('toolchain:output', `\n=== Installer finished (exit ${code}) ===\n`);
  return { ok: code === 0, code, output: out, toolchain: await detectToolchain() };
});

ipcMain.handle('toolchain:detect', async () => detectToolchain());

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  for (const c of children) { try { c.kill('SIGTERM'); } catch {} }
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (err) => {
  console.error('[main] uncaught', err);
});
