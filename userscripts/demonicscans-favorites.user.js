// ==UserScript==
// @name         Demonic Scans — Favorites
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.0.0
// @description  Keeps a list of favorite titles on Demonic Scans, without an account: an Add to favorites button on each title, and a star in the navigation bar opening the list with the date of each title's latest chapter, most recent first. Made for a phone's browser.
// @license      MIT
// @homepageURL  https://github.com/g-ongenae/dotfiles/blob/main/userscripts/demonicscans-favorites.user.js
// @supportURL   https://github.com/g-ongenae/dotfiles/issues
// @match        https://demonicscans.org/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // A latest chapter read from the site longer ago than this is read again when the list opens
  const STALE_MS = 60 * 60 * 1000;
  // Title pages fetched at once while checking the latest chapters
  const PARALLEL = 4;
  // Latest chapters this recent (in days) have their date highlighted
  const RECENT_DAYS = 1;

  // The favorites live in the site's localStorage, on this browser only:
  // { [title id]: { id, title, path, cover, chapter, chapterPath, date, added, checked, failed } }
  const STORE = 'dsf-favorites';
  // Marks the history entry added while the list is open, so that the back button closes it
  const STATE = 'dsfList';

  // The two groups of buttons of the navigation bar; the star joins the right one
  const NAV_BUTTONS = 'nav.navigation .innav > div:last-child';
  // A title page: its heading, cover, the site's own Bookmark button and its chapters, newest first
  const TITLE = '#manga-info-container h1';
  const COVER = '#manga-page img';
  const SITE_BOOKMARK = '#bookmark';
  const TITLE_COLUMN = '#manga-page';
  const FIRST_CHAPTER = '#read-first';
  const CHAPTER = '#chapters-list a.chplinks';
  // A chapter being read links back to its title, and to its other chapters: its own address
  // (/title/<name>/chapter/<number>/…) does not have the title's id, their links do
  const READER_TITLE = '.chapter-info h1 a[href*="/manga/"]';
  const READER_CHAPTER = '.chapters-nav option[value*="manga="], .chapters-nav a[href*="manga="]';

  const STAR = 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';
  const REFRESH =
    'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z';
  const CLOSE = 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

  // ---------- Elements ----------
  // `text` sets the text, any other key an attribute
  function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'text') node.textContent = value;
      else node.setAttribute(name, value);
    }
    node.append(...children);
    return node;
  }

  function icon(shape) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', shape);
    svg.append(path);
    return svg;
  }

  // ---------- Favorites ----------
  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE));
      return stored && typeof stored === 'object' ? stored : {};
    } catch {
      return {};
    }
  }

  // Reads the favorites again before each change: another tab may have changed them
  function update(change) {
    const favorites = load();
    change(favorites);
    try {
      localStorage.setItem(STORE, JSON.stringify(favorites));
    } catch {
      toast('The favorites could not be saved');
    }
  }

  // Latest chapter first, the titles without one last
  function byLatest(a, b) {
    return (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title);
  }

  // ---------- Pages ----------
  function idOf(href) {
    return href ? new URL(href, location.origin).searchParams.get('manga') || '' : '';
  }

  // What a title page (this one, or a fetched one) says of its title; null on any other page
  function readTitle(doc, path) {
    const latest = doc.querySelector(CHAPTER);
    const id = idOf((latest || doc.querySelector(FIRST_CHAPTER))?.getAttribute('href'));
    const title = doc.querySelector(TITLE)?.textContent.trim();
    if (!id || !title) return null;
    const found = { id, title, path, cover: doc.querySelector(COVER)?.getAttribute('src') || '' };
    if (!latest) return { ...found, chapter: '', chapterPath: '', date: '' };
    const url = new URL(latest.getAttribute('href'), location.origin);
    // The link holds the chapter's name, then its date in a span
    const name = [...latest.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
    return {
      ...found,
      chapter: name
        .map((node) => node.textContent)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      chapterPath: url.pathname + url.search,
      date: latest.querySelector('span')?.textContent.trim() || '',
    };
  }

  // A chapter being read only names its title: its cover and latest chapter are fetched later
  function readReader() {
    const link = document.querySelector(READER_TITLE);
    const other = document.querySelector(READER_CHAPTER);
    const id = idOf(other?.value || other?.getAttribute('href'));
    return link && id ? { id, title: link.textContent.trim(), path: link.pathname } : null;
  }

  const titlePage = readTitle(document, location.pathname);
  // The title of this page, when it shows one
  const here = titlePage || readReader();

  // ---------- Dates ----------
  const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  // The site gives dates as 2026-11-14: returns "14 Nov · 3 days ago" and the age in days
  function describe(date) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!parts) return { text: date, days: Infinity };
    const day = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Never in the future, whatever the site's time zone
    const days = Math.max(0, Math.round((today - day) / 86400000));
    let ago;
    if (days < 14) ago = relative.format(-days, 'day');
    else if (days < 60) ago = relative.format(-Math.round(days / 7), 'week');
    else if (days < 730) ago = relative.format(-Math.round(days / 30.44), 'month');
    else ago = relative.format(-Math.round(days / 365.25), 'year');
    const format = { day: 'numeric', month: 'short' };
    if (day.getFullYear() !== today.getFullYear()) format.year = 'numeric';
    return { text: `${day.toLocaleDateString('en-GB', format)} · ${ago}`, days };
  }

  // ---------- Styles ----------
  // The two buttons added to the page itself
  document.head.append(
    el('style', {
      text: `
        .dsf-open, .dsf-toggle {
          all: unset; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .dsf-open:focus-visible, .dsf-toggle:focus-visible { outline: 2px solid #ffce3b; outline-offset: -2px; }
        .dsf-open { align-self: center; width: 40px; height: 40px; margin-right: 4px; }
        .dsf-open svg { width: 26px; height: 26px; fill: #ffce3b; }
        .dsf-open.dsf-floating {
          position: fixed; right: 8px; bottom: 8px; z-index: 2147483646; width: 48px; height: 48px; margin: 0;
          border-radius: 50%; background: rgba(13, 14, 15, 0.85);
        }
        .dsf-toggle { gap: 6px; width: 100%; min-height: 44px; margin-top: 5px; background: #2c3034; color: #fff; }
        .dsf-toggle svg {
          width: 20px; height: 20px; fill: none; stroke: #ffce3b; stroke-width: 2; stroke-linejoin: round;
        }
        .dsf-toggle[aria-pressed="true"] { background: #ffce3b; color: #191a1c; }
        .dsf-toggle[aria-pressed="true"] svg { fill: #191a1c; stroke: #191a1c; }
      `,
    }),
  );

  // The list and the messages live in a shadow root, safe from the site's styles
  const host = document.createElement('div');
  const ui = host.attachShadow({ mode: 'open' });
  ui.append(
    el('style', {
      text: `
        :host { all: initial; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        [hidden] { display: none !important; }
        .list, .toast { font: 15px/1.35 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #fff; }
        .list {
          position: fixed; inset: 0; z-index: 2147483647; display: flex; flex-direction: column;
          background: #191a1c; outline: none;
        }
        header {
          display: flex; align-items: center; padding: 6px 4px 6px 16px;
          padding-top: max(6px, env(safe-area-inset-top)); background: #0d0e0f; border-bottom: 1px solid #ff6740;
        }
        .heading { flex: 1; min-width: 0; }
        h2 { margin: 0; font-size: 18px; }
        .count { margin: 0; color: #b2b2b2; font-size: 12px; }
        button { margin: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
        button:disabled { opacity: 0.4; cursor: default; }
        .icon { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; }
        .icon svg { width: 24px; height: 24px; fill: currentColor; }
        .checking svg { animation: turn 1s linear infinite; }
        @keyframes turn { to { transform: rotate(360deg); } }
        .add {
          flex: none; margin: 12px 16px 4px; padding: 12px 16px; border-radius: 8px;
          background: #ffce3b; color: #191a1c; font-weight: 600;
        }
        .empty { margin: 0; padding: 40px 24px; color: #b2b2b2; text-align: center; }
        ul {
          flex: 1; min-height: 0; margin: 0; padding: 0 0 env(safe-area-inset-bottom); list-style: none;
          overflow-y: auto; overscroll-behavior: contain;
        }
        li { display: flex; align-items: center; gap: 12px; padding: 8px 4px 8px 16px; border-bottom: 1px solid #2c2c2c; }
        a { color: inherit; text-decoration: none; }
        .cover { flex: none; width: 48px; height: 68px; border-radius: 4px; background: #2c2c2c; overflow: hidden; }
        .cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .text { flex: 1; min-width: 0; }
        .name {
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
          font-weight: 600; overflow-wrap: anywhere;
        }
        .latest {
          display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; min-height: 32px; padding-top: 2px;
          color: #b2b2b2; font-size: 13px;
        }
        .chapter { color: #569cff; }
        .chapter:empty { display: none; }
        .recent .date { color: #ff6740; }
        .failed { color: #ff6740; }
        .remove svg { fill: #ffce3b; }
        .toast {
          position: fixed; z-index: 2147483647; left: 16px; right: 16px;
          bottom: calc(16px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 8px;
          max-width: 480px; margin: 0 auto; padding: 4px 4px 4px 16px; min-height: 48px; border-radius: 8px;
          background: #333; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        }
        .toast span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .toast button { flex: none; min-height: 40px; padding: 0 12px; color: #ffce3b; font-weight: 600; }
      `,
    }),
  );
  document.documentElement.append(host);

  // ---------- Messages ----------
  let toastTimer = 0;

  // `action` names a button put after the message, and `act` is what it does
  function toast(text, action, act) {
    ui.querySelector('.toast')?.remove();
    const message = el('div', { class: 'toast', role: 'status' }, el('span', { text }));
    if (action) {
      const button = el('button', { type: 'button', text: action });
      button.addEventListener('click', () => {
        message.remove();
        act();
      });
      message.append(button);
    }
    ui.append(message);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => message.remove(), action ? 6000 : 3000);
  }

  // ---------- List ----------
  const count = el('p', { class: 'count' });
  const refreshButton = el('button', { type: 'button', class: 'icon', 'aria-label': 'Check the latest chapters' });
  refreshButton.append(icon(REFRESH));
  const closeButton = el('button', { type: 'button', class: 'icon', 'aria-label': 'Close the favorites' }, icon(CLOSE));
  const addButton = el('button', { type: 'button', class: 'add' });
  const empty = el('p', { class: 'empty', text: 'No favorites yet. Open a title and tap Add to favorites.' });
  const items = el('ul');
  const list = el(
    'div',
    { class: 'list', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Favorites', tabindex: '-1', hidden: '' },
    el(
      'header',
      {},
      el('div', { class: 'heading' }, el('h2', { text: 'Favorites' }), count),
      refreshButton,
      closeButton,
    ),
    addButton,
    empty,
    items,
  );
  ui.append(list);

  const rows = new Map(); // title id → the elements of its row
  let order = []; // title ids, as listed
  let checking = null; // { done, total } while the latest chapters are being read

  function row(favorite) {
    let made = rows.get(favorite.id);
    if (!made) {
      const image = el('img', { alt: '' });
      image.addEventListener('error', () => (image.hidden = true));
      const cover = el('a', { class: 'cover', tabindex: '-1', 'aria-hidden': 'true' }, image);
      const name = el('a', { class: 'name' });
      const chapter = el('span', { class: 'chapter' });
      const date = el('span', { class: 'date' });
      const failed = el('span', { class: 'failed', text: 'Not checked' });
      const latest = el('a', { class: 'latest' }, chapter, date, failed);
      const remove = el('button', { type: 'button', class: 'icon remove' }, icon(STAR));
      remove.addEventListener('click', () => toggle(favorite));
      const item = el('li', {}, cover, el('div', { class: 'text' }, name, latest), remove);
      made = { item, image, cover, name, chapter, date, failed, latest, remove };
      rows.set(favorite.id, made);
    }

    if (made.image.getAttribute('src') !== favorite.cover) {
      made.image.hidden = !favorite.cover;
      if (favorite.cover) made.image.src = favorite.cover;
      else made.image.removeAttribute('src');
    }
    made.cover.href = made.name.href = favorite.path;
    made.name.textContent = favorite.title;
    made.remove.setAttribute('aria-label', `Remove ${favorite.title} from the favorites`);

    const { text, days } = describe(favorite.date || '');
    made.chapter.textContent = favorite.chapter || '';
    if (favorite.chapterPath) made.latest.href = favorite.chapterPath;
    else made.latest.removeAttribute('href');
    if (favorite.chapter || favorite.date) made.date.textContent = text;
    else made.date.textContent = favorite.checked ? 'No chapter yet' : 'Not read from the site yet';
    made.latest.classList.toggle('recent', days <= RECENT_DAYS);
    made.failed.hidden = !favorite.failed;
    return made.item;
  }

  function render() {
    if (list.hidden) return;
    const favorites = load();
    const all = Object.values(favorites);
    // Rows keep their place while their dates come in, not to move under the finger
    if (checking && order.length) {
      const listed = order.filter((id) => favorites[id]);
      order = [...listed, ...all.filter((favorite) => !listed.includes(favorite.id)).map((favorite) => favorite.id)];
    } else {
      order = all.sort(byLatest).map((favorite) => favorite.id);
    }
    for (const id of rows.keys()) if (!favorites[id]) rows.delete(id);
    const wanted = order.map((id) => row(favorites[id]));
    if (wanted.length !== items.children.length || wanted.some((item, i) => items.children[i] !== item)) {
      items.replaceChildren(...wanted);
    }

    empty.hidden = all.length > 0;
    if (checking) count.textContent = `Checking the latest chapters… ${checking.done} / ${checking.total}`;
    else count.textContent = all.length === 1 ? '1 title' : `${all.length} titles`;
    refreshButton.disabled = Boolean(checking) || !all.length;
    refreshButton.classList.toggle('checking', Boolean(checking));
    addButton.hidden = !here || Boolean(favorites[here.id]);
    if (here) addButton.textContent = `Add “${here.title}”`;
  }

  // ---------- Latest chapters ----------
  async function check(favorite) {
    const response = await fetch(favorite.path, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const found = readTitle(new DOMParser().parseFromString(await response.text(), 'text/html'), favorite.path);
    if (found?.id !== favorite.id) throw new Error('Not the page of this title');
    return found;
  }

  // Reads again the latest chapter of the favorites `wanted` picks, a few title pages at a time
  async function refresh(wanted) {
    if (checking) return;
    const queue = Object.values(load()).filter(wanted);
    if (!queue.length) return;
    checking = { done: 0, total: queue.length };
    render();
    let failures = 0;

    async function work() {
      for (let favorite = queue.shift(); favorite; favorite = queue.shift()) {
        const { id } = favorite;
        let found = null;
        try {
          found = await check(favorite);
        } catch {
          failures += 1;
        }
        // Unless it was removed meanwhile. A failed check keeps what was known, and is tried again next time
        update((favorites) => {
          if (!favorites[id]) return;
          if (found) Object.assign(favorites[id], found, { checked: Date.now(), failed: false });
          else favorites[id].failed = true;
        });
        checking.done += 1;
        render();
      }
    }

    await Promise.all(Array.from({ length: PARALLEL }, work));
    checking = null;
    render();
    if (failures) toast(failures === 1 ? '1 title could not be checked' : `${failures} titles could not be checked`);
  }

  const isStale = (favorite) => !(Date.now() - favorite.checked < STALE_MS);

  // ---------- Adding and removing ----------
  // Adds the title, or removes it: a removal can be undone from its message
  function toggle(title) {
    const known = load()[title.id];
    if (known) {
      update((favorites) => delete favorites[title.id]);
      toast(`Removed ${known.title}`, 'Undo', () => {
        update((favorites) => (favorites[title.id] = known));
        changed();
      });
    } else {
      update((favorites) => {
        favorites[title.id] = { cover: '', chapter: '', chapterPath: '', date: '', ...title, added: Date.now() };
      });
      toast(`Added ${title.title}`);
      // Added from a chapter: its title page has not been read
      if (!title.checked) refresh((favorite) => favorite.id === title.id);
    }
    changed();
  }

  // The button of a title page, under the site's own Bookmark button (which needs an account)
  let toggleButton = null;
  let toggleLabel = null;
  if (titlePage) {
    toggleLabel = el('span');
    toggleButton = el('button', { type: 'button', class: 'dsf-toggle' }, icon(STAR), toggleLabel);
    toggleButton.addEventListener('click', () => toggle({ ...titlePage, checked: Date.now() }));
    const bookmark = document.querySelector(SITE_BOOKMARK);
    if (bookmark) bookmark.after(toggleButton);
    else document.querySelector(TITLE_COLUMN)?.append(toggleButton);
  }

  function changed() {
    if (toggleButton) {
      const added = Boolean(load()[titlePage.id]);
      toggleButton.setAttribute('aria-pressed', String(added));
      toggleLabel.textContent = added ? 'In favorites' : 'Add to favorites';
    }
    render();
  }

  // ---------- Opening and closing ----------
  let scroll = ''; // the page's own `overflow`, put back when the list closes
  let next = ''; // the link followed from the list, opened once it has closed

  function open() {
    if (!list.hidden) return;
    list.hidden = false;
    scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // Its own history entry: the phone's back button closes the list instead of leaving the page
    history.pushState({ ...history.state, [STATE]: true }, '');
    render();
    list.focus();
    refresh(isStale);
  }

  function hide() {
    list.hidden = true;
    document.documentElement.style.overflow = scroll;
    if (next) location.assign(next);
    next = '';
  }

  function close(link = '') {
    if (list.hidden) return;
    next = link;
    if (history.state?.[STATE]) history.back();
    else hide();
  }

  window.addEventListener('popstate', () => {
    if (!list.hidden) hide();
  });

  // Another tab changed the favorites
  window.addEventListener('storage', (e) => {
    if (e.key === STORE) changed();
  });

  refreshButton.addEventListener('click', () => refresh(() => true));
  closeButton.addEventListener('click', () => close());
  addButton.addEventListener('click', () => toggle(titlePage ? { ...titlePage, checked: Date.now() } : here));
  list.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  // Links close the list first, so that coming back does not land on its history entry
  list.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    close(link.href === location.href ? '' : link.href);
  });

  // The star opening the list: in the navigation bar, or floating where the page has none
  const openButton = el('button', { type: 'button', class: 'dsf-open', 'aria-label': 'Favorites' }, icon(STAR));
  openButton.addEventListener('click', open);
  const nav = document.querySelector(NAV_BUTTONS);
  if (nav) {
    nav.prepend(openButton);
  } else {
    openButton.classList.add('dsf-floating');
    document.body.append(openButton);
  }

  // A favorite's own page is the freshest source of its latest chapter
  if (titlePage && load()[titlePage.id]) {
    update((favorites) => Object.assign(favorites[titlePage.id], titlePage, { checked: Date.now(), failed: false }));
  }
  changed();
})();
