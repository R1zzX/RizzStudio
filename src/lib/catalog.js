/* Control catalog: metadata, defaults, property schemas, events. */

export const CATEGORIES = [
  'Common Controls',
  'Containers',
  'Menus & Toolbars',
  'Data',
  'Components',
  'Dialogs',
];

const BASE = [
  { name: 'Enabled', type: 'bool', cat: 'Behavior', def: true, desc: 'Enables or disables the control.' },
  { name: 'Visible', type: 'bool', cat: 'Behavior', def: true, desc: 'Determines whether the control is visible.' },
  { name: 'TabIndex', type: 'int', cat: 'Behavior', def: 0, desc: 'Tab order index.' },
  { name: 'Anchor', type: 'anchor', cat: 'Layout', def: 'Top,Left', desc: 'Defines which edges are bound to the parent.' },
  { name: 'Dock', type: 'enum', cat: 'Layout', def: 'None', options: ['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill'], ns: 'System.Windows.Forms', desc: 'Docks the control to an edge of its parent.' },
  { name: 'BackColor', type: 'color', cat: 'Appearance', def: '#F0F0F0', desc: 'Background color of the control.' },
  { name: 'ForeColor', type: 'color', cat: 'Appearance', def: '#000000', desc: 'Foreground color of the control.' },
  { name: 'Font', type: 'font', cat: 'Appearance', def: { family: 'Segoe UI', size: 9, style: 0 }, desc: 'Font used to display text.' },
  { name: 'Cursor', type: 'enum', cat: 'Appearance', def: 'Default', options: ['Default', 'Hand', 'Arrow', 'Cross', 'WaitCursor', 'IBeam', 'SizeAll', 'SizeNS', 'SizeWE'], ns: 'Cursors', desc: 'Mouse cursor shown over the control.' },
  { name: 'Padding', type: 'padding', cat: 'Layout', def: [0, 0, 0, 0], desc: 'Inner spacing between the control border and its contents.' },
  { name: 'Locked', type: 'bool', cat: 'Design', def: false, desc: 'Prevents the control from being moved in the designer.' },
];

const COMMON_EVENTS = ['Click', 'DoubleClick', 'MouseEnter', 'MouseLeave', 'MouseDown', 'MouseUp', 'KeyDown', 'KeyPress', 'KeyUp', 'Enter', 'Leave', 'Validating', 'Validated'];

const E = (extra = []) => [...COMMON_EVENTS, ...extra];

function d(name, size, text, props, events, opts = {}) {
  return {
    name, ns: 'System.Windows.Forms', category: opts.category || 'Common Controls',
    size, text, props, events, component: !!opts.component,
    container: !!opts.container, noText: !!opts.noText, backColor: opts.backColor,
    desc: opts.desc || '',
  };
}

