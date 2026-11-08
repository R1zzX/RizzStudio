/* Monaco code editor integration with VB.NET snippets. */

let monaco = null;

function loadMonaco() {
  if (monaco) return Promise.resolve(monaco);
  window.MonacoEnvironment = {
    getWorkerUrl: () => '/node_modules/monaco-editor/min/vs/base/worker/workerMain.js',
  };
  window.require.config({ paths: { vs: '/node_modules/monaco-editor/min/vs' } });
  return new Promise((resolve, reject) => {
    window.require(['vs/editor/editor.main'], (m) => {
      monaco = m;
      defineTheme();
      defineCompletions();
      resolve(m);
    }, reject);
  });
}

function defineTheme() {
  monaco.editor.defineTheme('bikinstudio-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7f7a95', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'keyword.control', foreground: 'c792ea' },
      { token: 'string', foreground: 'e8c46b' },
      { token: 'number', foreground: 'f2a97e' },
      { token: 'type', foreground: '7fd6c0' },
      { token: 'identifier', foreground: 'd7d1e8' },
      { token: 'delimiter', foreground: '9d95b5' },
      { token: 'operator', foreground: 'a78bfa' },
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d7d1e8',
      'editorLineNumber.foreground': '#5c5672',
      'editorLineNumber.activeForeground': '#a78bfa',
      'editor.selectionBackground': '#4b3a75',
      'editor.inactiveSelectionBackground': '#372c55',
      'editor.lineHighlightBackground': '#262331',
      'editorCursor.foreground': '#a78bfa',
      'editorIndentGuide.background1': '#2f2b3d',
      'editorIndentGuide.activeBackground1': '#4a4360',
      'editorWidget.background': '#26232f',
      'editorWidget.border': '#4a4360',
      'editorSuggestWidget.background': '#26232f',
      'editorSuggestWidget.selectedBackground': '#4b3a75',
      'minimap.background': '#1b1a22',
      'scrollbarSlider.background': '#3f395480',
      'scrollbarSlider.hoverBackground': '#57507080',
      'editorBracketMatch.background': '#4b3a7550',
      'editorBracketMatch.border': '#8b5cf6',
    },
  });
}

