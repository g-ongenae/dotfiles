// ==UserScript==
// @name         Google Meet — Keyboard shortcuts
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.3.1
// @description  Drives a Google Meet call from the keyboard: c opens the chat with the cursor in its message box (Esc leaves it, Cmd/Ctrl+Esc closes the chat), m mutes / unmutes the sound of the call (not your microphone), h hides / shows your own video, v switches to the next layout, f toggles full screen, s the captions, t the translation, p presents your screen, l reacts with a thumbs up, r opens Meet's emoji picker (held: 1 – 9 picks one of Meet's reactions) and ? lists the shortcuts.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/google-meet-keyboard.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://meet.google.com/*
// @match        https://chat.google.com/*
// @match        https://mail.google.com/chat/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // How long to wait for something Meet opens (chat, menu, reactions row, …)
  const WAIT_MS = 3000;
  // Holding r this long shows the reactions to pick from instead of Meet's emoji picker
  const HOLD_MS = 350;

  // Labels of Meet's buttons and menu items, in English and French
  const CHAT = /^(chat with everyone|discuter avec tous les participants)\b|^(chat|chat dans l['’]appel)$/i;
  const MORE_OPTIONS = /^(more options|plus d['’]options|autres options)$/i;
  // The options button of a tile ("Plus d'options pour <name>"), naming who it is for
  const TILE_OPTIONS = /^(?:more options for|plus d['’]options pour|autres options pour) (.+)$/i;
  const CHANGE_LAYOUT =
    /^(change layout|adjust view|modifier la vue|modifier la mise en page|changer la mise en page)$/i;
  const REACTIONS_TOGGLE = /^(send a reaction|reactions|envoyer une réaction|réactions)\b/i;
  // The captions and translation panel of the bottom bar, and its two switches
  const CAPTIONS_PANEL = /sous-titres|captions|tradu|translat|langu/i;
  // (not anchored: a switch's text may start with its icon's name)
  const CAPTIONS = /\b((activer|désactiver) (les )?sous-titres|turn (on|off) captions|(show|hide) captions)/i;
  const TRANSLATION =
    /\b(traduire ce|arrêter de traduire|ne plus traduire|désactiver la traduction|translate what|stop translating|turn (on|off) translation)/i;
  const MINIMIZE = /^(minimi[sz]e|réduire)$/i;
  const RESTORE = /^(maximi[sz]e|expand|restore|agrandir|développer|restaurer)\b/i;
  // The notice Meet shows once your video is minimized
  const MINIMIZED_NOTICE = /toujours envoyée|still (being )?(sent|shared|visible)/i;
  // Never clicked while looking for the reactions' "more emojis" button
  const LEAVE_CALL = /quitter|raccrocher|leave|hang ?up/i;
  const PRESENT =
    /^(present now|share screen|stop presenting|you are presenting|présenter maintenant|présenter|partager (l['’]|votre )?écran|arrêter (la présentation|de présenter)|vous présentez)\b/i;
  const CLOSE = /^(close|fermer)\b/i;
  const THUMBS_UP = '👍';
  // Meet's reactions row, in its order, for r held
  const REACTIONS = ['💖', '👍', '🎉', '👏', '😂', '😮', '😢', '🤔', '👎'];
  const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
  const EDITOR = 'textarea, [contenteditable=""], [contenteditable="true"]';
  // Messages between Meet and the chat, which Google Chat shows in a frame
  const MSG = 'meet-keyboard';
  const MEET = 'https://meet.google.com';
  const CHAT_ORIGINS = [MEET, 'https://chat.google.com', 'https://mail.google.com'];
  const BUSY = 'data-mgk-busy'; // on <html> while the script goes through Meet's menus

  const visible = (el) => el.getClientRects().length > 0;

  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Resolves with what `find` returns once it returns something, or null after WAIT_MS
  function waitFor(find) {
    return new Promise((resolve) => {
      const found = find();
      if (found) return resolve(found);
      const done = (value) => {
        observer.disconnect();
        clearTimeout(timer);
        resolve(value);
      };
      // At most once a frame: the videos change the page all the time
      let pending = false;
      const observer = new MutationObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          const el = find();
          if (el) done(el);
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      const timer = setTimeout(() => done(null), WAIT_MS);
    });
  }

  const editorIn = (doc) => [...doc.querySelectorAll(EDITOR)].find(visible) || null;

  // ---------- Chat frame ----------
  // Inside the chat's frame: Meet asks to put the cursor in the message box; Esc gives the keyboard
  // back to Meet and Cmd/Ctrl+Esc closes the chat
  if (window.top !== window) {
    // Google Chat's frames elsewhere (Gmail, …) are left alone
    let inMeet = location.ancestorOrigins
      ? [...location.ancestorOrigins].includes(MEET)
      : document.referrer.startsWith(MEET);
    window.addEventListener('message', async (e) => {
      if (e.origin !== MEET || e.data?.[MSG] !== 'focus') return;
      inMeet = true;
      (await waitFor(() => editorIn(document)))?.focus();
    });
    window.addEventListener(
      'keydown',
      (e) => {
        if (!inMeet || e.key !== 'Escape' || e.isComposing) return;
        swallow(e);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.top.postMessage({ [MSG]: e.metaKey || e.ctrlKey ? 'close' : 'leave' }, MEET);
      },
      true,
    );
    return;
  }
  if (location.origin !== MEET) return;

  const isMac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  const MOD = isMac ? '⌘' : 'Ctrl+';

  const SHORTCUTS = [
    ['c', 'Open the chat, with the cursor in its message box'],
    ['Esc', 'Leave the message box'],
    [`${MOD}Esc`, 'Close the chat'],
    ['m', 'Mute / unmute the sound of the call (not your microphone)'],
    ['h', 'Hide / show your own video'],
    ['v', 'Next layout: Auto, Tiled, Spotlight, Sidebar'],
    ['f', 'Full screen on / off'],
    ['s', 'Captions on / off'],
    ['t', 'Translation on / off'],
    ['p', 'Present your screen / stop presenting'],
    ['l', `React with ${THUMBS_UP}`],
    ['r', 'Open Meet’s emoji picker, the cursor in its search'],
    ['r (held)', `Then 1 – 9 to react with ${REACTIONS.join(' ')}; any other key cancels`],
    [`${MOD}D`, 'Turn your microphone on / off (Meet)'],
    [`${MOD}E`, 'Turn your camera on / off (Meet)'],
    [isMac ? '⌃⌘H' : 'Ctrl+Alt+H', 'Raise / lower your hand (Meet)'],
    ['?', 'Show / hide this list'],
  ];

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    /* The menus and dialogs the script goes through stay out of sight */
    html[${BUSY}] :is([role="menu"], [role="dialog"]) { opacity: 0 !important; }
  `;
  document.head.append(style);

  // The help, the reaction picker and the messages live in a shadow root outside <body>, out of
  // Meet's reach
  const host = document.createElement('div');
  const ui = host.attachShadow({ mode: 'open' });
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    :host { all: initial; }
    .help {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.5);
    }
    .panel, .picker, .toast, .badge {
      background: #2d2e31; color: #e3e3e3;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      font: 14px/1.4 -apple-system, system-ui, sans-serif;
    }
    .panel { min-width: 360px; max-height: 90vh; overflow: auto; padding: 20px 24px; border-radius: 12px; }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
    table { border-collapse: collapse; }
    td { padding: 3px 0; vertical-align: top; }
    td:first-child { padding-right: 20px; white-space: nowrap; }
    kbd {
      display: inline-block; min-width: 1.6em; padding: 1px 6px; text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.25); border-bottom-width: 2px; border-radius: 4px;
      background: #3c4043; font: 13px ui-monospace, monospace; white-space: pre;
    }
    .picker {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 120px; transform: translateX(-50%);
      padding: 8px 10px 6px; border-radius: 20px; text-align: center;
    }
    .picker div { display: flex; gap: 4px; }
    .picker p { margin: 0 0 4px; font-size: 12px; opacity: 0.8; }
    .picker span { display: flex; flex-direction: column; align-items: center; width: 44px; font-size: 24px; }
    .picker kbd { margin-top: 2px; min-width: 0; font-size: 11px; }
    .toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      padding: 10px 16px; border-radius: 8px;
    }
    .badge {
      position: fixed; z-index: 2147483647; left: 50%; top: 12px; transform: translateX(-50%);
      padding: 6px 14px; border-radius: 16px; background: #b3261e; color: #fff; pointer-events: none;
    }
  `;
  ui.append(uiStyle);

  function show(el) {
    if (!host.isConnected) document.documentElement.append(host);
    ui.append(el);
  }

  let toastTimer = 0;
  function toast(text) {
    ui.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    show(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2500);
  }

  // ---------- Helpers ----------
  const labelOf = (b) =>
    b.getAttribute('aria-label') || b.getAttribute('data-tooltip') || b.getAttribute('title') || '';
  const byLabel = (root, rx) =>
    [...root.querySelectorAll('button, [role="button"]')].find((b) => visible(b) && rx.test(labelOf(b).trim()));

  // The visible clickable element whose own text matches `rx` (menu items have no label)
  function byText(rx, root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!rx.test(n.nodeValue.trim())) continue;
      const el =
        n.parentElement.closest('button, a, [role="menuitem"], [role="menuitemradio"], [role="button"], li') ||
        n.parentElement;
      if (visible(el)) return el;
    }
    return null;
  }

  // Esc for Meet (to close its menus and dialogs), ignored by the handler below
  let escaping = false;
  function escape() {
    escaping = true;
    (document.activeElement || document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
    );
    escaping = false;
  }

  // Runs `task` with Meet's menus and dialogs out of sight
  async function busy(task) {
    document.documentElement.setAttribute(BUSY, '');
    try {
      return await task();
    } finally {
      document.documentElement.removeAttribute(BUSY);
    }
  }

  // Opens a menu and clicks its item matching `rx`; false when there is none
  async function menuItem(button, rx) {
    if (!button) return false;
    button.click();
    const item = await waitFor(() => byText(rx));
    if (item) {
      item.click();
      return true;
    }
    escape();
    return false;
  }

  // The visible buttons matching `rx` in the nearest block around `from` that has one, without
  // climbing past the videos' block
  function near(from, rx, skip) {
    const main = document.querySelector('main');
    for (let el = from?.parentElement; el && el !== document.body && !el.contains(main); el = el.parentElement) {
      const found = [...el.querySelectorAll('button, [role="button"]')].find(
        (b) => b !== skip && visible(b) && rx.test((labelOf(b) || b.textContent).trim()),
      );
      if (found) return found;
    }
    return null;
  }

  // Gives the keyboard back to the page, so that Meet's bar can fade out again
  function blur() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  // Clicks Meet's button matching `rx`, else the item of its "More options" menu
  async function command(rx, missing) {
    const button = byLabel(document, rx);
    if (button) return button.click();
    if (!(await busy(() => menuItem(byLabel(document, MORE_OPTIONS), rx)))) toast(missing);
  }

  // ---------- Chat ----------
  // The message box, or the frame of Google Chat holding it
  function chatTarget() {
    return (
      editorIn(document) ||
      [...document.querySelectorAll('iframe')].find((f) => {
        const r = f.getBoundingClientRect();
        return r.width > 150 && r.height > 150;
      }) ||
      null
    );
  }

  function focusChat(target) {
    target.focus();
    if (target.tagName !== 'IFRAME') return;
    try {
      const box = target.contentDocument && editorIn(target.contentDocument);
      if (box) return box.focus();
    } catch {
      /* cross-origin */
    }
    target.contentWindow.postMessage({ [MSG]: 'focus' }, '*');
  }

  async function chat() {
    let target = chatTarget();
    if (!target) {
      const button = byLabel(document, CHAT);
      if (!button) return toast('No chat button found');
      button.click();
      target = await waitFor(chatTarget);
    }
    if (target) focusChat(target);
  }

  // Gives the keyboard back to Meet, so that the shortcuts work again
  function leaveChat() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.focus();
  }

  function closeChat() {
    const button = byLabel(document, CHAT);
    leaveChat();
    if (button && (button.getAttribute('aria-pressed') === 'true' || chatTarget())) button.click();
  }

  window.addEventListener('message', (e) => {
    if (!CHAT_ORIGINS.includes(e.origin)) return;
    if (e.data?.[MSG] === 'leave') leaveChat();
    else if (e.data?.[MSG] === 'close') closeChat();
  });

  // ---------- Sound ----------
  // Mutes every <audio> and <video> of the page, including the ones Meet adds or swaps while muted.
  // Only what the script muted is unmuted again: your own video stays muted, or you would hear yourself.
  let soundOff = false;
  const silenced = new Set();
  let badge = null;

  function silence(el) {
    if (el.muted) return;
    el.muted = true;
    silenced.add(el);
  }

  function toggleSound() {
    soundOff = !soundOff;
    if (soundOff) {
      document.querySelectorAll('audio, video').forEach(silence);
      badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = '🔇 Call sound off — m to turn it back on';
      show(badge);
    } else {
      for (const el of silenced) el.muted = false;
      silenced.clear();
      badge?.remove();
      badge = null;
    }
    toast(soundOff ? 'Call sound off (your microphone is unchanged)' : 'Call sound on');
  }

  for (const type of ['play', 'volumechange', 'loadedmetadata']) {
    document.addEventListener(
      type,
      (e) => {
        if (soundOff && e.target instanceof HTMLMediaElement) silence(e.target);
      },
      true,
    );
  }

  // ---------- Own video ----------
  // Your camera's track comes from a device; with Meet's effects on, it is drawn on a canvas instead,
  // but your video is still mirrored
  function isOwnVideo(video) {
    const tracks = video.srcObject?.getVideoTracks?.() || [];
    if (tracks.some((t) => t.getSettings?.().deviceId)) return true;
    return /^matrix(3d)?\(-1,/.test(getComputedStyle(video).transform);
  }

  const tileOptions = (root) =>
    [...root.querySelectorAll('button, [role="button"]')].find((b) => TILE_OPTIONS.test(labelOf(b).trim()));

  // Your name, read on your tile's options button: it labels the bar Meet leaves once minimized
  let ownName = '';

  // The options button of your tile. Meet only adds it while the mouse is over the tile: pretend so.
  async function ownOptions() {
    const video = [...document.querySelectorAll('video')].find((v) => visible(v) && isOwnVideo(v));
    if (!video) return null;
    let tile = video.parentElement;
    while (
      tile.parentElement &&
      tile.parentElement !== document.body &&
      !tileOptions(tile) &&
      !tile.matches('[data-participant-id], [data-requested-participant-id]')
    )
      tile = tile.parentElement;
    for (const type of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove']) {
      video.dispatchEvent(new MouseEvent(type, { bubbles: true, view: window }));
    }
    const button = await waitFor(() => tileOptions(tile));
    const name = button && labelOf(button).trim().match(TILE_OPTIONS)[1];
    if (name) ownName = name;
    return button;
  }

  // The button bringing your video back: in the small bar named after you, else by its label
  function restoreButton() {
    if (ownName) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeValue.trim() !== ownName || !visible(n.parentElement)) continue;
        for (let el = n.parentElement, i = 0; el && i < 5; el = el.parentElement, i++) {
          if (el.getBoundingClientRect().height > 80) break;
          const buttons = [...el.querySelectorAll('button, [role="button"]')].filter(visible);
          if (buttons.length) return buttons[buttons.length - 1];
        }
      }
    }
    return byLabel(document, RESTORE);
  }

  // Closes the "Your video is still sent to the others" notice
  async function closeNotice() {
    const close = await waitFor(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!MINIMIZED_NOTICE.test(n.nodeValue)) continue;
        for (let el = n.parentElement, i = 0; el && i < 6; el = el.parentElement, i++) {
          const button = byLabel(el, CLOSE);
          if (button) return button;
        }
      }
      return null;
    });
    close?.click();
  }

  // Hides your video with Meet's own "Minimize" while it shows, else brings it back
  const toggleOwnVideo = () =>
    busy(async () => {
      const options = await ownOptions();
      if (options) {
        if (!(await menuItem(options, MINIMIZE))) return toast('No “Minimize” option on your video');
        blur();
        return closeNotice();
      }
      const restore = restoreButton();
      if (restore) restore.click();
      else toast('Your video was not found');
    });

  // ---------- Layout ----------
  // Picks the layout after the current one in Meet's "Change layout" dialog, then closes it
  const nextLayout = () =>
    busy(async () => {
      if (!(await menuItem(byLabel(document, MORE_OPTIONS), CHANGE_LAYOUT)))
        return toast('No “Change layout” in Meet’s menu');
      const radios = await waitFor(() => {
        const found = [
          ...document.querySelectorAll('[role="dialog"] input[type="radio"], [role="dialog"] [role="radio"]'),
        ].filter((r) => !r.disabled);
        return found.length > 1 ? found : null;
      });
      if (!radios) return toast('Meet’s layouts were not found');
      const checked = (r) => r.checked || r.getAttribute('aria-checked') === 'true';
      const radio = radios[(radios.findIndex(checked) + 1) % radios.length];
      radio.click();
      const label = (
        (radio.labels?.[0] || radio.closest('label'))?.textContent ||
        radio.getAttribute('aria-label') ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      const dialog = radio.closest('[role="dialog"]');
      const close = dialog && byLabel(dialog, CLOSE);
      if (close) close.click();
      else escape();
      toast(label ? `Layout: ${label}` : 'Next layout');
    });

  // ---------- Captions ----------
  // Meet's bottom bar opens a panel with a captions switch and a translation switch: flip the one
  // matching `rx`, then close the panel again and give the keyboard back, so that the bar fades out
  async function captionsSwitch(rx, missing) {
    const toggle = [...document.querySelectorAll('button, [role="button"]')].find((b) => {
      const label = labelOf(b).trim();
      return (
        visible(b) &&
        !b.closest('main') &&
        CAPTIONS_PANEL.test(label) &&
        !CAPTIONS.test(label) &&
        !TRANSLATION.test(label)
      );
    });
    let item = near(toggle, rx, toggle);
    let opened = false;
    if (!item && toggle) {
      toggle.click();
      opened = true;
      item = await waitFor(() => near(toggle, rx, toggle));
    }
    item ||= byLabel(document, rx);
    if (item) item.click();
    else toast(missing);
    if (opened) toggle.click();
    blur();
  }

  // ---------- Full screen ----------
  function fullScreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => toast('Full screen refused by the browser'));
  }

  // ---------- Reactions ----------
  const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
  // Skin tones and the emoji presentation selector, so that 👍🏽 matches Meet's 👍
  const bare = (emoji) => emoji.replace(/\u{FE0F}|[\u{1F3FB}-\u{1F3FF}]/gu, '');

  function firstEmoji(text) {
    if (!text) return null;
    if (typeof Intl.Segmenter === 'function') {
      for (const { segment } of new Intl.Segmenter().segment(text)) if (PICTO.test(segment)) return segment;
      return null;
    }
    return text.match(PICTO)?.[0] || null;
  }

  const emojiOf = (el) =>
    firstEmoji(el.dataset?.emoji) ||
    firstEmoji(el.getAttribute('aria-label')) ||
    firstEmoji(el.querySelector('img')?.alt) ||
    firstEmoji(el.getAttribute('alt')) ||
    firstEmoji(el.textContent);

  // The emoji buttons of the reactions row: the nearest ones around its toggle (leaving out the ones
  // on chat messages), else any on the page
  function reactionButtons(toggle) {
    const emojiButtons = (root) =>
      [...root.querySelectorAll('button, [role="button"]')].filter((b) => b !== toggle && visible(b) && emojiOf(b));
    const main = document.querySelector('main');
    for (let el = toggle?.parentElement; el && el !== document.body && !el.contains(main); el = el.parentElement) {
      const found = emojiButtons(el);
      if (found.length > 1) return found;
    }
    return toggle ? [] : emojiButtons(document);
  }

  // The reactions row's buttons, opening it if needed; `opened` tells to close it again afterwards
  async function openReactions() {
    const toggle = byLabel(document, REACTIONS_TOGGLE);
    let buttons = reactionButtons(toggle);
    if (buttons.length || !toggle) return { buttons, toggle, opened: false };
    toggle.click();
    buttons =
      (await waitFor(() => {
        const found = reactionButtons(toggle);
        return found.length ? found : null;
      })) || [];
    return { buttons, toggle, opened: true };
  }

  // Sends `emoji` from the reactions row, closing the row again if it was closed
  async function react(emoji) {
    const row = await openReactions();
    const button = row.buttons.find((b) => bare(emojiOf(b)) === bare(emoji));
    button?.click();
    if (row.opened) row.toggle.click();
    blur();
    if (!button) toast(row.buttons.length ? `No ${emoji} in Meet’s reactions` : 'No reactions found');
  }

  // ---------- Emoji picker ----------
  // The button at the end of the row opening Meet's full emoji picker: the one without an emoji in
  // the smallest block holding the whole row
  function moreEmojisButton(row) {
    let box = row.buttons[0].parentElement;
    while (box && !row.buttons.every((b) => box.contains(b))) box = box.parentElement;
    for (let i = 0; box && i < 3 && !box.contains(row.toggle); i++, box = box.parentElement) {
      const others = [...box.querySelectorAll('button, [role="button"]')].filter(
        (b) => visible(b) && !emojiOf(b) && !LEAVE_CALL.test(labelOf(b)),
      );
      if (others.length) return others[others.length - 1];
    }
    return null;
  }

  // The search box of Meet's emoji picker ("Rechercher")
  const SEARCH = /search|recherch/i;
  const searchBox = () =>
    [...document.querySelectorAll('input')].find(
      (i) => visible(i) && !i.closest(EDITOR) && SEARCH.test(`${i.placeholder} ${labelOf(i)}`),
    );

  // Opens Meet's emoji picker (the "+" at the end of the reactions row) with the cursor in its search:
  // type or paste an emoji there, then pick it
  async function emojiPicker() {
    let search = searchBox();
    if (!search) {
      const row = await openReactions();
      const more = row.buttons.length && moreEmojisButton(row);
      if (!more) return toast('Meet’s emoji picker was not found');
      more.click();
      search = await waitFor(searchBox);
    }
    search?.focus();
  }

  // ---------- Reaction picker ----------
  // r held shows Meet's reactions with their keys; the next key picks one or cancels
  let picker = null;

  function openPicker() {
    picker = document.createElement('div');
    picker.className = 'picker';
    const hint = document.createElement('p');
    hint.textContent = 'React: press 1 – 9 (any other key cancels)';
    const row = document.createElement('div');
    REACTIONS.forEach((emoji, i) => {
      const item = document.createElement('span');
      const kbd = document.createElement('kbd');
      kbd.textContent = String(i + 1);
      item.append(emoji, kbd);
      row.append(item);
    });
    picker.append(hint, row);
    show(picker);
  }

  // `digit`: the digit key pressed, else nothing (cancelled)
  function closePicker(digit) {
    picker.remove();
    picker = null;
    if (digit) react(REACTIONS[Number(digit) - 1]);
  }

  // ---------- Help ----------
  let help = null;

  function toggleHelp() {
    if (help) {
      help.remove();
      help = null;
      return;
    }
    help = document.createElement('div');
    help.className = 'help';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const title = document.createElement('h2');
    title.textContent = 'Keyboard shortcuts';
    const table = document.createElement('table');
    for (const [key, label] of SHORTCUTS) {
      const row = table.insertRow();
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      row.insertCell().append(kbd);
      row.insertCell().textContent = label;
    }
    panel.append(title, table);
    help.append(panel);
    help.addEventListener('click', (e) => e.target === help && toggleHelp());
    show(help);
  }

  // ---------- Keys ----------
  const KEYS = {
    c: chat,
    m: toggleSound,
    h: toggleOwnVideo,
    v: nextLayout,
    f: fullScreen,
    s: () => captionsSwitch(CAPTIONS, 'No captions switch found'),
    t: () => captionsSwitch(TRANSLATION, 'No translation switch found'),
    p: () => command(PRESENT, 'No present button found'),
    l: () => react(THUMBS_UP),
    '?': toggleHelp,
  };

  let holdTimer = 0; // set while r is down and the reaction picker not shown yet

  // Capture phase, so that Meet's own handlers never see the shortcuts
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.isComposing || escaping) return;
      const el = e.target instanceof Element ? e.target : null;

      // Shift and the other modifiers alone neither pick nor cancel (on AZERTY, digits need Shift);
      // r, still held, repeats
      if (picker) {
        if (/^(Shift|Control|Alt|Meta|CapsLock|AltGraph)$/.test(e.key)) return;
        swallow(e);
        if (e.key === 'r' && e.repeat) return;
        if (!e.repeat) closePicker(e.code.match(/^(?:Digit|Numpad)([1-9])$/)?.[1]);
        return;
      }

      if (e.key === 'Escape') {
        if (e.metaKey || e.ctrlKey) {
          swallow(e);
          closeChat();
        } else if (help) {
          swallow(e);
          toggleHelp();
        } else if (el?.closest(EDITABLE) && el !== searchBox()) {
          // Meet's emoji picker closes on Esc by itself
          swallow(e);
          leaveChat();
        }
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest(EDITABLE)) return;
      const action = e.key === 'r' || KEYS[e.key];
      if (!action || (help && e.key !== '?')) return;
      swallow(e);

      // r opens Meet's emoji picker on release, or shows the reaction picker once held
      if (e.key === 'r') {
        if (!e.repeat && !holdTimer) {
          holdTimer = setTimeout(() => {
            holdTimer = -1;
            openPicker();
          }, HOLD_MS);
        }
        return;
      }
      if (!e.repeat) action();
    },
    true,
  );

  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key !== 'r' || !holdTimer) return;
      swallow(e);
      if (holdTimer > 0) {
        clearTimeout(holdTimer);
        emojiPicker();
      }
      holdTimer = 0;
    },
    true,
  );

  // A release missed while another window had the focus
  window.addEventListener('blur', () => {
    if (holdTimer > 0) clearTimeout(holdTimer);
    holdTimer = 0;
  });
})();
