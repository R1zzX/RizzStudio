/* Form model, VB.NET designer serializer/parser, code-behind helpers. */

import { CONTROLS, propsFor, defaultsFor, FORM_PROPS } from './catalog.js';

let UID = 1;
export const uid = (p = 'c') => `${p}${UID++}`;

const NAMED_COLORS = {
  Black: '#000000', White: '#FFFFFF', Red: '#FF0000', Green: '#008000', Blue: '#0000FF',
  Yellow: '#FFFF00', Gray: '#808080', Silver: '#C0C0C0', Maroon: '#800000', Olive: '#808000',
  Lime: '#00FF00', Aqua: '#00FFFF', Teal: '#008080', Navy: '#000080', Fuchsia: '#FF00FF',
  Purple: '#800080', Orange: '#FFA500', Transparent: 'Transparent', Control: '#F0F0F0',
  Window: '#FFFFFF', WindowText: '#000000', ControlText: '#000000', ActiveCaption: '#99B4D1',
};
const COLOR_NAMES = Object.fromEntries(Object.entries(NAMED_COLORS).map(([k, v]) => [v.toUpperCase(), k]));

const ENUM_TYPES = {
  'TextBox.TextAlign': 'HorizontalAlignment',
  'Label.TextAlign': 'ContentAlignment',
  'Button.TextAlign': 'ContentAlignment',
  'Button.ImageAlign': 'ContentAlignment',
  'CheckBox.TextAlign': 'ContentAlignment',
  'RadioButton.TextAlign': 'ContentAlignment',
  'Button.DialogResult': 'DialogResult',
  'Button.FlatStyle': 'FlatStyle',
  'TextBox.BorderStyle': 'BorderStyle',
  'Label.BorderStyle': 'BorderStyle',
  'ListBox.BorderStyle': 'BorderStyle',
  'RichTextBox.BorderStyle': 'BorderStyle',
  'PictureBox.BorderStyle': 'BorderStyle',
  'Panel.BorderStyle': 'BorderStyle',
  'ComboBox.DropDownStyle': 'ComboBoxStyle',
  'ListBox.SelectionMode': 'SelectionMode',
  'CheckedListBox.SelectionMode': 'SelectionMode',
  'TextBox.ScrollBars': 'ScrollBars',
  'PictureBox.SizeMode': 'PictureBoxSizeMode',
  'ProgressBar.Style': 'ProgressBarStyle',
  'TrackBar.TickStyle': 'TickStyle',
  'CheckBox.Appearance': 'Appearance',
  'CheckBox.CheckState': 'CheckState',
  'TabControl.Appearance': 'TabAppearance',
  'TabControl.Alignment': 'TabAlignment',
  'LinkLabel.LinkBehavior': 'LinkBehavior',
  'DateTimePicker.Format': 'DateTimePickerFormat',
  'DataGridView.AutoSizeColumnsMode': 'DataGridViewAutoSizeColumnsMode',
  'ToolStrip.GripStyle': 'ToolStripGripStyle',
  'ErrorProvider.BlinkStyle': 'ErrorBlinkStyle',
  'MenuStrip.Dock': 'DockStyle',
  'StatusStrip.Dock': 'DockStyle',
};

const EVENT_ARGS = {
  MouseDown: 'MouseEventArgs', MouseUp: 'MouseEventArgs', MouseMove: 'MouseEventArgs', MouseEnter: 'EventArgs',
  MouseLeave: 'EventArgs', MouseHover: 'EventArgs', MouseWheel: 'MouseEventArgs',
  KeyDown: 'KeyEventArgs', KeyUp: 'KeyEventArgs', KeyPress: 'KeyPressEventArgs',
  FormClosing: 'FormClosingEventArgs', FormClosed: 'FormClosedEventArgs',
  Paint: 'PaintEventArgs', ItemCheck: 'ItemCheckEventArgs', FileOk: 'CancelEventArgs',
  LinkClicked: 'LinkLabelLinkClickedEventArgs', CellClick: 'DataGridViewCellEventArgs',
  CellDoubleClick: 'DataGridViewCellEventArgs', CellContentClick: 'DataGridViewCellEventArgs',
  CellValueChanged: 'DataGridViewCellEventArgs', ItemClicked: 'ToolStripItemClickedEventArgs',
  Popup: 'PopupEventArgs', Apply: 'EventArgs', Tick: 'EventArgs', Scroll: 'EventArgs',
  SelectedIndexChanged: 'EventArgs', SelectedValueChanged: 'EventArgs', CheckedChanged: 'EventArgs',
  CheckStateChanged: 'EventArgs', ValueChanged: 'EventArgs', TextChanged: 'EventArgs',
  DropDown: 'EventArgs', Resize: 'EventArgs', Activated: 'EventArgs', Deactivate: 'EventArgs',
};

export const COMPONENT_TYPES = new Set(['Timer', 'OpenFileDialog', 'SaveFileDialog', 'FolderBrowserDialog', 'ColorDialog', 'FontDialog', 'ErrorProvider', 'ToolTip', 'BindingSource']);
export const ITEM_TYPES = new Set(['ToolStripMenuItem', 'ToolStripStatusLabel', 'ToolStripButton', 'DataGridViewTextBoxColumn']);

/* ------------------------------------------------------------------ */
/* model creation                                                      */
/* ------------------------------------------------------------------ */

export function uniqueName(base, used) {
  const clean = String(base).replace(/[^A-Za-z0-9_]/g, '') || 'Control';
  if (!used.has(clean)) return clean;
  let i = 1;
  while (used.has(clean + i)) i++;
  return clean + i;
}

/* Visual Studio always starts control names at 1 (Button1, Label1, …). */
export function controlName(type, used) {
  let i = 1;
  while (used.has(type + i)) i++;
  return type + i;
}

export function usedNames(form) {
  const s = new Set();
  const walk = (list) => {
    for (const c of list) {
      s.add(c.name);
      if (c.items) for (const it of flattenItems(c.items)) s.add(it.name);
      if (c.columns) for (const col of c.columns) s.add(col.name);
      if (c.tabPages) for (const p of c.tabPages) { s.add(p.name); walk(p.children || []); }
      walk(c.children || []);
    }
  };
  walk(form.controls || []);
  for (const c of form.components || []) s.add(c.name);
  return s;
}

