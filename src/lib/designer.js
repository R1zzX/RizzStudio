/* The WinForms visual designer: rendering, selection, drag & drop, layout. */

import { CONTROLS, propsFor, iconFor, toolboxIconChar } from './catalog.js';
import {
  addControl, allControls, controlListFor, controlName, findControl, findParent, isContainer,
  uid, uniqueName, usedNames, walkControls,
} from './model.js';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const SNAP = 8;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function deepClone(o) {
  // Designer instances hang runtime-only fields (_parent, _content, _rect…)
  // off the model; drop them before JSON sees the circular _parent chain.
  return JSON.parse(JSON.stringify(o, (k, v) => (k.startsWith('_') ? undefined : v)));
}

function cleanForm(form) {
  return deepClone(form);
}

export class Designer {
  constructor(app) {
    this.app = app;
    this.doc = null;
    this.form = null;
    this.sel = new Set();
    this.selForm = false;
    this.clipboard = [];
    this.undoStack = [];
    this.redoStack = [];
    this.pendingTool = null;
    this.drag = null;
    this.zoom = 1;
    this.settings = { grid: true, snap: true, guides: true, gridSize: SNAP };
    this.$ = {
      frame: document.getElementById('form-frame'),
      surface: document.getElementById('form-surface'),
      client: document.getElementById('form-client'),
      caption: document.getElementById('form-caption-text'),
      selLayer: document.getElementById('selection-layer'),
      snapLayer: document.getElementById('snap-layer'),
      band: document.getElementById('rubber-band'),
      tray: document.getElementById('component-tray'),
      trayItems: document.getElementById('tray-items'),
      scroll: document.getElementById('designer-scroll'),
      stage: document.getElementById('designer-stage'),
      status: document.getElementById('ds-selection'),
      coords: document.getElementById('ds-coords'),
      formSelect: document.getElementById('form-select'),
      gridBtn: document.getElementById('btn-grid'),
      snapBtn: document.getElementById('btn-snap'),
      zoom: document.getElementById('zoom-select'),
    };
    this.init();
  }

