// ==UserScript==
// @name         LinkedIn — Better post composer
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.2.0
// @description  Makes the "Start a post" dialog fill the window; adds Bold and Italic buttons (Cmd/Ctrl+B, Cmd/Ctrl+I, which also work in comments) that restyle the selection with Unicode letters; shows attached images as a row of thumbnails at the bottom; counts words and characters against the 3,000 characters limit.
// @match        https://www.linkedin.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // LinkedIn rejects posts longer than this.
  const MAX_CHARS = 3000;
  // The counter turns orange past this share of MAX_CHARS.
  const WARN_RATIO = 0.9;
  // Height of the attached images, shown side by side (LinkedIn shows one full width).
  const THUMB_HEIGHT = '120px';
  // Space above and below the dialog.
  const DIALOG_MARGIN = '3vh';

  const EDITOR = '[componentkey="ShareBox_textEditor"]';
  const DIALOG = 'data-lkp-dialog'; // the compose dialog
  const FORMAT = 'data-lkp-format'; // Bold / Italic buttons
  const COUNTER = 'data-lkp-counter';
  // The chain from the editor up to the dialog stretches so that the editor takes the free height
  // and the images sit at the bottom: "col" grows in a flex column, "row" / "grid" stretches.
  const GROW = 'data-lkp-grow';
  const AS_FLEX = 'data-lkp-flex'; // block turned into a flex column so that its child can grow
  const ROW = 'data-lkp-row'; // the images, side by side
  const FLAT = 'data-lkp-flat'; // wrapper of LinkedIn's image grid, flattened into the row
  const THUMB = 'data-lkp-thumb'; // one image
  const FIT = 'data-lkp-fit'; // wrappers of the row, shrunk to it

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    dialog[${DIALOG}] {
      width: min(1280px, 96vw) !important;
      max-width: none !important;
      top: ${DIALOG_MARGIN} !important;
      height: calc(100vh - 2 * ${DIALOG_MARGIN}) !important;
      max-height: none !important;
    }
    [${AS_FLEX}] { display: flex !important; flex-direction: column !important; }
    [${GROW}="col"] { flex-grow: 1 !important; }
    [${GROW}="row"], [${GROW}="grid"] { align-self: stretch !important; height: auto !important; }
    [${ROW}] {
      display: flex !important; flex-flow: row wrap !important; gap: 4px !important;
      width: auto !important; height: auto !important; aspect-ratio: auto !important;
    }
    [${FLAT}] { display: contents !important; }
    [${THUMB}] {
      flex: none !important; height: ${THUMB_HEIGHT} !important; width: auto !important;
    }
    [${FIT}] {
      width: fit-content !important; max-width: 100%;
      height: auto !important; aspect-ratio: auto !important;
    }
    [${FORMAT}] { display: flex; align-items: center; gap: 4px; }
    [${FORMAT}] button {
      width: 40px; height: 40px; border: none; border-radius: 50%;
      background: transparent; color: inherit; cursor: pointer;
      font: 20px/1 Georgia, serif;
    }
    [${FORMAT}] button:hover { background: rgba(0, 0, 0, 0.08); }
    [${FORMAT}] button[data-style="bold"] { font-weight: 700; }
    [${FORMAT}] button[data-style="italic"] { font-style: italic; }
    [${COUNTER}] {
      align-self: center; white-space: nowrap;
      font-size: 14px; color: rgba(0, 0, 0, 0.6);
      font-variant-numeric: tabular-nums;
    }
    [${COUNTER}][data-level="warn"] { color: #b24020; }
    [${COUNTER}][data-level="over"] { color: #cc1016; font-weight: 600; }
  `;
  document.head.append(style);

  // ---------- Unicode bold / italic ----------
  // LinkedIn posts are plain text: "bold" and "italic" are the sans-serif letters of the
  // Mathematical Alphanumeric Symbols block. Italic has no digits; accents stay combining marks.
  const ALPHABETS = [
    // [first code point of A-Z, of a-z, of 0-9 (or null)] for plain, bold, italic, bold italic
    { bold: false, italic: false, upper: 0x41, lower: 0x61, digit: 0x30 },
    { bold: true, italic: false, upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
    { bold: false, italic: true, upper: 0x1d608, lower: 0x1d622, digit: null },
    { bold: true, italic: true, upper: 0x1d63c, lower: 0x1d656, digit: null },
  ];
  // Code point -> { base, bold, italic }; base is the plain character.
  const decoded = new Map();
  for (const a of ALPHABETS) {
    for (let i = 0; i < 26; i++) {
      decoded.set(a.upper + i, { base: 0x41 + i, bold: a.bold, italic: a.italic });
      decoded.set(a.lower + i, { base: 0x61 + i, bold: a.bold, italic: a.italic });
    }
    if (a.digit) {
      for (let i = 0; i < 10; i++) decoded.set(a.digit + i, { base: 0x30 + i, bold: a.bold, italic: a.italic });
    }
  }
  const isDigit = (base) => base >= 0x30 && base <= 0x39;
  const canTake = (base, kind) => kind === 'bold' || !isDigit(base);

  const encode = ({ base, bold, italic }) => {
    if (isDigit(base)) return String.fromCodePoint(bold ? 0x1d7ec + base - 0x30 : base);
    const a = ALPHABETS.find((x) => x.bold === bold && x.italic === italic);
    const upper = base <= 0x5a;
    return String.fromCodePoint((upper ? a.upper : a.lower) + base - (upper ? 0x41 : 0x61));
  };

  // True when every letter (or digit, for bold) of the text already has the style.
  const hasStyle = (text, kind) => {
    let styleable = 0;
    for (const ch of text.normalize('NFD')) {
      const d = decoded.get(ch.codePointAt(0));
      if (!d || !canTake(d.base, kind)) continue;
      styleable++;
      if (!d[kind]) return false;
    }
    return styleable > 0;
  };

  const restyle = (text, kind, on) => {
    let out = '';
    for (const ch of text.normalize('NFD')) {
      const d = decoded.get(ch.codePointAt(0));
      out += d && canTake(d.base, kind) ? encode({ ...d, [kind]: on }) : ch;
    }
    return out.normalize('NFC');
  };

  // Restyles the text nodes of the selection in place; ProseMirror reads the change back from
  // the DOM, as it does for spellcheck corrections, so it is undoable.
  const applyStyle = (editor, kind) => {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

    const parts = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!range.intersectsNode(node)) continue;
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (end > start) parts.push({ node, start, end });
    }
    if (!parts.length) return;

    const on = !hasStyle(parts.map((p) => p.node.data.slice(p.start, p.end)).join(''), kind);
    for (const p of parts) {
      const text = restyle(p.node.data.slice(p.start, p.end), kind, on);
      p.node.data = p.node.data.slice(0, p.start) + text + p.node.data.slice(p.end);
      p.end = p.start + text.length;
    }
    const first = parts[0];
    const last = parts[parts.length - 1];
    sel.setBaseAndExtent(first.node, first.start, last.node, last.end);
  };

  // Cmd/Ctrl+B and Cmd/Ctrl+I in the editor, and in comment boxes.
  document.addEventListener(
    'keydown',
    (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const kind = { b: 'bold', i: 'italic' }[e.key.toLowerCase()];
      const editor = kind && e.target instanceof Element && e.target.closest(`${EDITOR}, [contenteditable="true"]`);
      if (!editor) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      applyStyle(editor, kind);
    },
    true,
  );

  // ---------- Counter ----------
  // The post text as LinkedIn sends it: one line per paragraph.
  const postText = (editor) =>
    [...editor.children]
      .map((block) => {
        let text = '';
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.nodeType === Node.TEXT_NODE) text += node.data;
          else if (node.tagName === 'BR' && !node.classList.contains('ProseMirror-trailingBreak')) text += '\n';
        }
        return text;
      })
      .join('\n');

  const updateCounter = (editor) => {
    const counter = editor.closest('dialog')?.querySelector(`[${COUNTER}]`);
    if (!counter) return;
    const text = postText(editor);
    // UTF-16 code units, as JavaScript and LinkedIn count: emoji and bold/italic letters count 2.
    const chars = text.length;
    const words = (text.match(/\S+/g) || []).length;
    counter.textContent = `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'} · ${chars.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
    counter.dataset.level = chars > MAX_CHARS ? 'over' : chars > MAX_CHARS * WARN_RATIO ? 'warn' : '';
  };

  // ---------- Layout ----------
  const layoutParent = (el) => {
    let p = el.parentElement;
    while (p && getComputedStyle(p).display === 'contents') p = p.parentElement;
    return p;
  };

  // Stretches every box from the editor up to the dialog, whatever its display.
  const fillHeight = (dialog, editor) => {
    for (let el = editor; el && el !== dialog; el = el.parentElement) {
      const display = getComputedStyle(el).display;
      if (display === 'contents') continue;
      if (el !== editor && display === 'block') el.setAttribute(AS_FLEX, '');
      const p = layoutParent(el);
      const ps = getComputedStyle(p);
      const kind = ps.display.includes('grid')
        ? 'grid'
        : ps.display.includes('flex') && !p.hasAttribute(AS_FLEX) && !ps.flexDirection.startsWith('column')
          ? 'row'
          : 'col';
      el.setAttribute(GROW, kind);
    }
  };

  // LinkedIn shows the first image large and the others below it, cropped to fit the grid: put
  // them in one row of thumbnails, each with its own proportions.
  const layoutImages = (dialog) => {
    const card = dialog.querySelector('#ShareBoxpreviewCard');
    const figures = card ? [...card.querySelectorAll('figure')] : [];
    if (!figures.length) return;
    // A thumbnail is the figure, or its wrapper when that only holds it (with the "+N" overlay).
    const thumbs = figures.map((f) =>
      f.parentElement !== card && f.parentElement.querySelectorAll('figure').length === 1 ? f.parentElement : f,
    );
    let row = thumbs[0].parentElement;
    while (row !== card && !thumbs.every((t) => row.contains(t))) row = row.parentElement;
    if (row === card) return;
    row.setAttribute(ROW, '');
    for (const thumb of thumbs) {
      thumb.setAttribute(THUMB, '');
      for (let el = thumb.parentElement; el !== row; el = el.parentElement) el.setAttribute(FLAT, '');
      const img = thumb.querySelector('img');
      if (img?.naturalWidth) thumb.style.setProperty('aspect-ratio', `${img.naturalWidth} / ${img.naturalHeight}`, 'important');
    }
    for (let el = row.parentElement; el !== card; el = el.parentElement) el.setAttribute(FIT, '');
  };

  // ---------- Setup ----------
  const formatButtons = () => {
    const group = document.createElement('div');
    group.setAttribute(FORMAT, '');
    for (const [kind, label, key] of [
      ['bold', 'B', 'B'],
      ['italic', 'I', 'I'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.style = kind;
      button.textContent = label;
      button.title = `${kind[0].toUpperCase()}${kind.slice(1)} (${navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl+'}${key})`;
      // Keep the focus and the selection in the editor.
      button.addEventListener('mousedown', (e) => e.preventDefault());
      button.addEventListener('click', () => {
        const current = button.closest('dialog')?.querySelector(EDITOR);
        if (current) applyStyle(current, kind);
      });
      group.append(button);
    }
    return group;
  };

  const watched = new WeakSet();

  const setup = () => {
    for (const editor of document.querySelectorAll(EDITOR)) {
      const dialog = editor.closest('dialog');
      if (!dialog) continue;
      dialog.setAttribute(DIALOG, '');
      fillHeight(dialog, editor);
      layoutImages(dialog);

      if (!dialog.querySelector(`[${COUNTER}]`) || !dialog.querySelector(`[${FORMAT}]`)) {
        // LinkedIn re-rendered part of the footer: put both back.
        dialog.querySelectorAll(`[${COUNTER}], [${FORMAT}]`).forEach((el) => el.remove());
        const counter = document.createElement('div');
        counter.setAttribute(COUNTER, '');
        const buttons = formatButtons();
        // The footer row holding the emoji / media buttons, just above the separator of the Post
        // button: the Bold / Italic buttons go after the icons, the counter to the right.
        const row = dialog.querySelector('hr[role="presentation"]')?.previousElementSibling;
        const icons = row?.querySelector('button[aria-label="Show Emoji Picker"]') && row.firstElementChild;
        if (icons) {
          icons.append(buttons);
          row.append(counter);
        } else {
          const bar = document.createElement('div');
          bar.style.cssText = 'display: flex; justify-content: space-between; padding: 0 16px;';
          bar.append(buttons, counter);
          editor.closest('[data-testid="ui-core-tiptap-text-editor-wrapper"]')?.before(bar);
        }
        updateCounter(editor);
      }

      if (!watched.has(dialog)) {
        watched.add(dialog);
        // Image proportions are known once they load.
        dialog.addEventListener('load', schedule, true);
      }

      if (!watched.has(editor)) {
        watched.add(editor);
        let pending = false;
        new MutationObserver(() => {
          if (pending) return;
          pending = true;
          requestAnimationFrame(() => {
            pending = false;
            updateCounter(editor);
          });
        }).observe(editor, { childList: true, subtree: true, characterData: true });
      }
    }
  };

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      setup();
    });
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  setup();
})();
