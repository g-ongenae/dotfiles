// ==UserScript==
// @name         LinkedIn — Keyboard shortcuts
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.3.1
// @description  Drives LinkedIn from the keyboard: j / k (or ↓ / ↑) move between posts, l likes (held: picks the reaction), c comments, r reposts, s copies the link, o opens the post, e expands it, ← / → browse its images or document pages, Space plays / pauses its video and m mutes it, p starts a post, t / b go to the top / bottom, h / u open the feed / your profile, Cmd/Ctrl+U adds an image to the post or comment being written, Esc leaves a comment box and ? lists the shortcuts.
// @match        https://www.linkedin.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Modifier held with U: 'auto' (Cmd on macOS, Ctrl elsewhere), 'meta' (Cmd/Windows key) or 'ctrl'
  const MODIFIER = 'auto';
  // Space kept between the top bar and the post moved to
  const POST_MARGIN_PX = 8;
  // Holding l this long opens the reaction picker instead of liking
  const HOLD_MS = 350;
  // How long to wait for something LinkedIn opens (comment box, menu, …)
  const WAIT_MS = 3000;

  // Every post (feed, single post, company and profile pages) has one share button: the post is
  // its list item, or on pages without one, the largest block holding no other share button.
  const SHARE = 'main [aria-label="Send"]';
  const LIKE = 'button[aria-label^="Reaction button state"]';
  const REACTIONS_MENU = 'button[aria-label="Open reactions menu"]';
  const COMMENT = 'button[aria-label="Comment"]';
  const REPOST = 'button[aria-label="Repost"]';
  const POST_MENU = 'button[aria-label^="Open control menu for post"]';
  // LinkedIn's "…more" of a cut text, and linkedin-declutter's expand / collapse button
  const MORE = '[data-testid="expandable-text-button"]';
  const TOGGLE = '.lkc-expand:not([hidden])';
  const IMAGE = 'img[alt="View image"]';
  const START_POST = '[role="button"]:has(> [aria-label="Start a post"])';
  const TOP_BAR = '[data-testid="primary-nav"]';
  const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
  const EDITOR = '[contenteditable=""], [contenteditable="true"]';
  // The image button of the post composer ("Add media") and of comment boxes ("Add a photo")
  const MEDIA_BUTTON = /photo|image|media/i;
  // Items of the menus opened by r, s and o
  // (r takes the one opening the composer, not "Repost instantly")
  const REPOST_ITEM = /^Repost with (your )?thoughts$|^Republier avec (votre )?avis$/i;
  const COPY_LINK_ITEM = /^Copy link to post$|^Copier le lien (vers|du) (le )?post$/i;
  // The link of the "Link copied to clipboard. View post." message that follows
  const VIEW_POST = /^View post\.?$|^Voir le post\.?$/i;
  // Buttons of a carousel or of the image viewer
  const NEXT = /^next\b|^suivant/i;
  const PREVIOUS = /^previous\b|^prev\b|^précédent/i;
  const CURRENT = 'data-lkk-current'; // the post moved to

  // In LinkedIn's order, with the key picking each one once l is held
  const REACTIONS = [
    ['t', 'Like', '👍'],
    ['y', 'Celebrate', '👏'],
    ['u', 'Support', '🤝'],
    ['i', 'Love', '❤️'],
    ['o', 'Insightful', '💡'],
    ['p', 'Funny', '😂'],
  ];

  const isMac = /mac/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  const useMeta = MODIFIER === 'auto' ? isMac : MODIFIER === 'meta';
  const MOD = useMeta ? (isMac ? '⌘' : 'Meta+') : 'Ctrl+';

  const SHORTCUTS = [
    ['j  ↓', 'Next post'],
    ['k  ↑', 'Previous post'],
    ['l', 'Like / unlike the post'],
    ['l (held)', `Pick the reaction: ${REACTIONS.map(([k, , e]) => `${k} ${e}`).join('  ')}; l or Esc cancels`],
    ['c', 'Comment on the post'],
    ['r', 'Repost it with your thoughts (opens the composer)'],
    ['s', 'Copy the link to the post'],
    ['o', 'Open the post'],
    ['e', 'Expand / collapse the post'],
    ['←  →', 'Previous / next image or page of the post'],
    ['Space', 'Play / pause the video of the post'],
    ['m', 'Mute / unmute the video'],
    ['p', 'Start a post'],
    ['t', 'Top of the page'],
    ['b', 'Bottom of the page'],
    ['h', 'Home (feed)'],
    ['u', 'Your profile'],
    [`${MOD}B`, 'Bold, in a post or comment (LinkedIn — Better post composer)'],
    [`${MOD}I`, 'Italic, in a post or comment (LinkedIn — Better post composer)'],
    [`${MOD}U`, 'Add an image, in a post or comment'],
    ['Esc', 'Close the post or comment being written'],
    ['?', 'Show / hide this list'],
  ];

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    [${CURRENT}] {
      outline: 2px solid #0a66c2 !important; outline-offset: 2px;
      border-radius: 8px;
    }
    /* LinkedIn focuses the text once "…more" is clicked: the post's outline is enough */
    [${CURRENT}] [data-testid="expandable-text-box"]:focus { outline: none !important; box-shadow: none !important; }
  `;
  document.head.append(style);

  // The help, the reaction picker and the messages live in a shadow root outside <body>: LinkedIn's
  // React tree and linkedin-declutter (which acts on texts such as "Start a post") never see them.
  const host = document.createElement('div');
  const ui = host.attachShadow({ mode: 'open' });
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    :host { all: initial; }
    .help {
      position: fixed; inset: 0; z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.4);
    }
    .panel, .picker, .toast {
      background: #fff; color: rgba(0, 0, 0, 0.9);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font: 14px/1.4 -apple-system, system-ui, sans-serif;
    }
    .panel { min-width: 360px; max-height: 90vh; overflow: auto; padding: 20px 24px; border-radius: 12px; }
    h2 { margin: 0 0 12px; font-size: 18px; font-weight: 600; }
    table { border-collapse: collapse; }
    td { padding: 3px 0; vertical-align: top; }
    td:first-child { padding-right: 20px; white-space: nowrap; }
    kbd {
      display: inline-block; min-width: 1.6em; padding: 1px 6px; text-align: center;
      border: 1px solid rgba(0, 0, 0, 0.2); border-bottom-width: 2px; border-radius: 4px;
      background: #f3f2ef; font: 13px ui-monospace, monospace; white-space: pre;
    }
    .picker {
      position: fixed; z-index: 2147483647; display: flex; gap: 4px;
      padding: 6px; border-radius: 24px;
    }
    .picker span { display: flex; flex-direction: column; align-items: center; width: 44px; font-size: 24px; }
    .picker kbd { margin-top: 2px; min-width: 0; font-size: 11px; }
    .toast {
      position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
      padding: 10px 16px; border-radius: 8px; background: #1d2226; color: #fff;
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
      // At most once a frame: the feed changes all the time
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

  const visible = (el) => el.getClientRects().length > 0;

  // The visible clickable element whose own text matches `rx` (menu items have no label)
  function byText(rx) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!rx.test(n.nodeValue.trim())) continue;
      const el = n.parentElement.closest('button, a, [role="menuitem"], [role="button"], li') || n.parentElement;
      if (visible(el)) return el;
    }
    return null;
  }

  // The elements matching `selector` under `root`, its open shadow roots and same-origin frames
  // (the players of videos and documents live there)
  function deepAll(root, selector) {
    const out = [...root.querySelectorAll(selector)];
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) out.push(...deepAll(el.shadowRoot, selector));
      if (el.tagName === 'IFRAME') {
        try {
          if (el.contentDocument?.body) out.push(...deepAll(el.contentDocument, selector));
        } catch { /* cross-origin */ }
      }
    }
    return out;
  }

  const labelOf = (b) => b.getAttribute('aria-label') || b.getAttribute('title') || '';
  const byLabel = (root, rx) => deepAll(root, 'button, [role="button"]')
    .find((b) => visible(b) && rx.test(labelOf(b)));

  // Clicks without leaving a focus ring on what LinkedIn focuses (the button, the text it opened):
  // the post already has an outline
  function press(button) {
    button.click();
    requestAnimationFrame(() => {
      const el = document.activeElement;
      if (el && el !== document.body && !el.closest(EDITABLE)) el.blur();
    });
  }

  // Esc for LinkedIn (to close its menus), ignored by the handler below
  let escaping = false;
  function escape() {
    escaping = true;
    (document.activeElement || document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }),
    );
    escaping = false;
  }

  // Opens a menu of the post and clicks its item matching `rx`; false when there is none
  async function menuItem(button, rx, missing) {
    if (button) {
      button.click();
      const item = await waitFor(() => byText(rx));
      if (item) {
        item.click();
        return true;
      }
      escape();
    }
    toast(missing);
    return false;
  }

  // ---------- Posts ----------
  function posts() {
    const found = new Set();
    for (const share of document.querySelectorAll(SHARE)) {
      let post = share.closest('[role="listitem"]');
      if (!post) {
        post = share;
        while (post.parentElement && post.parentElement.tagName !== 'MAIN'
          && post.parentElement.querySelectorAll(SHARE).length === 1) post = post.parentElement;
      }
      if (visible(post)) found.add(post);
    }
    return [...found];
  }

  // Bottom of the sticky top bar
  function topOffset() {
    const bar = document.querySelector(TOP_BAR);
    const bottom = bar ? bar.getBoundingClientRect().bottom : 0;
    return (bottom > 0 && bottom < window.innerHeight / 3 ? bottom : 0) + POST_MARGIN_PX;
  }

  // The page scrolls in <main> (the body does not), or in the window on older layouts
  function scroller() {
    const main = document.querySelector('main');
    if (main && /auto|scroll/.test(getComputedStyle(main).overflowY) && main.scrollHeight > main.clientHeight) return main;
    return document.scrollingElement || document.documentElement;
  }

  const scrollTo = (top) => scroller().scrollTo({ top, behavior: 'smooth' });

  let current = null;

  function mark(post) {
    if (current) current.removeAttribute(CURRENT);
    current = post;
    post.setAttribute(CURRENT, '');
  }

  function select(post) {
    mark(post);
    scrollTo(scroller().scrollTop + post.getBoundingClientRect().top - topOffset());
  }

  // The post moved to, unless it was scrolled away: then the one at the top of the screen
  function currentIndex(list) {
    const offset = topOffset();
    const i = list.indexOf(current);
    if (i >= 0) {
      const r = current.getBoundingClientRect();
      if (r.bottom > offset && r.top < window.innerHeight) return i;
    }
    const first = list.findIndex((p) => p.getBoundingClientRect().bottom > offset + 1);
    return first < 0 ? list.length - 1 : first;
  }

  function move(step) {
    const list = posts();
    if (!list.length) return;
    let i = currentIndex(list);
    // Starting from the post at the top of the screen: j goes to it when its top is below the top
    // bar, k when it is above it
    if (list[i] !== current) {
      const delta = list[i].getBoundingClientRect().top - topOffset();
      if (step > 0 ? delta > 2 : delta < -2) i -= step;
    }
    select(list[Math.max(0, Math.min(list.length - 1, i + step))]);
  }

  // The post to act on: the current one, else the one at the top of the screen
  function onScreen() {
    const list = posts();
    return list.length ? list[currentIndex(list)] : null;
  }

  // The same, made current
  function target() {
    const post = onScreen();
    if (post && post !== current) select(post);
    return post;
  }

  function like() {
    const button = target()?.querySelector(LIKE);
    if (button) press(button);
  }

  async function comment() {
    const post = target();
    if (!post) return;
    if (!post.querySelector(EDITOR)) post.querySelector(COMMENT)?.click();
    (await waitFor(() => post.querySelector(EDITOR)))?.focus();
  }

  async function expand() {
    const post = target();
    if (!post) return;
    const toggle = post.querySelector(TOGGLE);
    if (toggle) return press(toggle);
    const more = post.querySelector(MORE);
    if (!more) return;
    press(more);
    // Beside an image, linkedin-declutter cuts the full text again and shows its toggle: open it too
    const cut = await waitFor(() => post.querySelector(TOGGLE));
    if (cut && cut.getAttribute('aria-expanded') !== 'true') press(cut);
  }

  function repost() {
    const post = target();
    if (post) menuItem(post.querySelector(REPOST), REPOST_ITEM, 'No “Repost with thoughts” on this post');
  }

  const copyLink = (post) => menuItem(post.querySelector(POST_MENU), COPY_LINK_ITEM, 'No “Copy link to post” on this post');

  // LinkedIn says "Link copied to clipboard" itself
  function share() {
    const post = target();
    if (post) copyLink(post);
  }

  // Posts hold no link to themselves: follow the "View post" link of the message LinkedIn shows
  // once it copied the post's link
  async function open() {
    const post = target();
    if (!post) return;
    const own = post.querySelector('a[href*="/feed/update/"], a[href*="/posts/"]');
    if (own) return location.assign(own.href);
    const before = new Set(document.querySelectorAll('a'));
    if (!await copyLink(post)) return;
    const link = await waitFor(() => [...document.querySelectorAll('a')]
      .find((a) => !before.has(a) && VIEW_POST.test(a.textContent.trim()) && visible(a)));
    if (!link) return toast('No “View post” link after copying it');
    if (/\/(feed\/update|posts)\//.test(link.href)) location.assign(link.href);
    else link.click();
  }

  // Plays or pauses the video of the post; false when it has none
  function playPause() {
    const post = onScreen();
    const video = post && deepAll(post, 'video').find(visible);
    if (!video) return false;
    if (post !== current) select(post);
    if (video.paused) video.play().catch(() => {});
    else video.pause();
    return true;
  }

  // Mutes or unmutes the video of the post, else the one playing on screen
  function mute() {
    const post = onScreen();
    const video = (post && deepAll(post, 'video').find(visible))
      || deepAll(document, 'video').find((v) => visible(v) && !v.paused);
    if (!video) return;
    video.muted = !video.muted;
    // LinkedIn starts videos muted at volume 0
    if (!video.muted && video.volume === 0) video.volume = 1;
    toast(video.muted ? 'Muted' : 'Sound on');
  }

  // Next / previous image: the buttons of a carousel, else opens the image viewer on the first (or
  // last) image of the post. In the viewer, its Next / Previous buttons.
  const viewerButton = (step) => {
    const dialog = [...document.querySelectorAll('dialog[open]')].pop();
    return dialog && byLabel(dialog, step > 0 ? NEXT : PREVIOUS);
  };

  function image(step) {
    const rx = step > 0 ? NEXT : PREVIOUS;
    const post = target();
    if (!post) return;
    const button = byLabel(post, rx);
    if (button) return press(button);
    const images = [...post.querySelectorAll(IMAGE)].filter(visible);
    (step > 0 ? images[0] : images[images.length - 1])?.click();
  }

  // ---------- Reactions ----------
  let picker = null;

  function openPicker() {
    const post = target();
    const menu = post?.querySelector(REACTIONS_MENU);
    if (!menu) return;
    menu.click();
    picker = document.createElement('div');
    picker.className = 'picker';
    for (const [key, name, emoji] of REACTIONS) {
      const item = document.createElement('span');
      item.title = name;
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      item.append(emoji, kbd);
      picker.append(item);
    }
    picker.post = post;
    const r = (post.querySelector(LIKE) || menu).getBoundingClientRect();
    picker.style.left = `${Math.max(8, r.left)}px`;
    picker.style.top = `${Math.max(8, r.top - 72)}px`;
    show(picker);
  }

  function closePicker() {
    picker?.remove();
    picker = null;
  }

  // LinkedIn's button for the reaction, in the menu it opened
  function reactionButton(name, post) {
    const rx = new RegExp(`^(React )?${name}\\b`, 'i');
    const ownLike = post.querySelector(LIKE);
    return [...document.querySelectorAll('button, [role="button"], [role="menuitem"]')].find((b) => visible(b)
      && !b.matches(LIKE) && !ownLike?.contains(b)
      && (rx.test(b.getAttribute('aria-label') || '') || rx.test(b.querySelector('img')?.alt || '')));
  }

  async function react(name) {
    const { post } = picker;
    closePicker();
    const button = await waitFor(() => reactionButton(name, post));
    if (button) press(button);
    else toast(`No “${name}” reaction found`);
  }

  // ---------- Pages ----------
  function startPost() {
    const button = document.querySelector(START_POST);
    if (button) button.click();
    else location.assign('/feed/?shareActive=true');
  }

  function goHome() {
    const link = document.querySelector(`${TOP_BAR} a[href$="/feed/"]`);
    if (link) link.click();
    else location.assign('/feed/');
  }

  // The profile card of the feed's sidebar links to your profile; LinkedIn redirects /in/me/ to it
  function goProfile() {
    const link = document.querySelector('aside[aria-label="Sidebar"] a[href*="/in/"]');
    if (link) link.click();
    else location.assign('/in/me/');
  }

  // ---------- Composer ----------
  // The button whose label names a photo / image / media, in the nearest block around the editor
  // that has one: the compose dialog or the comment box.
  function addImage(editor) {
    for (let box = editor.parentElement; box && box !== document.body; box = box.parentElement) {
      const button = [...box.querySelectorAll('button[aria-label]')]
        .find((b) => MEDIA_BUTTON.test(b.getAttribute('aria-label')));
      if (button) return button.click();
      const input = box.querySelector('input[type="file"]');
      if (input) return input.click();
      if (box.tagName === 'DIALOG' || box.matches('[role="listitem"]')) return;
    }
  }

  // Leaves the comment box for the post, so that the shortcuts work again
  function leaveComment(editor) {
    const post = posts().find((p) => p.contains(editor));
    editor.blur();
    if (post) {
      post.setAttribute('tabindex', '-1');
      post.focus({ preventScroll: true });
      mark(post);
    }
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
    j: () => move(1),
    k: () => move(-1),
    ArrowDown: () => move(1),
    ArrowUp: () => move(-1),
    ArrowRight: () => image(1),
    ArrowLeft: () => image(-1),
    c: comment,
    r: repost,
    s: share,
    o: open,
    e: expand,
    m: mute,
    p: startPost,
    t: () => scrollTo(0),
    b: () => scrollTo(scroller().scrollHeight),
    h: goHome,
    u: goProfile,
    '?': toggleHelp,
  };

  const swallow = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  let holdTimer = 0; // set while l is down and the picker not open yet

  // Capture phase, so that LinkedIn's own handlers (and the browser's) never see the shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.isComposing || escaping) return;
    const el = e.target instanceof Element ? e.target : null;
    const editor = el?.closest(EDITOR);

    if (picker) {
      swallow(e);
      if (e.repeat) return;
      const reaction = REACTIONS.find(([key]) => key === e.key);
      if (reaction) return react(reaction[1]);
      closePicker();
      escape(); // closes LinkedIn's menu too
      return;
    }

    const modifier = useMeta ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
    if (modifier && !e.altKey && !e.shiftKey && e.code === 'KeyU') {
      if (!editor) return;
      swallow(e);
      if (!e.repeat) addImage(editor);
      return;
    }

    if (e.key === 'Escape') {
      if (help) {
        swallow(e);
        toggleHelp();
      } else if (editor && !editor.closest('dialog')) {
        // The compose dialog closes on Esc by itself
        swallow(e);
        leaveComment(editor);
      }
      return;
    }

    if (e.metaKey || e.ctrlKey || e.altKey || el?.closest(EDITABLE)) return;
    // Space plays the video of the post, or scrolls the page as usual when it has none
    if (e.key === ' ' && !help && !e.repeat && !document.querySelector('dialog[open]')) {
      if (playPause()) swallow(e);
      return;
    }
    const action = e.key === 'l' || KEYS[e.key];
    if (!action || (help && e.key !== '?')) return;
    // With a dialog open (composer, image viewer, …) only the help and the viewer's Next / Previous
    // buttons work; without those buttons, the arrows are left to LinkedIn
    if (e.key !== '?' && document.querySelector('dialog[open]')) {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      const button = step && viewerButton(step);
      if (button) {
        swallow(e);
        button.click();
      }
      return;
    }
    swallow(e);

    // l likes on release, or opens the picker once held
    if (e.key === 'l') {
      if (!e.repeat && !holdTimer) {
        holdTimer = setTimeout(() => {
          holdTimer = -1;
          openPicker();
        }, HOLD_MS);
      }
      return;
    }
    if (e.repeat && !/^Arrow|^[jk]$/.test(e.key)) return;
    action();
  }, true);

  window.addEventListener('keyup', (e) => {
    if (e.key !== 'l' || !holdTimer) return;
    swallow(e);
    if (holdTimer > 0) {
      clearTimeout(holdTimer);
      like();
    }
    holdTimer = 0;
  }, true);

  // A release missed while another window had the focus
  window.addEventListener('blur', () => {
    if (holdTimer > 0) clearTimeout(holdTimer);
    holdTimer = 0;
  });
})();