export function createFormModel(name = 'Form1') {
  const props = defaultsFor(null, true);
  props.Text = name;
  return { name, w: 800, h: 480, props, controls: [], components: [], events: {}, path: '' };
}

export function makeTabPage(name, text) {
  return { id: uid('p'), name, text, children: [] };
}

export function createControl(type, used, x = 8, y = 8) {
  const def = CONTROLS[type];
  if (!def) throw new Error('Unknown control type: ' + type);
  const name = controlName(type, used);
  used.add(name);
  const props = defaultsFor(type);
  if (def.text !== undefined && def.text !== null) props.Text = def.text ? name : '';
  const c = {
    id: uid(),
    type,
    name,
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: def.size[0],
    h: def.size[1],
    props,
    events: {},
    children: [],
    component: !!def.component,
  };
  if (type === 'TabControl') {
    const pages = (props.TabPages || []).map((p, i) => {
      const text = p.text || `TabPage${i + 1}`;
      const pageName = uniqueName(sanitizeId(text), used);
      used.add(pageName);
      return makeTabPage(pageName, text);
    });
    c.tabPages = pages;
    c.activePage = 0;
    delete props.TabPages;
  }
  if (type === 'MenuStrip' || type === 'StatusStrip' || type === 'ToolStrip') {
    c.items = normalizeItems(type, props.Items || [], used);
    delete props.Items;
  }
  if (type === 'DataGridView') {
    c.columns = (props.Columns || []).map((col, i) => {
      const name = uniqueName(col.text ? sanitizeId(col.text) : 'Column', used);
      used.add(name);
      return {
        id: uid('col'),
        name,
        text: col.text || `Column${i + 1}`,
        width: col.width || 100,
      };
    });
    delete props.Columns;
  }
  return c;
}

function sanitizeId(text) {
  return String(text).replace(/[^A-Za-z0-9_]/g, '') || 'Item';
}

function normalizeItems(type, items, used) {
  const itemType = type === 'StatusStrip' ? 'ToolStripStatusLabel' : type === 'ToolStrip' ? 'ToolStripButton' : 'ToolStripMenuItem';
  const out = [];
  for (const it of items) {
    if (typeof it === 'string') it = { text: it };
    const name = uniqueName(sanitizeId(it.text || 'Item') + itemType, used);
    used.add(name);
    out.push({
      id: uid('mi'), type: itemType, name,
      text: it.text || '', shortcut: it.shortcut || '', checked: !!it.checked, enabled: it.enabled !== false,
      items: it.items ? normalizeItems(type, it.items, used) : [],
    });
  }
  return out;
}

export function addControl(form, parent, type, x, y) {
  const used = usedNames(form);
  const c = createControl(type, used, x, y);
  if (parent) {
    if (parent.type === 'TabControl') {
      const page = parent.tabPages[parent.activePage || 0];
      page.children.push(c);
    } else {
      parent.children.push(c);
    }
  } else if (c.component) {
    form.components.push(c);
  } else {
    form.controls.push(c);
  }
  return c;
}

export function walkControls(list, fn) {
  for (const c of list) {
    fn(c);
    if (c.tabPages) for (const p of c.tabPages) walkControls(p.children || [], fn);
    walkControls(c.children || [], fn);
  }
}

export function allControls(form) {
  const out = [];
  walkControls(form.controls || [], c => out.push(c));
  for (const p of form.controls || []) if (p.tabPages) for (const tp of p.tabPages) out.push({ ...tp, type: 'TabPage', isPage: true, parent: p });
  for (const c of form.components || []) out.push(c);
  return out;
}

export function findControl(form, id) {
  let found = null;
  walkControls(form.controls || [], c => { if (c.id === id) found = c; });
  if (!found) for (const c of form.components || []) if (c.id === id) found = c;
  if (!found) for (const c of form.controls || []) if (c.tabPages) for (const p of c.tabPages) if (p.id === id) found = p;
  return found;
}

export function findParent(form, id, list = form.controls, parent = null) {
  for (const c of list || []) {
    if (c.id === id) return { parent, list };
    if (c.tabPages) for (const p of c.tabPages) {
      if (p.id === id) return { parent: c, list: c.tabPages };
      const r = findParent(form, id, p.children, p);
      if (r) return r;
    }
    const r = findParent(form, id, c.children, c);
    if (r) return r;
  }
  return null;
}

export function isContainer(c) {
  return c && (c.type === 'Panel' || c.type === 'GroupBox' || c.type === 'TabControl');
}

export function controlListFor(form, parent) {
  if (!parent) return form.controls;
  if (parent.type === 'TabControl') return parent.tabPages[parent.activePage || 0].children;
  return parent.children;
}

/* ------------------------------------------------------------------ */
/* VB literal helpers                                                  */
/* ------------------------------------------------------------------ */

export function vbString(s) {
  s = String(s ?? '');
  if (!s) return '""';
  if (s.includes('\n')) {
    const parts = s.split(/\r?\n/);
    return parts.map(p => `"${p.replace(/"/g, '""')}"`).join(' & Environment.NewLine & ');
  }
  return `"${s.replace(/"/g, '""')}"`;
}

function vbNumber(n, single = false) {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  if (Number.isInteger(v)) return single ? `${v}.0!` : String(v);
  return `${v}${single ? '!' : ''}`;
}

function colorLiteral(hex) {
  if (!hex) return 'System.Drawing.Color.Empty';
  if (hex === 'Transparent') return 'System.Drawing.Color.Transparent';
  if (NAMED_COLORS[hex]) return `System.Drawing.Color.${hex}`;
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  if (h.length === 6) h = 'FF' + h;
  const a = parseInt(h.slice(0, 2), 16), r = parseInt(h.slice(2, 4), 16), g = parseInt(h.slice(4, 6), 16), b = parseInt(h.slice(6, 8), 16);
  if (a === 255) return `System.Drawing.Color.FromArgb(${r}, ${g}, ${b})`;
  return `System.Drawing.Color.FromArgb(${a}, ${r}, ${g}, ${b})`;
}