export const CONTROLS = {
  Button: d('Button', [104, 32], 'Button1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'Button1' },
    { name: 'TextAlign', type: 'enum', cat: 'Appearance', def: 'MiddleCenter', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'], ns: 'System.Drawing.ContentAlignment' },
    { name: 'FlatStyle', type: 'enum', cat: 'Appearance', def: 'Standard', options: ['Flat', 'Popup', 'Standard', 'System'] },
    { name: 'ImageAlign', type: 'enum', cat: 'Appearance', def: 'MiddleCenter', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'], ns: 'System.Drawing.ContentAlignment' },
    { name: 'DialogResult', type: 'enum', cat: 'Behavior', def: 'None', options: ['None', 'OK', 'Cancel', 'Yes', 'No', 'Abort', 'Retry', 'Ignore'] },
    { name: 'UseVisualStyleBackColor', type: 'bool', cat: 'Appearance', def: true },
  ], E(['TextChanged']), { desc: 'A clickable push button.' }),

  Label: d('Label', [60, 18], 'Label1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'Label1' },
    { name: 'AutoSize', type: 'bool', cat: 'Layout', def: true, emitAlways: true },
    { name: 'TextAlign', type: 'enum', cat: 'Appearance', def: 'TopLeft', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'], ns: 'System.Drawing.ContentAlignment' },
    { name: 'BorderStyle', type: 'enum', cat: 'Appearance', def: 'None', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ], E(), { backColor: 'Transparent', desc: 'Displays text that cannot be edited by the user.' }),

  LinkLabel: d('LinkLabel', [92, 18], 'LinkLabel1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'LinkLabel1' },
    { name: 'AutoSize', type: 'bool', cat: 'Layout', def: true, emitAlways: true },
    { name: 'LinkColor', type: 'color', cat: 'Appearance', def: '#0066CC' },
    { name: 'VisitedLinkColor', type: 'color', cat: 'Appearance', def: '#800080' },
    { name: 'LinkBehavior', type: 'enum', cat: 'Behavior', def: 'SystemDefault', options: ['SystemDefault', 'AlwaysUnderline', 'HoverUnderline', 'NeverUnderline'] },
  ], E(['LinkClicked']), { backColor: 'Transparent', desc: 'A label that displays a hyperlink.' }),

  TextBox: d('TextBox', [150, 23], 'TextBox1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'TextBox1' },
    { name: 'TextAlign', type: 'enum', cat: 'Appearance', def: 'Left', options: ['Left', 'Right', 'Center'], ns: 'System.Windows.Forms.HorizontalAlignment' },
    { name: 'Multiline', type: 'bool', cat: 'Behavior', def: false },
    { name: 'ReadOnly', type: 'bool', cat: 'Behavior', def: false },
    { name: 'PasswordChar', type: 'char', cat: 'Behavior', def: '' },
    { name: 'UseSystemPasswordChar', type: 'bool', cat: 'Behavior', def: false },
    { name: 'MaxLength', type: 'int', cat: 'Behavior', def: 32767 },
    { name: 'ScrollBars', type: 'enum', cat: 'Appearance', def: 'None', options: ['None', 'Horizontal', 'Vertical', 'Both'] },
    { name: 'BorderStyle', type: 'enum', cat: 'Appearance', def: 'Fixed3D', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ], E(['TextChanged']), { backColor: '#FFFFFF', desc: 'Accepts text input from the user.' }),

  RichTextBox: d('RichTextBox', [200, 96], 'RichTextBox1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: '' },
    { name: 'ReadOnly', type: 'bool', cat: 'Behavior', def: false },
    { name: 'DetectUrls', type: 'bool', cat: 'Behavior', def: true },
    { name: 'BorderStyle', type: 'enum', cat: 'Appearance', def: 'Fixed3D', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ], E(['TextChanged']), { backColor: '#FFFFFF', desc: 'A text box with rich formatting support.' }),

  MaskedTextBox: d('MaskedTextBox', [150, 23], '', [
    { name: 'Mask', type: 'string', cat: 'Behavior', def: '' },
    { name: 'Text', type: 'string', cat: 'Appearance', def: '' },
    { name: 'PromptChar', type: 'char', cat: 'Behavior', def: '_' },
    { name: 'ReadOnly', type: 'bool', cat: 'Behavior', def: false },
  ], E(['TextChanged']), { backColor: '#FFFFFF', desc: 'A text box that restricts input with a mask.' }),

  CheckBox: d('CheckBox', [104, 24], 'CheckBox1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'CheckBox1' },
    { name: 'Checked', type: 'bool', cat: 'Appearance', def: false },
    { name: 'CheckState', type: 'enum', cat: 'Appearance', def: 'Unchecked', options: ['Unchecked', 'Checked', 'Indeterminate'] },
    { name: 'ThreeState', type: 'bool', cat: 'Behavior', def: false },
    { name: 'AutoSize', type: 'bool', cat: 'Layout', def: true, emitAlways: true },
    { name: 'TextAlign', type: 'enum', cat: 'Appearance', def: 'MiddleLeft', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'], ns: 'System.Drawing.ContentAlignment' },
    { name: 'Appearance', type: 'enum', cat: 'Appearance', def: 'Normal', options: ['Normal', 'Button'] },
  ], E(['CheckedChanged', 'CheckStateChanged']), { backColor: 'Transparent', desc: 'A check box the user can select or clear.' }),

  RadioButton: d('RadioButton', [104, 24], 'RadioButton1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'RadioButton1' },
    { name: 'Checked', type: 'bool', cat: 'Appearance', def: false },
    { name: 'AutoSize', type: 'bool', cat: 'Layout', def: true, emitAlways: true },
    { name: 'TextAlign', type: 'enum', cat: 'Appearance', def: 'MiddleLeft', options: ['TopLeft', 'TopCenter', 'TopRight', 'MiddleLeft', 'MiddleCenter', 'MiddleRight', 'BottomLeft', 'BottomCenter', 'BottomRight'], ns: 'System.Drawing.ContentAlignment' },
  ], E(['CheckedChanged']), { backColor: 'Transparent', desc: 'A radio button; only one in a container can be selected.' }),

  ComboBox: d('ComboBox', [150, 23], '', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: '' },
    { name: 'Items', type: 'collection', cat: 'Data', def: [], coll: 'strings', desc: 'The items in the drop-down list.' },
    { name: 'DropDownStyle', type: 'enum', cat: 'Appearance', def: 'DropDown', options: ['Simple', 'DropDown', 'DropDownList'] },
    { name: 'SelectedIndex', type: 'int', cat: 'Data', def: -1 },
    { name: 'Sorted', type: 'bool', cat: 'Behavior', def: false },
    { name: 'MaxDropDownItems', type: 'int', cat: 'Behavior', def: 8 },
  ], E(['SelectedIndexChanged', 'SelectedValueChanged', 'TextChanged', 'DropDown']), { backColor: '#FFFFFF', desc: 'A drop-down list of items.' }),

  ListBox: d('ListBox', [150, 96], '', [
    { name: 'Items', type: 'collection', cat: 'Data', def: [], coll: 'strings', desc: 'The items in the list.' },
    { name: 'SelectionMode', type: 'enum', cat: 'Behavior', def: 'One', options: ['One', 'None', 'MultiSimple', 'MultiExtended'] },
    { name: 'SelectedIndex', type: 'int', cat: 'Data', def: -1 },
    { name: 'Sorted', type: 'bool', cat: 'Behavior', def: false },
    { name: 'MultiColumn', type: 'bool', cat: 'Behavior', def: false },
    { name: 'BorderStyle', type: 'enum', cat: 'Appearance', def: 'Fixed3D', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ], E(['SelectedIndexChanged', 'DoubleClick']), { backColor: '#FFFFFF', desc: 'A list of selectable items.' }),

  CheckedListBox: d('CheckedListBox', [150, 96], '', [
    { name: 'Items', type: 'collection', cat: 'Data', def: [], coll: 'strings' },
    { name: 'CheckOnClick', type: 'bool', cat: 'Behavior', def: false },
    { name: 'SelectionMode', type: 'enum', cat: 'Behavior', def: 'One', options: ['One', 'None', 'MultiSimple', 'MultiExtended'] },
  ], E(['SelectedIndexChanged', 'ItemCheck']), { backColor: '#FFFFFF', desc: 'A list with check boxes next to each item.' }),

  NumericUpDown: d('NumericUpDown', [120, 23], '0', [
    { name: 'Minimum', type: 'float', cat: 'Data', def: 0 },
    { name: 'Maximum', type: 'float', cat: 'Data', def: 100 },
    { name: 'Value', type: 'float', cat: 'Data', def: 0 },
    { name: 'DecimalPlaces', type: 'int', cat: 'Data', def: 0 },
    { name: 'Increment', type: 'float', cat: 'Data', def: 1 },
    { name: 'ThousandsSeparator', type: 'bool', cat: 'Appearance', def: false },
  ], E(['ValueChanged']), { backColor: '#FFFFFF', desc: 'A numeric spin box.' }),

  DateTimePicker: d('DateTimePicker', [200, 23], '', [
    { name: 'Format', type: 'enum', cat: 'Appearance', def: 'Short', options: ['Long', 'Short', 'Time', 'Custom'] },
    { name: 'ShowUpDown', type: 'bool', cat: 'Appearance', def: false },
    { name: 'ShowCheckBox', type: 'bool', cat: 'Behavior', def: false },
  ], E(['ValueChanged']), { backColor: '#FFFFFF', desc: 'Selects a date and/or time.' }),

  PictureBox: d('PictureBox', [120, 90], '', [
    { name: 'Image', type: 'image', cat: 'Appearance', def: '' },
    { name: 'SizeMode', type: 'enum', cat: 'Appearance', def: 'Normal', options: ['Normal', 'StretchImage', 'AutoSize', 'CenterImage', 'Zoom'] },
    { name: 'BorderStyle', type: 'enum', cat: 'Appearance', def: 'None', options: ['None', 'FixedSingle', 'Fixed3D'] },
  ], E(), { backColor: '#F7F7F7', desc: 'Displays an image.' }),

  ProgressBar: d('ProgressBar', [150, 23], '', [
    { name: 'Minimum', type: 'int', cat: 'Data', def: 0 },
    { name: 'Maximum', type: 'int', cat: 'Data', def: 100 },
    { name: 'Value', type: 'int', cat: 'Data', def: 0 },
    { name: 'Style', type: 'enum', cat: 'Appearance', def: 'Continuous', options: ['Blocks', 'Continuous', 'Marquee'] },
  ], E(), { backColor: '#E6E6E6', desc: 'Shows the progress of an operation.' }),

  TrackBar: d('TrackBar', [150, 45], '', [
    { name: 'Minimum', type: 'int', cat: 'Data', def: 0 },
    { name: 'Maximum', type: 'int', cat: 'Data', def: 10 },
    { name: 'Value', type: 'int', cat: 'Data', def: 0 },
    { name: 'TickStyle', type: 'enum', cat: 'Appearance', def: 'BottomRight', options: ['None', 'TopLeft', 'BottomRight', 'Both'] },
    { name: 'TickFrequency', type: 'int', cat: 'Appearance', def: 1 },
  ], E(['ValueChanged', 'Scroll']), { backColor: 'Transparent', desc: 'Selects a value by moving a thumb along a track.' }),

  Panel: d('Panel', [200, 100], '', [
    { name: 'BorderStyle', type: 'enum', cat: 'Appearance', def: 'None', options: ['None', 'FixedSingle', 'Fixed3D'] },
    { name: 'AutoScroll', type: 'bool', cat: 'Layout', def: false },
  ], E(['Paint']), { category: 'Containers', container: true, noText: true, desc: 'A container for grouping other controls.' }),

  GroupBox: d('GroupBox', [220, 120], 'GroupBox1', [
    { name: 'Text', type: 'string', cat: 'Appearance', def: 'GroupBox1' },
  ], E(), { category: 'Containers', container: true, backColor: 'Transparent', desc: 'A container with a caption and frame.' }),

  TabControl: d('TabControl', [280, 180], '', [
    { name: 'TabPages', type: 'collection', cat: 'Data', def: [{ text: 'TabPage1' }, { text: 'TabPage2' }], coll: 'tabpages' },
    { name: 'SelectedIndex', type: 'int', cat: 'Behavior', def: 0 },
    { name: 'Appearance', type: 'enum', cat: 'Appearance', def: 'Normal', options: ['Normal', 'Buttons', 'FlatButtons'] },
    { name: 'Alignment', type: 'enum', cat: 'Appearance', def: 'Top', options: ['Top', 'Bottom', 'Left', 'Right'] },
  ], E(['SelectedIndexChanged']), { category: 'Containers', container: true, noText: true, desc: 'A container with tabbed pages.' }),

  MenuStrip: d('MenuStrip', [320, 24], '', [
    { name: 'Items', type: 'collection', cat: 'Data', def: [{ text: 'File', items: [{ text: 'Exit' }] }, { text: 'Edit' }, { text: 'Help' }], coll: 'menuitems' },
    { name: 'Dock', type: 'enum', cat: 'Layout', def: 'Top', options: ['None', 'Top', 'Bottom', 'Left', 'Right', 'Fill'], ns: 'System.Windows.Forms' },
  ], E(['ItemClicked']), { category: 'Menus & Toolbars', noText: true, desc: 'The main menu bar of the form.' }),

  StatusStrip: d('StatusStrip', [320, 22], '', [
    { name: 'Items', type: 'collection', cat: 'Data', def: [{ text: 'Ready' }], coll: 'statusitems' },
  ], E(['ItemClicked']), { category: 'Menus & Toolbars', noText: true, desc: 'A status bar at the bottom of the form.' }),

  ToolStrip: d('ToolStrip', [320, 26], '', [
    { name: 'Items', type: 'collection', cat: 'Data', def: [{ text: 'New' }, { text: 'Open' }, { text: 'Save' }], coll: 'toolstripitems' },
    { name: 'GripStyle', type: 'enum', cat: 'Appearance', def: 'Hidden', options: ['Visible', 'Hidden'] },
  ], E(['ItemClicked']), { category: 'Menus & Toolbars', noText: true, desc: 'A toolbar with buttons.' }),

  DataGridView: d('DataGridView', [320, 160], '', [
    { name: 'Columns', type: 'collection', cat: 'Data', def: [{ text: 'Column1', width: 100 }, { text: 'Column2', width: 100 }], coll: 'columns' },
    { name: 'AllowUserToAddRows', type: 'bool', cat: 'Behavior', def: true },
    { name: 'ReadOnly', type: 'bool', cat: 'Behavior', def: false },
    { name: 'RowHeadersVisible', type: 'bool', cat: 'Appearance', def: true },
    { name: 'AutoSizeColumnsMode', type: 'enum', cat: 'Layout', def: 'None', options: ['None', 'Fill', 'DisplayedCells', 'AllCells'] },
    { name: 'BackgroundColor', type: 'color', cat: 'Appearance', def: '#FFFFFF' },
  ], E(['CellClick', 'CellDoubleClick', 'CellContentClick', 'CellValueChanged', 'SelectionChanged']), { category: 'Data', noText: true, backColor: '#FFFFFF', desc: 'Displays data in a customizable grid.' }),

  Timer: d('Timer', [32, 32], '', [
    { name: 'Interval', type: 'int', cat: 'Behavior', def: 100 },
    { name: 'Enabled', type: 'bool', cat: 'Behavior', def: false },
  ], E(['Tick']), { category: 'Components', component: true, noText: true, desc: 'Raises an event at regular intervals.' }),

  OpenFileDialog: d('OpenFileDialog', [32, 32], '', [
    { name: 'Title', type: 'string', cat: 'Appearance', def: '' },
    { name: 'Filter', type: 'string', cat: 'Behavior', def: 'All files (*.*)|*.*' },
    { name: 'FileName', type: 'string', cat: 'Data', def: '' },
    { name: 'Multiselect', type: 'bool', cat: 'Behavior', def: false },
    { name: 'CheckFileExists', type: 'bool', cat: 'Behavior', def: true },
  ], E(['FileOk']), { category: 'Dialogs', component: true, noText: true, desc: 'Displays a dialog to open a file.' }),

  SaveFileDialog: d('SaveFileDialog', [32, 32], '', [
    { name: 'Title', type: 'string', cat: 'Appearance', def: '' },
    { name: 'Filter', type: 'string', cat: 'Behavior', def: 'All files (*.*)|*.*' },
    { name: 'FileName', type: 'string', cat: 'Data', def: '' },
    { name: 'OverwritePrompt', type: 'bool', cat: 'Behavior', def: true },
  ], E(['FileOk']), { category: 'Dialogs', component: true, noText: true, desc: 'Displays a dialog to save a file.' }),

  FolderBrowserDialog: d('FolderBrowserDialog', [32, 32], '', [
    { name: 'Description', type: 'string', cat: 'Appearance', def: '' },
    { name: 'ShowNewFolderButton', type: 'bool', cat: 'Behavior', def: true },
  ], E(), { category: 'Dialogs', component: true, noText: true, desc: 'Lets the user pick a folder.' }),

  ColorDialog: d('ColorDialog', [32, 32], '', [
    { name: 'Color', type: 'color', cat: 'Appearance', def: '#000000' },
    { name: 'AllowFullOpen', type: 'bool', cat: 'Behavior', def: true },
  ], E(), { category: 'Dialogs', component: true, noText: true, desc: 'Lets the user pick a color.' }),

  FontDialog: d('FontDialog', [32, 32], '', [
    { name: 'ShowColor', type: 'bool', cat: 'Behavior', def: false },
    { name: 'FontMustExist', type: 'bool', cat: 'Behavior', def: false },
  ], E(['Apply']), { category: 'Dialogs', component: true, noText: true, desc: 'Lets the user pick a font.' }),

  ErrorProvider: d('ErrorProvider', [32, 32], '', [
    { name: 'BlinkStyle', type: 'enum', cat: 'Behavior', def: 'BlinkIfDifferentError', options: ['NeverBlink', 'AlwaysBlink', 'BlinkIfDifferentError'] },
  ], E(), { category: 'Components', component: true, noText: true, desc: 'Shows an error icon next to a control.' }),

  ToolTip: d('ToolTip', [32, 32], '', [
    { name: 'ToolTipTitle', type: 'string', cat: 'Appearance', def: '' },
    { name: 'InitialDelay', type: 'int', cat: 'Behavior', def: 500 },
    { name: 'AutoPopDelay', type: 'int', cat: 'Behavior', def: 5000 },
  ], E(['Popup']), { category: 'Components', component: true, noText: true, desc: 'Shows a tooltip when the pointer rests on a control.' }),
};