function defineCompletions() {
  monaco.languages.registerCompletionItemProvider('vb', {
    triggerCharacters: ['.', ' '],
    provideCompletionItems: () => {
      const K = monaco.languages.CompletionItemKind;
      const S = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      const items = [
        { label: 'Sub', kind: K.Snippet, insertText: 'Private Sub ${1:Name}(${2:sender As Object, e As EventArgs})\n\t$0\nEnd Sub', insertTextRules: S, documentation: 'Declare a subroutine.' },
        { label: 'Function', kind: K.Snippet, insertText: 'Private Function ${1:Name}(${2:args}) As ${3:String}\n\t$0\nEnd Function', insertTextRules: S },
        { label: 'If', kind: K.Snippet, insertText: 'If ${1:condition} Then\n\t$0\nEnd If', insertTextRules: S },
        { label: 'IfElse', kind: K.Snippet, insertText: 'If ${1:condition} Then\n\t$2\nElse\n\t$0\nEnd If', insertTextRules: S },
        { label: 'For', kind: K.Snippet, insertText: 'For ${1:i} As Integer = ${2:0} To ${3:10}\n\t$0\nNext', insertTextRules: S },
        { label: 'ForEach', kind: K.Snippet, insertText: 'For Each ${1:item} As ${2:String} In ${3:collection}\n\t$0\nNext', insertTextRules: S },
        { label: 'While', kind: K.Snippet, insertText: 'While ${1:condition}\n\t$0\nEnd While', insertTextRules: S },
        { label: 'Try', kind: K.Snippet, insertText: 'Try\n\t$1\nCatch ex As Exception\n\tMessageBox.Show(ex.Message)\nEnd Try', insertTextRules: S },
        { label: 'Select', kind: K.Snippet, insertText: 'Select Case ${1:value}\n\tCase ${2:1}\n\t\t$0\n\tCase Else\nEnd Select', insertTextRules: S },
        { label: 'Class', kind: K.Snippet, insertText: 'Public Class ${1:Name}\n\t$0\nEnd Class', insertTextRules: S },
        { label: 'MsgBox', kind: K.Snippet, insertText: 'MsgBox(${1:"Hello"}, MsgBoxStyle.Information, ${2:"Rizz Studio"})', insertTextRules: S },
        { label: 'MessageBox.Show', kind: K.Snippet, insertText: 'MessageBox.Show(${1:"Hello"}, ${2:"Title"}, MessageBoxButtons.OK, MessageBoxIcon.Information)', insertTextRules: S },
        { label: 'Handles', kind: K.Snippet, insertText: 'Handles ${1:Control}.${2:Click}', insertTextRules: S },
        { label: 'Dim', kind: K.Snippet, insertText: 'Dim ${1:name} As ${2:String} = ${3:""}', insertTextRules: S },
        { label: 'With', kind: K.Snippet, insertText: 'With ${1:object}\n\t$0\nEnd With', insertTextRules: S },
      ];
      const kws = ['AddHandler', 'AddressOf', 'AndAlso', 'As', 'Boolean', 'Byte', 'ByRef', 'ByVal', 'Call', 'Case', 'Catch', 'CBool', 'CByte', 'CDate', 'CDbl', 'CInt', 'CLng', 'CStr', 'Class', 'Const', 'Continue', 'Date', 'Decimal', 'Declare', 'Delegate', 'Dim', 'DirectCast', 'Do', 'Double', 'Each', 'Else', 'ElseIf', 'End', 'Enum', 'Erase', 'Error', 'Event', 'Exit', 'False', 'Finally', 'For', 'Friend', 'Function', 'Get', 'GetType', 'Global', 'GoSub', 'GoTo', 'Handles', 'If', 'Implements', 'Imports', 'In', 'Inherits', 'Integer', 'Interface', 'Is', 'IsNot', 'Let', 'Lib', 'Like', 'Long', 'Loop', 'Me', 'Mod', 'Module', 'MustInherit', 'MyBase', 'MyClass', 'Namespace', 'Narrowing', 'New', 'Next', 'Not', 'Nothing', 'NotInheritable', 'NotOverridable', 'Object', 'Of', 'On', 'Operator', 'Option', 'Optional', 'Or', 'OrElse', 'Overloads', 'Overridable', 'Overrides', 'ParamArray', 'Partial', 'Private', 'Property', 'Protected', 'Public', 'RaiseEvent', 'ReadOnly', 'ReDim', 'REM', 'RemoveHandler', 'Resume', 'Return', 'Select', 'Set', 'Shadows', 'Shared', 'Short', 'Single', 'Static', 'Step', 'Stop', 'String', 'Structure', 'Sub', 'SyncLock', 'Then', 'Throw', 'To', 'True', 'Try', 'TypeOf', 'UInteger', 'ULong', 'UShort', 'Using', 'Variant', 'Wend', 'When', 'While', 'Widening', 'With', 'WithEvents', 'WriteOnly', 'Xor'];
      for (const k of kws) items.push({ label: k, kind: K.Keyword, insertText: k });
      const controls = ['Button', 'Label', 'TextBox', 'CheckBox', 'RadioButton', 'ComboBox', 'ListBox', 'Panel', 'GroupBox', 'TabControl', 'MenuStrip', 'StatusStrip', 'ToolStrip', 'DataGridView', 'Timer', 'OpenFileDialog', 'SaveFileDialog', 'PictureBox', 'ProgressBar'];
      for (const c of controls) items.push({ label: c, kind: K.Class, insertText: c });
      return { suggestions: items };
    },
  });
}

export class CodeEditor {
  constructor(app) {
    this.app = app;
    this.editor = null;
    this.models = new Map();
    this.path = null;
    this.suppress = false;
    this.ready = false;
  }