function fontLiteral(f) {
  const family = f?.family || 'Segoe UI';
  const size = f?.size || 9;
  const style = f?.style || 0;
  const styles = [];
  if (style & 1) styles.push('Bold');
  if (style & 2) styles.push('Italic');
  if (style & 4) styles.push('Underline');
  if (style & 8) styles.push('Strikeout');
  if (!styles.length) return `New System.Drawing.Font(${vbString(family)}, ${vbNumber(size, true)})`;
  return `New System.Drawing.Font(${vbString(family)}, ${vbNumber(size, true)}, System.Drawing.FontStyle.${styles.join(' Or System.Drawing.FontStyle.')})`;
}

function enumLiteral(prop, type) {
  const value = prop._value;
  if (prop.ns === 'Cursors') return `System.Windows.Forms.Cursors.${value}`;
  let et = ENUM_TYPES[`${type}.${prop.name}`] || prop.name;
  if (prop.name === 'Dock') et = 'DockStyle';
  let ns = prop.ns || 'System.Windows.Forms';
  // Some property schemas store the full enum type in `ns` (for example
  // System.Windows.Forms.FormBorderStyle); others store only a namespace.
  if (ns === et || ns.endsWith('.' + et) || ns.endsWith(et)) return `${ns}.${value}`;
  return `${ns}.${et}.${value}`;
}

function anchorLiteral(v) {
  const parts = String(v || 'Top,Left').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return 'System.Windows.Forms.AnchorStyles.None';
  return `CType((${parts.map(p => `System.Windows.Forms.AnchorStyles.${p}`).join(' Or ')}), System.Windows.Forms.AnchorStyles)`;
}

function paddingLiteral(v) {
  const [l, t, r, b] = v || [0, 0, 0, 0];
  return `New System.Windows.Forms.Padding(${l}, ${t}, ${r}, ${b})`;
}

export function propLiteral(ctrlType, prop, value) {
  switch (prop.type) {
    case 'string': return vbString(value);
    case 'text': return vbString(value);
    case 'int': return String(parseInt(value) || 0);
    case 'float': return vbNumber(value, true);
    case 'bool': return value ? 'True' : 'False';
    case 'char': return value ? `"${String(value).replace(/"/g, '""')}"c` : '""c';
    case 'color': return colorLiteral(value);
    case 'font': return fontLiteral(value);
    case 'enum': return enumLiteral({ ...prop, _value: value }, ctrlType);
    case 'anchor': return anchorLiteral(value);
    case 'padding': return paddingLiteral(value);
    case 'point': return `New System.Drawing.Point(${value?.[0] || 0}, ${value?.[1] || 0})`;
    case 'size': return `New System.Drawing.Size(${value?.[0] || 0}, ${value?.[1] || 0})`;
    case 'image': return value ? `System.Drawing.Image.FromFile(${vbString(value)})` : 'Nothing';
    case 'controlref': return value ? `Me.${value}` : 'Nothing';
    default: return vbString(value);
  }
}

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ------------------------------------------------------------------ */
/* serializer                                                          */
/* ------------------------------------------------------------------ */

function fieldType(type) {
  if (ITEM_TYPES.has(type)) return `System.Windows.Forms.${type}`;
  return `System.Windows.Forms.${type}`;
}

function instLine(name, type) {
  if (type === 'Timer') return `        Me.${name} = New System.Windows.Forms.Timer(Me.components)`;
  return `        Me.${name} = New ${fieldType(type)}()`;
}

function emitItems(lines, ctrl, items, indent = '        ', parentName = null) {
  const refs = items.map(i => `Me.${i.name}`).join(', ');
  const coll = parentName ? `${parentName}.DropDownItems` : `${ctrl.name}.Items`;
  lines.push(`${indent}Me.${coll}.AddRange(New System.Windows.Forms.ToolStripItem() {${refs}})`);
}