export const FORM_PROPS = [
  { name: 'Text', type: 'string', cat: 'Appearance', def: 'Form1', desc: 'The caption of the form.' },
  { name: 'BackColor', type: 'color', cat: 'Appearance', def: '#F0F0F0' },
  { name: 'ForeColor', type: 'color', cat: 'Appearance', def: '#000000' },
  { name: 'Font', type: 'font', cat: 'Appearance', def: { family: 'Segoe UI', size: 9, style: 0 } },
  { name: 'StartPosition', type: 'enum', cat: 'Layout', def: 'WindowsDefaultLocation', options: ['Manual', 'CenterScreen', 'WindowsDefaultLocation', 'WindowsDefaultBounds', 'CenterParent'], ns: 'System.Windows.Forms.FormStartPosition' },
  { name: 'FormBorderStyle', type: 'enum', cat: 'Appearance', def: 'Sizable', options: ['None', 'FixedSingle', 'Fixed3D', 'FixedDialog', 'Sizable', 'FixedToolWindow', 'SizableToolWindow'], ns: 'System.Windows.Forms.FormBorderStyle' },
  { name: 'WindowState', type: 'enum', cat: 'Behavior', def: 'Normal', options: ['Normal', 'Minimized', 'Maximized'], ns: 'System.Windows.Forms.FormWindowState' },
  { name: 'MaximizeBox', type: 'bool', cat: 'Behavior', def: true },
  { name: 'MinimizeBox', type: 'bool', cat: 'Behavior', def: true },
  { name: 'ShowInTaskbar', type: 'bool', cat: 'Behavior', def: true },
  { name: 'TopMost', type: 'bool', cat: 'Behavior', def: false },
  { name: 'KeyPreview', type: 'bool', cat: 'Behavior', def: false },
  { name: 'AcceptButton', type: 'controlref', cat: 'Behavior', def: '' },
  { name: 'CancelButton', type: 'controlref', cat: 'Behavior', def: '' },
  { name: 'Opacity', type: 'float', cat: 'Appearance', def: 1 },
];

