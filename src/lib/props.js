/* Properties + Events panel */

import { propsFor, eventsFor, categoriesOf, iconFor } from './catalog.js';
import { handlerName } from './model.js';

const ANCHORS = ['Top', 'Bottom', 'Left', 'Right'];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class PropertiesPanel {
  constructor(app) {
    this.app = app;
    this.designer = app.designer;
    this.target = { kind: 'form', form: null };
    this.mode = 'properties';
    this.collapsed = new Set();
    this.alpha = false;
    this.$ = {
      grid: document.getElementById('prop-grid'),
      events: document.getElementById('event-grid'),
      target: document.getElementById('prop-target'),
      desc: document.getElementById('prop-desc'),
      scroll: document.getElementById('prop-scroll'),
      mode: document.getElementById('prop-view-select'),
      alphaBtn: document.getElementById('prop-alpha'),
      refreshBtn: document.getElementById('prop-refresh'),
    };
    this.$.mode.addEventListener('change', () => { this.mode = this.$.mode.value; this.render(); });
    this.$.alphaBtn.addEventListener('click', () => { this.alpha = !this.alpha; this.$.alphaBtn.classList.toggle('on', this.alpha); this.render(); });
    this.$.refreshBtn.addEventListener('click', () => this.render());
  }

  showTarget(target) {
    this.target = target || { kind: 'form', form: this.designer.form };
    this.render();
  }

  render() {
    const t = this.target;
    this.$.grid.classList.toggle('hidden', this.mode !== 'properties');
    this.$.events.classList.toggle('hidden', this.mode !== 'events');
    this.$.grid.innerHTML = '';
    this.$.events.innerHTML = '';
    if (!t || (!t.form && !t.control)) {
      this.$.target.textContent = '—';
      this.$.desc.textContent = 'Select a control to edit its properties.';
      return;
    }
    if (t.kind === 'control') {
      this.$.target.textContent = `${t.control.name} — ${t.control.type}`;
      if (this.mode === 'events') this.renderEvents(t.control, t.form);
      else this.renderControlProps(t.control, t.form);
    } else if (t.kind === 'multi') {
      this.$.target.textContent = `${t.controls.length} controls selected`;
      if (this.mode === 'events') {
        this.$.events.appendChild(el('div', 'empty-note pad', 'Event binding is available for a single control.'));
      } else {
        this.renderMultiProps(t.controls, t.form);
      }
    } else {
      this.$.target.textContent = `${t.form.name} — Form`;
      if (this.mode === 'events') this.renderFormEvents(t.form);
      else this.renderFormProps(t.form);
    }
    this.$.desc.textContent = 'Select a property to see its description.';
  }

  renderFormProps(form) {
    const props = [
      ...propsFor(null, true),
      { name: 'ClientSize', type: 'size', cat: 'Layout', def: [800, 480], desc: 'The client area size of the form.' },
      { name: 'Name', type: 'readonly', cat: 'Design', def: form.name, desc: 'The name of the form class.' },
    ];
    const values = { ...form.props, ClientSize: [form.w, form.h], Name: form.name };
    this.buildGrid(props, values, [form], true);
  }

  renderControlProps(c, form) {
    if (c.unknown) {
      const props = [
        { name: 'Name', type: 'readonly', cat: 'Design', def: c.name },
        { name: 'Type', type: 'readonly', cat: 'Design', def: c.type },
        { name: 'Note', type: 'readonly', cat: 'Design', def: 'Preserved from Designer.vb' },
      ];
      this.buildGrid(props, { Name: c.name, Type: c.type, Note: 'Preserved from Designer.vb' }, [c], false);
      return;
    }
    if (c.isPage) {
      const props = [
        { name: 'Text', type: 'string', cat: 'Appearance', def: c.text || '', desc: 'The tab page caption.' },
        { name: 'Name', type: 'readonly', cat: 'Design', def: c.name },
      ];
      this.buildGrid(props, { Text: c.text, Name: c.name }, [c], false, true);
      return;
    }
    if (c.component) {
      const props = [{ ...this.nameProp(c), cat: 'Design' }, ...propsFor(c.type).filter(p => p.name !== 'Text')];
      const values = { Name: c.name, ...c.props };
      this.buildGrid(props, values, [c], false);
      return;
    }
    const base = propsFor(c.type);
    const synthetic = [
      this.nameProp(c),
      { name: 'Location', type: 'point', cat: 'Layout', def: [0, 0], desc: 'X and Y position relative to the parent container.' },
      { name: 'Size', type: 'size', cat: 'Layout', def: [c.w, c.h], desc: 'Width and height of the control.' },
    ];
    const props = [...base, ...synthetic];
    const values = { ...c.props, Name: c.name, Location: [c.x, c.y], Size: [c.w, c.h] };
    if (props.some(p => p.name === 'Font')) values.Font = this.designer.fontFor(c);
    this.buildGrid(props, values, [c], false);
  }

  nameProp(c) {
    return { name: 'Name', type: 'string', cat: 'Design', def: c.name, desc: 'The name used in code to refer to this control.' };
  }

  renderMultiProps(cs, form) {
    const editable = cs.filter(c => !c.unknown);
    if (!editable.length) {
      this.$.grid.appendChild(el('div', 'empty-note pad', 'Unsupported controls are preserved but cannot be edited here.'));
      return;
    }
    const base = propsFor(editable[0].type);
    const shared = base.filter(p => editable.every(c => c.props[p.name] !== undefined));
    const values = {};
    for (const p of shared) values[p.name] = editable[0].props[p.name];
    this.buildGrid(shared, values, editable, false, false, true);
  }

  buildGrid(props, values, targets, isForm, isPage = false, isMulti = false) {
    const grid = this.$.grid;
    const cats = categoriesOf(props);
    for (const cat of cats) {
      let list = props.filter(p => p.cat === cat);
      if (this.alpha) list = [...list].sort((a, b) => a.name.localeCompare(b.name));
      const head = el('div', 'prop-cat' + (this.collapsed.has(cat) ? ' closed' : ''));
      head.innerHTML = `<span class="chev">&#9662;</span><span>${cat}</span>`;
      head.addEventListener('click', () => {
        if (this.collapsed.has(cat)) this.collapsed.delete(cat); else this.collapsed.add(cat);
        head.classList.toggle('closed');
        body.classList.toggle('closed');
      });
      grid.appendChild(head);
      const body = el('div', 'prop-cat-body');
      if (this.collapsed.has(cat)) body.classList.add('closed');
      for (const p of list) {
        if (p.name === 'Text' && !props.some(x => x.name === 'Text')) continue;
        const row = el('div', 'prop-row');
        const lab = el('div', 'pr-label'); lab.textContent = p.name; lab.title = p.name;
        row.appendChild(lab);
        const val = el('div', 'pr-val');
        val.appendChild(this.editor(p, values[p.name], targets, { isForm, isPage, isMulti }));
        row.appendChild(val);
        row.addEventListener('mouseenter', () => { this.$.desc.innerHTML = `<b>${p.name}</b> — ${p.desc || ''}`; });
        row.addEventListener('focusin', () => { this.$.desc.innerHTML = `<b>${p.name}</b> — ${p.desc || ''}`; });
        body.appendChild(row);
      }
      grid.appendChild(body);
    }
  }

  editor(p, value, targets, ctx) {
    const apply = (v, quiet = false) => {
      if (!this.designer.form) return;
      this.designer.pushUndo();
      for (const t of targets) this.applyValue(p, v, t, ctx);
      this.designer.render();
      this.app.onDesignerChange(true);
      if (!quiet) this.render();
      else this.app.props.render();
    };

    if (p.type === 'readonly') {
      const s = el('span', 'ellipsis'); s.textContent = String(value ?? '');
      return s;
    }

    if (p.type === 'bool') {
      const wrap = el('div', 'bool-wrap');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!value;
      cb.disabled = ctx.isMulti && p.name === 'Name';
      cb.addEventListener('change', () => apply(cb.checked, true));
      wrap.appendChild(cb);
      return wrap;
    }

    if (p.type === 'enum') {
      const sel = el('select');
      for (const o of p.options) {
        const opt = el('option'); opt.value = o; opt.textContent = o; if (o === value) opt.selected = true; sel.appendChild(opt);
      }
      sel.addEventListener('change', () => apply(sel.value, true));
      return sel;
    }

    if (p.type === 'color') {
      const sw = el('div', 'color-swatch');
      const chip = el('div', 'color-chip');
      chip.style.background = value === 'Transparent' ? 'repeating-conic-gradient(#888 0% 25%, #ddd 0% 50%) 0 0/6px 6px' : (value || '#F0F0F0');
      const txt = el('span'); txt.textContent = value || '';
      sw.appendChild(chip); sw.appendChild(txt);
      sw.addEventListener('click', async () => {
        const c = await this.app.pickColor(value);
        if (c !== null && c !== undefined) apply(c);
      });
      return sw;
    }

    if (p.type === 'font') {
      const b = el('button', 'btn-mini');
      const f = value || { family: 'Segoe UI', size: 9, style: 0 };
      b.textContent = `${f.family}, ${f.size}${(f.style & 1) ? ' Bold' : ''}${(f.style & 2) ? ' Italic' : ''}`;
      b.style.width = '100%';
      b.style.textAlign = 'left';
      b.style.overflow = 'hidden';
      b.style.textOverflow = 'ellipsis';
      b.addEventListener('click', async () => {
        const nf = await this.app.pickFont(f);
        if (nf) apply(nf);
      });
      return b;
    }

    if (p.type === 'anchor') {
      const wrap = el('div', 'anchor-box');
      const set = new Set(String(value || '').split(',').map(s => s.trim()));
      for (const a of ANCHORS) {
        const i = el('i', set.has(a) ? 'on' : '');
        i.title = a;
        i.style.cursor = 'pointer';
        i.addEventListener('click', () => {
          const parts = new Set(String(targets[0].props.Anchor || '').split(',').map(s => s.trim()).filter(Boolean));
          if (parts.has(a)) parts.delete(a); else parts.add(a);
          apply([...parts].join(','));
        });
        wrap.appendChild(i);
      }
      wrap.style.gridTemplateColumns = 'repeat(2, 12px)';
      return wrap;
    }

    if (p.type === 'point' || p.type === 'size') {
      const wrap = el('div');
      wrap.style.display = 'flex'; wrap.style.gap = '3px'; wrap.style.width = '100%';
      const v = Array.isArray(value) ? value : [0, 0];
      const a = el('input'); a.type = 'number'; a.value = v[0]; a.style.width = '50%';
      const b = el('input'); b.type = 'number'; b.value = v[1]; b.style.width = '50%';
      const commit = () => {
        const nv = [parseInt(a.value) || 0, parseInt(b.value) || 0];
        if (p.type === 'size') nv[0] = Math.max(8, nv[0]), nv[1] = Math.max(8, nv[1]);
        apply(nv);
      };
      a.addEventListener('change', commit); b.addEventListener('change', commit);
      wrap.appendChild(a); wrap.appendChild(b);
      return wrap;
    }

    if (p.type === 'padding') {
      const wrap = el('div'); wrap.style.display = 'flex'; wrap.style.gap = '2px'; wrap.style.width = '100%';
      const v = Array.isArray(value) ? value : [0, 0, 0, 0];
      const inputs = v.map((n, i) => {
        const inp = el('input'); inp.type = 'number'; inp.value = n; inp.style.width = '25%'; inp.title = ['Left', 'Top', 'Right', 'Bottom'][i];
        inp.addEventListener('change', () => apply(inputs.map(x => parseInt(x.value) || 0)));
        wrap.appendChild(inp); return inp;
      });
      return wrap;
    }

    if (p.type === 'controlref') {
      const sel = el('select');
      const none = el('option'); none.value = ''; none.textContent = '(none)'; sel.appendChild(none);
      const form = this.designer.form;
      const walk = (list) => {
        for (const c of list || []) {
          if (c.type === 'Button') {
            const o = el('option'); o.value = c.name; o.textContent = c.name; if (c.name === value) o.selected = true; sel.appendChild(o);
          }
          walk(c.children);
        }
      };
      walk(form.controls);
      sel.addEventListener('change', () => apply(sel.value));
      return sel;
    }

    if (p.type === 'image') {
      const wrap = el('div'); wrap.style.display = 'flex'; wrap.style.gap = '4px'; wrap.style.width = '100%';
      const inp = el('input'); inp.type = 'text'; inp.value = value || ''; inp.placeholder = '(none)';
      inp.addEventListener('change', () => apply(inp.value));
      const b = el('button', 'btn-mini'); b.textContent = '…';
      b.addEventListener('click', async () => {
        const f = await this.app.browseImage();
        if (f) apply(f);
      });
      wrap.appendChild(inp); wrap.appendChild(b);
      return wrap;
    }

    if (p.type === 'collection') {
      const b = el('button', 'btn-mini');
      const n = Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0);
      b.textContent = `${n} item${n === 1 ? '' : 's'} …`;
      b.style.width = '100%'; b.style.textAlign = 'left';
      b.addEventListener('click', () => this.app.openCollectionEditor(targets[0], p.name));
      return b;
    }

    if (p.type === 'char') {
      const inp = el('input'); inp.type = 'text'; inp.maxLength = 1; inp.value = value || '';
      inp.addEventListener('change', () => apply(inp.value.slice(0, 1)));
      return inp;
    }

    if (p.type === 'int' || p.type === 'float') {
      const inp = el('input'); inp.type = 'number'; inp.value = value ?? 0;
      if (p.type === 'float') inp.step = 'any';
      inp.addEventListener('change', () => apply(p.type === 'int' ? (parseInt(inp.value) || 0) : (parseFloat(inp.value) || 0)));
      return inp;
    }

    const inp = el('input'); inp.type = 'text'; inp.value = value ?? '';
    inp.addEventListener('change', () => apply(inp.value));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { inp.blur(); } });
    return inp;
  }

  applyValue(p, v, target, ctx) {
    if (ctx.isForm) {
      if (p.name === 'ClientSize') { target.w = Math.max(100, v[0]); target.h = Math.max(60, v[1]); return; }
      if (p.name === 'Name') return;
      target.props[p.name] = v;
      return;
    }
    if (target.isPage) {
      if (p.name === 'Text') target.text = v;
      return;
    }
    if (p.name === 'Name') {
      this.app.renameControl(target, v);
      return;
    }
    if (p.name === 'Location') { target.x = Math.max(0, v[0]); target.y = Math.max(0, v[1]); return; }
    if (p.name === 'Size') {
      target.w = Math.max(8, v[0]); target.h = Math.max(8, v[1]);
      // WinForms AutoSize controls ignore an explicit Size, so resizing one
      // through the property grid turns AutoSize off, like the VS designer.
      if (target.props && target.props.AutoSize === true) target.props.AutoSize = false;
      return;
    }
    target.props[p.name] = v;
  }

  /* ---------------- events ---------------- */

  renderFormEvents(form) {
    this.renderEvents({ name: form.name, type: 'Form', events: form.events, isForm: true }, form);
  }

  renderEvents(ctrl, form) {
    const isForm = ctrl.isForm;
    const events = eventsFor(ctrl.type, isForm);
    const grid = this.$.events;
    const head = el('div', 'prop-cat');
    head.innerHTML = '<span class="chev">&#9662;</span><span>Events</span>';
    grid.appendChild(head);
    const body = el('div', 'event-grid');
    for (const evt of events) {
      const row = el('div', 'evt-row');
      const lab = el('div', 'ev-label'); lab.textContent = evt;
      const val = el('div', 'ev-val');
      const bound = (ctrl.events || {})[evt];
      const sel = el('select');
      const none = el('option'); none.value = ''; none.textContent = '(none)'; sel.appendChild(none);
      const newName = handlerName(ctrl.name, evt);
      const no = el('option'); no.value = '__new__'; no.textContent = `${newName} (new)`; sel.appendChild(no);
      if (bound) {
        const bo = el('option'); bo.value = bound;
        bo.textContent = bound === newName ? `${bound} (new)` : bound;
        sel.appendChild(bo);
      }
      sel.value = bound || '';
      sel.addEventListener('change', async () => {
        if (!sel.value) await this.app.unbindEvent(ctrl, evt, isForm);
        else if (sel.value === '__new__') await this.app.bindEvent(ctrl, evt, null, isForm);
        else await this.app.bindEvent(ctrl, evt, sel.value, isForm);
        this.render();
      });
      row.addEventListener('dblclick', () => this.app.bindEvent(ctrl, evt, null, isForm));
      val.appendChild(sel);
      row.appendChild(lab); row.appendChild(val);
      row.addEventListener('mouseenter', () => { this.$.desc.innerHTML = `<b>${evt}</b> — Raised by ${ctrl.name}. Double-click to create an event handler.`; });
      body.appendChild(row);
    }
    grid.appendChild(body);
    const note = el('div', 'hint small');
    note.style.padding = '10px 14px';
    note.textContent = 'Double-click an event (or pick "(new)") to generate a handler in the code-behind file.';
    grid.appendChild(note);
  }
}
