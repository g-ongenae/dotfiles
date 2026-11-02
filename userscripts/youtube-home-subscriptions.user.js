// ==UserScript==
// @name         YouTube — Subscriptions on the home page
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.0.0
// @description  When the YouTube home feed is empty (watch history off), shows your subscribed channels there as a grid of avatars instead of the "Your watch history is off" box. Channels with new videos come first and carry a dot.
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Hide the "Your watch history is off" box once the channels are shown
  const HIDE_NUDGE = true;
  // Put channels with new content first (otherwise keep the sidebar order)
  const NEW_FIRST = true;

  const GRID_ID = 'yths-subscriptions';
  const HOME = 'ytd-browse[page-subtype="home"]';
  const NUDGE = `${HOME} ytd-rich-section-renderer:has(ytd-feed-nudge-renderer)`;
  const AVATAR = 88; // px

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    ${HIDE_NUDGE ? `html:has(#${GRID_ID}) ${NUDGE} { display: none !important; }` : ''}
    /* The rich grid centres its children: stretch to the full width of the feed */
    #${GRID_ID} { align-self: stretch; box-sizing: border-box; width: 100%; margin: 24px 0 32px; padding: 0 8px; }
    #${GRID_ID} .yths-head {
      display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px;
      color: var(--yt-spec-text-primary, #0f0f0f);
    }
    #${GRID_ID} h2 { margin: 0; font: 700 2rem/2.8rem Roboto, Arial, sans-serif; }
    #${GRID_ID} .yths-head a {
      font: 500 1.4rem/2rem Roboto, Arial, sans-serif; text-decoration: none;
      color: var(--yt-spec-call-to-action, #065fd4);
    }
    #${GRID_ID} ul {
      list-style: none; margin: 0; padding: 0;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;
    }
    #${GRID_ID} li > a {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 16px 8px; border-radius: 12px; text-decoration: none;
      color: var(--yt-spec-text-primary, #0f0f0f);
    }
    #${GRID_ID} li > a:hover { background: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05)); }
    #${GRID_ID} .yths-avatar { position: relative; width: ${AVATAR}px; height: ${AVATAR}px; }
    #${GRID_ID} img {
      width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
      background: var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05));
    }
    #${GRID_ID} .yths-new .yths-avatar::after {
      content: ''; position: absolute; right: 4px; bottom: 4px; width: 14px; height: 14px; border-radius: 50%;
      background: var(--yt-spec-call-to-action, #065fd4);
      box-shadow: 0 0 0 3px var(--yt-spec-base-background, #fff);
    }
    #${GRID_ID} .yths-name {
      font: 500 1.4rem/2rem Roboto, Arial, sans-serif; text-align: center;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // ---------- Subscriptions, read from the sidebar guide ----------
  // The guide holds every subscription, even when it is collapsed. Those behind "Show more" are only
  // rendered once it is expanded, so they are read from the element's data instead.
  const big = (url) => url.replace(/=s\d+-/, `=s${AVATAR * 2}-`); // the guide asks for 88px avatars; ask for a crisp size
  const text = (t) => t?.simpleText ?? t?.runs?.map((r) => r.text).join('') ?? '';

  function avatarOf(entry) {
    let url = '';
    try {
      // The sidebar keeps the avatar data on a non-upgraded icon, so it is there before any lazy load
      const raw = entry.querySelector('yt-icon[disable-upgrade^="{"]')?.getAttribute('disable-upgrade');
      url = JSON.parse(raw).thumbnails.at(-1).url;
    } catch {
      const src = entry.querySelector('img')?.src || '';
      if (src.startsWith('http')) url = src;
    }
    return big(url);
  }

  // Polymer data of an element: through the X-ray wrapper when the script runs as a Firefox content script
  function dataOf(node) {
    const raw = node.wrappedJSObject ?? node;
    return (raw.polymerController ?? raw).data;
  }

  function hidden(section) {
    const subs = [];
    for (const node of section.querySelectorAll('ytd-guide-collapsible-entry-renderer')) {
      let items;
      try { items = dataOf(node)?.expandableItems; } catch { continue; }
      for (const item of items ?? []) {
        const e = item.guideEntryRenderer;
        const path = e?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl
          ?? e?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url;
        if (!path || !/^\/(@|channel\/)/.test(path)) continue;
        subs.push({
          href: new URL(path, location.origin).href,
          name: text(e.formattedTitle),
          avatar: big(e.thumbnail?.thumbnails?.at(-1)?.url ?? ''),
          isNew: e.presentationStyle === 'GUIDE_ENTRY_PRESENTATION_STYLE_NEW_CONTENT',
        });
      }
    }
    return subs;
  }

  function subscriptions() {
    const header = document.querySelector('ytd-guide-renderer a[href$="/feed/subscriptions"]');
    const section = header?.closest('ytd-guide-section-renderer');
    if (!section) return [];
    const subs = [];
    for (const entry of section.querySelectorAll('ytd-guide-entry-renderer')) {
      const a = entry.querySelector('a#endpoint[href]');
      if (!a || a === header || !/\/(@|channel\/)/.test(a.pathname)) continue;
      subs.push({
        href: a.href,
        name: a.title || entry.querySelector('.title')?.textContent.trim() || '',
        avatar: avatarOf(entry),
        isNew: entry.getAttribute('line-end-style') === 'dot',
      });
    }
    // Once "Show more" was expanded, its channels are in both lists: keep the rendered ones
    const seen = new Set(subs.map((s) => s.href));
    for (const s of hidden(section)) if (!seen.has(s.href)) { seen.add(s.href); subs.push(s); }
    if (NEW_FIRST) subs.sort((x, y) => y.isNew - x.isNew); // stable: keeps the guide order within each group
    return subs;
  }

  // With the mini guide shown, YouTube only loads the full guide when the ☰ button is hovered:
  // hover it for the user. Retried at most once a second, until the button is ready.
  let lastRequest = 0;
  function requestGuide() {
    if (Date.now() - lastRequest < 1000) return;
    const button = document.querySelector('ytd-masthead #guide-button');
    if (!button) return;
    lastRequest = Date.now();
    button.dispatchEvent(new MouseEvent('mouseenter'));
  }

  // ---------- Grid ----------
  function el(tag, props = {}, ...children) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  function build(subs) {
    const list = el('ul');
    for (const s of subs) {
      const img = el('img', { src: s.avatar, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
      list.append(el('li', { className: s.isNew ? 'yths-new' : '' },
        el('a', { href: s.href, title: s.isNew ? `${s.name} — new content` : s.name },
          el('span', { className: 'yths-avatar' }, img),
          el('span', { className: 'yths-name' }, s.name))));
    }
    return el('section', { id: GRID_ID },
      el('div', { className: 'yths-head' },
        el('h2', { textContent: 'Subscriptions' }),
        el('a', { href: '/feed/subscriptions', textContent: 'Latest videos' }),
        el('a', { href: '/feed/channels', textContent: 'Manage' })),
      list);
  }

  // ---------- Main pass (YouTube is an SPA) ----------
  let lastKey = '';
  function run() {
    const grid = document.querySelector(`${HOME} ytd-rich-grid-renderer`);
    const existing = document.getElementById(GRID_ID);
    // Only fill the home page when its feed is empty, i.e. shows the watch history nudge
    if (!grid || !grid.querySelector('ytd-feed-nudge-renderer')) {
      existing?.remove();
      lastKey = '';
      return;
    }
    const subs = subscriptions();
    if (!subs.length) { requestGuide(); return; } // the observer runs us again once the guide is in
    const key = JSON.stringify(subs);
    if (existing && existing.parentNode === grid && key === lastKey) return;
    lastKey = key;
    existing?.remove();
    grid.insertBefore(build(subs), grid.querySelector(':scope > #contents'));
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['line-end-style'] });
  window.addEventListener('yt-navigate-finish', run);
})();