export const FORM_EVENTS = ['Load', 'Shown', 'FormClosing', 'FormClosed', 'Click', 'DoubleClick', 'Resize', 'Activated', 'Deactivate', 'KeyDown', 'KeyPress', 'KeyUp'];

export function controlDef(type) {
  return CONTROLS[type] || null;
}

export function propsFor(type, isForm = false) {
  if (isForm) return FORM_PROPS;
  const def = CONTROLS[type];
  if (!def) return BASE;
  const base = BASE.filter(p => {
    if (def.noText && p.name === 'Text') return false;
    if (def.component && ['Anchor', 'Dock', 'TabIndex', 'Padding', 'Cursor'].includes(p.name)) return false;
    return true;
  });
  const own = def.props || [];
  const merged = [...own];
  for (const p of base) {
    if (!merged.some(x => x.name === p.name)) {
      if (p.name === 'BackColor' && def.backColor) merged.push({ ...p, def: def.backColor });
      else merged.push(p);
    }
  }
  // put Text first when present
  merged.sort((a, b) => (a.name === 'Text' ? -1 : b.name === 'Text' ? 1 : 0));
  return merged;
}

export function eventsFor(type, isForm = false) {
  if (isForm) return FORM_EVENTS;
  return CONTROLS[type]?.events || COMMON_EVENTS;
}