export function serializeDesigner(form) {
  const L = [];
  const push = (s = '') => L.push(s);

  push(`<Global.Microsoft.VisualBasic.CompilerServices.DesignerGenerated()> _`);
  push(`Partial Class ${form.name}`);
  push(`    Inherits System.Windows.Forms.Form`);
  push('');
  push(`    'Form overrides dispose to clean up the component list.`);
  push(`    <System.Diagnostics.DebuggerNonUserCode()> _`);
  push(`    Protected Overrides Sub Dispose(ByVal disposing As Boolean)`);
  push(`        Try`);
  push(`            If disposing AndAlso components IsNot Nothing Then`);
  push(`                components.Dispose()`);
  push(`            End If`);
  push(`        Finally`);
  push(`            MyBase.Dispose(disposing)`);
  push(`        End Try`);
  push(`    End Sub`);
  push('');
  push(`    'Required by the Windows Form Designer`);
  push(`    Private components As System.ComponentModel.IContainer`);
  push('');
  push(`    'NOTE: The following procedure is required by the Windows Form Designer.`);
  push(`    'It can be modified using the Windows Form Designer.`);
  push(`    'Do not modify it using the code editor.`);
  push(`    <System.Diagnostics.DebuggerStepThrough()> _`);
  push(`    Private Sub InitializeComponent()`);

  const controls = [];
  walkControls(form.controls, c => controls.push(c));
  const hasComponents = (form.components || []).length > 0;
  if (hasComponents) push(`        Me.components = New System.ComponentModel.Container()`);

  // instantiate components
  for (const c of form.components) push(instLine(c.name, c.type));

  // instantiate tab pages, menu items, columns, then controls
  for (const c of controls) {
    if (c.type === 'TabControl') {
      for (const p of c.tabPages) push(instLine(p.name, 'TabPage'));
      if (c.items) emitItemsRecursive(L, c.items);
    }
    if (c.items) emitItemsRecursive(L, c.items);
    if (c.columns) for (const col of c.columns) push(instLine(col.name, 'DataGridViewTextBoxColumn'));
  }
  for (const c of controls) {
    if (c.unknown) {
      const ctor = (c.raw || []).find(l => /^Me\.\w+\s*=\s*New\b/.test(l.trim()));
      push(ctor ? `        ${ctor.trim()}` : instLine(c.name, c.type));
    } else {
      push(instLine(c.name, c.type));
    }
  }

  push('');
  push(`        Me.SuspendLayout()`);

  // properties
  for (const c of form.components) emitControlProps(L, c);
  for (const c of controls) {
    if (c.unknown) {
      for (const raw of c.raw || []) {
        const t = raw.trim();
        if (/^Me\.\w+\s*=\s*New\b/.test(t)) continue;
        if (/\.Controls\.Add/.test(t)) continue;
        L.push(`        ${t}`);
      }
      continue;
    }
    if (c.type === 'TabControl') for (const p of c.tabPages) {
      L.push(`        Me.${p.name}.Text = ${vbString(p.text)}`);
      L.push(`        Me.${p.name}.UseVisualStyleBackColor = True`);
    }
    if (c.columns) for (const col of c.columns) {
      L.push(`        Me.${col.name}.HeaderText = ${vbString(col.text)}`);
      L.push(`        Me.${col.name}.Name = ${vbString(col.name)}`);
      L.push(`        Me.${col.name}.Width = ${col.width}`);
    }
    emitControlProps(L, c);
    if (c.items) {
      emitItemProps(L, c.items);
      if (['MenuStrip', 'StatusStrip', 'ToolStrip'].includes(c.type)) emitItems(L, c, c.items);
    }
    if (c.columns && c.columns.length) {
      L.push(`        Me.${c.name}.Columns.AddRange(New System.Windows.Forms.DataGridViewColumn() {${c.columns.map(col => `Me.${col.name}`).join(', ')}})`);
    }
  }

  // form properties
  const fp = form.props;
  push(`        Me.AutoScaleDimensions = New System.Drawing.SizeF(7.0!, 15.0!)`);
  push(`        Me.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font`);
  push(`        Me.ClientSize = New System.Drawing.Size(${form.w}, ${form.h})`);
  for (const p of FORM_PROPS) {
    if (p.name === 'Text') continue;
    const v = fp[p.name];
    if (v === undefined || eq(v, p.def)) continue;
    push(`        Me.${p.name} = ${propLiteral('Form', p, v)}`);
  }
  push(`        Me.Name = ${vbString(form.name)}`);
  push(`        Me.Text = ${vbString(fp.Text || form.name)}`);

  // add children
  const addTo = (parentName, list) => {
    for (const c of list) {
      if (parentName) L.push(`        Me.${parentName}.Controls.Add(Me.${c.name})`);
      else L.push(`        Me.Controls.Add(Me.${c.name})`);
    }
  };
  const normal = controls.filter(c => !['MenuStrip', 'StatusStrip', 'ToolStrip'].includes(c.type));
  const bars = controls.filter(c => ['MenuStrip', 'StatusStrip', 'ToolStrip'].includes(c.type));
  for (const c of controls) {
    if (c.type === 'TabControl') {
      for (const p of c.tabPages) {
        L.push(`        Me.${c.name}.Controls.Add(Me.${p.name})`);
        for (const ch of p.children) L.push(`        Me.${p.name}.Controls.Add(Me.${ch.name})`);
      }
    }
    for (const ch of c.children) L.push(`        Me.${c.name}.Controls.Add(Me.${ch.name})`);
  }
  const isBar = (c) => ['MenuStrip', 'StatusStrip', 'ToolStrip'].includes(c.type);
  const topLevel = [...(form.controls || []).filter(isBar), ...(form.controls || []).filter(c => !isBar(c))];
  for (const c of topLevel) L.push(`        Me.Controls.Add(Me.${c.name})`);

  push('');
  push(`        Me.ResumeLayout(False)`);
  push(`        Me.PerformLayout()`);
  push(`    End Sub`);
  push('');

  // fields
  for (const c of form.components) push(`    Friend WithEvents ${c.name} As ${fieldType(c.type)}`);
  for (const c of controls) {
    if (c.type === 'TabControl') {
      for (const p of c.tabPages) push(`    Friend WithEvents ${p.name} As System.Windows.Forms.TabPage`);
      if (c.items) for (const it of flattenItems(c.items)) push(`    Friend WithEvents ${it.name} As System.Windows.Forms.ToolStripMenuItem`);
    }
    if (c.items) for (const it of flattenItems(c.items)) push(`    Friend WithEvents ${it.name} As ${fieldType(it.type)}`);
    if (c.columns) for (const col of c.columns) push(`    Friend WithEvents ${col.name} As System.Windows.Forms.DataGridViewTextBoxColumn`);
    if (c.unknown) push(c.decl ? `    ${c.decl.trim()}` : `    Friend WithEvents ${c.name} As System.Windows.Forms.${c.type}`);
    else push(`    Friend WithEvents ${c.name} As ${fieldType(c.type)}`);
  }
  push(`End Class`);
  push('');
  return L.join('\n');
}

function flattenItems(items) {
  const out = [];
  for (const it of items) { out.push(it); out.push(...flattenItems(it.items || [])); }
  return out;
}

function emitItemsRecursive(L, items) {
  for (const it of items) {
    L.push(instLine(it.name, it.type));
    emitItemsRecursive(L, it.items || []);
  }
}

function emitItemProps(L, items) {
  for (const it of items) {
    L.push(`        Me.${it.name}.Text = ${vbString(it.text)}`);
    if (it.type === 'ToolStripMenuItem') {
      if (it.shortcut) L.push(`        Me.${it.name}.ShortcutKeys = ${shortcutLiteral(it.shortcut)}`);
      if (it.checked) L.push(`        Me.${it.name}.Checked = True`);
      if (!it.enabled) L.push(`        Me.${it.name}.Enabled = False`);
      if (it.items && it.items.length) emitItems(L, null, it.items, '        ', it.name);
    }
    emitItemProps(L, it.items || []);
  }
}

