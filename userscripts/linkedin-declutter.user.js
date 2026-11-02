// ==UserScript==
// @name         LinkedIn — Declutter & wide feed
// @namespace    https://github.com/g-ongenae/dotfiles
// @version      1.0.0
// @description  Hides Jobs, For Business, Premium upsells, Groups/Newsletters/Events and the right rail; widens the feed; moves the composer to the left column; shows post images beside the text; removes "Show translation" on French/English posts.
// @match        https://www.linkedin.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const HIDE = 'data-lkc-hide';
  const MEDIA = 'data-lkc-media';
  const POST = 'data-lkc-post'; // post laid out as text | media
  const SIDE = 'data-lkc-side'; // the media column of such a post
  const TEXT = 'data-lkc-text'; // main text of a feed post
  const MOVED = 'data-lkc-moved'; // composer / feed sort moved to the left column
  // Post images/videos are shrunk to 1/8 of the post width, but never below 100px.
  const MEDIA_MAX_WIDTH = 'max(12.5%, 100px)';
  // Smaller images are avatars, logos or reactions and are left alone.
  const MEDIA_THRESHOLD_PX = 250;
  // Padding/borders a media wrapper may add around the image itself.
  const MEDIA_SLACK_PX = 40;

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
    [${HIDE}] { display: none !important; }
    [${MOVED}] #shareboxProfilePictureComponentRef { display: none !important; }
    /* Post text: max-height instead of line-clamp, so no "… more"; the expand button says there is more.
       3 lines like LinkedIn, or whatever fits beside the image (see fitText). */
    [${TEXT}] {
      display: block !important;
      -webkit-line-clamp: unset !important;
      max-height: var(--lkc-max, 3lh) !important;
      overflow: hidden !important;
    }
    [${TEXT}][data-lkc-expanded] { max-height: none !important; }
    [${TEXT}] [data-testid="expandable-text-button"] { display: none !important; }
    /* Look comes from the classes copied off LinkedIn's "Send" button */
    .lkc-expand svg { display: block !important; width: 20px !important; height: 20px !important; }
    .lkc-expand[hidden] { display: none !important; }
    /* Skip rendering posts far off-screen; the auto keyword remembers their last real height */
    [data-testid="mainFeed"] [role="listitem"]:not([role="listitem"] [role="listitem"]) {
      content-visibility: auto;
      contain-intrinsic-size: auto 600px;
    }
    [${MEDIA}] { max-width: ${MEDIA_MAX_WIDTH} !important; }
    [${MEDIA}] img, [${MEDIA}] video { max-width: 100% !important; }
    @media (min-width: 992px) {
      [${POST}] {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        column-gap: 16px !important;
        align-items: start !important;
      }
      [${POST}] > * { grid-column: 1 !important; }
      [${POST}] > [${SIDE}] {
        grid-column: 2 !important; width: 100% !important;
        padding: 1px !important; box-sizing: border-box !important;
      }
      [${SIDE}], [${SIDE}] [${MEDIA}] { max-width: none !important; }
      /* Next to an image the text gets as many lines as fit beside it (see fitText) */
      [${MOVED}] [data-lkc-actions] {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      [${MOVED}] [data-lkc-actions] > *, [${MOVED}] [data-lkc-actions] > * > * {
        justify-content: flex-start !important;
      }
      [data-lkc-layout="grid"] {
        grid-template-columns: var(--lkc-cols) !important;
        grid-template-areas: none !important;
      }
      [data-lkc-layout="grid"] > [data-lkc-col="left"] {
        grid-area: auto !important; grid-column: 1 !important; grid-row: 1 !important;
      }
      [data-lkc-layout="grid"] > [data-lkc-col="center"] {
        grid-area: auto !important; grid-column: var(--lkc-center-col) !important; grid-row: 1 !important;
      }
      [data-lkc-layout="flex"] > [data-lkc-col="center"] {
        flex: 1 1 auto !important; width: auto !important;
      }
      [data-lkc-col="center"] { max-width: none !important; }
    }
  `;
  document.head.appendChild(style);

  // ---------- Helpers ----------
  const hide = (el, reason = '') => { if (el && !el.hasAttribute(HIDE)) el.setAttribute(HIDE, reason); };

  /** Climb from `el` to the ancestor that is a sibling-level block of `other` (i.e. whose parent contains `other`). */
  function blockOf(el, other) {
    if (!el || !other || el.contains(other) || other.contains(el)) return null;
    let cur = el;
    while (cur.parentElement && !cur.parentElement.contains(other)) cur = cur.parentElement;
    return cur.parentElement ? cur : null;
  }

  const navItem = (el) => el.closest('li') || el.closest('a, button') || el;

  const RX = {
    puzzles: /^Today[’']s puzzles$/i,
    addFeed: /^Add to your feed$/i,
    copyright: /^LinkedIn Corporation ©/i,
    startPost: /^Start a post/i,
    feedView: /^Select feed view/i,
    video: /^Video$/i,
    article: /^Write article$/i,
    home: /^Home$/i,
    me: /^Me$/i,
    jobs: /^Jobs$/i,
    business: /^For Business$/i,
    premium: /^(Retry|Try|Reactivate)\b.{0,20}\bfor\b/i,
    recommended: /^Recommended for you$/i,
    translation: /^(Show|See) translation$|^(Voir|Afficher) la traduction$/i,
  };

  /** Single pass over short text nodes, bucketed by regex. */
  function scanText() {
    const found = Object.fromEntries(Object.keys(RX).map((k) => [k, []]));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue.trim();
      if (!t || t.length > 40 || !n.parentElement) continue;
      for (const k in RX) {
        if (RX[k].test(t)) { found[k].push(n.parentElement); break; }
      }
    }
    return found;
  }

  // ---------- Language detection (stop-word scoring) ----------
  // Order matters: on a tie the first language wins, so fr/en come last to stay conservative.
  const STOP = Object.fromEntries(Object.entries({
    es: 'el los las una del y es por para con que en se no lo al su como más pero muy está son este esta de la',
    it: 'il lo gli una di e è che per con non sono del della nel come più ma anche questo la',
    pt: 'o os as um uma do da dos das e é não para com que em no na por mais mas como muito são de',
    de: 'der die das und ist nicht ich du wir sie mit für auf ein eine zu den dem von auch es sich',
    nl: 'de het een en is van op te dat niet ik je we met voor zijn maar ook om',
    fr: 'le la les une des du de et est pas pour qui dans sur avec ce cette ces sont mais au aux il elle ils nous vous je ne plus son sa ses leur être fait très tout comme bien aussi qu c j',
    en: 'the and is are was were to of in on for with that this it be not you we they have has but at by from your our will can just what about',
  }).map(([lang, words]) => [lang, new Set(words.split(' '))]));

  function detectLang(text) {
    const words = text.toLowerCase().match(/\p{L}+/gu) || [];
    if (words.length < 3) return null;
    let best = null;
    let bestScore = 0;
    for (const [lang, set] of Object.entries(STOP)) {
      let score = 0;
      for (const w of words) if (set.has(w)) score++;
      if (score > bestScore) { best = lang; bestScore = score; }
    }
    return bestScore >= 2 && bestScore / words.length >= 0.08 ? best : null;
  }

  /** Text of the post the "Show translation" button belongs to. */
  function postText(btn) {
    const own = btn.innerText.trim();
    let el = btn.parentElement;
    for (let i = 0; el && i < 6; i++, el = el.parentElement) {
      const txt = el.innerText.replace(own, '').trim();
      if (txt.length >= 20) return txt;
    }
    return null;
  }

  // ---------- Media ----------
  /** Mark the outermost box wrapping each post image/video; CSS caps its width (aspect-ratio children follow). */
  function markMedia(col) {
    for (const m of col.querySelectorAll('img, video')) {
      if (m.closest(`[${MEDIA}]`)) continue;
      const r = m.getBoundingClientRect();
      if (r.width < MEDIA_THRESHOLD_PX) continue; // also skips lazy images not loaded yet
      let box = m;
      for (let p = m.parentElement; p && p !== col; p = p.parentElement) {
        const pr = p.getBoundingClientRect();
        const { display } = getComputedStyle(p);
        if (display === 'contents') continue; // no box of its own
        if (pr.width > r.width + MEDIA_SLACK_PX || pr.height > r.height + MEDIA_SLACK_PX) break;
        if (display !== 'inline') box = p;
      }
      box.setAttribute(MEDIA, '');
      sideBySide(box);
    }
  }

  /** Put the first media of a post in a right-hand column, next to the text. */
  function sideBySide(box) {
    // The post body is the box holding the (visually hidden) "Feed post" <h2>; collages nest deeper
    const post = box.parentElement && box.parentElement.closest(':has(> h2)');
    if (!post || post.hasAttribute(POST) || !post.closest('[role="listitem"]')) return;
    let item = box;
    while (item.parentElement !== post) item = item.parentElement;
    const others = [...post.children].filter((c) => c !== item);
    if (!others.length) return;
    // One row per block, plus a flexible row right above the action bar: a tall image pushes the
    // action bar down to its bottom edge instead of spreading the text apart
    const bar = others.findIndex((c) => c.querySelector('[aria-label="Send"]'));
    const before = bar < 0 ? others.length : bar;
    const rows = [];
    if (before) rows.push(`repeat(${before}, auto)`);
    rows.push('minmax(0, 1fr)');
    if (others.length > before) rows.push(`repeat(${others.length - before}, auto)`);
    post.style.setProperty('grid-template-rows', rows.join(' '), 'important');
    others.forEach((c, i) => c.style.setProperty('grid-row', String(i < before ? i + 1 : i + 2), 'important'));
    item.style.setProperty('grid-row', `1 / span ${bar < 0 ? before + 1 : before + 2}`, 'important');
    item.setAttribute(SIDE, '');
    post.setAttribute(POST, '');
  }

  /** Clamp the text of a side-by-side post so the text column ends where the media does. */
  function fitText(post) {
    const side = post.querySelector(`:scope > [${SIDE}]`);
    const text = post.querySelector(`[${TEXT}]`);
    if (!side || !text || side.contains(text)) return;
    const sideH = side.getBoundingClientRect().height;
    const textH = text.getBoundingClientRect().height;
    if (!sideH || !textH) return; // off-screen (content-visibility) or not loaded yet
    // Height of the text column without the flexible spacer row (which only fills the gap to the image)
    let used = 0;
    for (const c of post.children) {
      if (c === side) continue;
      const h = c.getBoundingClientRect().height;
      if (h < 2) continue; // visually hidden heading, empty slots
      const cs = getComputedStyle(c);
      used += h + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    }
    if (!used) return;
    // Room left for the text once header and action bar are placed; stable whatever the current clamp is
    const room = textH + sideH - used;
    const cs = getComputedStyle(text);
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.43;
    const max = `${Math.max(2, Math.floor(room / lineH)) * lineH}px`;
    if (!text.hasAttribute('data-lkc-expanded') && text.style.getPropertyValue('--lkc-max') !== max) {
      text.style.setProperty('--lkc-max', max);
    }
  }

  // Line icons on a 20px grid like LinkedIn's: ↨ (expand) and ↥ (collapse)
  const ICONS = {
    expand: 'M10 2v13M6 6l4-4 4 4M6 11l4 4 4-4M5 18h10',
    collapse: 'M10 15V3M6 7l4-4 4 4M5 18h10',
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
    for (const [k, v] of Object.entries({
      fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    })) path.setAttribute(k, v);
    svg.appendChild(path);
    return svg;
  }

  /** Mark the main text of every post (not comment texts) and give it an expand button. */
  function postTexts(col) {
    for (const text of col.querySelectorAll('[data-testid="expandable-text-box"]')) {
      if (!text.hasAttribute(TEXT)) {
        const post = text.closest(':has(> h2)');
        // Comments live in the same post body, after the post text: only the first text box counts
        if (!post || post.querySelector('[data-testid="expandable-text-box"]') !== text) continue;
        text.setAttribute(TEXT, '');
      }
      const post = text.closest(':has(> h2)');
      if (post) expandButton(post, text);
    }
  }

  /** Expand/collapse toggle next to "Send", shown only when the text is actually cut. */
  function expandButton(post, text) {
    let btn = post.querySelector('.lkc-expand');
    if (!btn) {
      const send = [...post.querySelectorAll('[aria-label="Send"]')].find((el) => !el.closest(`[${SIDE}]`));
      if (!send) return;
      btn = document.createElement('button');
      btn.type = 'button';
      // Same classes as "Send" (and its inner span) so size, padding and hover match exactly
      btn.className = `${send.className} lkc-expand`;
      const inner = document.createElement('span');
      const sendInner = send.querySelector(':scope > span');
      if (sendInner) {
        inner.className = sendInner.className;
        inner.style.cssText = sendInner.style.cssText; // LinkedIn sets min-height inline
      }
      const label = (open) => {
        inner.replaceChildren(icon(open ? 'collapse' : 'expand'));
        btn.title = open ? 'Collapse text' : 'Show full text';
        btn.setAttribute('aria-label', btn.title);
        btn.setAttribute('aria-expanded', String(open));
      };
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const t = post.querySelector(`[${TEXT}]`); // LinkedIn may have re-rendered the text since
        if (!t) return;
        const open = !t.hasAttribute('data-lkc-expanded');
        t.toggleAttribute('data-lkc-expanded', open);
        label(open);
      });
      btn.appendChild(inner);
      label(false);
      send.after(btn);
    }
    btn.hidden = !text.hasAttribute('data-lkc-expanded') && text.scrollHeight <= text.clientHeight + 1;
  }

  // ---------- Moving React-owned nodes ----------
  // React later removes/inserts children through the original parent; make it tolerate the move.
  const pageObj = (n) => n.wrappedJSObject || n;
  const pageFn = (fn, n) => (typeof exportFunction === 'function' ? exportFunction(fn, pageObj(n)) : fn);
  let composerHome = null; // where the composer used to be, still inside the feed column

  function moveAfter(node, target, kind) {
    const home = node.parentElement;
    const page = pageObj(home);
    if (!home.hasAttribute('data-lkc-home')) {
      const rm = home.removeChild.bind(home);
      const ins = home.insertBefore.bind(home);
      page.removeChild = pageFn((c) => {
        if (c.parentNode === home) return rm(c);
        c.remove();
        return c;
      }, home);
      page.insertBefore = pageFn((c, ref) => ins(c, ref && ref.parentNode === home ? ref : null), home);
      home.setAttribute('data-lkc-home', '');
    }
    composerHome = home;
    node.setAttribute(MOVED, kind);
    target.after(node);
  }

  // ---------- Layout ----------
  function widen(grid, centerCol, leftCol) {
    if (grid.hasAttribute('data-lkc-layout') || window.innerWidth < 992) return;
    const isGrid = getComputedStyle(grid).display.includes('grid');
    const left = leftCol && leftCol.parentElement === grid ? leftCol : null;
    if (isGrid) {
      const lw = left ? Math.round(left.getBoundingClientRect().width) : 0;
      if (left && !lw) return; // not laid out yet, retry on next pass
      grid.style.setProperty('--lkc-cols', left ? `${lw}px minmax(0, 1fr)` : 'minmax(0, 1fr)');
      grid.style.setProperty('--lkc-center-col', left ? '2' : '1');
      if (left) left.setAttribute('data-lkc-col', 'left');
    }
    centerCol.setAttribute('data-lkc-col', 'center');
    grid.setAttribute('data-lkc-layout', isGrid ? 'grid' : 'flex');
  }

  function undoFeedLayout() {
    for (const el of document.querySelectorAll(`[${HIDE}="rail"]`)) el.removeAttribute(HIDE);
    for (const el of document.querySelectorAll('[data-lkc-layout]')) {
      el.removeAttribute('data-lkc-layout');
      el.style.removeProperty('--lkc-cols');
      el.style.removeProperty('--lkc-center-col');
    }
    for (const el of document.querySelectorAll('[data-lkc-col]')) el.removeAttribute('data-lkc-col');
  }

  // ---------- Main pass ----------
  function run() {
    const f = scanText();
    const onFeed = location.pathname.startsWith('/feed');

    const startPost = [document.getElementById('shareboxProfilePictureComponentRef'), ...f.startPost]
      .find((el) => el && !el.closest(`[${MOVED}]`));
    const center = startPost
      || (composerHome && composerHome.isConnected ? composerHome : null)
      || document.querySelector('main [data-urn*="activity"], main [data-id*="activity"]');
    const rightAnchor = f.puzzles[0] || f.addFeed[0] || f.copyright[0];
    const saved = document.querySelector('a[href*="/my-items"]');
    const centerCol = center && blockOf(center, rightAnchor || saved);

    // Top navigation: Jobs, For Business, Premium
    const inTopBar = (el) => {
      if (centerCol && centerCol.contains(el)) return false;
      if (el.closest('header, #global-nav')) return true;
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.bottom < 120;
    };
    const me = f.me.find(inTopBar);
    const home = f.home.find(inTopBar);
    // Climb to the whole nav entry: up to the block next to "Me"/"Home", else the nearest link/button
    const navEntry = (el) => {
      const anchor = [me, home].find((a) => a && !a.contains(el) && !el.contains(a));
      return (anchor && blockOf(el, anchor)) || navItem(el);
    };
    const premiumChips = [...document.querySelectorAll('svg[id^="premium-chip"], a[href*="/premium"]'), ...f.premium];
    for (const el of [...f.jobs, ...f.business, ...premiumChips, ...document.querySelectorAll('a[href*="/jobs"]')]) {
      if (inTopBar(el)) hide(navEntry(el));
    }

    // Everything right of "Me" (For Business, Premium icon, separators)
    if (me) {
      const meRight = me.getBoundingClientRect().right;
      const hideRight = (item) => {
        for (let s = item && item.nextElementSibling; s; s = s.nextElementSibling) {
          const r = s.getBoundingClientRect();
          // Closed dropdowns have no size and open ones overflow the bar: leave them alone
          if (r.height > 0 && r.bottom < 120 && r.left >= meRight - 1) hide(s);
        }
      };
      hideRight(me.closest('li'));
      hideRight(home && blockOf(me, home));
    }

    // Left column: Groups / Newsletters / Events + Premium card
    const leftCol = saved && center ? blockOf(saved, center) : null;
    if (leftCol) {
      for (const a of leftCol.querySelectorAll('a[href*="/groups"], a[href*="newsletters"], a[href*="/events"]')) {
        hide(blockOf(a, saved) || navItem(a));
      }
      const premiumEls = [
        ...leftCol.querySelectorAll('a[href*="/premium"]'),
        ...f.premium.filter((el) => leftCol.contains(el)),
      ];
      for (const el of premiumEls) {
        const card = blockOf(el, saved);
        // Never hide the profile card if the upsell lives inside it
        hide(card && !card.querySelector('a[href*="/in/"]') ? card : el.parentElement);
      }
    }

    // Right rail + wider feed (feed page only)
    if (onFeed && rightAnchor && center) {
      const rightCol = blockOf(rightAnchor, center);
      const cCol = blockOf(center, rightAnchor);
      if (rightCol && cCol && rightCol.parentElement === cCol.parentElement) {
        hide(rightCol, 'rail');
        widen(rightCol.parentElement, cCol, leftCol);
      }
    } else if (!onFeed) {
      undoFeedLayout();
    }

    if (centerCol) {
      markMedia(centerCol);
      postTexts(centerCol);
      for (const post of centerCol.querySelectorAll(`[${POST}]`)) fitText(post);
    }

    // Composer and feed sort go below "Saved items" (feed page only).
    // Runs after the layout code above, which locates the feed column through the composer.
    // The composer is a listitem too: the first real post is the first listitem without it
    const firstPost = centerCol && [...centerCol.querySelectorAll('[role="listitem"]')]
      .find((li) => !(startPost && li.contains(startPost)) && !f.feedView.some((e) => li.contains(e)));
    // The left column stretches to the feed height: insert into the card stack, right after "Saved items"
    const profile = leftCol && leftCol.querySelector('a[href*="/in/"]');
    const savedCard = profile && blockOf(saved, profile);
    if (onFeed && savedCard && firstPost) {
      const moves = [['composer', startPost], ['sort', f.feedView.find((e) => centerCol.contains(e))]];
      for (const [kind, el] of moves) {
        const block = el && blockOf(el, firstPost);
        if (!block || block === centerCol || !centerCol.contains(block)) continue;
        const composer = kind === 'sort' && savedCard.parentElement.querySelector(`:scope > [${MOVED}="composer"]`);
        moveAfter(block, composer || savedCard, kind);
        const v = f.video.find((e) => block.contains(e));
        const a = f.article.find((e) => block.contains(e));
        const row = v && a && blockOf(v, a);
        if (row) row.parentElement.setAttribute('data-lkc-actions', '');
      }
    }

    // "Recommended for you" (people to follow) cards in the feed
    for (const el of f.recommended) hide(el.closest('[role="listitem"]'));

    // "Show translation" on French / English posts
    for (const el of f.translation) {
      const btn = el.closest('button, a, [role="button"]') || el;
      if (btn.hasAttribute('data-lkc-tr')) continue;
      const text = postText(btn);
      if (!text) continue; // post not rendered yet, retry on next pass
      btn.setAttribute('data-lkc-tr', '');
      const lang = detectLang(text);
      if (lang === 'fr' || lang === 'en') {
        const parent = btn.parentElement;
        const onlyChild = parent && parent.children.length === 1
          && parent.innerText.trim() === btn.innerText.trim();
        hide(onlyChild ? parent : btn);
      }
    }
  }

  // ---------- Scheduling (throttled, LinkedIn is an SPA) ----------
  let timer = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; run(); }, 250);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('load', schedule, true); // lazy images get their size late
  // Posts skipped by content-visibility have no size until scrolled into view
  window.addEventListener('scroll', schedule, { passive: true });

  // ---------- Memory: pause videos once they leave the screen ----------
  const offscreen = new IntersectionObserver((entries) => {
    for (const e of entries) if (!e.isIntersecting && !e.target.paused) e.target.pause();
  });
  const watched = new WeakSet();
  setInterval(() => {
    for (const v of document.querySelectorAll('video')) {
      if (!watched.has(v)) { watched.add(v); offscreen.observe(v); }
    }
  }, 2000);

  run();
})();