  async init() {
    await loadMonaco();
    const host = document.getElementById('editor-host');
    this.editor = monaco.editor.create(host, {
      theme: 'bikinstudio-dark',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "DejaVu Sans Mono", monospace',
      fontLigatures: true,
      minimap: { enabled: true, renderCharacters: false, maxColumn: 90 },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      renderLineHighlight: 'all',
      roundedSelection: false,
      padding: { top: 8 },
      lineNumbersMinChars: 4,
      glyphMargin: false,
      folding: true,
      tabSize: 4,
      insertSpaces: true,
      wordWrap: 'off',
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: true },
      suggest: { showWords: true, snippetsPreventQuickSuggestions: false },
      fixedOverflowWidgets: true,
    });
    this.editor.onDidChangeModelContent(() => {
      if (this.suppress || !this.path) return;
      this.app.onEditorChange(this.path, this.editor.getValue());
    });
    this.editor.onDidChangeCursorPosition((e) => {
      this.app.updateCursor(e.position.lineNumber, e.position.column);
      this.updateBreadcrumb();
    });
    this.ready = true;
    return this;
  }

  languageFor(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (ext === 'vb') return 'vb';
    if (ext === 'xml' || ext === 'vbproj' || ext === 'sln' || ext === 'config' || ext === 'manifest') return 'xml';
    if (ext === 'json') return 'json';
    if (ext === 'md') return 'markdown';
    if (ext === 'css') return 'css';
    if (ext === 'html') return 'html';
    return 'plaintext';
  }

  open(path, content, opts = {}) {
    if (!this.ready) return;
    let model = this.models.get(path);
    if (!model) {
      model = monaco.editor.createModel(content ?? '', this.languageFor(path));
      this.models.set(path, model);
      model.onDidChangeContent(() => {
        if (this.suppress || this.path !== path) return;
        this.app.onEditorChange(path, model.getValue());
      });
    } else if (content !== undefined && model.getValue() !== content) {
      this.suppress = true;
      model.setValue(content);
      this.suppress = false;
    }
    if (this.path !== path) this.editor.setModel(model);
    this.path = path;
    this.editor.updateOptions({ readOnly: !!opts.readOnly });
    this.updateBreadcrumb();
    if (opts.line) this.revealLine(opts.line);
    this.editor.focus();
  }

  updateBreadcrumb() {
    const bc = document.getElementById('editor-breadcrumb');
    if (!bc || !this.path) return;
    const pos = this.editor.getPosition();
    const parts = this.path.split('/').filter(Boolean);
    const name = parts.pop() || this.path;
    const line = pos?.lineNumber || 1;
    bc.innerHTML = `<span>${parts.slice(-2).join(' / ') || 'Project'}</span><span class="bc-sep">›</span><span class="bc-cur">${name}</span><span class="bc-sep">›</span><span>Ln ${line}, Col ${pos?.column || 1}</span>`;
  }

  revealLine(line) {
    if (!this.editor) return;
    this.editor.revealLineInCenter(line);
    this.editor.setPosition({ lineNumber: line, column: 1 });
    this.editor.focus();
  }

  getValue(path) {
    const m = this.models.get(path);
    return m ? m.getValue() : '';
  }

  setValue(path, value) {
    const m = this.models.get(path);
    if (!m) return;
    this.suppress = true;
    m.setValue(value);
    this.suppress = false;
  }

  /* Drop every cached Monaco model. Called when switching projects so a new
     project never reads stale buffer contents from the previous one. */
  clearModels() {
    for (const m of this.models.values()) m.dispose();
    this.models.clear();
    this.path = null;
    if (this.editor) this.editor.setModel(null);
  }

  setFontSize(n) {
    if (this.editor) this.editor.updateOptions({ fontSize: n });
  }

  focus() { if (this.editor) this.editor.focus(); }

  layout() { if (this.editor) this.editor.layout(); }
}