export function defaultsFor(type, isForm = false) {
  const out = {};
  for (const p of propsFor(type, isForm)) out[p.name] = structuredClone(p.def);
  return out;
}

export function categoriesOf(props) {
  const order = ['Appearance', 'Behavior', 'Layout', 'Data', 'Design', 'Misc'];
  const cats = [...new Set(props.map(p => p.cat))];
  cats.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return cats;
}

export function iconFor(type) {
  const map = {
    Button: '<rect x="2.5" y="5" width="11" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.1"/>',
    Label: '<path d="M4 12 8 4l4 8M5.5 9.5h5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
    LinkLabel: '<path d="M4 12 8 4l4 8M5.5 9.5h5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 14h10" stroke="currentColor" stroke-width="1.1"/>',
    TextBox: '<rect x="2.5" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 7.5h4" stroke="currentColor" stroke-width="1.1"/>',
    RichTextBox: '<rect x="2.5" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 7h6M4.5 9h4" stroke="currentColor" stroke-width="1"/>',
    MaskedTextBox: '<rect x="2.5" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 1.4"/>',
    CheckBox: '<rect x="3" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m4.5 7.5 1.4 1.4L8.5 6" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    RadioButton: '<circle cx="6" cy="7.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="7.5" r="1.3" fill="currentColor"/>',
    ComboBox: '<rect x="2.5" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m10 7 1.4 1.6L12.8 7" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    ListBox: '<rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6h5M4.5 8h5M4.5 10h3" stroke="currentColor" stroke-width="1"/>',
    CheckedListBox: '<rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 6h1M4 8h1M4 10h1M6.5 6h4M6.5 8h4M6.5 10h3" stroke="currentColor" stroke-width="1"/>',
    NumericUpDown: '<rect x="2.5" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="m10 6 1 1 1-1M10 10l1-1 1 1" fill="none" stroke="currentColor" stroke-width="1.1"/>',
    DateTimePicker: '<rect x="2.5" y="4.5" width="11" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 3.5v2M11 3.5v2M2.5 6.5h11" stroke="currentColor" stroke-width="1.1"/>',
    PictureBox: '<rect x="2.5" y="4" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="7" r="1" fill="currentColor"/><path d="m4 11 3-3 2 2 2-1.5 1.5 2.5" fill="none" stroke="currentColor" stroke-width="1.1"/>',
    ProgressBar: '<rect x="2.5" y="5.5" width="11" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 8h4" stroke="currentColor" stroke-width="3"/>',
    TrackBar: '<path d="M2.5 8h11" stroke="currentColor" stroke-width="1.2"/><rect x="6.5" y="4.5" width="3" height="7" rx="1" fill="currentColor"/>',
    Panel: '<rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6.5h11" stroke="currentColor" stroke-width="1"/>',
    GroupBox: '<rect x="2.5" y="4.5" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 3h5" stroke="currentColor" stroke-width="1.6"/>',
    TabControl: '<path d="M2.5 6.5v6h11v-6M2.5 6.5h3l1-2h4l1 2h3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
    MenuStrip: '<rect x="2.5" y="4" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6.5h11M4.5 8.5h3M8.5 8.5h3" stroke="currentColor" stroke-width="1.1"/>',
    StatusStrip: '<rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 10.5h11M4 9h4" stroke="currentColor" stroke-width="1.1"/>',
    ToolStrip: '<rect x="2.5" y="4" width="11" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6.5h11M4.5 8.5h2M7.5 8.5h2M10.5 8.5h2" stroke="currentColor" stroke-width="1.1"/>',
    DataGridView: '<rect x="2.5" y="3.5" width="11" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6h11M6 6v6.5M9.5 6v6.5M2.5 9h11" stroke="currentColor" stroke-width="1"/>',
    Timer: '<circle cx="8" cy="9" r="4.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 6.5V9l1.7 1M6 2.5h4M8 2.5v1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
    OpenFileDialog: '<path d="M2.5 5.5h4l1.5 1.5h5.5v6h-11z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 10h5M8 8v4" stroke="currentColor" stroke-width="1"/>',
    SaveFileDialog: '<path d="M3 2.5h8l2 2V13H3z" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 2.5v3.5h5V2.5M5 13v-3h6v3" fill="none" stroke="currentColor" stroke-width="1"/>',
    FolderBrowserDialog: '<path d="M2.5 5.5h4l1.5 1.5h5.5v6h-11z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    ColorDialog: '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6.5" r="1" fill="currentColor"/><circle cx="10" cy="6.5" r="1" fill="currentColor"/><circle cx="6" cy="10" r="1" fill="currentColor"/>',
    FontDialog: '<path d="M4 12 8 3l4 9M5.5 9h5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    ErrorProvider: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    ToolTip: '<path d="M2.5 4.5h11v6h-6l-2.5 2v-2h-2.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>',
  };
  const path = map[type] || '<rect x="3" y="3" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/>';
  return `<svg viewBox="0 0 16 16">${path}</svg>`;
}

export function toolboxIconChar(type) {
  return ({ Button: 'B', Label: 'A', TextBox: 'T', CheckBox: '✓', RadioButton: '◉', ComboBox: '▾', ListBox: '≡', Panel: '▭', GroupBox: '▣', TabControl: '◫', MenuStrip: '☰', StatusStrip: '▬', ToolStrip: '⚒', DataGridView: '▦', Timer: '⏱', OpenFileDialog: '📂', SaveFileDialog: '💾', FolderBrowserDialog: '📁', ColorDialog: '🎨', FontDialog: 'A', ErrorProvider: '!', ToolTip: '?' }[type] || '◆');
}