function emitControlProps(L, c) {
  const def = CONTROLS[c.type];
  const props = propsFor(c.type);
  const hasText = props.some(p => p.name === 'Text');
  if (hasText) L.push(`        Me.${c.name}.Text = ${vbString(c.props.Text ?? '')}`);
  for (const p of props) {
    if (p.name === 'Text' || p.name === 'Locked') continue;
    if (p.name === 'Items') {
      const items = c.props.Items;
      if (Array.isArray(items) && items.length) {
        L.push(`        Me.${c.name}.Items.AddRange(New Object() {${items.map(vbString).join(', ')}})`);
      }
      continue;
    }
    if (p.name === 'TabPages' || p.name === 'Columns') continue;
    const v = c.props[p.name];
    if (v === undefined) continue;
    if (eq(v, p.def) && !p.emitAlways) continue;
    L.push(`        Me.${c.name}.${p.name} = ${propLiteral(c.type, p, v)}`);
  }
  if (c.extra) for (const [k, v] of Object.entries(c.extra)) L.push(`        Me.${c.name}.${k} = ${v}`);
  if (!c.component) {
    const docked = c.props.Dock && c.props.Dock !== 'None';
    if (!docked) {
      L.push(`        Me.${c.name}.Location = New System.Drawing.Point(${Math.round(c.x)}, ${Math.round(c.y)})`);
      const autoSize = c.props.AutoSize === true;
      if (!autoSize) L.push(`        Me.${c.name}.Size = New System.Drawing.Size(${Math.round(c.w)}, ${Math.round(c.h)})`);
    }
    L.push(`        Me.${c.name}.Name = ${vbString(c.name)}`);
    if (!hasText && def && def.text !== undefined && !def.noText) L.push(`        Me.${c.name}.Text = ${vbString(c.props.Text ?? '')}`);
    if (c.type === 'TabControl') L.push(`        Me.${c.name}.SelectedIndex = ${c.activePage || 0}`);
  }
}

function shortcutLiteral(s) {
  const parts = String(s).split('+').map(x => x.trim()).filter(Boolean);
  const keys = parts.map(p => {
    if (/^ctrl$/i.test(p)) return 'Control';
    if (/^shift$/i.test(p)) return 'Shift';
    if (/^alt$/i.test(p)) return 'Alt';
    if (/^del(ete)?$/i.test(p)) return 'Delete';
    if (/^ins(ert)?$/i.test(p)) return 'Insert';
    return p.length === 1 ? p.toUpperCase() : p;
  });
  return `CType((${keys.map(k => `System.Windows.Forms.Keys.${k}`).join(' Or ')}), System.Windows.Forms.Keys)`;
}

/* ------------------------------------------------------------------ */
/* parser                                                              */
/* ------------------------------------------------------------------ */

function joinContinuations(code) {
  const raw = code.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let buf = '';
  for (const line of raw) {
    const t = line.replace(/\s+$/, '');
    if (t.endsWith(' _')) { buf += t.slice(0, -2) + ' '; continue; }
    out.push((buf + t).trim());
    buf = '';
  }
  if (buf) out.push(buf.trim());
  return out;
}

function unquote(s) {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/""/g, '"');
  return s;
}

function parseStringExpr(raw) {
  raw = raw.trim();
  if (!raw.includes('&')) return unquote(raw);
  const parts = raw.split('&').map(x => x.trim());
  let out = '';
  for (const p of parts) {
    if (p === 'Environment.NewLine' || /vbCrLf|vbNewLine|ChrW\(13\)/.test(p)) out += '\n';
    else if (p.startsWith('"')) out += unquote(p);
  }
  return out;
}

function parseColor(raw) {
  raw = raw.trim();
  let m = raw.match(/Color\.FromArgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) return '#' + [m[2], m[3], m[4]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
  m = raw.match(/Color\.FromArgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) return '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
  m = raw.match(/Color\.(\w+)/i);
  if (m) {
    const name = m[1];
    if (NAMED_COLORS[name]) return NAMED_COLORS[name];
    if (name === 'Transparent') return 'Transparent';
    return '#000000';
  }
  if (/^#/.test(raw)) return raw.toUpperCase();
  return raw;
}

function parseFont(raw) {
  const m = raw.match(/New\s+System\.Drawing\.Font\(\s*"((?:[^"]|"")*)"\s*,\s*([\d.]+)/i);
  if (!m) return null;
  const family = m[1].replace(/""/g, '"');
  const size = parseFloat(m[2]);
  let style = 0;
  if (/FontStyle\.Bold/.test(raw)) style |= 1;
  if (/FontStyle\.Italic/.test(raw)) style |= 2;
  if (/FontStyle\.Underline/.test(raw)) style |= 4;
  if (/FontStyle\.Strikeout/.test(raw)) style |= 8;
  return { family, size, style };
}

function parsePoint(raw) {
  const m = raw.match(/Point\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i);
  return m ? [Math.round(+m[1]), Math.round(+m[2])] : [0, 0];
}
function parseSize(raw) {
  const m = raw.match(/Size\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i);
  return m ? [Math.round(+m[1]), Math.round(+m[2])] : [0, 0];
}
function parsePadding(raw) {
  const m = raw.match(/Padding\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i);
  return m ? [+m[1], +m[2], +m[3], +m[4]] : [0, 0, 0, 0];
}
function parseAnchor(raw) {
  const parts = [...raw.matchAll(/AnchorStyles\.(\w+)/g)].map(m => m[1]);
  return parts.length ? parts.join(',') : 'Top,Left';
}
function parseEnum(raw) {
  const m = raw.match(/\.(\w+)\s*\)?\s*$/);
  return m ? m[1] : raw.trim();
}
function parseNumber(raw) {
  return parseFloat(String(raw).replace(/[!FDSIL%]/g, '')) || 0;
}
function parseBool(raw) { return /^True$/i.test(raw.trim()); }
function parseChar(raw) {
  const m = raw.trim().match(/^"(.*)"c$/i);
  return m ? m[1].replace(/""/g, '"') : '';
}
function parseShortcut(raw) {
  const keys = [...raw.matchAll(/Keys\.(\w+)/g)].map(m => m[1]);
  return keys.map(k => (k === 'Control' ? 'Ctrl' : k)).join('+');
}