  init() {
    const s = this.$.surface;
    s.addEventListener('pointerdown', (e) => this.onSurfaceDown(e));
    s.addEventListener('dblclick', (e) => {
      if (e.target === s || e.target === this.$.client) this.app.openFormCode();
    });
    s.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    s.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    s.addEventListener('drop', (e) => this.onDrop(e));
    s.addEventListener('mousemove', (e) => {
      if (!this.drag && this.form) {
        const p = this.toForm(e);
        this.$.coords.textContent = `${Math.round(p.x)}, ${Math.round(p.y)} px`;
      }
    });

    this.$.gridBtn.addEventListener('click', () => {
      this.settings.grid = !this.settings.grid;
      this.$.gridBtn.classList.toggle('on', this.settings.grid);
      this.applyGrid();
    });
    this.$.snapBtn.addEventListener('click', () => {
      this.settings.snap = !this.settings.snap;
      this.$.snapBtn.classList.toggle('on', this.settings.snap);
    });

    document.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => this.align(b.dataset.align)));
    document.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => this.sameSize(b.dataset.size)));
    document.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => this.order(b.dataset.order)));
    document.getElementById('btn-preview').addEventListener('click', () => this.app.previewForm());

    this.$.formSelect.addEventListener('change', () => this.app.switchForm(this.$.formSelect.value));

    if (this.$.zoom) {
      this.$.zoom.addEventListener('change', () => this.setZoom(parseInt(this.$.zoom.value) / 100));
    }
    this.$.scroll.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      this.zoomStep(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  setZoom(z) {
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    this.zoom = Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));
    this.$.frame.style.zoom = String(this.zoom);
    if (this.$.zoom) {
      const pct = Math.round(this.zoom * 100);
      const nearest = steps.reduce((a, s) => Math.abs(Math.round(s * 100) - pct) < Math.abs(Math.round(a * 100) - pct) ? s : a, steps[0]);
      this.$.zoom.value = String(Math.round(nearest * 100));
    }
    this.app.setStatus(`Zoom: ${Math.round(this.zoom * 100)}%`);
  }

  zoomStep(dir) {
    const steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
    const i = steps.indexOf(this.zoom);
    if (i >= 0) this.setZoom(steps[Math.min(steps.length - 1, Math.max(0, i + dir))]);
    else {
      const next = steps.find(s => dir > 0 ? s > this.zoom : s < this.zoom);
      if (next) this.setZoom(next);
    }
  }

  /* ---------------- document ---------------- */

  setDoc(doc) {
    this.doc = doc;
    this.form = doc.form;
    this.sel.clear();
    this.selForm = false;
    this.undoStack = [];
    this.redoStack = [];
    this.pendingTool = null;
    this.render();
    this.updateFormSelect();
  }

  updateFormSelect() {
    const sel = this.$.formSelect;
    if (!sel) return;
    sel.innerHTML = '';
    const forms = this.app.forms instanceof Map ? this.app.forms.values() : (this.app.forms || []);
    for (const f of forms) {
      const o = document.createElement('option');
      o.value = f.name;
      o.textContent = f.name;
      if (this.form && f.name === this.form.name) o.selected = true;
      sel.appendChild(o);
    }
  }

  /* ---------------- undo ---------------- */

  pushUndo() {
    if (!this.form) return;
    this.undoStack.push({ form: cleanForm(this.form), sel: [...this.sel], selForm: this.selForm });
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length) { this.app.toast('Nothing to undo', 'warn'); return; }
    this.redoStack.push({ form: cleanForm(this.form), sel: [...this.sel], selForm: this.selForm });
    const s = this.undoStack.pop();
    this.restore(s);
  }

  redo() {
    if (!this.redoStack.length) { this.app.toast('Nothing to redo', 'warn'); return; }
    this.undoStack.push({ form: cleanForm(this.form), sel: [...this.sel], selForm: this.selForm });
    const s = this.redoStack.pop();
    this.restore(s);
  }

  restore(s) {
    this.doc.form = s.form;
    this.form = s.form;
    this.sel = new Set(s.sel);
    this.selForm = s.selForm;
    this.render();
    this.app.onDesignerChange(true);
    this.app.props.showTarget(this.getTarget());
  }

  /* ---------------- layout ---------------- */

  computeRects() {
    const form = this.form;
    const layout = (list, pw, ph, ox, oy, parent) => {
      let top = 0, bottom = ph, left = 0, right = pw;
      for (const c of list || []) {
        const dock = c.props?.Dock || 'None';
        let x = c.x, y = c.y, w = c.w, h = c.h;
        if (dock === 'Top') { x = 0; y = top; w = pw; top += h; }
        else if (dock === 'Bottom') { y = bottom - h; x = 0; w = pw; bottom -= h; }
        else if (dock === 'Left') { x = left; y = 0; w = w; h = ph; left += w; }
        else if (dock === 'Right') { x = right - w; y = 0; h = ph; right -= w; }
        else if (dock === 'Fill') { x = 0; y = 0; w = pw; h = ph; }
        c._rect = { x: ox + x, y: oy + y, w, h };
        c._parent = parent;
        c._origin = { x: ox + x, y: oy + y };
        c._content = { x: ox + x, y: oy + y, w, h };
        if (c.type === 'GroupBox') { c._content = { x: ox + x + 3, y: oy + y + 16, w: w - 6, h: h - 19 }; }
        if (c.type === 'Panel') { c._content = { x: ox + x, y: oy + y, w, h }; }
        if (c.type === 'TabControl') {
          const page = c.tabPages?.[c.activePage || 0];
          c._content = { x: ox + x + 4, y: oy + y + 28, w: w - 8, h: h - 32 };
          if (page) {
            page._rect = c._content;
            page._parent = c;
            layout(page.children, c._content.w, c._content.h, c._content.x, c._content.y, c);
          }
        }
        if (c.children && c.children.length) {
          layout(c.children, c._content.w, c._content.h, c._content.x, c._content.y, c);
        }
      }
    };
    layout(form.controls, form.w, form.h, 0, 0, null);
  }

  /* ---------------- render ---------------- */

  render() {
    if (!this.form) return;
    const f = this.form;
    const surface = this.$.surface;
    surface.style.width = f.w + 'px';
    surface.style.height = f.h + 'px';
    surface.style.setProperty('--grid-size', (this.settings.gridSize || 8) + 'px');
    this.$.frame.style.width = f.w + 'px';
    this.$.caption.textContent = f.props.Text || f.name;
    this.applyGrid();
    this.computeRects();

    const client = this.$.client;
    client.innerHTML = '';
    const renderList = (list) => {
      for (const c of list || []) {
        if (c.component) continue;
        client.appendChild(this.renderControl(c));
        if (c.type === 'TabControl') {
          const page = c.tabPages?.[c.activePage || 0];
          if (page) renderList(page.children);
        } else if (c.children && c.children.length) {
          renderList(c.children);
        }
      }
    };
    renderList(f.controls);

    this.renderTray();
    this.renderSelection();
    this.$.formSelect && this.updateFormSelect();
  }

  applyGrid() {
    this.$.surface.classList.toggle('grid-on', this.settings.grid);
    this.$.gridBtn.classList.toggle('on', this.settings.grid);
    this.$.snapBtn.classList.toggle('on', this.settings.snap);
  }

  /* A control inherits the Font of its nearest parent (container or form) until
     the property is explicitly changed, matching WinForms inheritance rules. */
  fontFor(c) {
    const isDefault = (type, f) => {
      const def = propsFor(type).find(p => p.name === 'Font');
      return !!def && JSON.stringify(f) === JSON.stringify(def.def);
    };
    for (let cur = c; cur; cur = cur._parent) {
      const f = cur.props?.Font;
      if (f && !isDefault(cur.type, f)) return f;
    }
    return this.form?.props?.Font || { family: 'Segoe UI', size: 9, style: 0 };
  }

  renderControl(c) {
    const r = c._rect || { x: c.x, y: c.y, w: c.w, h: c.h };
    const node = el('div', `ctl ${c.type}`);
    node.dataset.id = c.id;
    node.style.left = r.x + 'px';
    node.style.top = r.y + 'px';
    node.style.width = r.w + 'px';
    node.style.height = r.h + 'px';

    if (c.unknown) {
      node.classList.add('ctl-preserved');
      const t = el('span', 'ctext');
      t.textContent = `${c.name} (${c.type})`;
      node.appendChild(t);
      node.title = `Unsupported control type "${c.type}". It is preserved in Designer.vb but cannot be edited here.`;
      node.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.select([c.id], e.ctrlKey || e.shiftKey); });
      node.addEventListener('contextmenu', (e) => this.onContextMenu(e, c));
      return node;
    }

    const p = c.props || {};
    const font = this.fontFor(c);
    node.style.fontFamily = `"${font.family}", "Noto Sans", sans-serif`;
    node.style.fontSize = Math.max(7, Math.round((font.size || 9) * 96 / 72)) + 'px';
    node.style.fontWeight = (font.style & 1) ? '700' : '400';
    node.style.fontStyle = (font.style & 2) ? 'italic' : 'normal';
    node.style.textDecoration = (font.style & 4) ? 'underline' : (font.style & 8 ? 'line-through' : 'none');
    if (p.ForeColor && p.ForeColor !== 'Transparent') node.style.color = p.ForeColor;
    if (p.BackColor && p.BackColor !== 'Transparent' && p.BackColor !== 'Control') node.style.background = p.BackColor;
    if (p.BackColor === 'Transparent') node.style.background = 'transparent';
    if (p.Enabled === false) { node.style.opacity = '.62'; node.style.filter = 'grayscale(.35)'; }
    if (p.Visible === false) node.style.visibility = 'hidden';
    if (p.Cursor === 'Hand') node.style.cursor = 'pointer';

    const text = String(p.Text ?? '');
    const setText = (t) => { const s = el('span'); s.className = 'ctext'; s.textContent = t; node.appendChild(s); };

    switch (c.type) {
      case 'Button': setText(text); break;
      case 'Label': case 'LinkLabel': setText(text); break;
      case 'TextBox': setText(p.UseSystemPasswordChar || p.PasswordChar ? '•'.repeat(Math.max(4, text.length)) : text); break;
      case 'RichTextBox': setText(text); break;
      case 'MaskedTextBox': setText(text || (p.Mask || '')); break;
      case 'CheckBox':
        node.classList.toggle('checked', !!p.Checked);
        setText(text); break;
      case 'RadioButton':
        node.classList.toggle('checked', !!p.Checked);
        setText(text); break;
      case 'ComboBox': {
        const items = p.Items || [];
        setText(text || items[0] || '');
        break;
      }
      case 'ListBox': case 'CheckedListBox': {
        for (const it of (p.Items || []).slice(0, 12)) { const d = el('div', 'li'); d.textContent = it; node.appendChild(d); }
        break;
      }
      case 'NumericUpDown': setText(String(p.Value ?? 0)); break;
      case 'DateTimePicker': setText('01/01/2026'); break;
      case 'ProgressBar': {
        const min = +p.Minimum || 0, max = +p.Maximum || 100, v = +p.Value || 0;
        node.style.setProperty('--val', Math.max(0, Math.min(100, ((v - min) / Math.max(1, max - min)) * 100)) + '%');
        break;
      }
      case 'TrackBar': {
        const min = +p.Minimum || 0, max = +p.Maximum || 10, v = +p.Value || 0;
        node.style.setProperty('--val', Math.max(0, Math.min(100, ((v - min) / Math.max(1, max - min)) * 100)) + '%');
        break;
      }
      case 'GroupBox': {
        const t = el('span', 'gb-title'); t.textContent = text; node.appendChild(t);
        break;
      }
      case 'TabControl': {
        const tabs = el('div', 'tabs');
        (c.tabPages || []).forEach((pg, i) => {
          const t = el('div', 'tab' + (i === (c.activePage || 0) ? ' active' : ''));
          t.textContent = pg.text || pg.name;
          t.addEventListener('pointerdown', (ev) => {
            ev.stopPropagation();
            this.pushUndo();
            c.activePage = i;
            this.select([c.id]);
            this.render();
            this.app.onDesignerChange(true);
          });
          tabs.appendChild(t);
        });
        node.appendChild(tabs);
        break;
      }
      case 'MenuStrip': {
        for (const it of (c.items || [])) {
          const mi = el('span', 'mi'); mi.textContent = it.text || 'Item';
          node.appendChild(mi);
        }
        break;
      }
      case 'StatusStrip': {
        for (const it of (c.items || [])) {
          const mi = el('span', 'mi'); mi.textContent = it.text || '';
          mi.style.padding = '0 6px';
          node.appendChild(mi);
        }
        break;
      }
      case 'ToolStrip': {
        for (const it of (c.items || [])) {
          const mi = el('span', 'tbtn'); mi.textContent = it.text || 'Item';
          node.appendChild(mi);
        }
        break;
      }
      case 'DataGridView': {
        const head = el('div', 'dg-head');
        const cols = c.columns && c.columns.length ? c.columns : [{ text: 'Column1' }, { text: 'Column2' }];
        for (const col of cols) { const s = el('span'); s.textContent = col.text; head.appendChild(s); }
        node.appendChild(head);
        node.appendChild(el('div', 'dg-body'));
        break;
      }
      case 'Panel': node.classList.toggle('bordered', p.BorderStyle && p.BorderStyle !== 'None'); break;
      case 'FlowLayoutPanel': break;
      case 'PictureBox': break;
      default: setText(text); break;
    }

    node.addEventListener('pointerdown', (e) => this.onControlDown(e, c));
    node.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this.app.bindDefaultEvent(c);
    });
    node.addEventListener('contextmenu', (e) => this.onContextMenu(e, c));
    return node;
  }

  renderSelection() {
    const layer = this.$.selLayer;
    layer.innerHTML = '';
    this.$.frame.classList.toggle('form-selected', this.selForm);
    if (this.selForm) return;
    const selected = this.selectedControls();
    for (const c of selected) {
      if (c.component || c.isPage) continue;
      const r = c._rect;
      if (!r) continue;
      const out = el('div', 'sel-outline');
      out.style.left = r.x + 'px';
      out.style.top = r.y + 'px';
      out.style.width = r.w + 'px';
      out.style.height = r.h + 'px';
      if (c.props?.Locked) out.style.borderStyle = 'dashed';
      layer.appendChild(out);
    }
    if (selected.length === 1 && !selected[0].component) {
      const c = selected[0];
      const r = c._rect;
      if (r) {
        for (const h of HANDLES) {
          const hd = el('div', 'sel-handle');
          hd.dataset.h = h;
          const px = h.includes('w') ? r.x - 3 : h.includes('e') ? r.x + r.w - 4 : r.x + r.w / 2 - 3.5;
          const py = h.includes('n') ? r.y - 3 : h.includes('s') ? r.y + r.h - 4 : r.y + r.h / 2 - 3.5;
          hd.style.left = px + 'px';
          hd.style.top = py + 'px';
          hd.style.cursor = `${h}-resize`;
          hd.addEventListener('pointerdown', (e) => this.onResizeDown(e, c, h));
          layer.appendChild(hd);
        }
      }
    }
  }

  renderTray() {
    const items = this.form.components || [];
    this.$.tray.classList.toggle('hidden', items.length === 0);
    this.$.trayItems.innerHTML = '';
    for (const c of items) {
      const node = el('div', 'tray-item' + (this.sel.has(c.id) ? ' selected' : ''));
      node.innerHTML = `<div class="ti-ico">${iconFor(c.type)}</div><div>${c.name}</div>`;
      node.style.color = 'var(--text-dim)';
      node.querySelector('.ti-ico').style.width = '20px';
      node.querySelector('.ti-ico').style.height = '20px';
      node.addEventListener('click', (e) => { e.stopPropagation(); this.select([c.id], e.ctrlKey); });
      node.addEventListener('dblclick', (e) => { e.stopPropagation(); this.app.bindDefaultEvent(c); });
      node.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); this.onContextMenu(e, c); });
      this.$.trayItems.appendChild(node);
    }
  }

  /* ---------------- selection ---------------- */

  select(ids, additive = false) {
    if (!additive) this.sel.clear();
    for (const id of ids) {
      if (additive && this.sel.has(id)) this.sel.delete(id);
      else this.sel.add(id);
    }
    this.selForm = false;
    this.renderSelection();
    this.renderTray();
    this.updateStatus();
    this.app.props.showTarget(this.getTarget());
  }

  selectForm() {
    this.sel.clear();
    this.selForm = true;
    this.renderSelection();
    this.updateStatus();
    this.app.props.showTarget({ kind: 'form', form: this.form });
  }

  selectedControls() {
    return [...this.sel].map(id => findControl(this.form, id)).filter(Boolean);
  }

  getTarget() {
    if (this.selForm) return { kind: 'form', form: this.form };
    const cs = this.selectedControls();
    if (cs.length === 1) return { kind: 'control', control: cs[0], form: this.form };
    if (cs.length > 1) return { kind: 'multi', controls: cs, form: this.form };
    return { kind: 'form', form: this.form };
  }

  updateStatus() {
    if (this.selForm || !this.sel.size) { this.$.status.textContent = `${this.form.name} selected`; return; }
    const cs = this.selectedControls();
    if (cs.length === 1) this.$.status.textContent = `${cs[0].name} (${cs[0].type}) selected`;
    else this.$.status.textContent = `${cs.length} controls selected`;
  }

  /* ---------------- pointer: move / resize / rubber band ---------------- */

  toForm(e) {
    const r = this.$.client.getBoundingClientRect();
    const z = this.zoom || 1;
    return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z };
  }

  onSurfaceDown(e) {
    if (e.button !== 0) return;
    if (e.target !== this.$.surface && e.target !== this.$.client) return;
    if (this.pendingTool) {
      const p = this.toForm(e);
      this.placeTool(p.x, p.y, null);
      return;
    }
    this.selForm = false;
    const start = this.toForm(e);
    let moved = false;
    const band = this.$.band;
    band.classList.remove('hidden');
    band.style.left = start.x + 'px';
    band.style.top = start.y + 'px';
    band.style.width = '0px';
    band.style.height = '0px';
    const move = (ev) => {
      const p = this.toForm(ev);
      if (Math.abs(p.x - start.x) > 3 || Math.abs(p.y - start.y) > 3) moved = true;
      band.style.left = Math.min(p.x, start.x) + 'px';
      band.style.top = Math.min(p.y, start.y) + 'px';
      band.style.width = Math.abs(p.x - start.x) + 'px';
      band.style.height = Math.abs(p.y - start.y) + 'px';
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      band.classList.add('hidden');
      if (!moved) { this.selectForm(); return; }
      const p = this.toForm(ev);
      const rect = {
        x: Math.min(p.x, start.x), y: Math.min(p.y, start.y),
        w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y),
      };
      const hits = allControls(this.form).filter(c => !c.component && !c.isPage && c._rect && intersects(c._rect, rect));
      this.select(hits.map(c => c.id), ev.ctrlKey || ev.shiftKey);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  onControlDown(e, c) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (this.pendingTool) {
      const p = this.toForm(e);
      const parent = isContainer(c) ? c : null;
      this.placeTool(p.x, p.y, parent);
      return;
    }
    if (e.ctrlKey || e.shiftKey) {
      this.select([c.id], true);
      if (!this.sel.has(c.id)) return;
    } else if (!this.sel.has(c.id)) {
      this.select([c.id]);
    }
    if (c.props?.Locked) return;
    if (c.props?.Dock && c.props.Dock !== 'None') return;
    this.startMove(e, c);
  }

  startMove(e, primary) {
    const selected = this.selectedControls().filter(c => !c.props?.Locked && !c.component);
    if (!selected.length) return;
    this.pushUndo();
    const start = this.toForm(e);
    const orig = new Map(selected.map(c => [c.id, { x: c.x, y: c.y, rect: { ...c._rect } }]));
    const others = allControls(this.form).filter(c => !c.component && !c.isPage && c._rect && !this.sel.has(c.id));
    const guides = [];
    let lastDx = 0, lastDy = 0;
    const move = (ev) => {
      const p = this.toForm(ev);
      let dx = Math.round(p.x - start.x);
      let dy = Math.round(p.y - start.y);
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (this.settings.snap) {
        const grid = this.settings.gridSize || SNAP;
        const pr = orig.get(primary.id);
        const absX = pr.rect.x + dx, absY = pr.rect.y + dy;
        let snappedX = Math.round(absX / grid) * grid;
        let snappedY = Math.round(absY / grid) * grid;
        guides.length = 0;
        if (this.settings.guides) {
          const targets = [];
          for (const o of others) {
            targets.push({ x: o._rect.x, y: o._rect.y, w: o._rect.w, h: o._rect.h });
          }
          const edgesX = [snappedX, snappedX + pr.rect.w / 2, snappedX + pr.rect.w];
          const edgesY = [snappedY, snappedY + pr.rect.h / 2, snappedY + pr.rect.h];
          let bestX = null, bestY = null;
          for (const t of targets) {
            const tx = [t.x, t.x + t.w / 2, t.x + t.w];
            const ty = [t.y, t.y + t.h / 2, t.y + t.h];
            for (let i = 0; i < 3; i++) {
              for (const v of tx) {
                if (Math.abs(edgesX[i] - v) <= 5 && (!bestX || Math.abs(edgesX[i] - v) < Math.abs(bestX.d))) bestX = { d: edgesX[i] - v, v, i };
              }
              for (const v of ty) {
                if (Math.abs(edgesY[i] - v) <= 5 && (!bestY || Math.abs(edgesY[i] - v) < Math.abs(bestY.d))) bestY = { d: edgesY[i] - v, v, i };
              }
            }
          }
          if (bestX) {
            snappedX -= bestX.d;
            guides.push({ v: true, pos: bestX.v });
          }
          if (bestY) {
            snappedY -= bestY.d;
            guides.push({ v: false, pos: bestY.v });
          }
        }
        dx += snappedX - absX;
        dy += snappedY - absY;
        this.showGuides(guides);
      }
      dx = Math.round(dx); dy = Math.round(dy);
      lastDx = dx; lastDy = dy;
      for (const c of selected) {
        const o = orig.get(c.id);
        if (!o) continue;
        c.x = Math.max(0, o.x + dx);
        c.y = Math.max(0, o.y + dy);
      }
      this.render();
      const pr = orig.get(primary.id);
      this.showSizeTip(pr.rect.x + dx, pr.rect.y + dy + pr.rect.h + 8, `${primary.w} × ${primary.h}`);
      this.$.coords.textContent = `${primary.x}, ${primary.y}`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.hideGuides();
      this.hideSizeTip();
      this.app.onDesignerChange(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  onResizeDown(e, c, dir) {
    e.stopPropagation();
    e.preventDefault();
    if (c.props?.Locked) return;
    this.pushUndo();
    const start = this.toForm(e);
    const o = { x: c.x, y: c.y, w: c.w, h: c.h };
    let autoCleared = false;
    const move = (ev) => {
      const p = this.toForm(ev);
      let dx = Math.round(p.x - start.x);
      let dy = Math.round(p.y - start.y);
      if (this.settings.snap) {
        const g = this.settings.gridSize || SNAP;
        dx = Math.round(dx / g) * g;
        dy = Math.round(dy / g) * g;
      }
      if (!autoCleared && (dx || dy) && c.props?.AutoSize === true) {
        c.props.AutoSize = false;
        autoCleared = true;
      }
      let { x, y, w, h } = o;
      if (dir.includes('e')) w = Math.max(8, o.w + dx);
      if (dir.includes('s')) h = Math.max(8, o.h + dy);
      if (dir.includes('w')) { w = Math.max(8, o.w - dx); x = o.x + (o.w - w); }
      if (dir.includes('n')) { h = Math.max(8, o.h - dy); y = o.y + (o.h - h); }
      c.x = Math.max(0, x); c.y = Math.max(0, y); c.w = Math.round(w); c.h = Math.round(h);
      this.render();
      this.showSizeTip(c._rect.x, c._rect.y + c._rect.h + 8, `${c.w} × ${c.h}`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      this.hideSizeTip();
      this.app.onDesignerChange(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  showGuides(guides) {
    const layer = this.$.snapLayer;
    layer.innerHTML = '';
    for (const g of guides) {
      const d = el('div', 'snap-guide ' + (g.v ? 'v' : 'h'));
      if (g.v) d.style.left = g.pos + 'px'; else d.style.top = g.pos + 'px';
      layer.appendChild(d);
    }
  }
  hideGuides() { this.$.snapLayer.innerHTML = ''; }

  showSizeTip(x, y, text) {
    let tip = document.getElementById('sel-size-tip');
    if (!tip) { tip = el('div', 'sel-size-tip'); tip.id = 'sel-size-tip'; this.$.surface.appendChild(tip); }
    tip.textContent = text;
    tip.style.left = Math.max(0, x) + 'px';
    tip.style.top = Math.max(0, y) + 'px';
    tip.classList.remove('hidden');
  }
  hideSizeTip() { const t = document.getElementById('sel-size-tip'); if (t) t.classList.add('hidden'); }

  /* ---------------- drag & drop / tools ---------------- */

  setPendingTool(type) {
    this.pendingTool = type;
    this.$.surface.style.cursor = type ? 'crosshair' : '';
    if (type) this.app.setStatus(`Click on the form to place ${type}, or drag it from the Toolbox.`);
  }

  placeTool(x, y, parent) {
    const type = this.pendingTool;
    if (!type) return;
    this.addControlAt(type, x, y, parent);
    this.pendingTool = null;
    this.$.surface.style.cursor = '';
  }

  addControlAt(type, x, y, parent) {
    const def = CONTROLS[type];
    if (!def) return;
    this.pushUndo();
    let px = x, py = y;
    if (parent && parent._content) { px = x - parent._content.x; py = y - parent._content.y; }
    if (this.settings.snap) {
      const g = this.settings.gridSize || SNAP;
      px = Math.round(px / g) * g;
      py = Math.round(py / g) * g;
    }
    px = Math.max(0, px); py = Math.max(0, py);
    const c = addControl(this.form, parent || null, type, px, py);
    if (c.component) {
      this.select([c.id]);
    } else {
      if (def.component) { this.select([c.id]); }
      else this.select([c.id]);
    }
    this.render();
    this.app.onDesignerChange(true);
    this.app.toast(`${c.name} added`, 'ok');
    return c;
  }

  onDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/x-bikinstudio-control') || e.dataTransfer.getData('text/plain');
    if (!type || !CONTROLS[type]) return;
    const p = this.toForm(e);
    let parent = null;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.ctl');
    if (target) {
      const c = findControl(this.form, target.dataset.id);
      if (c && isContainer(c) && c.type !== 'TabControl') parent = c;
      if (c && c.type === 'TabControl') parent = c;
    }
    if (CONTROLS[type].component) this.addControlAt(type, 0, 0, null);
    else this.addControlAt(type, p.x, p.y, parent);
  }

  /* ---------------- commands ---------------- */

  deleteSelection() {
    const cs = this.selectedControls();
    if (!cs.length) return;
    this.pushUndo();
    const removed = [];
    const collect = (c) => {
      removed.push(c.name);
      for (const ch of c.children || []) collect(ch);
      for (const p of c.tabPages || []) { removed.push(p.name); for (const ch of p.children || []) collect(ch); }
    };
    for (const c of cs) collect(c);
    for (const c of cs) {
      if (c.component) {
        this.form.components = this.form.components.filter(x => x.id !== c.id);
      } else {
        const found = findParent(this.form, c.id);
        if (found) found.list.splice(found.list.indexOf(c), 1);
        else if (c.isPage) {
          for (const tc of this.form.controls) if (tc.tabPages) tc.tabPages = tc.tabPages.filter(p => p.id !== c.id);
        }
      }
    }
    this.sel.clear();
    this.render();
    this.app.onDesignerChange(true);
    this.app.cleanupDeletedHandlers(removed);
    this.app.props.showTarget(this.getTarget());
  }

  copy() {
    const cs = this.selectedControls().filter(c => !c.unknown);
    if (!cs.length) return;
    this.clipboard = cs.map(c => cleanForm(c));
    this.app.setStatus(`${cs.length} control(s) copied`);
  }

  cut() { this.copy(); this.deleteSelection(); }

  paste() {
    if (!this.clipboard.length) return;
    this.pushUndo();
    const used = usedNames(this.form);
    const pasteOne = (src, parent) => {
      const c = deepClone(src);
      c.id = uid();
      c.name = controlName(c.type, used);
      used.add(c.name);
      if (c.type === 'TabControl') {
        for (const p of c.tabPages || []) {
          p.id = uid('p');
          p.name = uniqueName('TabPage', used);
          used.add(p.name);
          p.children = (p.children || []).map(ch => pasteOne(ch, p));
        }
      }
      c.children = (c.children || []).map(ch => pasteOne(ch, c));
      if (c.items) { c.items = cloneItems(c.items, used); }
      if (c.columns) for (const col of c.columns) {
        col.id = uid('col');
        col.name = uniqueName('Column', used);
        used.add(col.name);
      }
      c.x = (c.x || 0) + 16;
      c.y = (c.y || 0) + 16;
      if (parent) controlListFor(this.form, parent).push(c);
      else if (c.component) this.form.components.push(c);
      else this.form.controls.push(c);
      return c;
    };
    const added = [];
    for (const src of this.clipboard) {
      const found = findParent(this.form, src.id);
      added.push(pasteOne(src, found?.parent || null));
    }
    this.sel = new Set(added.map(c => c.id));
    this.selForm = false;
    this.render();
    this.app.onDesignerChange(true);
    this.app.props.showTarget(this.getTarget());
  }

  duplicate() { this.copy(); this.paste(); }

  selectAll() {
    this.sel = new Set(allControls(this.form).filter(c => !c.component && !c.unknown).map(c => c.id));
    this.selForm = false;
    this.renderSelection();
    this.updateStatus();
    this.app.props.showTarget(this.getTarget());
  }

  nudge(dx, dy) {
    const cs = this.selectedControls().filter(c => !c.props?.Locked && !c.component && !c.unknown);
    if (!cs.length) return;
    this.pushUndo();
    for (const c of cs) { c.x = Math.max(0, c.x + dx); c.y = Math.max(0, c.y + dy); }
    this.render();
    this.app.onDesignerChange(true);
  }

  align(kind) {
    const cs = this.selectedControls().filter(c => !c.component && !c.unknown);
    if (cs.length < 2) { this.app.toast('Select at least two controls to align', 'warn'); return; }
    this.pushUndo();
    const xs = cs.map(c => c._rect.x);
    const ys = cs.map(c => c._rect.y);
    const x2 = cs.map(c => c._rect.x + c._rect.w);
    const y2 = cs.map(c => c._rect.y + c._rect.h);
    const minX = Math.min(...xs), maxX = Math.max(...x2), minY = Math.min(...ys), maxY = Math.max(...y2);
    for (const c of cs) {
      if (kind === 'left') c.x += minX - c._rect.x;
      if (kind === 'right') c.x += maxX - (c._rect.x + c._rect.w);
      if (kind === 'center') c.x += Math.round((minX + maxX) / 2 - (c._rect.x + c._rect.w / 2));
      if (kind === 'top') c.y += minY - c._rect.y;
      if (kind === 'bottom') c.y += maxY - (c._rect.y + c._rect.h);
      if (kind === 'middle') c.y += Math.round((minY + maxY) / 2 - (c._rect.y + c._rect.h / 2));
    }
    this.render();
    this.app.onDesignerChange(true);
  }

  sameSize(kind) {
    const cs = this.selectedControls().filter(c => !c.component && !c.unknown);
    if (cs.length < 2) { this.app.toast('Select at least two controls', 'warn'); return; }
    this.pushUndo();
    const first = cs[0];
    for (const c of cs.slice(1)) {
      if (kind === 'same-width') c.w = first.w;
      if (kind === 'same-height') c.h = first.h;
      if (kind === 'same-size') { c.w = first.w; c.h = first.h; }
    }
    this.render();
    this.app.onDesignerChange(true);
  }

  order(kind) {
    const cs = this.selectedControls().filter(c => !c.unknown);
    if (!cs.length) return;
    this.pushUndo();
    for (const c of cs) {
      const found = findParent(this.form, c.id);
      if (!found) continue;
      const { list } = found;
      const i = list.indexOf(c);
      if (i < 0) continue;
      list.splice(i, 1);
      if (kind === 'front') list.push(c); else list.unshift(c);
    }
    this.render();
    this.app.onDesignerChange(true);
  }

  lockSelection(lock) {
    const cs = this.selectedControls();
    if (!cs.length) return;
    this.pushUndo();
    for (const c of cs) c.props.Locked = lock;
    this.render();
    this.app.onDesignerChange(true);
    this.app.props.showTarget(this.getTarget());
  }

  /* ---------------- events ---------------- */

  onKeyDown(e) {
    if (!this.app.isDesignerActive()) return;
    if (this.app.activeModal || this.app.menuName) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); this.copy(); return; }
    if (mod && e.key.toLowerCase() === 'x') { e.preventDefault(); this.cut(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); this.paste(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.duplicate(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.selectAll(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelection(); return; }
    if (e.key === 'Escape') { this.pendingTool = null; this.$.surface.style.cursor = ''; this.selectForm(); return; }
    if (e.key === 'F7' && !e.shiftKey) { e.preventDefault(); this.app.openCodeForSelection(); return; }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') this.nudge(-step, 0);
      if (e.key === 'ArrowRight') this.nudge(step, 0);
      if (e.key === 'ArrowUp') this.nudge(0, -step);
      if (e.key === 'ArrowDown') this.nudge(0, step);
    }
  }

  onContextMenu(e, c) {
    e.preventDefault();
    e.stopPropagation();
    if (c && !this.sel.has(c.id)) this.select([c.id]);
    const has = !!c || this.sel.size > 0;
    const items = [
      { label: 'View Code', key: 'F7', action: () => this.app.openCodeForSelection(), disabled: !has },
      { label: 'Bring to Front', action: () => this.order('front'), disabled: !has },
      { label: 'Send to Back', action: () => this.order('back'), disabled: !has },
      { sep: true },
      { label: 'Cut', key: 'Ctrl+X', action: () => this.cut(), disabled: !has },
      { label: 'Copy', key: 'Ctrl+C', action: () => this.copy(), disabled: !has },
      { label: 'Paste', key: 'Ctrl+V', action: () => this.paste(), disabled: !this.clipboard.length },
      { label: 'Delete', key: 'Del', action: () => this.deleteSelection(), disabled: !has },
      { sep: true },
      { label: 'Lock Controls', action: () => this.lockSelection(true), disabled: !has },
      { label: 'Unlock Controls', action: () => this.lockSelection(false), disabled: !has },
      { sep: true },
      { label: 'Properties', action: () => this.app.props.showTarget(this.getTarget()) },
    ];
    this.app.showContextMenu(items, e.clientX, e.clientY);
  }
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function cloneItems(items, used) {
  return (items || []).map(it => {
    const name = uniqueName(it.type, used);
    used.add(name);
    return {
      ...it,
      id: uid('mi'),
      name,
      items: cloneItems(it.items, used),
    };
  });
}
