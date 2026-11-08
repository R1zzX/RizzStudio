/* BikinStudio — main application orchestrator. */

import {
  CATEGORIES, CONTROLS, FORM_PROPS, iconFor, toolboxIconChar,
  propsFor, eventsFor, defaultsFor,
} from './catalog.js';
import {
  createFormModel, createControl, addControl, allControls, findControl, findParent,
  usedNames, uniqueName, walkControls, serializeDesigner, parseDesigner, parseHandlers,
  defaultCodeBehind, handlerName, makeTabPage,
  vbprojFile, slnFile, programFile, uid, COMPONENT_TYPES,
} from './model.js';
import { Designer } from './designer.js';
import { PropertiesPanel } from './props.js';
import { CodeEditor } from './editor.js';

const bik = window.bik;

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const basename = (p) => String(p || '').split('/').filter(Boolean).pop() || String(p || '');
const dirname = (p) => { const s = String(p || ''); const i = s.lastIndexOf('/'); return i > 0 ? s.slice(0, i) : '/'; };
const joinPath = (...parts) => parts.filter(Boolean).join('/').replace(/\/{2,}/g, '/');
const extOf = (p) => { const b = basename(p); const i = b.lastIndexOf('.'); return i >= 0 ? b.slice(i + 1).toLowerCase() : ''; };
const stripExt = (p) => { const b = basename(p); const i = b.lastIndexOf('.'); return i >= 0 ? b.slice(0, i) : b; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const isIdent = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
const sanitizeId = (s) => String(s || '').replace(/[^A-Za-z0-9_]/g, '') || 'Item';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

const CONTROL_ICON = (type) => `<span class="tb-icon">${iconFor(type)}</span>`;
const FORM_ICON = '<svg viewBox="0 0 16 16" width="13" height="13"><rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6.5h11" stroke="currentColor" stroke-width="1.1"/></svg>';
const CODE_ICON = '<span style="font-family:var(--mono);font-size:10px;color:#7fd6c0">{ }</span>';

const DEFAULT_EVENTS = {
  Button: 'Click', Label: 'Click', LinkLabel: 'LinkClicked', TextBox: 'TextChanged',
  RichTextBox: 'TextChanged', MaskedTextBox: 'TextChanged', CheckBox: 'CheckedChanged',
  RadioButton: 'CheckedChanged', ComboBox: 'SelectedIndexChanged', ListBox: 'SelectedIndexChanged',
  CheckedListBox: 'ItemCheck', NumericUpDown: 'ValueChanged', TrackBar: 'ValueChanged',
  Timer: 'Tick', PictureBox: 'Click', DataGridView: 'CellClick', MenuStrip: 'ItemClicked',
  StatusStrip: 'ItemClicked', ToolStrip: 'ItemClicked', Form: 'Load',
};

const COLOR_PALETTE = [
  'Transparent', '#FFFFFF', '#F0F0F0', '#E6E6E6', '#D9D9D9', '#BFBFBF', '#808080', '#404040', '#000000', '#1E1E1E',
  '#FF0000', '#FF7F7F', '#FFA500', '#FFD700', '#FFFF00', '#BFFF00', '#00FF00', '#00FF7F', '#00FFFF', '#00BFFF',
  '#0000FF', '#4F9CF9', '#7F00FF', '#8B5CF6', '#A78BFA', '#FF00FF', '#FF69B4', '#800000', '#008000', '#000080',
];

const FONT_FAMILIES = [
  'Segoe UI', 'Arial', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas',
  'Courier New', 'DejaVu Sans', 'Georgia', 'Liberation Sans', 'Noto Sans', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana',
];

/* ------------------------------------------------------------------ */
/* application                                                         */
/* ------------------------------------------------------------------ */

class App {
  constructor() {
    this.settings = {};
    this.toolchain = null;
    this.project = null;           // { dir, name, projectFile, slnFile }
    this.forms = new Map();        // formName -> { name, form, designerPath, codePath, dirty }
    this.activeFormName = null;
    this.docs = [{ id: 'start', kind: 'start', label: 'Start Page' }];
    this.activeDocId = 'start';
    this.fileCache = new Map();
    this.dirty = new Set();
    this.config = 'Debug';
    this.outputSource = 'Build';
    this.buildOutput = '';
    this.appOutput = '';
    this.toolchainLog = '';
    this.buildState = null;
    this.recent = [];
    this.expanded = new Set();
    this.bottomTab = 'errors';
    this.menuName = null;
    this.activeModal = null;
    this.lastDesignerForm = null;
    this._toastId = 0;

    this.designer = new Designer(this);
    this.props = new PropertiesPanel(this);
    this.editor = new CodeEditor(this);

    this.boot();
  }

  async boot() {
    this.bindChrome();
    this.bindMenus();
    this.bindToolbar();
    this.bindPanels();
    this.bindStart();
    this.bindBottom();
    this.bindSettings();
    this.bindGlobalKeys();
    this.bindIpc();
    this.buildToolbox();
    this.renderTabs();
    this.renderStart();
    this.showStart();

    try {
      const info = await bik.invoke('app:info');
      this.toolchain = info.toolchain;
      this.settings = info.settings || {};
      this.recent = Array.isArray(this.settings.recent) ? this.settings.recent : [];
      this.applySettings();
      this.renderEnv();
      this.renderRecent();
      this.renderToolchain();
      this.updateToolchainStatus();
      $('start-version').textContent = `v${info.version || '1.0.0'}`;
    } catch (err) {
      console.error(err);
      this.toast('Could not read environment information', 'err');
    }

    try {
      await this.editor.init();
      this.editor.setFontSize(Number(this.settings.fontSize) || 13);
    } catch (err) {
      console.error('Monaco failed to load', err);
      this.toast('Code editor failed to load: ' + err.message, 'err');
    }
  }

  /* ================================================================ */
  /* chrome: titlebar, window controls, rail                          */
  /* ================================================================ */

  bindChrome() {
    $('win-min').addEventListener('click', () => bik.invoke('window:minimize'));
    $('win-max').addEventListener('click', () => bik.invoke('window:maximize'));
    $('win-close').addEventListener('click', () => this.requestClose());
    $('tb-search').addEventListener('click', () => this.openSearch());

    document.querySelectorAll('.rail-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showLeftPanel(btn.dataset.panel));
    });
    $('left-close').addEventListener('click', () => {
      $('leftpanel').classList.add('collapsed');
      document.querySelectorAll('.rail-btn').forEach(b => b.classList.remove('active'));
    });
    $('left-pin').addEventListener('click', () => {
      $('leftpanel').classList.toggle('collapsed');
    });
    $('tab-overflow').addEventListener('click', () => this.showDocList());
  }

  requestClose() {
    if (this.dirty.size) {
      this.confirm('Close BikinStudio', 'There are unsaved changes. Save before closing?', [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Discard', value: 'discard' },
        { label: 'Save All', value: 'save', primary: true },
      ]).then(async (r) => {
        if (r === 'cancel' || r == null) return;
        if (r === 'save') await this.saveAll();
        bik.invoke('window:close');
      });
    } else {
      bik.invoke('window:close');
    }
  }

  showLeftPanel(name) {
    const titles = { toolbox: 'Toolbox', explorer: 'Solution Explorer', toolchain: 'Toolchain Manager', settings: 'Settings' };
    if (!titles[name]) return;
    const panel = $('leftpanel');
    const already = !panel.classList.contains('collapsed') && $('left-title').textContent === titles[name];
    document.querySelectorAll('.rail-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
    document.querySelectorAll('.left-view').forEach(v => v.classList.add('hidden'));
    $('view-' + name).classList.remove('hidden');
    $('left-title').textContent = titles[name];
    panel.classList.remove('collapsed');
    if (already && name !== 'toolbox' && name !== 'explorer') return;
    if (name === 'explorer') this.renderSolutionTree();
    if (name === 'toolchain') this.renderToolchain();
  }

  updateTitle() {
    const dirty = this.dirty.size > 0;
    const name = this.project ? this.project.name : 'BikinStudio';
    $('tb-title').textContent = `${name}${dirty ? ' •' : ''} — BikinStudio Community`;
    document.title = `${name}${dirty ? ' •' : ''} — BikinStudio`;
    $('sb-project').textContent = this.project ? this.project.name : 'No project';
  }

  setStatus(msg) {
    $('sb-ready-text').textContent = msg || 'Ready';
    $('menu-hint').textContent = '';
  }

  toast(msg, kind = '') {
    const icons = { ok: '✓', err: '✕', warn: '!', '': 'i' };
    const t = el('div', 'toast ' + kind);
    t.innerHTML = `<span class="t-ico">${icons[kind] || icons['']}</span><div class="t-body"><div class="t-msg">${esc(msg)}</div></div><button class="t-close">✕</button>`;
    const close = () => { t.remove(); };
    t.querySelector('.t-close').addEventListener('click', close);
    $('toast-layer').appendChild(t);
    setTimeout(close, kind === 'err' ? 9000 : 4200);
  }

  /* ================================================================ */
  /* generic modal / menu                                              */
  /* ================================================================ */

  openModal({ title, body, buttons = [], width, className = '', closable = true, onClose }) {
    const layer = $('modal-layer');
    layer.innerHTML = '';
    layer.classList.remove('hidden');
    const modal = el('div', 'modal ' + className);
    if (width) modal.style.width = typeof width === 'number' ? width + 'px' : width;
    const head = el('div', 'modal-head');
    head.innerHTML = `<h2>${esc(title)}</h2>`;
    const x = el('button', 'modal-close', '✕');
    head.appendChild(x);
    const bodyEl = el('div', 'modal-body');
    if (body instanceof Node) bodyEl.appendChild(body);
    else bodyEl.innerHTML = body || '';
    modal.appendChild(head);
    modal.appendChild(bodyEl);
    let foot = null;
    if (buttons.length) {
      foot = el('div', 'modal-foot');
      modal.appendChild(foot);
    }
    layer.appendChild(modal);

    const api = {
      el: modal, body: bodyEl, closed: false,
      close(value) {
        if (api.closed) return;
        api.closed = true;
        layer.classList.add('hidden');
        layer.innerHTML = '';
        if (this.activeModal === api) this.activeModal = null;
        if (onClose) onClose(value);
      },
    };
    this.activeModal = api;
    x.addEventListener('click', () => api.close(null));
    layer.onclick = (e) => { if (e.target === layer && closable) api.close(null); };

    for (const b of buttons) {
      const btn = el('button', 'btn ' + (b.primary ? 'primary' : '') + (b.small ? ' sm' : ''), esc(b.label));
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        if (b.onClick) {
          btn.disabled = true;
          try { await b.onClick(api); } catch (err) { console.error(err); this.toast(err.message || String(err), 'err'); }
          btn.disabled = false;
        } else {
          api.close(b.value);
        }
      });
      if (b.left) btn.style.marginRight = 'auto';
      foot.appendChild(btn);
    }
    return api;
  }

  confirm(title, message, buttons) {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const api = this.openModal({
        title,
        body: `<p style="margin:0;line-height:1.6;color:var(--text-dim)">${esc(message)}</p>`,
        buttons: (buttons || [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }]).map(b => ({
          ...b,
          onClick: () => { api.close(); done(b.value); },
        })),
        onClose: (v) => done(v == null ? 'cancel' : v),
      });
    });
  }

  showContextMenu(items, x, y) {
    const layer = $('menu-layer');
    layer.innerHTML = '';
    layer.classList.remove('hidden');
    const pop = el('div', 'menu-pop');
    for (const item of items) {
      if (item.sep) { pop.appendChild(el('div', 'menu-sep')); continue; }
      const row = el('div', 'menu-item' + (item.disabled ? ' disabled' : ''));
      row.innerHTML = `<span class="mi-icon">${item.icon || ''}</span><span class="mi-label">${esc(item.label)}</span>${item.key ? `<span class="mi-key">${esc(item.key)}</span>` : ''}`;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        if (!item.disabled) item.action && item.action();
      });
      pop.appendChild(row);
    }
    layer.appendChild(pop);
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 6)) + 'px';
    pop.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 6)) + 'px';
    layer.onclick = (e) => { if (e.target === layer) this.closeMenu(); };
  }

  closeMenu() {
    $('menu-layer').classList.add('hidden');
    $('menu-layer').innerHTML = '';
    document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
    this.menuName = null;
  }

  /* ================================================================ */
  /* menu bar                                                          */
  /* ================================================================ */

  menuDefs() {
    return {
      file: [
        { label: 'New Project…', key: 'Ctrl+Shift+N', icon: '+', action: () => this.newProject() },
        { label: 'New Windows Form…', icon: '▦', action: () => this.addForm() },
        { sep: true },
        { label: 'Open Project / Solution…', key: 'Ctrl+O', icon: '📂', action: () => this.openProject() },
        { label: 'Open Folder…', action: () => this.openFolder() },
        { label: 'Open File…', action: () => this.openFileDialog() },
        { sep: true },
        { label: 'Save', key: 'Ctrl+S', action: () => this.saveActive() },
        { label: 'Save All', key: 'Ctrl+Shift+S', action: () => this.saveAll() },
        { label: 'Close Tab', key: 'Ctrl+W', action: () => this.closeDoc(this.activeDocId) },
        { sep: true },
        { label: 'Exit', action: () => this.requestClose() },
      ],
      edit: [
        { label: 'Undo', key: 'Ctrl+Z', action: () => this.isDesignerActive() ? this.designer.undo() : this.monacoCommand('undo') },
        { label: 'Redo', key: 'Ctrl+Y', action: () => this.isDesignerActive() ? this.designer.redo() : this.monacoCommand('redo') },
        { sep: true },
        { label: 'Cut', key: 'Ctrl+X', action: () => this.isDesignerActive() ? this.designer.cut() : this.monacoCommand('editor.action.clipboardCutAction') },
        { label: 'Copy', key: 'Ctrl+C', action: () => this.isDesignerActive() ? this.designer.copy() : this.monacoCommand('editor.action.clipboardCopyAction') },
        { label: 'Paste', key: 'Ctrl+V', action: () => this.isDesignerActive() ? this.designer.paste() : this.monacoCommand('editor.action.clipboardPasteAction') },
        { label: 'Delete', key: 'Del', action: () => this.isDesignerActive() && this.designer.deleteSelection() },
        { label: 'Select All', key: 'Ctrl+A', action: () => this.isDesignerActive() ? this.designer.selectAll() : this.monacoCommand('editor.action.selectAll') },
        { sep: true },
        { label: 'Find…', key: 'Ctrl+F', action: () => this.monacoCommand('actions.find') },
        { label: 'Search BikinStudio…', key: 'Ctrl+Q', action: () => this.openSearch() },
      ],
      view: [
        { label: 'Toolbox', action: () => this.showLeftPanel('toolbox') },
        { label: 'Solution Explorer', action: () => this.showLeftPanel('explorer') },
        { label: 'Toolchain Manager', action: () => this.showLeftPanel('toolchain') },
        { label: 'Settings', action: () => this.showLeftPanel('settings') },
        { sep: true },
        { label: 'Error List', action: () => this.switchBottom('errors') },
        { label: 'Output', action: () => this.switchBottom('output') },
        { label: 'Immediate Window', action: () => this.switchBottom('immediate') },
        { label: 'Toolchain Log', action: () => this.switchBottom('toolchain') },
        { sep: true },
        { label: 'Start Page', action: () => this.openDoc('start') },
        { label: 'Toggle Bottom Panel', action: () => this.toggleBottom() },
        { label: 'Toggle Full Screen', key: 'F11', action: () => bik.invoke('window:fullscreen') },
      ],
      project: [
        { label: 'Add Windows Form…', action: () => this.addForm() },
        { label: 'Add Class…', action: () => this.addClassFile() },
        { sep: true },
        { label: 'Set Startup Form…', action: () => this.setStartupFormDialog() },
        { label: 'Open Project Folder', action: () => this.project && bik.invoke('shell:openPath', this.project.dir) },
        { label: 'Project Properties…', action: () => this.showProjectProperties() },
      ],
      build: [
        { label: 'Build Solution', key: 'Ctrl+Shift+B', action: () => this.build() },
        { label: 'Rebuild Solution', action: () => this.build(true) },
        { label: 'Clean Solution', action: () => this.clean() },
        { sep: true },
        { label: 'Start', key: 'F5', action: () => this.run() },
        { label: 'Start Without Debugging', key: 'Ctrl+F5', action: () => this.run() },
        { label: 'Stop', action: () => bik.invoke('app:stop') },
        { sep: true },
        { label: 'Preview Form (simulation)', action: () => this.previewForm() },
      ],
      debug: [
        { label: 'Start', key: 'F5', action: () => this.run() },
        { label: 'Start Without Debugging', key: 'Ctrl+F5', action: () => this.run() },
        { label: 'Stop', action: () => bik.invoke('app:stop') },
        { sep: true },
        { label: 'Show Application Output', action: () => { this.outputSource = 'Application'; this.switchBottom('output'); this.renderOutput(); } },
        { label: 'Show Build Output', action: () => { this.outputSource = 'Build'; this.switchBottom('output'); this.renderOutput(); } },
      ],
      format: [
        { label: 'Align Left', action: () => this.designer.align('left') },
        { label: 'Align Center', action: () => this.designer.align('center') },
        { label: 'Align Right', action: () => this.designer.align('right') },
        { label: 'Align Top', action: () => this.designer.align('top') },
        { label: 'Align Middle', action: () => this.designer.align('middle') },
        { label: 'Align Bottom', action: () => this.designer.align('bottom') },
        { sep: true },
        { label: 'Make Same Width', action: () => this.designer.sameSize('same-width') },
        { label: 'Make Same Height', action: () => this.designer.sameSize('same-height') },
        { label: 'Make Same Size', action: () => this.designer.sameSize('same-size') },
        { sep: true },
        { label: 'Bring to Front', action: () => this.designer.order('front') },
        { label: 'Send to Back', action: () => this.designer.order('back') },
      ],
      tools: [
        { label: 'Toolchain Manager', action: () => this.showLeftPanel('toolchain') },
        { label: 'Install / Repair Toolchain', action: () => this.installToolchain() },
        { sep: true },
        { label: 'Settings', action: () => this.showLeftPanel('settings') },
        { label: 'Search…', key: 'Ctrl+Q', action: () => this.openSearch() },
      ],
      window: [
        { label: 'Start Page', action: () => this.openDoc('start') },
        { label: 'Solution Explorer', action: () => this.showLeftPanel('explorer') },
        { label: 'Close All Tabs', action: () => this.closeAllTabs() },
        { label: 'Reset Layout', action: () => this.resetLayout() },
      ],
      help: [
        { label: 'About BikinStudio', action: () => this.showAbout() },
        { label: 'Open Toolchain Folder', action: () => {
            const dir = this.toolchain && this.toolchain.toolchainDir;
            if (dir) bik.invoke('shell:openPath', dir);
            else this.toast('Toolchain folder is not available yet', 'warn');
          } },
      ],
    };
  }

  bindMenus() {
    document.querySelectorAll('#menubar .menu').forEach(m => {
      const name = m.dataset.menu;
      m.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.menuName === name) { this.closeMenu(); return; }
        this.openMenu(name, m);
      });
      m.addEventListener('mouseenter', () => {
        if (this.menuName && this.menuName !== name) this.openMenu(name, m);
      });
    });
    $('menu-layer').addEventListener('pointerdown', (e) => {
      if (e.target === $('menu-layer')) this.closeMenu();
    });
  }

  openMenu(name, anchor) {
    const defs = this.menuDefs();
    const items = defs[name];
    if (!items) return;
    document.querySelectorAll('#menubar .menu').forEach(m => m.classList.toggle('open', m === anchor));
    this.menuName = name;
    const layer = $('menu-layer');
    layer.innerHTML = '';
    layer.classList.remove('hidden');
    const pop = el('div', 'menu-pop');
    for (const item of items) {
      if (item.sep) { pop.appendChild(el('div', 'menu-sep')); continue; }
      const row = el('div', 'menu-item' + (item.disabled ? ' disabled' : ''));
      row.innerHTML = `<span class="mi-icon">${item.icon || ''}</span><span class="mi-label">${esc(item.label)}</span>${item.key ? `<span class="mi-key">${esc(item.key)}</span>` : ''}`;
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();
        try { item.action && item.action(); } catch (err) { console.error(err); this.toast(err.message, 'err'); }
      });
      pop.appendChild(row);
    }
    layer.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(r.left, window.innerWidth - pop.offsetWidth - 6) + 'px';
    pop.style.top = (r.bottom + 2) + 'px';
  }

  monacoCommand(id) {
    if (this.editor.editor) this.editor.editor.getAction(id)?.run();
  }

  /* ================================================================ */
  /* toolbar                                                           */
  /* ================================================================ */

  bindToolbar() {
    $('btn-start').addEventListener('click', () => this.run());
    $('btn-start-no-debug').addEventListener('click', () => this.run());
    $('btn-save').addEventListener('click', () => this.saveAll());
    $('btn-undo').addEventListener('click', () => this.isDesignerActive() ? this.designer.undo() : this.monacoCommand('undo'));
    $('btn-redo').addEventListener('click', () => this.isDesignerActive() ? this.designer.redo() : this.monacoCommand('redo'));
    $('btn-build').addEventListener('click', () => this.build());
    $('btn-new-form').addEventListener('click', () => this.addForm());
    $('cfg-select').addEventListener('change', () => {
      this.config = $('cfg-select').value;
      $('sb-build').textContent = `Build: ${this.config}`;
    });
    $('global-search').addEventListener('focus', () => { $('global-search').blur(); this.openSearch(); });
    $('global-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.openSearch($('global-search').value); } });
  }

  /* ================================================================ */
  /* left panels                                                       */
  /* ================================================================ */

  bindPanels() {
    $('toolbox-search').addEventListener('input', () => this.buildToolbox($('toolbox-search').value));
    $('toolbox-expand').addEventListener('click', () => {
      const closed = document.querySelectorAll('.tb-cat-head.closed').length > 0;
      document.querySelectorAll('.tb-cat-head').forEach(h => h.classList.toggle('closed', closed));
      document.querySelectorAll('.tb-cat-body').forEach(b => b.classList.toggle('closed', closed));
    });
    $('view-explorer').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'new-project') this.newProject();
      if (act === 'open-project') this.openProject();
      if (act === 'refresh') this.renderSolutionTree();
      if (act === 'collapse') { this.expanded.clear(); this.renderSolutionTree(); }
    });
    $('btn-install-toolchain').addEventListener('click', () => this.installToolchain());
    $('bottom-close').addEventListener('click', () => this.toggleBottom());
    $('output-source').addEventListener('change', () => {
      this.outputSource = $('output-source').value;
      this.renderOutput();
    });
    $('output-clear').addEventListener('click', () => {
      if (this.outputSource === 'Build') this.buildOutput = '';
      else if (this.outputSource === 'Application') this.appOutput = '';
      this.renderOutput();
    });
    $('immediate-input').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const input = e.target;
      const expr = input.value.trim();
      if (!expr) return;
      input.value = '';
      const out = $('immediate-text');
      out.textContent += `> ${expr}\n`;
      try {
        if (/^[0-9+\-*/(). %]+$/.test(expr)) {
          // eslint-disable-next-line no-new-func
          const v = Function('"use strict";return (' + expr.replace(/%/g, '/100') + ')')();
          out.textContent += `${v}\n`;
        } else {
          out.textContent += 'Only arithmetic expressions are evaluated in the simulator.\n';
        }
      } catch (err) {
        out.textContent += `${err.message}\n`;
      }
      out.scrollTop = out.scrollHeight;
    });
  }

  buildToolbox(filter = '') {
    const tree = $('toolbox-tree');
    tree.innerHTML = '';
    const f = filter.trim().toLowerCase();
    for (const cat of CATEGORIES) {
      const defs = Object.entries(CONTROLS).filter(([, d]) => (d.category || 'Common Controls') === cat);
      const shown = defs.filter(([type, d]) => !f || type.toLowerCase().includes(f) || (d.desc || '').toLowerCase().includes(f));
      if (!shown.length) continue;
      const wrap = el('div', 'tb-cat');
      wrap.dataset.cat = cat;
      const head = el('div', 'tb-cat-head');
      head.innerHTML = `<span class="chev">▾</span><span>${esc(cat)}</span>`;
      const body = el('div', 'tb-cat-body');
      head.addEventListener('click', () => {
        head.classList.toggle('closed');
        body.classList.toggle('closed');
      });
      for (const [type, def] of shown) {
        const item = el('div', 'tb-item');
        item.draggable = true;
        item.dataset.type = type;
        item.title = def.desc || type;
        item.innerHTML = `${CONTROL_ICON(type)}<span>${esc(type)}</span>`;
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/x-bikinstudio-control', type);
          e.dataTransfer.setData('text/plain', type);
          e.dataTransfer.effectAllowed = 'copy';
          item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('click', () => {
          document.querySelectorAll('.tb-item.selected').forEach(x => x.classList.remove('selected'));
          item.classList.add('selected');
          this.designer.setPendingTool(type);
        });
        item.addEventListener('dblclick', () => {
          if (!this.project) { this.toast('Create or open a project first', 'warn'); return; }
          this.openDesigner(this.activeFormName || [...this.forms.keys()][0]);
          this.designer.addControlAt(type, 24, 24, null);
        });
        body.appendChild(item);
      }
      wrap.appendChild(head);
      wrap.appendChild(body);
      tree.appendChild(wrap);
    }
    if (!tree.children.length) tree.innerHTML = '<div class="empty-note pad">No toolbox items match your search.</div>';
  }

  /* ================================================================ */
  /* start page                                                        */
  /* ================================================================ */

  bindStart() {
    $('startpage').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'new-project') this.newProject();
      if (act === 'open-project') this.openProject();
      if (act === 'open-sample') this.openSample();
    });
  }

  renderStart() {
    this.renderRecent();
    this.renderEnv();
  }

  renderRecent() {
    const box = $('recent-list');
    if (!box) return;
    box.innerHTML = '';
    if (!this.recent.length) {
      box.innerHTML = '<div class="empty-note">No recent projects yet.</div>';
      return;
    }
    for (const r of this.recent.slice(0, 12)) {
      const item = el('div', 'recent-item');
      item.innerHTML = `<div class="ri-name">${esc(r.name)}</div><div class="ri-path">${esc(r.path)}</div>`;
      item.addEventListener('click', () => this.loadProject(r.path));
      box.appendChild(item);
    }
  }

  renderEnv() {
    const box = $('env-status');
    if (!box) return;
    const tc = this.toolchain;
    if (!tc) { box.innerHTML = '<div class="empty-note">Checking environment…</div>'; return; }
    const row = (label, ok, text) => `<div class="env-row"><span><span class="dot ${ok ? 'ok' : 'bad'}"></span>${esc(label)}</span><span>${esc(text)}</span></div>`;
    box.innerHTML = [
      row('.NET SDK', tc.dotnet.installed, tc.dotnet.installed ? tc.dotnet.version : 'not installed'),
      row('Mono / WinForms', tc.mono.installed, tc.mono.installed ? 'ready' : 'not installed'),
      row('GDI+', tc.gdiplus, tc.gdiplus ? 'available' : 'missing'),
      row('Wine (optional)', tc.wine.installed, tc.wine.installed ? tc.wine.version : 'not found'),
    ].join('');
  }

  updateToolchainStatus() {
    const s = $('sb-toolchain');
    if (!this.toolchain) { s.textContent = 'Toolchain: checking…'; s.className = 'sb-item'; return; }
    const ok = this.toolchain.dotnet.installed && this.toolchain.mono.installed;
    s.textContent = ok ? 'Toolchain: ready' : 'Toolchain: incomplete';
    s.className = 'sb-item ' + (ok ? 'ok' : 'bad');
    $('sb-build').textContent = `Build: ${this.config}`;
  }

  renderToolchain() {
    const box = $('toolchain-list');
    if (!box) return;
    const tc = this.toolchain;
    if (!tc) { box.innerHTML = '<div class="empty-note pad">Detecting toolchain…</div>'; return; }
    const card = (title, ok, sub) => `<div class="tc-card"><div class="tc-title"><span>${esc(title)}</span><span class="pill ${ok ? 'ok' : 'bad'}">${ok ? 'Ready' : 'Missing'}</span></div><div class="tc-sub">${esc(sub || '')}</div></div>`;
    box.innerHTML = [
      card('.NET SDK', tc.dotnet.installed, tc.dotnet.version ? `${tc.dotnet.version} — ${tc.dotnet.path}` : tc.dotnet.path),
      card('Mono runtime', tc.mono.installed, tc.mono.version || tc.mono.path),
      card('libgdiplus', tc.gdiplus, 'System.Drawing support for WinForms'),
      card('Wine (optional)', tc.wine.installed, tc.wine.installed ? tc.wine.version : 'Not required — Mono is the default runtime'),
    ].join('');
  }

  async installToolchain() {
    if (!this.toolchain || !this.toolchain.dotnet.installed || !this.toolchain.mono.installed) {
      this.toast('Installing the toolchain can take a few minutes. See the Toolchain log.', '');
    }
    $('btn-install-toolchain').disabled = true;
    $('btn-install-toolchain').textContent = 'Installing…';
    this.switchBottom('toolchain');
    this.toolchainLog = '';
    $('toolchain-log').textContent = '';
    try {
      const r = await bik.invoke('toolchain:install');
      this.toolchain = r.toolchain || this.toolchain;
      this.renderToolchain();
      this.renderEnv();
      this.updateToolchainStatus();
      this.toast(r.ok ? 'Toolchain installed successfully' : 'Toolchain installation failed', r.ok ? 'ok' : 'err');
    } catch (err) {
      this.toast('Installer error: ' + err.message, 'err');
    } finally {
      $('btn-install-toolchain').disabled = false;
      $('btn-install-toolchain').textContent = 'Install / Repair Toolchain';
    }
  }

  /* ================================================================ */
  /* bottom panel                                                      */
  /* ================================================================ */

  bindBottom() {
    document.querySelectorAll('.btab').forEach(b => {
      b.addEventListener('click', () => this.switchBottom(b.dataset.btab));
    });
  }

  switchBottom(tab) {
    this.bottomTab = tab;
    $('bottompanel').classList.remove('collapsed');
    document.querySelectorAll('.btab').forEach(b => b.classList.toggle('active', b.dataset.btab === tab));
    document.querySelectorAll('.bview').forEach(v => v.classList.add('hidden'));
    const v = $('bview-' + tab);
    if (v) v.classList.remove('hidden');
    if (tab === 'output') this.renderOutput();
    if (tab === 'toolchain') $('toolchain-log').textContent = this.toolchainLog;
  }

  toggleBottom() {
    $('bottompanel').classList.toggle('collapsed');
  }

  renderOutput() {
    const pre = $('output-text');
    if (!pre) return;
    pre.textContent = this.outputSource === 'Build' ? this.buildOutput : this.appOutput;
    pre.scrollTop = pre.scrollHeight;
    $('output-source').value = this.outputSource;
  }

  showErrors(errors) {
    const list = $('error-list');
    const badge = $('err-count');
    list.innerHTML = '';
    const real = (errors || []).filter(e => e.severity === 'error');
    if (!errors || !errors.length) {
      list.innerHTML = '<div class="empty-note pad">No build errors. Build the solution to see diagnostics here.</div>';
      badge.classList.add('hidden');
      return;
    }
    badge.textContent = String(real.length || errors.length);
    badge.classList.remove('hidden');
    for (const e of errors) {
      const row = el('div', 'err-row');
      row.innerHTML = `<span class="sev-${e.severity === 'error' ? 'error' : 'warning'}">${e.severity}</span><span class="code">${esc(e.code || '')}</span><span class="msg" title="${esc(e.message)}">${esc(e.message)}</span><span class="file" title="${esc(e.file)}">${esc(basename(e.file || ''))}</span><span>${e.line || ''}</span>`;
      row.addEventListener('click', () => this.navigateError(e));
      list.appendChild(row);
    }
  }

  async navigateError(e) {
    if (!e.file) return;
    let p = e.file;
    if (!p.startsWith('/')) p = joinPath(this.project ? this.project.dir : '', p);
    const readOnly = p.endsWith('.Designer.vb');
    await this.openCode(p, { line: e.line || 1, readOnly });
  }

  bindSettings() {
    const apply = async (patch) => {
      Object.assign(this.settings, patch);
      this.applySettings();
      try { await bik.invoke('settings:set', patch); } catch {}
    };
    $('set-grid').addEventListener('change', (e) => apply({ grid: e.target.checked }));
    $('set-snap').addEventListener('change', (e) => apply({ snap: e.target.checked }));
    $('set-guides').addEventListener('change', (e) => apply({ guides: e.target.checked }));
    $('set-gridsize').addEventListener('change', (e) => apply({ gridSize: Math.max(2, Math.min(64, parseInt(e.target.value) || 8)) }));
    $('set-fontsize').addEventListener('change', (e) => apply({ fontSize: Math.max(9, Math.min(28, parseInt(e.target.value) || 13)) }));
    $('set-autosave').addEventListener('change', (e) => apply({ autosave: e.target.checked }));
  }

  applySettings() {
    const s = this.settings || {};
    const d = this.designer.settings;
    d.grid = s.grid !== false;
    d.snap = s.snap !== false;
    d.guides = s.guides !== false;
    d.gridSize = Number(s.gridSize) || 8;
    $('set-grid').checked = d.grid;
    $('set-snap').checked = d.snap;
    $('set-guides').checked = d.guides;
    $('set-gridsize').value = d.gridSize;
    $('set-fontsize').value = Number(s.fontSize) || 13;
    $('set-autosave').checked = !!s.autosave;
    this.designer.applyGrid();
    if (this.editor && this.editor.editor) this.editor.setFontSize(Number(s.fontSize) || 13);
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.activeModal) {
        if (e.key === 'Escape') { e.preventDefault(); this.activeModal.close(null); }
        return;
      }
      if (e.key === 'Escape' && this.menuName) { this.closeMenu(); return; }
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const tag = document.activeElement?.tagName;
      const inText = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
      if (mod && e.shiftKey && key === 'n') { e.preventDefault(); this.newProject(); return; }
      if (mod && key === 'o' && !e.shiftKey) { e.preventDefault(); this.openProject(); return; }
      if (mod && key === 's') { e.preventDefault(); if (e.shiftKey) this.saveAll(); else this.saveActive(); return; }
      if (mod && e.shiftKey && key === 'b') { e.preventDefault(); this.build(); return; }
      if (e.key === 'F5') { e.preventDefault(); this.run(); return; }
      if (mod && key === 'q') { e.preventDefault(); this.openSearch(); return; }
      if (mod && key === 'w' && !inText) { e.preventDefault(); this.closeDoc(this.activeDocId); return; }
      if (e.key === 'F11') { e.preventDefault(); bik.invoke('window:fullscreen'); return; }
      if (e.key === 'F7' && e.shiftKey) { e.preventDefault(); this.openActiveDesigner(); return; }
      if (e.key === 'F7' && !e.shiftKey && !this.isDesignerActive() && !inText) { e.preventDefault(); this.openCodeForSelection(); return; }
    });
  }

  bindIpc() {
    bik.on('build:output', (d) => {
      this.buildOutput += d;
      if (this.bottomTab === 'output' && this.outputSource === 'Build') this.renderOutput();
    });
    bik.on('build:state', (s) => {
      this.buildState = s;
      if (s.running) { $('sb-build').textContent = `Build: ${this.config} (building…)`; this.setStatus('Building solution…'); }
      else { $('sb-build').textContent = `Build: ${this.config}`; this.setStatus(s.ok ? 'Build succeeded' : 'Build failed'); }
    });
    bik.on('app:output', (d) => {
      this.appOutput += d;
      if (this.bottomTab === 'output' && this.outputSource === 'Application') this.renderOutput();
    });
    bik.on('app:exited', (r) => {
      this.toast(`Application exited (code ${r.code})`, r.code === 0 ? 'ok' : 'warn');
      this.appOutput += `\n[application exited with code ${r.code}]\n`;
      if (this.bottomTab === 'output' && this.outputSource === 'Application') this.renderOutput();
    });
    bik.on('toolchain:output', (d) => {
      this.toolchainLog += d;
      if (this.bottomTab === 'toolchain') $('toolchain-log').textContent = this.toolchainLog;
    });
    bik.on('window:state', (s) => {
      $('win-max').title = s.maximized ? 'Restore' : 'Maximize';
    });
  }

  /* ================================================================ */
  /* documents / tabs                                                  */
  /* ================================================================ */

  ensureDoc(doc) {
    let d = this.docs.find(x => x.id === doc.id);
    if (!d) { this.docs.push(doc); d = doc; }
    return d;
  }

  showStart() {
    $('startpage').classList.remove('hidden');
    document.querySelectorAll('.doc-view').forEach(v => v.classList.add('hidden'));
    this.activeDocId = 'start';
    this.renderTabs();
    this.updateTitle();
    this.renderStart();
  }

  async openDesigner(name) {
    if (!name) name = this.activeFormName || [...this.forms.keys()][0];
    const entry = this.forms.get(name);
    if (!entry) { this.toast('No form selected', 'warn'); return; }
    this.activeFormName = name;
    this.ensureDoc({ id: 'designer:' + name, kind: 'designer', label: name, formName: name });
    await this.openDoc('designer:' + name);
  }

  async openCode(path, opts = {}) {
    if (!path) return;
    let content = await this.readFile(path);
    if (content === '' && !(await bik.invoke('fs:exists', path))) {
      const entry = [...this.forms.values()].find(f => f.codePath === path);
      content = entry ? defaultCodeBehind(entry.form) : '';
      if (entry) await this.writeFile(path, content);
    }
    this.fileCache.set(path, content);
    const doc = this.ensureDoc({
      id: path, kind: 'code', label: basename(path), path,
      readOnly: !!opts.readOnly, line: opts.line || null,
    });
    doc.readOnly = !!opts.readOnly;
    doc.line = opts.line || null;
    await this.openDoc(path);
  }

  async openDoc(id) {
    const doc = this.docs.find(d => d.id === id);
    if (!doc) return;
    this.activeDocId = id;
    $('startpage').classList.add('hidden');
    document.querySelectorAll('.doc-view').forEach(v => v.classList.add('hidden'));
    if (doc.kind === 'start') {
      this.showStart();
      return;
    }
    if (doc.kind === 'designer') {
      const entry = this.forms.get(doc.formName);
      if (!entry) { this.showStart(); return; }
      this.activeFormName = doc.formName;
      $('designer-view').classList.remove('hidden');
      if (this.designer.form !== entry.form) {
        this.designer.setDoc(entry);
      } else {
        this.designer.render();
      }
      this.props.showTarget(this.designer.getTarget());
    } else if (doc.kind === 'code') {
      $('editor-view').classList.remove('hidden');
      try {
        if (!this.editor.ready) await this.editor.init();
        const content = await this.readFile(doc.path);
        this.editor.open(doc.path, content, { readOnly: doc.readOnly, line: doc.line });
        doc.line = null;
      } catch (err) {
        console.error(err);
        this.toast('Could not open file: ' + err.message, 'err');
      }
    }
    this.renderTabs();
    this.updateTitle();
    $('sb-cursor').textContent = doc.kind === 'code' ? 'Ln 1, Col 1' : '';
  }

  renderTabs() {
    const tabs = $('tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    for (const doc of this.docs) {
      const tab = el('div', 'doc-tab' + (doc.id === this.activeDocId ? ' active' : '') + (this.dirty.has(doc.id) ? ' dirty' : ''));
      const icon = doc.kind === 'designer' ? FORM_ICON : doc.kind === 'code' ? CODE_ICON : '<span style="color:var(--accent-2)">⌂</span>';
      tab.innerHTML = `<span class="tab-icon">${icon}</span><span class="tab-label">${esc(doc.label)}</span>`;
      const close = el('button', 'tab-close', '✕');
      close.title = 'Close';
      close.addEventListener('click', (e) => { e.stopPropagation(); this.closeDoc(doc.id); });
      tab.appendChild(close);
      tab.addEventListener('click', () => this.openDoc(doc.id));
      tab.addEventListener('auxclick', (e) => { if (e.button === 1) this.closeDoc(doc.id); });
      tabs.appendChild(tab);
    }
  }

  async closeDoc(id) {
    const idx = this.docs.findIndex(d => d.id === id);
    if (idx < 0) return;
    const doc = this.docs[idx];
    if (doc.kind === 'start') return;
    if (this.dirty.has(id)) {
      const r = await this.confirm('Close ' + doc.label, `${doc.label} has unsaved changes.`, [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Discard', value: 'discard' },
        { label: 'Save', value: 'save', primary: true },
      ]);
      if (r === 'cancel' || r == null) return;
      if (r === 'save') await this.saveDoc(id);
    }
    this.docs.splice(idx, 1);
    this.dirty.delete(id);
    if (this.activeDocId === id) {
      const next = this.docs[Math.max(0, idx - 1)] || this.docs[0];
      if (next) this.openDoc(next.id); else this.showStart();
    } else {
      this.renderTabs();
    }
  }

  async closeAllTabs() {
    for (const doc of [...this.docs].reverse()) {
      if (doc.kind !== 'start') await this.closeDoc(doc.id);
    }
    this.showStart();
  }

  showDocList() {
    const items = this.docs.map(d => ({
      label: d.label, icon: d.kind === 'designer' ? '▦' : d.kind === 'code' ? '{}' : '⌂',
      action: () => this.openDoc(d.id),
    }));
    const r = $('tab-overflow').getBoundingClientRect();
    this.showContextMenu(items, r.left - 160, r.bottom + 2);
  }

  markDirty(id) {
    const wasClean = !this.dirty.has(id);
    this.dirty.add(id);
    if (wasClean) this.renderTabs();
    this.updateTitle();
    this.scheduleAutoSave();
  }

  scheduleAutoSave() {
    if (!this.settings.autosave) return;
    clearTimeout(this._autoTimer);
    this._autoTimer = setTimeout(() => this.saveAll(true), 1200);
  }

  isDesignerActive() {
    return this.activeDocId.startsWith('designer:') && !!this.designer.form;
  }

  openActiveDesigner() {
    const entry = this.activeFormEntry();
    if (entry) this.openDesigner(entry.name);
    else this.toast('No form to design', 'warn');
  }

  activeFormEntry() {
    if (this.activeFormName && this.forms.has(this.activeFormName)) return this.forms.get(this.activeFormName);
    const first = [...this.forms.values()][0];
    return first || null;
  }

  forms() { return [...this.forms.values()]; }

  async switchForm(name) {
    await this.openDesigner(name);
  }

  /* ================================================================ */
  /* files                                                             */
  /* ================================================================ */

  async readFile(p, force = false) {
    if (!force && this.fileCache.has(p)) return this.fileCache.get(p);
    try {
      const t = await bik.invoke('fs:read', p);
      this.fileCache.set(p, t);
      return t;
    } catch { return ''; }
  }

  async writeFile(p, content) {
    await bik.invoke('fs:write', { path: p, content });
    this.fileCache.set(p, content);
  }

  contentFor(path) {
    if (this.editor && this.editor.models.has(path)) return this.editor.getValue(path);
    return this.fileCache.get(path) || '';
  }

  async saveActive() {
    if (this.isDesignerActive()) return this.saveDoc(this.activeDocId);
    if (this.activeDocId.startsWith('/')) return this.saveDoc(this.activeDocId);
    return this.saveAll();
  }

  async saveDoc(id) {
    if (id.startsWith('designer:')) {
      const entry = this.forms.get(id.slice('designer:'.length));
      if (entry) await this.saveForm(entry);
      this.dirty.delete(id);
    } else if (id.startsWith('/')) {
      const content = this.contentFor(id);
      await this.writeFile(id, content);
      this.dirty.delete(id);
      this.applyHandlersForPath(id);
    }
    this.renderTabs();
    this.updateTitle();
  }

  async saveForm(entry) {
    const content = serializeDesigner(entry.form);
    await this.writeFile(entry.designerPath, content);
    entry.dirty = false;
  }

  async saveAll(quiet = false) {
    if (!this.project) { if (!quiet) this.toast('No project to save', 'warn'); return; }
    try {
      for (const entry of this.forms.values()) await this.saveForm(entry);
      for (const doc of this.docs) {
        if (doc.kind !== 'code' || !doc.path || doc.readOnly) continue;
        if (!this.dirty.has(doc.id)) continue;
        await this.writeFile(doc.path, this.contentFor(doc.path));
        this.applyHandlersForPath(doc.path);
      }
      this.dirty.clear();
      this.renderTabs();
      this.updateTitle();
      this.setStatus('All changes saved');
      if (!quiet) this.toast('Project saved', 'ok');
    } catch (err) {
      console.error(err);
      this.toast('Save failed: ' + err.message, 'err');
    }
  }

  applyHandlersForPath(path) {
    const entry = [...this.forms.values()].find(f => f.codePath === path);
    if (!entry) return;
    this.applyHandlers(entry, this.contentFor(path));
  }

  applyHandlers(entry, code) {
    const map = parseHandlers(code || '', entry.form.name);
    walkControls(entry.form.controls || [], (c) => {
      for (const k of Object.keys(c.events || {})) delete c.events[k];
    });
    entry.form.events = {};
    for (const [key, handler] of Object.entries(map)) {
      if (key.startsWith('form:')) {
        entry.form.events[key.slice(5)] = handler;
        continue;
      }
      const [ctrlName, evt] = key.split(':');
      const c = this.findControlByName(entry.form, ctrlName);
      if (c) { c.events = c.events || {}; c.events[evt] = handler; }
    }
  }

  findControlByName(form, name) {
    let found = null;
    walkControls(form.controls || [], (c) => { if (c.name === name) found = c; });
    return found;
  }

  onEditorChange(path, value) {
    this.fileCache.set(path, value);
    const doc = this.docs.find(d => d.id === path);
    if (doc) { this.markDirty(doc.id); }
  }

  updateCursor(line, col) {
    $('sb-cursor').textContent = `Ln ${line}, Col ${col}`;
  }

  /* ================================================================ */
  /* project lifecycle                                                 */
  /* ================================================================ */

  async newProject() {
    const body = el('div');
    body.innerHTML = `
      <div class="form-field"><label>Project name</label><input type="text" id="np-name" value="MyWinFormsApp" spellcheck="false" /></div>
      <div class="form-field"><label>Location</label><div style="display:flex;gap:6px"><input type="text" id="np-loc" value="${esc(this.settings.lastLocation || '')}" spellcheck="false" /><button class="btn sm" id="np-browse" type="button">Browse…</button></div></div>
      <div class="section-title">Template</div>
      <div class="tpl-grid" id="np-templates">
        <div class="tpl-card selected" data-tpl="blank"><div class="tpl-name"><span class="tpl-ico">▦</span>Windows Forms App</div><div class="tpl-desc">A blank form with the drag &amp; drop designer. The classic starting point.</div></div>
        <div class="tpl-card" data-tpl="calculator"><div class="tpl-name"><span class="tpl-ico">∑</span>Calculator Sample</div><div class="tpl-desc">A working calculator with buttons, display, and event handlers you can study.</div></div>
        <div class="tpl-card" data-tpl="menu"><div class="tpl-name"><span class="tpl-ico">☰</span>Menu &amp; Toolbar</div><div class="tpl-desc">Form with a MenuStrip, ToolStrip, StatusStrip, and a content panel.</div></div>
        <div class="tpl-card" data-tpl="dialog"><div class="tpl-name"><span class="tpl-ico">⧉</span>Dialog Form</div><div class="tpl-desc">A fixed dialog with OK/Cancel buttons and AcceptButton / CancelButton wired.</div></div>
      </div>
      <div class="notice info" style="margin-top:14px">The project targets <code>net472</code> and runs on Linux through the bundled Mono WinForms runtime.</div>`;
    let template = 'blank';
    body.querySelectorAll('.tpl-card').forEach(card => {
      card.addEventListener('click', () => {
        body.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        template = card.dataset.tpl;
      });
    });
    const locInput = body.querySelector('#np-loc');
    if (!locInput.value) {
      const home = (this.toolchain && this.toolchain.home) || '';
      locInput.value = home ? joinPath(home, 'Projects') : '~/Projects';
    }
    body.querySelector('#np-browse').addEventListener('click', async () => {
      const d = await bik.invoke('dialog:openDirectory');
      if (d) locInput.value = d;
    });

    const api = this.openModal({
      title: 'Create a new project',
      body,
      width: 680,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'Create', primary: true,
          onClick: async () => {
            const name = body.querySelector('#np-name').value.trim();
            const loc = locInput.value.trim();
            if (!isIdent(name)) { this.toast('Project name must be a valid identifier (letters, digits, underscore).', 'err'); return; }
            if (!loc) { this.toast('Choose a location for the project.', 'err'); return; }
            const dir = joinPath(loc, name);
            const exists = await bik.invoke('fs:exists', dir);
            if (exists) {
              const items = await bik.invoke('fs:readdir', dir).catch(() => []);
              if (items.length) {
                const ok = await this.confirm('Folder not empty', `${dir} already exists and is not empty. Create the project anyway?`, [
                  { label: 'Cancel', value: 'cancel' }, { label: 'Use Folder', value: 'ok', primary: true },
                ]);
                if (ok !== 'ok') return;
              }
            }
            api.close();
            await this.createProject({ name, dir, template });
          },
        },
      ],
    });
  }

  async createProject({ name, dir, template }) {
    try {
      this.setStatus('Creating project…');
      await bik.invoke('fs:mkdir', dir);
      const rootNamespace = name;
      const projectFile = joinPath(dir, name + '.vbproj');
      const sln = joinPath(dir, name + '.sln');
      const form = createFormModel('Form1');
      form.props.Text = 'Form1';
      const code = templateCode(name, template, form);
      if (template === 'calculator') buildCalculator(form);
      if (template === 'menu') buildMenuForm(form);
      if (template === 'dialog') buildDialogForm(form);

      await this.writeFile(projectFile, vbprojFile(name, rootNamespace));
      await this.writeFile(sln, slnFile(name));
      await this.writeFile(joinPath(dir, 'Program.vb'), programFile(rootNamespace));
      await this.writeFile(joinPath(dir, 'Form1.Designer.vb'), serializeDesigner(form));
      await this.writeFile(joinPath(dir, 'Form1.vb'), code);

      this.settings.lastLocation = dirname(dir);
      await bik.invoke('settings:set', { lastLocation: this.settings.lastLocation }).catch(() => {});
      await this.loadProject(dir, { fresh: true });
      await this.openDesigner('Form1');
      this.toast(`Project ${name} created`, 'ok');
    } catch (err) {
      console.error(err);
      this.toast('Could not create project: ' + err.message, 'err');
    }
  }

  async openProject() {
    const f = await bik.invoke('dialog:openFile', {
      filters: [
        { name: 'Solutions and projects', extensions: ['sln', 'vbproj'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (!f) return;
    await this.loadProject(f);
  }

  async openFolder() {
    const d = await bik.invoke('dialog:openDirectory');
    if (d) await this.loadProject(d);
  }

  async openFileDialog() {
    const f = await bik.invoke('dialog:openFile', { filters: [{ name: 'All files', extensions: ['*'] }] });
    if (f) await this.openCode(f, { readOnly: f.endsWith('.Designer.vb') });
  }

  async openSample() {
    const base = (this.toolchain && this.toolchain.home ? this.toolchain.home : '/tmp') + '/BikinStudio Samples';
    const dir = joinPath(base, 'Calculator');
    const exists = await bik.invoke('fs:exists', joinPath(dir, 'Calculator.vbproj'));
    if (!exists) {
      await bik.invoke('fs:mkdir', dir);
      await this.createProject({ name: 'Calculator', dir, template: 'calculator' });
      return;
    }
    await this.loadProject(dir);
  }

  async loadProject(input, opts = {}) {
    try {
      let dir = String(input || '');
      let isDir = true;
      try { await bik.invoke('fs:readdir', dir); } catch { isDir = false; }
      if (!isDir) dir = dirname(dir);
      const listing = await bik.invoke('fs:readdir', dir);
      let projEntry = listing.find(i => !i.dir && i.name.toLowerCase().endsWith('.vbproj'));
      let slnEntry = listing.find(i => !i.dir && i.name.toLowerCase().endsWith('.sln'));
      let projectDir = dir;
      if (!projEntry && slnEntry) {
        const slnText = await this.readFile(slnEntry.path, true);
        const m = slnText.match(/"([^"]+\.vbproj)"/i);
        if (m) {
          const p = m[1].replace(/\\/g, '/');
          projectDir = p.startsWith('/') ? dirname(p) : joinPath(dir, dirname(p));
          const sub = await bik.invoke('fs:readdir', projectDir).catch(() => []);
          projEntry = sub.find(i => !i.dir && i.name.toLowerCase().endsWith('.vbproj'));
        }
      }
      if (!projEntry) {
        for (const it of listing.filter(i => i.dir)) {
          const sub = await bik.invoke('fs:readdir', it.path).catch(() => []);
          const p = sub.find(x => !x.dir && x.name.toLowerCase().endsWith('.vbproj'));
          if (p) { projEntry = p; projectDir = it.path; break; }
        }
      }
      if (!projEntry) { this.toast('No .vbproj or .sln found in that folder', 'err'); return; }

      const projText = await this.readFile(projEntry.path, true);
      const asm = (projText.match(/<AssemblyName>([^<]+)<\/AssemblyName>/i) || [])[1] || stripExt(projEntry.name);
      const rootNs = (projText.match(/<RootNamespace>([^<]+)<\/RootNamespace>/i) || [])[1] || asm;
      this.project = {
        dir: projectDir,
        name: asm,
        rootNamespace: rootNs,
        projectFile: projEntry.path,
        slnFile: slnEntry ? slnEntry.path : joinPath(projectDir, asm + '.sln'),
      };
      this.forms.clear();
      this.fileCache.clear();
      this.dirty.clear();
      this.docs = [{ id: 'start', kind: 'start', label: 'Start Page' }];
      this.activeDocId = 'start';

      const files = await bik.invoke('fs:readdir', projectDir);
      const designerFiles = files.filter(i => !i.dir && /\.Designer\.vb$/i.test(i.name));
      for (const f of designerFiles) {
        const base = f.name.replace(/\.Designer\.vb$/i, '');
        const codePath = joinPath(projectDir, base + '.vb');
        const content = await this.readFile(f.path, true);
        const parsed = parseDesigner(content, base);
        const form = parsed.form;
        form.name = base;
        form.path = f.path;
        const entry = { name: base, form, designerPath: f.path, codePath, dirty: false };
        const codeExists = files.some(x => !x.dir && x.name.toLowerCase() === (base + '.vb').toLowerCase());
        const code = codeExists ? await this.readFile(codePath, true) : defaultCodeBehind(form);
        if (!codeExists) await this.writeFile(codePath, code);
        this.applyHandlers(entry, code);
        this.forms.set(base, entry);
      }
      if (!this.forms.size) {
        const form = createFormModel('Form1');
        const designerPath = joinPath(projectDir, 'Form1.Designer.vb');
        const codePath = joinPath(projectDir, 'Form1.vb');
        await this.writeFile(designerPath, serializeDesigner(form));
        await this.writeFile(codePath, defaultCodeBehind(form));
        const entry = { name: 'Form1', form, designerPath, codePath, dirty: false };
        this.forms.set('Form1', entry);
      }

      const first = [...this.forms.keys()][0];
      this.activeFormName = first;
      this.updateTitle();
      this.renderSolutionTree();
      this.showLeftPanel('explorer');
      await this.openDesigner(first);
      this.pushRecent(this.project.name, projectDir);
      this.setStatus(`Opened ${this.project.name}`);
      if (!opts.fresh) this.toast(`Loaded ${this.project.name}`, 'ok');
    } catch (err) {
      console.error(err);
      this.toast('Could not open project: ' + err.message, 'err');
    }
  }

  pushRecent(name, path) {
    this.recent = [{ name, path }, ...this.recent.filter(r => r.path !== path)].slice(0, 12);
    bik.invoke('settings:set', { recent: this.recent }).catch(() => {});
    this.renderRecent();
  }

  async addForm() {
    if (!this.project) { this.toast('Create or open a project first', 'warn'); return; }
    const body = el('div');
    const suggested = 'Form' + (this.forms.size + 1);
    body.innerHTML = `<div class="form-field"><label>Form name</label><input type="text" id="nf-name" value="${suggested}" spellcheck="false" /></div>
      <div class="hint">A new form is added with its designer and code-behind. The startup form can be changed in Project &gt; Set Startup Form.</div>`;
    const api = this.openModal({
      title: 'Add Windows Form',
      body,
      width: 460,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'Add', primary: true,
          onClick: async () => {
            const name = body.querySelector('#nf-name').value.trim();
            if (!isIdent(name)) { this.toast('Form name must be a valid identifier', 'err'); return; }
            if (this.forms.has(name)) { this.toast('A form with that name already exists', 'err'); return; }
            const form = createFormModel(name);
            form.props.Text = name;
            const designerPath = joinPath(this.project.dir, name + '.Designer.vb');
            const codePath = joinPath(this.project.dir, name + '.vb');
            await this.writeFile(designerPath, serializeDesigner(form));
            await this.writeFile(codePath, defaultCodeBehind(form));
            const entry = { name, form, designerPath, codePath, dirty: false };
            this.forms.set(name, entry);
            this.renderSolutionTree();
            api.close();
            await this.openDesigner(name);
            this.toast(`${name} added`, 'ok');
          },
        },
      ],
    });
  }

  async addClassFile() {
    if (!this.project) { this.toast('Create or open a project first', 'warn'); return; }
    const body = el('div');
    body.innerHTML = `<div class="form-field"><label>Class name</label><input type="text" id="nc-name" value="Class1" spellcheck="false" /></div>`;
    const api = this.openModal({
      title: 'Add Class', body, width: 460,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'Add', primary: true,
          onClick: async () => {
            const name = body.querySelector('#nc-name').value.trim();
            if (!isIdent(name)) { this.toast('Class name must be a valid identifier', 'err'); return; }
            const p = joinPath(this.project.dir, name + '.vb');
            await this.writeFile(p, `Public Class ${name}\n\nEnd Class\n`);
            api.close();
            this.renderSolutionTree();
            await this.openCode(p);
          },
        },
      ],
    });
  }

  async setStartupFormDialog() {
    if (!this.project) return;
    const body = el('div');
    body.innerHTML = `<div class="form-field"><label>Startup form</label><select id="sf-name">${[...this.forms.keys()].map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></div>
      <div class="hint">Updates <code>Program.vb</code> so <code>Application.Run</code> starts this form.</div>`;
    const api = this.openModal({
      title: 'Set Startup Form', body, width: 460,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'Apply', primary: true,
          onClick: async () => {
            const name = body.querySelector('#sf-name').value;
            const p = joinPath(this.project.dir, 'Program.vb');
            let code = await this.readFile(p, true);
            if (!code) code = programFile(this.project.rootNamespace);
            code = code.replace(/Application\.Run\(New\s+\w+\(\)\)/i, `Application.Run(New ${name}())`);
            await this.writeFile(p, code);
            this.fileCache.delete(p);
            api.close();
            this.toast(`Startup form set to ${name}`, 'ok');
          },
        },
      ],
    });
  }

  async showProjectProperties() {
    if (!this.project) return;
    const tc = this.toolchain || { dotnet: {}, mono: {} };
    const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
    const body = el('div');
    body.innerHTML = [
      kv('Project', this.project.name),
      kv('Directory', this.project.dir),
      kv('Project file', basename(this.project.projectFile)),
      kv('Target framework', 'net472'),
      kv('Root namespace', this.project.rootNamespace),
      kv('Startup object', this.project.rootNamespace + '.Program'),
      kv('.NET SDK', tc.dotnet?.installed ? tc.dotnet.version : 'not installed'),
      kv('Mono runtime', tc.mono?.installed ? (tc.mono.version || 'ready') : 'not installed'),
      `<div class="notice info" style="margin-top:14px">Build uses <code>dotnet build</code>. Run uses the private Mono runtime so WinForms can render on Linux.</div>`,
    ].join('');
    this.openModal({ title: 'Project Properties', body, width: 620, buttons: [{ label: 'Close', value: 'ok', primary: true }] });
  }

  resetLayout() {
    $('leftpanel').classList.remove('collapsed');
    $('bottompanel').classList.remove('collapsed');
    this.showLeftPanel('toolbox');
    this.setStatus('Layout reset');
  }

  /* ================================================================ */
  /* designer callbacks                                                */
  /* ================================================================ */

  onDesignerChange() {
    const entry = this.activeFormEntry();
    if (!entry) return;
    this.markDirty('designer:' + entry.name);
    this.props.render();
  }

  bindDefaultEvent(c) {
    if (!c) return;
    const evt = DEFAULT_EVENTS[c.type] || 'Click';
    return this.bindEvent(c, evt, null, false);
  }

  async bindEvent(ctrl, evt, handler, isForm = false) {
    const entry = this.activeFormEntry();
    if (!entry) { this.toast('Open a form first', 'warn'); return; }
    const form = entry.form;
    const targetName = isForm ? form.name : ctrl.name;
    const handlesTarget = isForm ? 'MyBase' : targetName;
    const codePath = entry.codePath;
    let code = this.contentFor(codePath) || await this.readFile(codePath);
    if (!code) code = defaultCodeBehind(form);
    const defaultName = handlerName(targetName, evt);
    const hname = handler || defaultName;
    if (hasSub(code, hname)) code = attachHandles(code, hname, handlesTarget, evt);
    else code = insertHandler(code, hname, handlesTarget, evt);
    await this.writeFile(codePath, code);
    if (this.editor && this.editor.models.has(codePath)) this.editor.setValue(codePath, code);
    this.fileCache.set(codePath, code);
    this.applyHandlers(entry, code);
    this.props.render();
    this.designer.render();
    this.toast(`Handler ${hname} ready`, 'ok');
    const line = lineOfHandler(code, hname);
    await this.openCode(codePath, { line });
    return hname;
  }

  async unbindEvent(ctrl, evt, isForm = false) {
    const entry = this.activeFormEntry();
    if (!entry) return;
    const form = entry.form;
    const targetName = isForm ? form.name : ctrl.name;
    const handlesTarget = isForm ? 'MyBase' : targetName;
    const bound = isForm ? (form.events || {})[evt] : (ctrl.events || {})[evt];
    const codePath = entry.codePath;
    let code = this.contentFor(codePath) || await this.readFile(codePath);
    if (!code) return;
    code = detachHandler(code, bound || handlerName(targetName, evt), handlesTarget, evt);
    await this.writeFile(codePath, code);
    if (this.editor && this.editor.models.has(codePath)) this.editor.setValue(codePath, code);
    this.fileCache.set(codePath, code);
    this.applyHandlers(entry, code);
    this.props.render();
    this.designer.render();
    this.toast(`Unbound ${targetName}.${evt}`, '');
  }

  async openCodeForSelection() {
    const entry = this.activeFormEntry();
    if (!entry) { this.toast('No project is open', 'warn'); return; }
    const target = this.designer.getTarget();
    let line = null;
    if (target.kind === 'control' && target.control.events) {
      const evt = DEFAULT_EVENTS[target.control.type] || 'Click';
      const h = target.control.events[evt];
      if (h) {
        const code = this.contentFor(entry.codePath) || await this.readFile(entry.codePath);
        line = lineOfHandler(code, h);
      }
    }
    await this.openCode(entry.codePath, { line });
  }

  async openFormCode() {
    const entry = this.activeFormEntry();
    if (!entry) return;
    await this.openCode(entry.codePath);
  }

  async renameControl(c, newName) {
    const entry = this.activeFormEntry();
    if (!entry) return;
    newName = String(newName || '').trim();
    if (!isIdent(newName)) { this.toast('Control names must be valid identifiers', 'err'); this.props.render(); return; }
    if (newName === c.name) return;
    const used = usedNames(entry.form);
    if (used.has(newName)) { this.toast(`The name ${newName} is already used`, 'err'); this.props.render(); return; }
    const old = c.name;
    c.name = newName;
    const codePath = entry.codePath;
    let code = this.contentFor(codePath) || await this.readFile(codePath);
    if (code) {
      code = code.replace(new RegExp(`\\b${escapeRe(old)}_`, 'g'), newName + '_');
      code = code.replace(new RegExp(`(Handles\\s+[^\\n]*?)\\b${escapeRe(old)}\\.`, 'g'), `$1${newName}.`);
      code = code.replace(new RegExp(`\\bMe\\.${escapeRe(old)}\\b`, 'g'), `Me.${newName}`);
      await this.writeFile(codePath, code);
      if (this.editor && this.editor.models.has(codePath)) this.editor.setValue(codePath, code);
      this.applyHandlers(entry, code);
    }
    this.designer.render();
    this.props.showTarget(this.designer.getTarget());
    this.onDesignerChange();
    this.toast(`Renamed ${old} to ${newName}`, 'ok');
  }

  /* ================================================================ */
  /* property editors                                                  */
  /* ================================================================ */

  pickColor(current) {
    return new Promise((resolve) => {
      const body = el('div');
      const grid = el('div', 'color-grid');
      let chosen = current || '#FFFFFF';
      for (const c of COLOR_PALETTE) {
        const cell = el('div', 'color-cell' + (c === chosen ? ' sel' : ''));
        cell.dataset.color = c;
        cell.style.background = c === 'Transparent'
          ? 'repeating-conic-gradient(#888 0% 25%, #ddd 0% 50%) 0 0/8px 8px'
          : c;
        cell.title = c;
        cell.addEventListener('click', () => {
          chosen = c;
          grid.querySelectorAll('.color-cell').forEach(x => x.classList.toggle('sel', x === cell));
          hex.value = c === 'Transparent' ? '' : c;
          hex.disabled = c === 'Transparent';
        });
        grid.appendChild(cell);
      }
      const row = el('div', 'form-field');
      row.innerHTML = `<label>Hex color</label><input type="text" id="pc-hex" value="${chosen === 'Transparent' ? '' : esc(chosen)}" placeholder="#RRGGBB" spellcheck="false" />`;
      const hex = row.querySelector('input');
      hex.addEventListener('input', () => {
        const v = hex.value.trim();
        if (/^#?[0-9a-f]{6}$/i.test(v)) {
          chosen = '#' + v.replace('#', '').toUpperCase();
          grid.querySelectorAll('.color-cell').forEach(x => x.classList.toggle('sel', x.dataset.color === chosen));
        }
      });
      body.appendChild(grid);
      body.appendChild(row);
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const api = this.openModal({
        title: 'Color Picker',
        body,
        width: 520,
        buttons: [
          { label: 'Transparent', onClick: () => { api.close(); done('Transparent'); } },
          { label: 'Cancel', onClick: () => { api.close(); done(null); } },
          { label: 'OK', primary: true, onClick: () => { api.close(); done(chosen); } },
        ],
        onClose: () => done(null),
      });
    });
  }

  pickFont(current) {
    return new Promise((resolve) => {
      const f = current || { family: 'Segoe UI', size: 9, style: 0 };
      const body = el('div');
      body.innerHTML = `
        <div class="form-row">
          <div class="form-field"><label>Family</label><select id="pf-family">${FONT_FAMILIES.map(x => `<option value="${esc(x)}"${x === f.family ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
          <div class="form-field" style="max-width:120px"><label>Size</label><input type="number" id="pf-size" min="6" max="96" step="0.5" value="${Number(f.size) || 9}" /></div>
        </div>
        <div class="section-title">Style</div>
        <div style="display:flex;gap:18px">
          <label class="check-row"><input type="checkbox" id="pf-bold" ${f.style & 1 ? 'checked' : ''} /> Bold</label>
          <label class="check-row"><input type="checkbox" id="pf-italic" ${f.style & 2 ? 'checked' : ''} /> Italic</label>
          <label class="check-row"><input type="checkbox" id="pf-underline" ${f.style & 4 ? 'checked' : ''} /> Underline</label>
        </div>
        <div id="pf-preview" style="margin-top:12px;padding:16px;border:1px solid var(--border);border-radius:6px;background:#1b1924;font-size:16px">The quick brown fox jumps over the lazy dog.</div>`;
      const update = () => {
        const size = parseFloat(body.querySelector('#pf-size').value) || 9;
        const fam = body.querySelector('#pf-family').value;
        let st = 0;
        if (body.querySelector('#pf-bold').checked) st |= 1;
        if (body.querySelector('#pf-italic').checked) st |= 2;
        if (body.querySelector('#pf-underline').checked) st |= 4;
        const p = body.querySelector('#pf-preview');
        p.style.fontFamily = `"${fam}", sans-serif`;
        p.style.fontSize = Math.max(8, size * 1.33) + 'px';
        p.style.fontWeight = st & 1 ? '700' : '400';
        p.style.fontStyle = st & 2 ? 'italic' : 'normal';
        p.style.textDecoration = st & 4 ? 'underline' : 'none';
      };
      body.addEventListener('input', update);
      body.addEventListener('change', update);
      update();
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const api = this.openModal({
        title: 'Font',
        body,
        width: 560,
        buttons: [
          { label: 'Cancel', onClick: () => { api.close(); done(null); } },
          {
            label: 'OK', primary: true,
            onClick: () => {
              let style = 0;
              if (body.querySelector('#pf-bold').checked) style |= 1;
              if (body.querySelector('#pf-italic').checked) style |= 2;
              if (body.querySelector('#pf-underline').checked) style |= 4;
              const out = {
                family: body.querySelector('#pf-family').value,
                size: parseFloat(body.querySelector('#pf-size').value) || 9,
                style,
              };
              api.close();
              done(out);
            },
          },
        ],
        onClose: () => done(null),
      });
    });
  }

  async browseImage() {
    const f = await bik.invoke('dialog:openFile', {
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico'] }],
    });
    return f || null;
  }

  openCollectionEditor(ctrl, propName) {
    const schema = propsFor(ctrl.type).find(p => p.name === propName);
    const coll = schema?.coll || (propName === 'Items' ? 'strings' : '');
    if (coll === 'strings') return this.editStringCollection(ctrl, propName);
    if (coll === 'tabpages') return this.editTabPages(ctrl);
    if (coll === 'columns') return this.editColumns(ctrl);
    if (coll === 'menuitems' || coll === 'statusitems' || coll === 'toolstripitems') return this.editMenuItems(ctrl, coll);
    this.toast('This collection cannot be edited yet', 'warn');
  }

  editStringCollection(ctrl, propName) {
    let working = Array.isArray(ctrl.props[propName]) ? [...ctrl.props[propName]] : [];
    let selected = 0;
    const body = el('div');
    const layout = el('div', 'coll-layout');
    const list = el('div', 'coll-list');
    const edit = el('div', 'coll-edit');
    const actions = el('div', 'coll-actions');
    layout.appendChild(list);
    layout.appendChild(edit);
    body.appendChild(layout);
    edit.appendChild(actions);

    const draw = () => {
      list.innerHTML = '';
      working.forEach((v, i) => {
        const row = el('div', 'coll-list-item' + (i === selected ? ' sel' : ''));
        row.textContent = String(v || '(empty)');
        row.addEventListener('click', () => { selected = i; draw(); });
        list.appendChild(row);
      });
      if (!working.length) list.innerHTML = '<div class="empty-note pad">No items.</div>';
      edit.innerHTML = '';
      edit.appendChild(actions);
      actions.innerHTML = '';
      const add = el('button', 'btn', '+ Add');
      add.addEventListener('click', () => { working.push('Item' + (working.length + 1)); selected = working.length - 1; draw(); });
      const del = el('button', 'btn', 'Remove');
      del.disabled = !working.length;
      del.addEventListener('click', () => { working.splice(selected, 1); selected = Math.max(0, selected - 1); draw(); });
      const up = el('button', 'btn', '↑');
      up.disabled = selected <= 0;
      up.addEventListener('click', () => { const [v] = working.splice(selected, 1); working.splice(selected - 1, 0, v); selected--; draw(); });
      const down = el('button', 'btn', '↓');
      down.disabled = selected >= working.length - 1;
      down.addEventListener('click', () => { const [v] = working.splice(selected, 1); working.splice(selected + 1, 0, v); selected++; draw(); });
      actions.append(add, del, up, down);
      if (working.length) {
        const inp = el('input');
        inp.type = 'text';
        inp.value = working[selected];
        inp.style.width = '100%';
        inp.style.height = '30px';
        inp.style.background = '#1b1924';
        inp.style.border = '1px solid var(--border)';
        inp.style.borderRadius = '5px';
        inp.style.padding = '0 9px';
        inp.addEventListener('input', () => {
          working[selected] = inp.value;
          const row = list.children[selected];
          if (row && row.classList.contains('coll-list-item')) row.textContent = String(inp.value || '(empty)');
        });
        edit.appendChild(inp);
      }
    };
    draw();
    const api = this.openModal({
      title: `${ctrl.name}.${propName} Collection Editor`,
      body,
      width: 620,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'OK', primary: true,
          onClick: () => {
            this.designer.pushUndo();
            ctrl.props[propName] = working.filter(x => String(x).length);
            this.designer.render();
            this.onDesignerChange();
            this.props.render();
            api.close();
          },
        },
      ],
    });
  }

  editTabPages(ctrl) {
    let working = (ctrl.tabPages || []).map(p => ({ ...p, children: p.children || [] }));
    let selected = 0;
    const body = el('div');
    body.innerHTML = `<div class="hint" style="margin-bottom:10px">Tab pages are real <code>TabPage</code> controls. Controls dropped on the active tab page belong to it.</div>`;
    const layout = el('div', 'coll-layout');
    const list = el('div', 'coll-list');
    const edit = el('div', 'coll-edit');
    layout.appendChild(list); layout.appendChild(edit);
    body.appendChild(layout);
    const draw = () => {
      list.innerHTML = '';
      working.forEach((p, i) => {
        const row = el('div', 'coll-list-item' + (i === selected ? ' sel' : ''));
        row.textContent = p.text || p.name;
        row.addEventListener('click', () => { selected = i; draw(); });
        list.appendChild(row);
      });
      edit.innerHTML = '';
      const actions = el('div', 'coll-actions');
      const add = el('button', 'btn', '+ Add Page');
      add.addEventListener('click', () => {
        const used = usedNames(this.designer.form);
        working.push(makeTabPage(uniqueName('TabPage', used), 'TabPage' + (working.length + 1)));
        selected = working.length - 1; draw();
      });
      const del = el('button', 'btn', 'Remove');
      del.disabled = working.length <= 1;
      del.addEventListener('click', () => { working.splice(selected, 1); selected = Math.max(0, selected - 1); draw(); });
      const up = el('button', 'btn', '↑');
      up.disabled = selected <= 0;
      up.addEventListener('click', () => { const [v] = working.splice(selected, 1); working.splice(selected - 1, 0, v); selected--; draw(); });
      const down = el('button', 'btn', '↓');
      down.disabled = selected >= working.length - 1;
      down.addEventListener('click', () => { const [v] = working.splice(selected, 1); working.splice(selected + 1, 0, v); selected++; draw(); });
      actions.append(add, del, up, down);
      edit.appendChild(actions);
      if (working.length) {
        const field = el('div', 'form-field');
        field.innerHTML = `<label>Page text</label><input type="text" id="tp-text" value="${esc(working[selected].text || '')}" />`;
        field.querySelector('input').addEventListener('input', (e) => {
          working[selected].text = e.target.value;
          const row = list.children[selected];
          if (row) row.textContent = e.target.value;
        });
        edit.appendChild(field);
        const nameField = el('div', 'form-field');
        nameField.innerHTML = `<label>Page name</label><input type="text" value="${esc(working[selected].name || '')}" readonly />`;
        edit.appendChild(nameField);
      }
    };
    draw();
    const api = this.openModal({
      title: `${ctrl.name}.TabPages Collection Editor`, body, width: 620,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'OK', primary: true,
          onClick: () => {
            this.designer.pushUndo();
            ctrl.tabPages = working;
            ctrl.activePage = Math.min(ctrl.activePage || 0, working.length - 1);
            this.designer.render();
            this.onDesignerChange();
            this.props.render();
            api.close();
          },
        },
      ],
    });
  }

  editColumns(ctrl) {
    let working = (ctrl.columns || []).map(c => ({ ...c }));
    let selected = 0;
    const body = el('div');
    const layout = el('div', 'coll-layout');
    const list = el('div', 'coll-list');
    const edit = el('div', 'coll-edit');
    layout.append(list, edit);
    body.appendChild(layout);
    const used = usedNames(this.designer.form);
    const draw = () => {
      list.innerHTML = '';
      working.forEach((c, i) => {
        const row = el('div', 'coll-list-item' + (i === selected ? ' sel' : ''));
        row.textContent = c.text || c.name;
        row.addEventListener('click', () => { selected = i; draw(); });
        list.appendChild(row);
      });
      edit.innerHTML = '';
      const actions = el('div', 'coll-actions');
      const add = el('button', 'btn', '+ Add Column');
      add.addEventListener('click', () => {
        const name = uniqueName('Column', used); used.add(name);
        working.push({ id: uid('col'), name, text: 'Column' + (working.length + 1), width: 100 });
        selected = working.length - 1; draw();
      });
      const del = el('button', 'btn', 'Remove');
      del.disabled = !working.length;
      del.addEventListener('click', () => { working.splice(selected, 1); selected = Math.max(0, selected - 1); draw(); });
      actions.append(add, del);
      edit.appendChild(actions);
      if (working.length) {
        const f1 = el('div', 'form-field');
        f1.innerHTML = `<label>Header text</label><input type="text" value="${esc(working[selected].text || '')}" />`;
        f1.querySelector('input').addEventListener('input', (e) => { working[selected].text = e.target.value; list.children[selected].textContent = e.target.value; });
        const f2 = el('div', 'form-field');
        f2.innerHTML = `<label>Width</label><input type="number" value="${working[selected].width || 100}" />`;
        f2.querySelector('input').addEventListener('input', (e) => { working[selected].width = parseInt(e.target.value) || 100; });
        const f3 = el('div', 'form-field');
        f3.innerHTML = `<label>Name</label><input type="text" value="${esc(working[selected].name || '')}" readonly />`;
        edit.append(f1, f2, f3);
      }
    };
    draw();
    const api = this.openModal({
      title: `${ctrl.name}.Columns Collection Editor`, body, width: 620,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'OK', primary: true,
          onClick: () => {
            this.designer.pushUndo();
            ctrl.columns = working;
            this.designer.render();
            this.onDesignerChange();
            this.props.render();
            api.close();
          },
        },
      ],
    });
  }

  editMenuItems(ctrl, coll) {
    const isStatus = coll === 'statusitems';
    const isTool = coll === 'toolstripitems';
    const itemType = isStatus ? 'ToolStripStatusLabel' : isTool ? 'ToolStripButton' : 'ToolStripMenuItem';
    let working = clone(ctrl.items || []);
    const used = usedNames(this.designer.form);
    const body = el('div');
    body.innerHTML = `<div class="hint" style="margin-bottom:10px">Edit the item tree. Use the buttons on each row to add a child, add a sibling, move, or delete.</div>`;
    const tree = el('div', 'tree-editor');
    body.appendChild(tree);
    const nameFor = (text) => {
      const name = uniqueName(sanitizeId(text || 'Item') + itemType, used);
      used.add(name);
      return name;
    };
    const draw = () => {
      tree.innerHTML = '';
      const drawItems = (items, depth, parentList) => {
        if (!items.length) {
          const empty = el('div', 'empty-note pad');
          empty.textContent = 'No items. Add one below.';
          tree.appendChild(empty);
        }
        items.forEach((it, idx) => {
          const row = el('div', 'te-row');
          row.style.paddingLeft = (5 + depth * 16) + 'px';
          const txt = el('input');
          txt.type = 'text'; txt.value = it.text || ''; txt.placeholder = 'Text';
          txt.addEventListener('input', () => { it.text = txt.value; });
          row.appendChild(txt);
          if (it.type === 'ToolStripMenuItem') {
            const key = el('input');
            key.type = 'text'; key.value = it.shortcut || ''; key.placeholder = 'Ctrl+X'; key.style.width = '80px'; key.style.flex = '0 0 80px';
            key.addEventListener('input', () => { it.shortcut = key.value; });
            row.appendChild(key);
          }
          const btn = (label, title, fn, disabled) => {
            const b = el('button', 'btn sm', label);
            b.title = title; b.disabled = !!disabled;
            b.addEventListener('click', fn);
            row.appendChild(b);
          };
          btn('+↳', 'Add child', () => {
            const child = { id: uid('mi'), type: itemType, name: nameFor('Item'), text: 'Item', shortcut: '', checked: false, enabled: true, items: [] };
            it.items = it.items || []; it.items.push(child); draw();
          }, isStatus || isTool);
          btn('+', 'Add sibling', () => {
            const sib = { id: uid('mi'), type: itemType, name: nameFor('Item'), text: 'Item', shortcut: '', checked: false, enabled: true, items: [] };
            parentList.splice(idx + 1, 0, sib); draw();
          });
          btn('↑', 'Move up', () => { if (idx > 0) { const [v] = parentList.splice(idx, 1); parentList.splice(idx - 1, 0, v); draw(); } }, idx === 0);
          btn('↓', 'Move down', () => { if (idx < parentList.length - 1) { const [v] = parentList.splice(idx, 1); parentList.splice(idx + 1, 0, v); draw(); } }, idx === parentList.length - 1);
          btn('✕', 'Delete', () => { parentList.splice(idx, 1); draw(); });
          tree.appendChild(row);
          if (it.items && it.items.length) drawItems(it.items, depth + 1, it.items);
        });
      };
      drawItems(working, 0, working);
      const addRoot = el('button', 'btn sm', '+ Add top-level item');
      addRoot.style.marginTop = '8px';
      addRoot.addEventListener('click', () => {
        working.push({ id: uid('mi'), type: itemType, name: nameFor('Item'), text: 'Item', shortcut: '', checked: false, enabled: true, items: [] });
        draw();
      });
      tree.appendChild(addRoot);
    };
    draw();
    const api = this.openModal({
      title: `${ctrl.name}.Items Collection Editor`, body, width: 760,
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        {
          label: 'OK', primary: true,
          onClick: () => {
            this.designer.pushUndo();
            ctrl.items = working;
            this.designer.render();
            this.onDesignerChange();
            this.props.render();
            api.close();
          },
        },
      ],
    });
  }

  /* ================================================================ */
  /* preview                                                           */
  /* ================================================================ */

  previewForm() {
    const entry = this.activeFormEntry();
    if (!entry) { this.toast('Open a form first', 'warn'); return; }
    const form = entry.form;
    this.designer.render();
    const backdrop = el('div', 'preview-backdrop');
    const win = el('div', 'preview-window');
    const title = el('div', 'preview-title');
    title.innerHTML = `<span>${esc(form.props.Text || form.name)} — Preview</span><span class="pw-btns"><i>—</i><i>□</i><i>✕</i></span>`;
    const bodyWrap = el('div', 'preview-body');
    bodyWrap.style.width = form.w + 'px';
    bodyWrap.style.height = form.h + 'px';
    const inner = el('div', 'preview-form');
    inner.style.width = form.w + 'px';
    inner.style.height = form.h + 'px';
    inner.style.background = form.props.BackColor && form.props.BackColor !== 'Transparent' ? form.props.BackColor : '#F0F0F0';
    const clone = $('form-client').cloneNode(true);
    clone.removeAttribute('id');
    clone.style.position = 'absolute';
    clone.style.inset = '0';
    inner.appendChild(clone);
    bodyWrap.appendChild(inner);
    const hint = el('div', 'preview-hint', 'Simulation only — use Start (F5) to run the real WinForms app with Mono.');
    win.append(title, bodyWrap);
    backdrop.appendChild(win);
    document.body.appendChild(backdrop);
    document.body.appendChild(hint);
    const close = () => { backdrop.remove(); hint.remove(); window.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    title.querySelector('.pw-btns').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    window.addEventListener('keydown', onKey);
  }

  /* ================================================================ */
  /* build / run                                                       */
  /* ================================================================ */

  async build(rebuild = false) {
    if (!this.project) { this.toast('Create or open a project first', 'warn'); return false; }
    await this.saveAll(true);
    this.buildOutput = '';
    this.outputSource = 'Build';
    this.switchBottom('output');
    this.renderOutput();
    this.setStatus(rebuild ? 'Rebuilding solution…' : 'Building solution…');
    try {
      const r = await bik.invoke('build:start', {
        dir: this.project.dir,
        projectFile: this.project.projectFile,
        configuration: this.config,
      });
      if (!this.buildOutput && r.output) { this.buildOutput = r.output; this.renderOutput(); }
      this.showErrors(r.errors || []);
      if (r.ok) {
        this.setStatus('Build succeeded');
        $('sb-build').textContent = `Build: ${this.config} — succeeded`;
        this.toast('Build succeeded', 'ok');
      } else {
        this.setStatus('Build failed');
        $('sb-build').textContent = `Build: ${this.config} — failed`;
        this.switchBottom('errors');
        this.toast('Build failed — see the Error List', 'err');
      }
      return !!r.ok;
    } catch (err) {
      console.error(err);
      this.toast('Build error: ' + err.message, 'err');
      return false;
    }
  }

  async run() {
    if (!this.project) { this.toast('Create or open a project first', 'warn'); return; }
    const ok = await this.build();
    if (!ok) return;
    this.appOutput = '';
    this.outputSource = 'Application';
    this.switchBottom('output');
    this.renderOutput();
    try {
      const r = await bik.invoke('app:run', {
        dir: this.project.dir,
        configuration: this.config,
        assemblyName: this.project.name,
        projectFile: this.project.projectFile,
      });
      if (!r.started) {
        if (r.reason === 'mono-missing') {
          const choice = await this.confirm('Mono runtime required', r.message, [
            { label: 'Close', value: 'cancel' },
            { label: 'Open Toolchain Manager', value: 'open', primary: true },
          ]);
          if (choice === 'open') { this.showLeftPanel('toolchain'); }
        } else {
          this.toast(r.message || 'Could not start application', 'err');
        }
        return;
      }
      this.setStatus('Application running…');
      this.toast(r.message || 'Application started', 'ok');
    } catch (err) {
      console.error(err);
      this.toast('Run error: ' + err.message, 'err');
    }
  }

  async clean() {
    if (!this.project) return;
    const ok = await this.confirm('Clean Solution', 'Delete the bin and obj folders for this project?', [
      { label: 'Cancel', value: 'cancel' },
      { label: 'Clean', value: 'ok', primary: true },
    ]);
    if (ok !== 'ok') return;
    await bik.invoke('fs:rm', joinPath(this.project.dir, 'bin'));
    await bik.invoke('fs:rm', joinPath(this.project.dir, 'obj'));
    this.fileCache.clear();
    this.toast('Clean finished', 'ok');
    this.setStatus('Clean finished');
  }

  /* ================================================================ */
  /* solution explorer                                                 */
  /* ================================================================ */

  async renderSolutionTree() {
    const tree = $('solution-tree');
    const empty = $('explorer-empty');
    if (!tree) return;
    tree.innerHTML = '';
    if (!this.project) {
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    let files = [];
    try { files = await bik.invoke('fs:readdir', this.project.dir); } catch {}

    const row = (depth, icon, label, opts = {}) => {
      const r = el('div', 'tree-row' + (opts.selected ? ' selected' : ''));
      r.style.paddingLeft = (6 + depth * 13) + 'px';
      const chev = opts.expandable ? (opts.expanded ? '▾' : '▸') : '';
      r.innerHTML = `<span class="tw">${chev}</span><span class="ti">${icon}</span><span class="tlabel">${esc(label)}</span>${opts.badge ? `<span class="tbadge">${esc(opts.badge)}</span>` : ''}`;
      if (opts.onClick) r.addEventListener('click', opts.onClick);
      if (opts.onContext) r.addEventListener('contextmenu', (e) => { e.preventDefault(); opts.onContext(e); });
      if (opts.onDblClick) r.addEventListener('dblclick', opts.onDblClick);
      tree.appendChild(r);
      return r;
    };

    const slnExpanded = this.expanded.has('sln');
    row(0, '◈', basename(this.project.slnFile), {
      expandable: true, expanded: slnExpanded,
      onClick: () => { this.toggleExpand('sln'); this.renderSolutionTree(); },
    });
    if (!slnExpanded) return;

    const projExpanded = this.expanded.has('proj');
    row(1, '▣', this.project.name, {
      expandable: true, expanded: projExpanded, badge: 'VB.NET',
      onClick: () => { this.toggleExpand('proj'); this.renderSolutionTree(); },
    });
    if (!projExpanded) return;

    const formsExpanded = this.expanded.has('forms');
    row(2, '▤', 'Forms', {
      expandable: true, expanded: formsExpanded, badge: String(this.forms.size),
      onClick: () => { this.toggleExpand('forms'); this.renderSolutionTree(); },
    });
    if (formsExpanded) {
      for (const entry of this.forms.values()) {
        const key = 'form:' + entry.name;
        const open = this.expanded.has(key);
        const formRow = row(3, FORM_ICON, entry.name + '.vb', {
          expandable: true, expanded: open,
          selected: this.activeFormName === entry.name,
          onClick: () => this.openDesigner(entry.name),
          onDblClick: () => this.openDesigner(entry.name),
          onContext: (e) => this.formContextMenu(entry, e),
        });
        const tw = formRow.querySelector('.tw');
        if (tw) tw.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleExpand(key);
          this.renderSolutionTree();
        });
        if (open) {
          row(4, FORM_ICON, entry.name + '.Designer.vb', {
            onClick: () => this.openCode(entry.designerPath, { readOnly: true }),
            onContext: (e) => this.formContextMenu(entry, e),
          });
          row(4, CODE_ICON, entry.name + '.vb', {
            onClick: () => this.openCode(entry.codePath),
            onContext: (e) => this.formContextMenu(entry, e),
          });
        }
      }
    }

    const otherFiles = files.filter(f => !f.dir && /\.vb$/i.test(f.name) &&
      !/\.Designer\.vb$/i.test(f.name) &&
      ![...this.forms.values()].some(e => basename(e.codePath).toLowerCase() === f.name.toLowerCase()));
    for (const f of otherFiles) {
      row(2, CODE_ICON, f.name, { onClick: () => this.openCode(f.path) });
    }
    const projectFiles = files.filter(f => !f.dir && /\.(vbproj|sln|config|json|xml)$/i.test(f.name) && f.name !== basename(this.project.projectFile) && f.name !== basename(this.project.slnFile));
    for (const f of projectFiles) {
      row(2, '◦', f.name, { onClick: () => this.openCode(f.path, { readOnly: extOf(f.name) !== 'json' }) });
    }
    row(2, '⚙', basename(this.project.projectFile), { onClick: () => this.openCode(this.project.projectFile, { readOnly: true }) });
  }

  toggleExpand(key) {
    if (this.expanded.has(key)) this.expanded.delete(key); else this.expanded.add(key);
  }

  formContextMenu(entry, e) {
    this.showContextMenu([
      { label: 'View Designer', action: () => this.openDesigner(entry.name) },
      { label: 'View Code', action: () => this.openCode(entry.codePath) },
      { sep: true },
      { label: 'Set as Startup Form', action: () => this.setStartupFormDirect(entry.name) },
      { label: 'Open Containing Folder', action: () => bik.invoke('shell:showItem', entry.designerPath) },
    ], e.clientX, e.clientY);
  }

  async setStartupFormDirect(name) {
    if (!this.project) return;
    const p = joinPath(this.project.dir, 'Program.vb');
    let code = await this.readFile(p, true);
    if (!code) code = programFile(this.project.rootNamespace);
    code = code.replace(/Application\.Run\(New\s+\w+\(\)\)/i, `Application.Run(New ${name}())`);
    await this.writeFile(p, code);
    this.toast(`Startup form set to ${name}`, 'ok');
  }

  /* ================================================================ */
  /* search                                                            */
  /* ================================================================ */

  openSearch(initial = '') {
    const body = el('div');
    body.innerHTML = `<div class="toolbar-search" style="width:100%;margin-bottom:12px"><svg viewBox="0 0 16 16" width="12" height="12"><circle cx="7" cy="7" r="4.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m10.4 10.4 3.3 3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><input id="search-input" placeholder="Search commands, files, forms, and toolbox controls…" spellcheck="false" value="${esc(initial)}" /></div><div class="search-results" id="search-results"></div>`;
    const input = body.querySelector('#search-input');
    const results = body.querySelector('#search-results');
    const defs = this.menuDefs();
    const commands = [];
    for (const items of Object.values(defs)) {
      for (const it of items) if (!it.sep) commands.push({ label: it.label, kind: 'Command', icon: it.icon || '⌘', action: it.action });
    }
    const forms = [...this.forms.values()].map(f => ({ label: f.name, kind: 'Form', icon: '▦', action: () => this.openDesigner(f.name) }));
    const controls = Object.keys(CONTROLS).map(type => ({ label: type, kind: 'Toolbox', icon: '◇', action: () => { this.showLeftPanel('toolbox'); this.designer.setPendingTool(type); } }));
    const files = [...this.forms.values()].flatMap(f => [
      { label: basename(f.codePath), kind: 'File', icon: '{}', action: () => this.openCode(f.codePath) },
      { label: basename(f.designerPath), kind: 'File', icon: '▦', action: () => this.openCode(f.designerPath, { readOnly: true }) },
    ]);
    const all = [...commands, ...forms, ...files, ...controls];
    let filtered = all;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      filtered = all.filter(x => !q || x.label.toLowerCase().includes(q) || x.kind.toLowerCase().includes(q)).slice(0, 60);
      results.innerHTML = '';
      if (!filtered.length) { results.innerHTML = '<div class="empty-note pad">No results.</div>'; return; }
      for (const item of filtered) {
        const row = el('div', 'search-result');
        row.innerHTML = `<span class="sr-kind">${esc(item.kind)}</span><span style="color:var(--text-mute);width:18px;text-align:center">${item.icon}</span><span>${esc(item.label)}</span>`;
        row.addEventListener('click', () => { api.close(); item.action && item.action(); });
        results.appendChild(row);
      }
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); api.close(); filtered[0].action && filtered[0].action(); }
    });
    const api = this.openModal({ title: 'Search BikinStudio', body, width: 640, buttons: [] });
    draw();
    setTimeout(() => { input.focus(); input.select(); }, 30);
  }

  showAbout() {
    const tc = this.toolchain || { dotnet: {}, mono: {} };
    const body = el('div');
    body.innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
        <div class="start-logo" style="width:56px;height:56px">
          <svg viewBox="0 0 32 32" width="34" height="34"><path d="M4 8.5 16 2l12 6.5v15L16 30 4 23.5z" fill="#8b5cf6"/><path d="M4 8.5 16 15l12-6.5M16 15v15" fill="none" stroke="#2a1140" stroke-width="2.2" stroke-linejoin="round"/></svg>
        </div>
        <div><h2 style="margin:0;font-size:18px">BikinStudio Community</h2><div class="hint">A Visual Studio-inspired IDE for VB.NET Windows Forms on Linux.</div></div>
      </div>
      <div class="kv"><span>Version</span><span>1.0.0</span></div>
      <div class="kv"><span>Editor</span><span>Monaco</span></div>
      <div class="kv"><span>Target framework</span><span>net472</span></div>
      <div class="kv"><span>.NET SDK</span><span>${esc(tc.dotnet?.installed ? tc.dotnet.version : 'not installed')}</span></div>
      <div class="kv"><span>Mono runtime</span><span>${esc(tc.mono?.installed ? (tc.mono.version || 'ready') : 'not installed')}</span></div>
      <div class="kv"><span>Toolchain directory</span><span>${esc(tc.toolchainDir || '')}</span></div>
      <div class="notice info" style="margin-top:16px">This is an independent project. It is not affiliated with or endorsed by Microsoft. Visual Studio is a trademark of Microsoft Corporation.</div>`;
    this.openModal({ title: 'About BikinStudio', body, width: 620, buttons: [{ label: 'Close', value: 'ok', primary: true }] });
  }
}

/* ------------------------------------------------------------------ */
/* module-level helpers                                               */
/* ------------------------------------------------------------------ */

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function lineOfHandler(code, name) {
  const lines = String(code || '').split('\n');
  const re = new RegExp(`\\bSub\\s+${escapeRe(name)}\\s*\\(`, 'i');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return null;
}

function hasSub(code, name) {
  return new RegExp(`\\bSub\\s+${escapeRe(name)}\\s*\\(`, 'i').test(String(code || ''));
}

function insertHandler(code, name, handlesTarget, evt) {
  const args = EVENT_ARGS_LOCAL[evt] || 'EventArgs';
  const snippet = `    Private Sub ${name}(sender As Object, e As ${args}) Handles ${handlesTarget}.${evt}\n\n    End Sub\n\n`;
  const idx = code.lastIndexOf('End Class');
  if (idx < 0) return code + '\n' + snippet;
  return code.slice(0, idx) + snippet + code.slice(idx);
}

function attachHandles(code, handlerNameStr, handlesTarget, evt) {
  const lines = String(code).split('\n');
  let idx = -1;
  const re = new RegExp(`\\bSub\\s+${escapeRe(handlerNameStr)}\\s*\\(`, 'i');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) { idx = i; break; }
  if (idx < 0) return code;
  for (let i = idx; i < Math.min(lines.length, idx + 8); i++) {
    if (/\bHandles\b/i.test(lines[i])) {
      if (new RegExp(`\\b${escapeRe(handlesTarget)}\\.${escapeRe(evt)}\\b`).test(lines[i])) return code;
      lines[i] = lines[i].replace(/\bHandles\b/i, `Handles ${handlesTarget}.${evt},`);
      return lines.join('\n');
    }
  }
  return code;
}

function detachHandler(code, handlerNameStr, handlesTarget, evt) {
  const src = String(code);
  const lines = src.split('\n');
  let start = -1;
  const re = new RegExp(`\\bSub\\s+${escapeRe(handlerNameStr)}\\s*\\(`, 'i');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) { start = i; break; }
  if (start < 0) return src;
  let handlesIdx = -1;
  for (let i = start; i < Math.min(lines.length, start + 8); i++) {
    if (/\bHandles\b/i.test(lines[i])) { handlesIdx = i; break; }
  }
  if (handlesIdx < 0) return src;
  const line = lines[handlesIdx];
  const hpos = line.search(/\bHandles\b/i);
  const head = line.slice(0, hpos + 'Handles'.length);
  const list = line.slice(hpos + 'Handles'.length).split(',').map(s => s.trim()).filter(Boolean);
  const wanted = `${handlesTarget}.${evt}`;
  const kept = list.filter(h => h.replace(/^Me\./, '') !== wanted);
  if (kept.length === list.length) return src;
  if (kept.length) {
    lines[handlesIdx] = head + ' ' + kept.join(', ');
    return lines.join('\n');
  }
  // no Handles clauses left: drop the whole Sub block
  let end = handlesIdx;
  while (end < lines.length && !/^\s*End Sub\b/i.test(lines[end])) end++;
  if (end >= lines.length) return src;
  let from = start;
  while (from > 0 && /^\s*$/.test(lines[from - 1])) from--;
  lines.splice(from, end - from + 1);
  return lines.join('\n');
}

const EVENT_ARGS_LOCAL = {
  Load: 'EventArgs', Click: 'EventArgs', DoubleClick: 'EventArgs', MouseClick: 'MouseEventArgs',
  MouseDown: 'MouseEventArgs', MouseUp: 'MouseEventArgs', MouseMove: 'MouseEventArgs',
  MouseEnter: 'EventArgs', MouseLeave: 'EventArgs', MouseHover: 'EventArgs',
  KeyDown: 'KeyEventArgs', KeyUp: 'KeyEventArgs', KeyPress: 'KeyPressEventArgs',
  TextChanged: 'EventArgs', CheckedChanged: 'EventArgs', SelectedIndexChanged: 'EventArgs',
  ValueChanged: 'EventArgs', ItemCheck: 'ItemCheckEventArgs', Tick: 'EventArgs',
  ItemClicked: 'ToolStripItemClickedEventArgs', LinkClicked: 'LinkLabelLinkClickedEventArgs',
  FormClosing: 'FormClosingEventArgs', FormClosed: 'FormClosedEventArgs',
  Resize: 'EventArgs', Paint: 'PaintEventArgs', CellClick: 'DataGridViewCellEventArgs',
  Enter: 'EventArgs', Leave: 'EventArgs', Validating: 'CancelEventArgs', Validated: 'EventArgs',
};

/* ------------------------------------------------------------------ */
/* project templates                                                  */
/* ------------------------------------------------------------------ */

function templateCode(name, template, form) {
  if (template === 'calculator') return calculatorCode();
  if (template === 'menu') return menuCode();
  if (template === 'dialog') return dialogCode();
  return defaultCodeBehind(form);
}

function calculatorCode() {
  return `Imports System.Windows.Forms

Public Class Form1

    Private current As String = "0"
    Private stored As Double = 0
    Private pendingOp As String = ""
    Private fresh As Boolean = True

    Private Sub Form1_Load(sender As Object, e As EventArgs) Handles MyBase.Load
        UpdateDisplay()
    End Sub

    Private Sub UpdateDisplay()
        Display.Text = current
    End Sub

    Private Sub AppendDigit(d As String)
        If fresh Then
            current = ""
            fresh = False
        End If
        If d = "." AndAlso current.Contains(".") Then Return
        If current = "" AndAlso d = "." Then current = "0"
        current &= d
        UpdateDisplay()
    End Sub

    Private Sub SetOperator(op As String)
        If Not fresh Then
            Calculate()
        Else
            stored = Double.Parse(current)
        End If
        pendingOp = op
        fresh = True
    End Sub

    Private Sub Calculate()
        Dim value As Double = Double.Parse(current)
        Select Case pendingOp
            Case "+" : stored += value
            Case "-" : stored -= value
            Case "*" : stored *= value
            Case "/"
                If value = 0 Then
                    current = "Error"
                    UpdateDisplay()
                    Return
                End If
                stored /= value
        End Select
        current = stored.ToString()
        pendingOp = ""
        fresh = True
        UpdateDisplay()
    End Sub

    Private Sub ClearAll()
        current = "0"
        stored = 0
        pendingOp = ""
        fresh = True
        UpdateDisplay()
    End Sub

    Private Sub Backspace()
        If current.Length > 1 Then current = current.Substring(0, current.Length - 1) Else current = "0"
        UpdateDisplay()
    End Sub

    Private Sub Button7_Click(sender As Object, e As EventArgs) Handles Button7.Click
        AppendDigit("7")
    End Sub

    Private Sub Button8_Click(sender As Object, e As EventArgs) Handles Button8.Click
        AppendDigit("8")
    End Sub

    Private Sub Button9_Click(sender As Object, e As EventArgs) Handles Button9.Click
        AppendDigit("9")
    End Sub

    Private Sub Button4_Click(sender As Object, e As EventArgs) Handles Button4.Click
        AppendDigit("4")
    End Sub

    Private Sub Button5_Click(sender As Object, e As EventArgs) Handles Button5.Click
        AppendDigit("5")
    End Sub

    Private Sub Button6_Click(sender As Object, e As EventArgs) Handles Button6.Click
        AppendDigit("6")
    End Sub

    Private Sub Button1_Click(sender As Object, e As EventArgs) Handles Button1.Click
        AppendDigit("1")
    End Sub

    Private Sub Button2_Click(sender As Object, e As EventArgs) Handles Button2.Click
        AppendDigit("2")
    End Sub

    Private Sub Button3_Click(sender As Object, e As EventArgs) Handles Button3.Click
        AppendDigit("3")
    End Sub

    Private Sub Button0_Click(sender As Object, e As EventArgs) Handles Button0.Click
        AppendDigit("0")
    End Sub

    Private Sub ButtonDot_Click(sender As Object, e As EventArgs) Handles ButtonDot.Click
        AppendDigit(".")
    End Sub

    Private Sub ButtonAdd_Click(sender As Object, e As EventArgs) Handles ButtonAdd.Click
        SetOperator("+")
    End Sub

    Private Sub ButtonSub_Click(sender As Object, e As EventArgs) Handles ButtonSub.Click
        SetOperator("-")
    End Sub

    Private Sub ButtonMul_Click(sender As Object, e As EventArgs) Handles ButtonMul.Click
        SetOperator("*")
    End Sub

    Private Sub ButtonDiv_Click(sender As Object, e As EventArgs) Handles ButtonDiv.Click
        SetOperator("/")
    End Sub

    Private Sub ButtonEquals_Click(sender As Object, e As EventArgs) Handles ButtonEquals.Click
        Calculate()
    End Sub

    Private Sub ButtonClear_Click(sender As Object, e As EventArgs) Handles ButtonClear.Click
        ClearAll()
    End Sub

    Private Sub ButtonBack_Click(sender As Object, e As EventArgs) Handles ButtonBack.Click
        Backspace()
    End Sub

    Private Sub ButtonNegate_Click(sender As Object, e As EventArgs) Handles ButtonNegate.Click
        If current.StartsWith("-") Then current = current.Substring(1) Else current = "-" & current
        UpdateDisplay()
    End Sub

End Class
`;
}

function menuCode() {
  return `Imports System.Windows.Forms

Public Class Form1

    Private Sub Form1_Load(sender As Object, e As EventArgs) Handles MyBase.Load
        StatusLabel.Text = "Ready"
    End Sub

    Private Sub ExitMenuItem_Click(sender As Object, e As EventArgs) Handles ExitMenuItem.Click
        Close()
    End Sub

    Private Sub AboutMenuItem_Click(sender As Object, e As EventArgs) Handles AboutMenuItem.Click
        MessageBox.Show("Built with BikinStudio on Linux.", "About", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub ToolStripButton1_Click(sender As Object, e As EventArgs) Handles ToolStripButton1.Click
        MessageBox.Show("New document", "BikinStudio", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

    Private Sub HelloButton_Click(sender As Object, e As EventArgs) Handles HelloButton.Click
        MessageBox.Show("Hello from BikinStudio!", "Hello", MessageBoxButtons.OK, MessageBoxIcon.Information)
    End Sub

End Class
`;
}

function dialogCode() {
  return `Imports System.Windows.Forms

Public Class Form1

    Private Sub OkButton_Click(sender As Object, e As EventArgs) Handles OkButton.Click
        DialogResult = DialogResult.OK
        Close()
    End Sub

    Private Sub CancelBtn_Click(sender As Object, e As EventArgs) Handles CancelBtn.Click
        DialogResult = DialogResult.Cancel
        Close()
    End Sub

End Class
`;
}

function buildCalculator(form) {
  form.w = 370;
  form.h = 420;
  form.props.Text = 'Calculator';
  form.props.StartPosition = 'CenterScreen';
  form.props.FormBorderStyle = 'FixedSingle';
  form.props.MaximizeBox = false;
  form.props.BackColor = '#2B2839';

  const used = usedNames(form);
  const mk = (type, name, x, y, w, h, text, props = {}) => {
    const c = createControl(type, used, x, y);
    c.name = name;
    used.add(name);
    c.w = w; c.h = h;
    c.props.Text = text;
    Object.assign(c.props, props);
    form.controls.push(c);
    return c;
  };

  mk('TextBox', 'Display', 12, 12, 346, 52, '0', {
    TextAlign: 'Right', ReadOnly: true, Font: { family: 'Segoe UI', size: 20, style: 1 },
    BackColor: '#1B1924', ForeColor: '#E7E4F2', BorderStyle: 'FixedSingle',
  });

  const labels = [
    ['C', 'ButtonClear'], ['⌫', 'ButtonBack'], ['±', 'ButtonNegate'], ['÷', 'ButtonDiv'],
    ['7', 'Button7'], ['8', 'Button8'], ['9', 'Button9'], ['×', 'ButtonMul'],
    ['4', 'Button4'], ['5', 'Button5'], ['6', 'Button6'], ['−', 'ButtonSub'],
    ['1', 'Button1'], ['2', 'Button2'], ['3', 'Button3'], ['+', 'ButtonAdd'],
  ];
  let i = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const [text, name] = labels[i++];
      const x = 12 + col * 88;
      const y = 76 + row * 62;
      const isOp = ['ButtonDiv', 'ButtonMul', 'ButtonSub', 'ButtonAdd', 'ButtonEquals'].includes(name);
      const isClear = name === 'ButtonClear' || name === 'ButtonBack';
      mk('Button', name, x, y, 82, 56, text, {
        Font: { family: 'Segoe UI', size: 13, style: 1 },
        BackColor: isOp ? '#8B5CF6' : isClear ? '#3A3548' : '#322E42',
        ForeColor: isOp ? '#FFFFFF' : '#E7E4F2',
        FlatStyle: 'Flat',
      });
    }
  }
  // zero spans two columns
  mk('Button', 'Button0', 12, 76 + 4 * 62, 170, 56, '0', {
    Font: { family: 'Segoe UI', size: 13, style: 1 }, BackColor: '#322E42', ForeColor: '#E7E4F2', FlatStyle: 'Flat',
  });
  mk('Button', 'ButtonDot', 12 + 2 * 88, 76 + 4 * 62, 82, 56, '.', {
    Font: { family: 'Segoe UI', size: 13, style: 1 }, BackColor: '#322E42', ForeColor: '#E7E4F2', FlatStyle: 'Flat',
  });
  mk('Button', 'ButtonEquals', 12 + 3 * 88, 76 + 4 * 62, 82, 56, '=', {
    Font: { family: 'Segoe UI', size: 13, style: 1 }, BackColor: '#8B5CF6', ForeColor: '#FFFFFF', FlatStyle: 'Flat',
  });

  for (const c of form.controls) {
    if (c.type === 'Button') c.events = {};
  }
}

function buildMenuForm(form) {
  form.w = 760;
  form.h = 480;
  form.props.Text = 'Menu & Toolbar Demo';
  form.props.StartPosition = 'CenterScreen';
  const used = usedNames(form);
  const add = (type, name, x, y, w, h, text, props = {}) => {
    const c = createControl(type, used, x, y);
    c.name = name; used.add(name);
    c.w = w; c.h = h; c.props.Text = text;
    Object.assign(c.props, props);
    form.controls.push(c);
    return c;
  };

  const menu = add('MenuStrip', 'MainMenu', 0, 0, 760, 24, '', { Dock: 'Top' });
  menu.items = [
    { id: uid('mi'), type: 'ToolStripMenuItem', name: 'FileMenuItem', text: 'File', shortcut: '', checked: false, enabled: true, items: [
      { id: uid('mi'), type: 'ToolStripMenuItem', name: 'ExitMenuItem', text: 'Exit', shortcut: 'Alt+F4', checked: false, enabled: true, items: [] },
    ] },
    { id: uid('mi'), type: 'ToolStripMenuItem', name: 'HelpMenuItem', text: 'Help', shortcut: '', checked: false, enabled: true, items: [
      { id: uid('mi'), type: 'ToolStripMenuItem', name: 'AboutMenuItem', text: 'About…', shortcut: '', checked: false, enabled: true, items: [] },
    ] },
  ];

  const tool = add('ToolStrip', 'MainToolStrip', 0, 24, 760, 28, '', { Dock: 'Top' });
  tool.items = [
    { id: uid('mi'), type: 'ToolStripButton', name: 'ToolStripButton1', text: 'New', shortcut: '', checked: false, enabled: true, items: [] },
    { id: uid('mi'), type: 'ToolStripButton', name: 'ToolStripButton2', text: 'Open', shortcut: '', checked: false, enabled: true, items: [] },
    { id: uid('mi'), type: 'ToolStripButton', name: 'ToolStripButton3', text: 'Save', shortcut: '', checked: false, enabled: true, items: [] },
  ];

  const status = add('StatusStrip', 'MainStatus', 0, 0, 760, 22, '', { Dock: 'Bottom' });
  status.items = [
    { id: uid('mi'), type: 'ToolStripStatusLabel', name: 'StatusLabel', text: 'Ready', shortcut: '', checked: false, enabled: true, items: [] },
  ];

  add('Label', 'TitleLabel', 28, 76, 500, 34, 'Menu & Toolbar Demo', {
    Font: { family: 'Segoe UI', size: 18, style: 1 }, ForeColor: '#2B2839',
  });
  add('Label', 'BodyLabel', 28, 118, 620, 60, 'This form was generated by BikinStudio. Edit the menu items in the Properties panel, then press F5 to run it with Mono.', {
    Font: { family: 'Segoe UI', size: 10, style: 0 }, ForeColor: '#444444',
  });
  add('Button', 'HelloButton', 28, 190, 140, 36, 'Say Hello', { FlatStyle: 'Flat' });
  const hello = form.controls[form.controls.length - 1];
  hello.events = { Click: 'HelloButton_Click' };
}

function buildDialogForm(form) {
  form.w = 460;
  form.h = 240;
  form.props.Text = 'Dialog';
  form.props.StartPosition = 'CenterParent';
  form.props.FormBorderStyle = 'FixedDialog';
  form.props.MaximizeBox = false;
  form.props.MinimizeBox = false;
  form.props.AcceptButton = 'OkButton';
  form.props.CancelButton = 'CancelBtn';
  const used = usedNames(form);
  const add = (type, name, x, y, w, h, text, props = {}) => {
    const c = createControl(type, used, x, y);
    c.name = name; used.add(name);
    c.w = w; c.h = h; c.props.Text = text;
    Object.assign(c.props, props);
    form.controls.push(c);
    return c;
  };
  add('Label', 'PromptLabel', 24, 28, 400, 40, 'Do you want to continue?', {
    Font: { family: 'Segoe UI', size: 12, style: 0 },
  });
  add('Button', 'OkButton', 236, 170, 90, 32, 'OK', { DialogResult: 'OK' });
  add('Button', 'CancelBtn', 336, 170, 90, 32, 'Cancel', { DialogResult: 'Cancel' });
  form.controls[1].events = { Click: 'OkButton_Click' };
  form.controls[2].events = { Click: 'CancelBtn_Click' };
}

/* ------------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', () => {
  window.bikApp = new App();
});