function parseObjectArray(raw) {
  const inner = raw.replace(/^New\s+[\w\.]+\(\)\s*\{/, '').replace(/\}\s*$/, '').trim();
  if (!inner) return [];
  const parts = [];
  let cur = '', q = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') q = !q;
    if (ch === ',' && !q) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function parseDesigner(code, fallbackName = 'Form1') {
  const lines = joinContinuations(code);
  const form = createFormModel(fallbackName);
  const ctors = new Map();       // name -> type
  const rawProps = new Map();    // name -> {prop: raw}
  const formProps = {};
  const parentOf = new Map();    // child -> parent name ('FORM' for form)
  const itemRefs = new Map();    // owner -> [refs]
  const dropdownRefs = new Map();
  const columnRefs = new Map();
  const declLines = new Map();   // name -> raw Friend WithEvents declaration
  const warnings = [];
  let formName = fallbackName;
  const formPropNames = new Set(['ClientSize', ...FORM_PROPS.map(p => p.name)]);

  for (const line of lines) {
    if (!line || line.startsWith("'") || line.startsWith('Imports ') || line.startsWith('Option ')) continue;
    let m = line.match(/^(?:Public\s+|Friend\s+)?Partial\s+Class\s+(\w+)/i);
    if (m) { formName = m[1]; form.name = formName; continue; }

    m = line.match(/^(?:Friend|Private|Public)\s+WithEvents\s+(\w+)\s+As\s+(.+)$/i);
    if (m) { declLines.set(m[1], line); continue; }

    m = line.match(/^Me\.([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (m && formPropNames.has(m[1])) { formProps[m[1]] = m[2]; continue; }

    m = line.match(/^Me\.(\w+)\s*=\s*New\s+([\w\.]+)\s*(?:\((.*)\))?$/i);
    if (m) {
      const type = m[2].split('.').pop();
      if (type !== 'SizeF' && type !== 'Container' && type !== 'Component' && type !== 'Point' && type !== 'Size') {
        ctors.set(m[1], type);
        if (!rawProps.has(m[1])) rawProps.set(m[1], {});
      }
      continue;
    }

    m = line.match(/^Me\.(\w+)\.([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (m) {
      const [, name, prop, value] = m;
      if (!rawProps.has(name)) rawProps.set(name, {});
      rawProps.get(name)[prop] = value;
      continue;
    }

    m = line.match(/^Me\.(\w+)\.Controls\.Add\(Me\.(\w+)\)$/);
    if (m) { parentOf.set(m[2], m[1]); continue; }
    m = line.match(/^Me\.Controls\.Add\(Me\.(\w+)\)$/);
    if (m) { parentOf.set(m[1], 'FORM'); continue; }
    m = line.match(/^Me\.(\w+)\.Items\.AddRange\(\s*New\s+[\w\.]+\(\)\s*\{(.*)\}\s*\)$/);
    if (m) { itemRefs.set(m[1], parseObjectArray('New X() {' + m[2] + '}')); continue; }
    m = line.match(/^Me\.(\w+)\.Items\.Add\((.+)\)$/);
    if (m) {
      const refs = itemRefs.get(m[1]) || [];
      refs.push(m[2].trim());
      itemRefs.set(m[1], refs);
      continue;
    }
    m = line.match(/^Me\.(\w+)\.DropDownItems\.AddRange\(\s*New\s+[\w\.]+\(\)\s*\{(.*)\}\s*\)$/);
    if (m) { dropdownRefs.set(m[1], parseObjectArray('New X() {' + m[2] + '}')); continue; }
    m = line.match(/^Me\.(\w+)\.Columns\.AddRange\(\s*New\s+[\w\.]+\(\)\s*\{(.*)\}\s*\)$/);
    if (m) { columnRefs.set(m[1], parseObjectArray('New X() {' + m[2] + '}')); continue; }

    m = line.match(/^Me\.(ClientSize|Text|Name|BackColor|ForeColor|Font|StartPosition|FormBorderStyle|WindowState|MaximizeBox|MinimizeBox|ShowInTaskbar|TopMost|KeyPreview|AcceptButton|CancelButton|Opacity)\s*=\s*(.+)$/);
    if (m) { formProps[m[1]] = m[2]; continue; }
  }

  // build controls
  const byName = new Map();
  const itemObjects = new Map();
  for (const [name, type] of ctors) {
    if (type === 'TabPage') {
      const rp = rawProps.get(name) || {};
      const page = { id: uid('p'), name, text: rp.Text !== undefined ? parseStringExpr(rp.Text) : name, children: [], isPage: true };
      byName.set(name, page);
      continue;
    }
    if (ITEM_TYPES.has(type)) {
      itemObjects.set(name, { id: uid('mi'), type, name, text: '', shortcut: '', checked: false, enabled: true, items: [] });
      continue;
    }
    if (type === 'ToolStripStatusLabel' || type === 'ToolStripButton') {
      itemObjects.set(name, { id: uid('mi'), type, name, text: '', shortcut: '', checked: false, enabled: true, items: [] });
      continue;
    }
    if (COMPONENT_TYPES.has(type)) {
      const c = { id: uid(), type, name, props: defaultsFor(type), events: {}, children: [], component: true, x: 0, y: 0, w: 32, h: 32 };
      applyProps(c, rawProps.get(name) || {});
      form.components.push(c);
      byName.set(name, c);
      continue;
    }
    if (!CONTROLS[type]) {
      // Opaque preservation: keep the control and its raw designer lines so a
      // round-trip through the designer cannot silently delete it.
      const rawRe = new RegExp(`^(?:Me\\.${escapeRe(name)}\\b|CType\\(Me\\.${escapeRe(name)}\\b)`);
      const raw = lines.filter(l => rawRe.test(l.trim()));
      const c = {
        id: uid(), type, name, x: 0, y: 0, w: 64, h: 64,
        props: {}, events: {}, children: [], component: false,
        unknown: true, raw, decl: declLines.get(name) || '',
      };
      byName.set(name, c);
      warnings.push(`Preserved unsupported control type: ${type} (${name}). It stays in Designer.vb but is not editable in the designer.`);
      continue;
    }
    const c = {
      id: uid(), type, name,
      x: 0, y: 0, w: CONTROLS[type].size[0], h: CONTROLS[type].size[1],
      props: defaultsFor(type), events: {}, children: [], component: false,
    };
    applyProps(c, rawProps.get(name) || {});
    if (type === 'TabControl') { c.tabPages = []; c.activePage = 0; delete c.props.TabPages; }
    if (type === 'MenuStrip' || type === 'StatusStrip' || type === 'ToolStrip') { c.items = []; delete c.props.Items; }
    if (type === 'DataGridView') { c.columns = []; delete c.props.Columns; }
    byName.set(name, c);
  }

  // resolve menu items / columns
  for (const [name, obj] of itemObjects) {
    const rp = rawProps.get(name) || {};
    obj.text = rp.Text !== undefined ? parseStringExpr(rp.Text) : '';
    if (rp.ShortcutKeys) obj.shortcut = parseShortcut(rp.ShortcutKeys);
    if (rp.Checked) obj.checked = parseBool(rp.Checked);
    if (rp.Enabled) obj.enabled = parseBool(rp.Enabled);
    if (dropdownRefs.has(name)) obj.items = dropdownRefs.get(name).map(r => itemObjects.get(r.replace(/^Me\./, ''))).filter(Boolean);
  }
  for (const [ownerName, refs] of itemRefs) {
    const owner = byName.get(ownerName);
    if (!owner) continue;
    if (owner.type === 'DataGridView') continue;
    if (owner.type === 'MenuStrip' || owner.type === 'StatusStrip' || owner.type === 'ToolStrip') {
      owner.items = refs.map(r => itemObjects.get(r.replace(/^Me\./, ''))).filter(Boolean);
    } else {
      owner.props.Items = refs.map(r => parseStringExpr(r));
    }
  }
  // guard against self-referencing / cyclic item trees from hand-edited files
  const pruneItemCycles = (item, ancestors) => {
    if (!item || ancestors.has(item)) return;
    const next = new Set(ancestors);
    next.add(item);
    item.items = (item.items || []).filter(c => c && !next.has(c));
    for (const c of item.items) pruneItemCycles(c, next);
  };
  for (const it of itemObjects.values()) pruneItemCycles(it, new Set());

  for (const [ownerName, refs] of columnRefs) {
    const owner = byName.get(ownerName);
    if (!owner || owner.type !== 'DataGridView') continue;
    owner.columns = refs.map(r => {
      const colName = r.replace(/^Me\./, '');
      const rp = rawProps.get(colName) || {};
      return {
        id: uid('col'), name: colName,
        text: rp.HeaderText !== undefined ? parseStringExpr(rp.HeaderText) : colName,
        width: rp.Width !== undefined ? parseNumber(rp.Width) : 100,
      };
    });
  }

  // form props
  for (const p of FORM_PROPS) {
    const raw = formProps[p.name];
    if (raw === undefined) continue;
    switch (p.type) {
      case 'string': form.props[p.name] = parseStringExpr(raw); break;
      case 'bool': form.props[p.name] = parseBool(raw); break;
      case 'int': form.props[p.name] = parseNumber(raw); break;
      case 'float': form.props[p.name] = parseNumber(raw); break;
      case 'color': form.props[p.name] = parseColor(raw); break;
      case 'font': { const f = parseFont(raw); if (f) form.props[p.name] = f; break; }
      case 'enum': form.props[p.name] = parseEnum(raw); break;
      case 'controlref': form.props[p.name] = raw.replace(/^Me\./, ''); break;
    }
  }
  if (formProps.ClientSize) { const s = parseSize(formProps.ClientSize); form.w = s[0]; form.h = s[1]; }

  // attach hierarchy
  const formLevel = [];
  for (const [childName, parentName] of parentOf) {
    const child = byName.get(childName);
    if (!child) continue;
    if (parentName === 'FORM') { formLevel.push(child); continue; }
    const parent = byName.get(parentName);
    if (!parent) { formLevel.push(child); continue; }
    if (parent.type === 'TabControl' && child.isPage) {
      parent.tabPages.push(child);
    } else if (child.isPage) {
      warnings.push(`Tab page ${child.name} has no tab control parent.`);
    } else if (parent.type === 'TabControl') {
      const page = parent.tabPages[0];
      if (page) page.children.push(child); else formLevel.push(child);
    } else if (parent.children) {
      parent.children.push(child);
    }
  }
  // tab control pages and children without explicit parent
  for (const c of byName.values()) {
    if (c.type === 'TabControl') {
      for (const p of c.tabPages) if (!parentOf.has(p.name)) parentOf.set(p.name, c.name);
      c.activePage = Math.max(0, Math.min(c.tabPages.length - 1, parseNumber(rawProps.get(c.name)?.SelectedIndex || 0)));
    }
  }
  // any control not placed
  const placed = new Set([...parentOf.keys()]);
  for (const [name, c] of byName) {
    if (c.isPage) continue;
    if (!placed.has(name) && !form.components.includes(c)) formLevel.push(c);
  }
  // de-dupe and keep order
  const seen = new Set();
  form.controls = formLevel.filter(c => { if (!c || seen.has(c.id)) return false; seen.add(c.id); return !c.component; });

  // normalize menu items names/ids
  for (const c of form.controls) {
    if (c.tabPages) c.tabPages.forEach(p => { p.text = p.text || p.name; });
    if (c.items) for (const it of flattenItems(c.items)) { it.id = it.id || uid('mi'); }
  }

  return { form, warnings };
}

function applyProps(c, raw) {
  const schema = propsFor(c.type);
  const map = Object.fromEntries(schema.map(p => [p.name, p]));
  for (const [prop, value] of Object.entries(raw)) {
    if (prop === 'Location') { const p = parsePoint(value); c.x = p[0]; c.y = p[1]; continue; }
    if (prop === 'Size') { const s = parseSize(value); c.w = s[0]; c.h = s[1]; continue; }
    if (prop === 'Name') continue;
    if (prop === 'Text') { c.props.Text = parseStringExpr(value); continue; }
    if (prop === 'Items' || prop === 'TabPages' || prop === 'Columns') continue;
    const p = map[prop];
    if (!p) {
      // Preserve properties the catalog does not model so a save does not
      // silently drop designer settings. Values that depend on generated
      // locals (resource manager, CType casts) are left alone.
      if (!/\bresources\b/.test(value) && !/\bCType\(|\bDirectCast\(/.test(value)) {
        c.extra = c.extra || {};
        c.extra[prop] = value;
      }
      continue;
    }
    switch (p.type) {
      case 'string': c.props[prop] = parseStringExpr(value); break;
      case 'bool': c.props[prop] = parseBool(value); break;
      case 'int': c.props[prop] = Math.round(parseNumber(value)); break;
      case 'float': c.props[prop] = parseNumber(value); break;
      case 'char': c.props[prop] = parseChar(value); break;
      case 'color': c.props[prop] = parseColor(value); break;
      case 'font': { const f = parseFont(value); if (f) c.props[prop] = f; break; }
      case 'enum': c.props[prop] = parseEnum(value); break;
      case 'anchor': c.props[prop] = parseAnchor(value); break;
      case 'padding': c.props[prop] = parsePadding(value); break;
      case 'controlref': c.props[prop] = value.replace(/^Me\./, ''); break;
      case 'collection':
        if (prop === 'Items') {
          const arr = parseObjectArray(value).map(v => unquote(v));
          c.props.Items = arr;
        }
        break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* code-behind                                                         */
/* ------------------------------------------------------------------ */

export function defaultCodeBehind(form) {
  return `Imports System.Windows.Forms\n\nPublic Class ${form.name}\n\n    Private Sub ${form.name}_Load(sender As Object, e As EventArgs) Handles MyBase.Load\n\n    End Sub\n\nEnd Class\n`;
}

export function handlerName(ctrlName, eventName) {
  return `${ctrlName}_${eventName}`;
}

export function addHandler(code, formName, ctrlName, eventName) {
  const name = handlerName(ctrlName, eventName);
  if (new RegExp(`\\bSub\\s+${escapeRe(name)}\\s*\\(`, 'i').test(code)) return code;
  const args = EVENT_ARGS[eventName] || 'EventArgs';
  const handles = ctrlName === formName || ctrlName === 'MyBase' ? `MyBase.${eventName}` : `${ctrlName}.${eventName}`;
  const snippet = `    Private Sub ${name}(sender As Object, e As ${args}) Handles ${handles}\n\n    End Sub\n\n`;
  const idx = code.lastIndexOf('End Class');
  if (idx < 0) return code + '\n' + snippet;
  return code.slice(0, idx) + snippet + code.slice(idx);
}

export function removeHandler(code, ctrlName, eventName) {
  const name = handlerName(ctrlName, eventName);
  const re = new RegExp(`\\n?[ \\t]*Private Sub ${escapeRe(name)}\\([^\\n]*\\)[^\\n]*Handles[^\\n]*\\n(?:[\\s\\S]*?)\\n[ \\t]*End Sub\\n?`, 'i');
  return code.replace(re, '\n');
}

/* Remove Handles clauses that point at deleted controls. The handler body is
   left intact so user code is never destroyed; a clause with no targets left
   simply loses its Handles list. */
export function stripHandlesFor(code, names) {
  if (!names || !names.length) return code;
  const set = new Set(names.map(n => String(n).toLowerCase()));
  return code.split('\n').map((line) => {
    if (line.trim().startsWith("'")) return line;
    const m = line.match(/^(.*?)\bHandles\s+(.+)$/);
    if (!m) return line;
    const targets = m[2].split(',').map(t => t.trim()).filter(Boolean);
    const kept = targets.filter(t => !set.has(t.split('.')[0].trim().toLowerCase()));
    if (kept.length === targets.length) return line;
    if (!kept.length) return m[1].replace(/\s+$/, '');
    return `${m[1]}${kept.join(', ')}`;
  }).join('\n');
}

function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function parseHandlers(code, formName) {
  const out = {};
  const re = /(?:Private|Public|Protected|Friend)?\s*Sub\s+(\w+)\s*\([^)]*\)\s*Handles\s+([^\n]+)/gi;
  let m;
  while ((m = re.exec(code)) !== null) {
    const handler = m[1];
    const handles = m[2].replace(/\s+/g, ' ');
    for (const part of handles.split(',')) {
      const h = part.trim();
      const hm = h.match(/^(?:Me\.)?(\w+)\.(\w+)$/);
      if (!hm) continue;
      const [, ctrl, evt] = hm;
      if (ctrl === 'MyBase') {
        out[`form:${evt}`] = handler;
      } else {
        out[`${ctrl}:${evt}`] = handler;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* project file content                                                */
/* ------------------------------------------------------------------ */

export function programFile(namespace) {
  return `Imports System.Windows.Forms\n\nModule Program\n    <STAThread>\n    Sub Main()\n        Application.EnableVisualStyles()\n        Application.SetCompatibleTextRenderingDefault(False)\n        Application.Run(New Form1())\n    End Sub\nEnd Module\n`;
}

export function vbprojFile(name, rootNamespace) {
  return `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net472</TargetFramework>
    <RootNamespace>${rootNamespace}</RootNamespace>
    <AssemblyName>${name}</AssemblyName>
    <MyType>WindowsForms</MyType>
    <StartupObject>${rootNamespace}.Program</StartupObject>
    <OptionStrict>Off</OptionStrict>
    <OptionExplicit>On</OptionExplicit>
    <OptionInfer>On</OptionInfer>
    <LangVersion>latest</LangVersion>
    <GenerateAssemblyInfo>true</GenerateAssemblyInfo>
    <Deterministic>true</Deterministic>
    <DebugType>portable</DebugType>
  </PropertyGroup>

  <ItemGroup>
    <Reference Include="System.Windows.Forms" />
    <Reference Include="System.Drawing" />
    <Reference Include="System.Data" />
    <Reference Include="System.Xml" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NETFramework.ReferenceAssemblies" Version="1.0.3" PrivateAssets="all" />
  </ItemGroup>

</Project>
`;
}

export function slnFile(name) {
  const guid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16).toUpperCase();
  });
  const proj = guid();
  return `\nMicrosoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.0.31903.59
MinimumVisualStudioVersion = 10.0.40219.1
Project("{F184B08F-C81C-45F6-A57F-5ABD9991F28F}") = "${name}", "${name}.vbproj", "{${proj}}"
EndProject
Global
\tGlobalSection(SolutionConfigurationPlatforms) = preSolution
\t\tDebug|Any CPU = Debug|Any CPU
\t\tRelease|Any CPU = Release|Any CPU
\tEndGlobalSection
\tGlobalSection(ProjectConfigurationPlatforms) = postSolution
\t\t{${proj}}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
\t\t{${proj}}.Debug|Any CPU.Build.0 = Debug|Any CPU
\t\t{${proj}}.Release|Any CPU.ActiveCfg = Release|Any CPU
\t\t{${proj}}.Release|Any CPU.Build.0 = Release|Any CPU
\tEndGlobalSection
\tGlobalSection(SolutionProperties) = preSolution
\t\tHideSolutionNode = FALSE
\tEndGlobalSection
EndGlobal
`;
}
