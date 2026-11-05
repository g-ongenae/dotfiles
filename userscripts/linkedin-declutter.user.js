// ==UserScript==
// @name         LinkedIn — Declutter & wide feed
// @namespace    https://github.com/g-ongenae/dotfiles
// @author       g-ongenae
// @version      1.4.9
// @description  Hides Jobs, For Business, Premium upsells, Groups/Newsletters/Events, the footer and the right rail; widens the feed and single posts and lays out the posts of company and profile pages like the feed; moves the composer to the left column; shows post images beside the text; adds panel buttons folding the left column of the feed and the side column of company and profile pages (folded by default); removes "Show translation" on French/English posts.
// @match        https://www.linkedin.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Settings ----------
  // Hide the "Messaging" pop-up docked at the bottom right. The unread count stays on the
  // Messaging icon of the top bar. Set to false to keep the pop-up.
  const HIDE_MESSAGING_POPUP = true;
  // LinkedIn keeps every post it has loaded in memory (gigabytes after a long scroll) and only a
  // reload frees it. After this many posts the feed stops and offers a fresh one. 0 disables.
  const FRESH_FEED_AFTER = 50;
  // Fold columns on first visit: the left one of the feed and single posts (profile, composer), the
  // right one of company and profile pages ("People also viewed", …). Afterwards, a panel button at
  // the page edge toggles them and the last state is remembered.
  const FOLD_LEFT_BY_DEFAULT = false;
  const FOLD_SIDE_BY_DEFAULT = true;

  const HIDE = 'data-lkc-hide';
  const MEDIA = 'data-lkc-media';
  const POST = 'data-lkc-post'; // post laid out as text | media
  const SIDE = 'data-lkc-side'; // the media column of such a post
  const TEXT = 'data-lkc-text'; // main text of a feed post
  const MOVED = 'data-lkc-moved'; // composer / feed sort moved to the left column
  const TEXT_BOX = '[data-testid="expandable-text-box"]'; // LinkedIn's post / comment text
  const CARD = 'data-lkc-card'; // post card of a profile's Activity section; value: width it was fitted for
  const CARD_GAP_PX = 12; // between the text and the image of such a card
  // Post images/videos are shrunk to 1/8 of the post width, but never below 100px.
  const MEDIA_MAX_WIDTH = 'max(12.5%, 100px)';
  // Smaller images are avatars, logos or reactions and are left alone.
  const MEDIA_THRESHOLD_PX = 250;
  // Padding/borders a media wrapper may add around the image itself.
  const MEDIA_SLACK_PX = 40;
  // The top bar is about 52px tall; with the sticky header of a company or profile page under it
  // the pair is much taller
  const TOP_BAR_MAX_PX = 100;
  const FOLD = 'data-lkc-fold'; // a foldable column: "left" or "side"
  const FOLD_ROW = 'data-lkc-fold-row'; // the row holding the side column, re-laid out while it is folded
  const FOLDS = {
    left: { label: 'left column', byDefault: FOLD_LEFT_BY_DEFAULT },
    side: { label: 'side column', byDefault: FOLD_SIDE_BY_DEFAULT },
  };
  for (const [name, fold] of Object.entries(FOLDS)) {
    fold.key = `lkc-${name}-folded`;
    fold.attr = `data-lkc-${name}-folded`; // on <html>
    const stored = localStorage.getItem(fold.key);
    fold.folded = stored === null ? fold.byDefault : stored === '1';
  }

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
    .lkc-fresh {
      display: block; width: 100%; margin: 8px 0 24px; padding: 16px;
      border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px;
      background: var(--color-background-container, #fff); color: inherit;
      font: inherit; font-size: 16px; font-weight: 600; cursor: pointer;
    }
    .lkc-fresh:hover { background: rgba(0, 0, 0, 0.04); }
    /* Folded columns disappear and the others take their room; only the panel button stays */
    html[${FOLDS.left.attr}] [${FOLD}="left"], html[${FOLDS.side.attr}] [${FOLD}="side"] { display: none !important; }
    html[${FOLDS.left.attr}] [data-lkc-layout="grid"] { --lkc-cols: minmax(0, 1fr) !important; --lkc-center-col: 1 !important; }
    /* A row left with a single column (side column folded, or emptied by hiding its only card) */
    html[${FOLDS.side.attr}] [${FOLD_ROW}], [data-lkc-solo] {
      grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: none !important;
    }
    html[${FOLDS.side.attr}] [${FOLD_ROW}] > :not([${FOLD}]), [data-lkc-solo] > * {
      grid-area: auto !important; grid-column: 1 / -1 !important; flex: 1 1 auto !important; max-width: none !important;
    }
    .lkc-fold {
      /* At the page edges, in the top bar */
      position: fixed; z-index: 10000; top: max(4px, calc((var(--lkc-bar, 52px) - 32px) / 2));
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; padding: 0; border: none; border-radius: 8px;
      background: transparent; color: rgba(0, 0, 0, 0.6); cursor: pointer;
    }
    .lkc-fold:hover { background: rgba(0, 0, 0, 0.08); color: rgba(0, 0, 0, 0.9); }
    .lkc-fold[hidden] { display: none !important; }
    .lkc-fold svg { width: 20px; height: 20px; }
    #lkc-fold-left { left: 8px; }
    #lkc-fold-side { right: 8px; }
    .lkc-fresh small { display: block; margin-top: 4px; font-size: 13px; font-weight: 400; opacity: 0.7; }
    /* Skip rendering posts far off-screen; the auto keyword remembers their last real height */
    [data-testid="mainFeed"] [role="listitem"]:not([role="listitem"] [role="listitem"]) {
      content-visibility: auto;
      contain-intrinsic-size: auto 600px;
    }
    /* :where adds no weight, so [${SIDE}] below still lifts the cap */
    [${MEDIA}]:not(:where(dialog, [role="dialog"], [aria-modal="true"]) *) { max-width: ${MEDIA_MAX_WIDTH} !important; }
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
  const offscreen = new IntersectionObserver((entries) => {
    for (const e of entries) if (!e.isIntersecting && !e.target.paused) e.target.pause();
  });
  const watched = new WeakSet();

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
    // Upsell cards of the left column of a post and of company pages ("The latest hiring trends")
    upsell: /^Limited offer\b|^Redeem now$|^Restart Premium\b/i,
    adLibrary: /^View ad library\b/i,
    side: /^(People also (viewed|follow)|Pages people also viewed|(Other )?similar pages|Affiliated pages|More profiles for you|People you may know|You might like|Explore Premium profiles|Who your viewers also viewed|Pages for you)$/i,
    recommended: /^Recommended for you$/i,
    messaging: /^Messaging$/i,
    translation: /^(Show|See) translation$|^(Voir|Afficher) la traduction$/i,
  };

  // Elements whose short text matches RX, kept across passes. Only subtrees added since the last
  // pass are scanned, instead of every text node of the page several times a second.
  const found = Object.fromEntries(Object.keys(RX).map((k) => [k, new Set()]));
  let pendingRoots = [document.body];

  function classify(n) {
    const t = n.nodeValue.trim();
    if (!t || t.length > 40 || !n.parentElement) return;
    for (const k in RX) {
      if (RX[k].test(t)) { found[k].add(n.parentElement); return; }
    }
  }

  function scanText() {
    const roots = pendingRoots;
    pendingRoots = [];
    for (const k in found) for (const el of found[k]) if (!el.isConnected) found[k].delete(el);
    for (const root of roots) {
      if (!root.isConnected) continue;
      if (root.nodeType === Node.TEXT_NODE) { classify(root); continue; }
      if (root.nodeType !== Node.ELEMENT_NODE) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) classify(n);
    }
    return Object.fromEntries(Object.entries(found).map(([k, set]) => [k, [...set]]));
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
  /** A post body: in a feed list, or headed by its own visually hidden "Feed post" heading (single
   *  posts, posts of a company or profile page). Not a page section with a visible <h2>. */
  function isPostBody(el) {
    if (el.closest('[role="listitem"]')) return true;
    const h2 = el.querySelector(':scope > h2');
    return !!h2 && h2.getBoundingClientRect().height < 2;
  }

  /** In the image viewer or another overlay: a dialog, or a fixed box over the page. */
  function inOverlay(el) {
    if (el.closest('dialog, [role="dialog"], [aria-modal="true"]')) return true;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (getComputedStyle(p).position === 'fixed') return true;
    }
    return false;
  }

  /** Mark the outermost box wrapping each post image/video; CSS caps its width (aspect-ratio children follow). */
  function markMedia(col) {
    for (const m of col.querySelectorAll('img, video')) {
      if (m.closest(`[${MEDIA}]`)) continue;
      const r = m.getBoundingClientRect();
      if (r.width < MEDIA_THRESHOLD_PX) continue; // also skips lazy images not loaded yet
      // Opening an image shows it full size in a viewer: never shrink that one
      if (inOverlay(m)) continue;
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
    let post = box.parentElement && box.parentElement.closest(':has(> h2)');
    if (!post || !isPostBody(post)) return;
    // Quote repost: the media belongs to the quoted post (a card with its own text, no <h2>).
    // Lay out that card instead of pushing the whole of it beside the reposter's text.
    const quoted = box.parentElement.closest(`:has(${TEXT_BOX})`);
    if (quoted && post.contains(quoted) && quoted !== post && !box.contains(quoted.querySelector(TEXT_BOX))) post = quoted;
    if (post.hasAttribute(POST)) return;
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
    // A quoted post wraps its media in a display: contents box: without a box of its own, its grid
    // placement is lost and the media lands in the first row only, pushing the text below it
    if (getComputedStyle(item).display === 'contents') item.style.setProperty('display', 'block', 'important');
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

  // Line icons on a 20px grid like LinkedIn's: ↨ (expand), ↥ (collapse) and panels with their left / right column
  const PANEL = 'M4 3h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z';
  const ICONS = {
    expand: 'M10 2v13M6 6l4-4 4 4M6 11l4 4 4-4M5 18h10',
    collapse: 'M10 15V3M6 7l4-4 4 4M5 18h10',
    left: `${PANEL}M7.5 3v14`,
    side: `${PANEL}M12.5 3v14`,
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

  /** The post body of a text box: the one under a "Feed post" heading, else (cards of the Activity
   *  section of a profile) the box around it holding a single action bar. */
  function postOf(text) {
    const post = text.closest(':has(> h2)');
    if (post && isPostBody(post)) return post;
    const card = text.closest(':has([aria-label="Send"])');
    if (!card || card.querySelectorAll('[aria-label="Send"]').length !== 1 || card.querySelector('h1')) return null;
    if (!card.hasAttribute(CARD)) card.setAttribute(CARD, '');
    return card;
  }

  /** Activity card without media: the text runs down to the action bar. */
  function fillCardText(card, text) {
    const cardW = Math.round(card.getBoundingClientRect().width);
    if (!cardW || card.getAttribute(CARD) === String(cardW)) return; // done for this width
    const send = card.querySelector('[aria-label="Send"]');
    let bar = send;
    while (bar && bar.parentElement !== card && !bar.parentElement.contains(text)) bar = bar.parentElement;
    if (!bar) return;
    // The bar stays at the bottom of the card whatever the text height, so the result is stable
    const room = bar.getBoundingClientRect().top - text.getBoundingClientRect().top - CARD_GAP_PX;
    const cs = getComputedStyle(text);
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.43;
    if (room <= 0 || !lineH) return;
    text.style.setProperty('--lkc-max', `${Math.max(3, Math.floor(room / lineH)) * lineH}px`);
    card.setAttribute(CARD, String(cardW));
    expandButton(card);
  }

  /** Activity card: the image fills the card width, and the text takes whatever height it leaves,
   *  instead of 3 lines over an empty gap and an image boxed at a fixed size. */
  function fillCard(card) {
    const text = card.querySelector(`[${TEXT}]`);
    const media = [...card.querySelectorAll('img, video')].find((m) => m.getBoundingClientRect().width >= 200);
    if (!text || text.hasAttribute('data-lkc-expanded')) return;
    if (!media) {
      // An image still loading has no size yet: wait for it rather than give its room to the text
      if ([...card.querySelectorAll('img')].some((i) => !i.complete || !i.getAttribute('src'))) return;
      fillCardText(card, text);
      return;
    }
    const w = media.naturalWidth || media.videoWidth;
    const h = media.naturalHeight || media.videoHeight;
    if (!w || !h) return; // not loaded yet
    // The media frame: its outermost wrapper holding neither the text nor the action bar
    const chain = [];
    for (let p = media.parentElement; p && p !== card; p = p.parentElement) {
      if (p.contains(text) || p.querySelector('[aria-label="Send"]')) break;
      chain.push(p);
    }
    const frame = chain[chain.length - 1];
    if (!frame || !frame.parentElement) return;
    const cardW = Math.round(card.getBoundingClientRect().width);
    if (!cardW || card.getAttribute(CARD) === String(cardW)) return; // done for this width
    // Height shared by the text and the media: unchanged by the split, so the result is stable
    const tr = text.getBoundingClientRect();
    const span = frame.getBoundingClientRect().bottom - tr.top;
    if (span <= 0) return;
    const cs = getComputedStyle(text);
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.43;
    const textMin = Math.min(text.scrollHeight, 3 * lineH); // LinkedIn's 3 lines at least
    const mediaH = Math.round(Math.min(frame.parentElement.getBoundingClientRect().width * (h / w), span - textMin - CARD_GAP_PX));
    if (mediaH < 100) return;
    for (const el of chain) {
      for (const [k, v] of Object.entries({
        width: '100%', height: `${mediaH}px`, 'max-width': 'none', 'max-height': 'none', 'padding-top': '0', 'padding-bottom': '0',
      })) el.style.setProperty(k, v, 'important');
    }
    for (const [k, v] of Object.entries({
      width: '100%', height: `${mediaH}px`, 'max-width': 'none', 'max-height': 'none', 'object-fit': 'contain',
    })) media.style.setProperty(k, v, 'important');
    const room = span - mediaH - CARD_GAP_PX;
    text.style.setProperty('--lkc-max', `${Math.max(3, Math.floor(room / lineH)) * lineH}px`);
    card.setAttribute(CARD, String(cardW));
    expandButton(card); // the text may now fit whole
  }

  /** Mark the main text of every post (not comment texts) and give it an expand button. */
  function postTexts(col) {
    const posts = new Set();
    for (const text of col.querySelectorAll(TEXT_BOX)) {
      const post = postOf(text);
      if (!post) continue;
      if (!text.hasAttribute(TEXT)) {
        // Comments live in the same post body, after the post text: only the first text box counts,
        // plus the one of a quoted post laid out beside its image
        const card = text.closest(`[${POST}]`);
        const first = (el) => el && el.querySelector(TEXT_BOX) === text;
        if (!first(post) && !(card && post.contains(card) && first(card))) continue;
        text.setAttribute(TEXT, '');
      }
      posts.add(post);
    }
    for (const post of posts) expandButton(post);
  }

  /** Expand/collapse toggle next to "Send", shown only when a text of the post is actually cut. */
  function expandButton(post) {
    const texts = () => [...post.querySelectorAll(`[${TEXT}]`)]; // LinkedIn may re-render them
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
        const all = texts();
        if (!all.length) return;
        const open = !all[0].hasAttribute('data-lkc-expanded');
        for (const t of all) t.toggleAttribute('data-lkc-expanded', open);
        label(open);
      });
      btn.appendChild(inner);
      label(false);
      send.after(btn);
    }
    btn.hidden = !texts().some((t) => t.hasAttribute('data-lkc-expanded') || t.scrollHeight > t.clientHeight + 1);
  }

  // ---------- Cards, footer, side column ----------
  /** The card (rounded box with a background) around `el`, unless it holds the page title or a post. */
  function cardOf(el) {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const r = p.getBoundingClientRect();
      if (r.width < 200 || r.height < 60) continue; // buttons and labels
      const cs = getComputedStyle(p);
      const bg = cs.backgroundColor;
      if (!parseFloat(cs.borderTopLeftRadius) || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
      return p.querySelector(`h1, ${TEXT_BOX}, [role="listitem"]`) ? null : p;
    }
    return null;
  }

  /** Hide the column `card` was alone in, and let the rest of its row take the room. */
  function hideEmptyColumn(card) {
    const shown = (c) => !c.hasAttribute(HIDE) && c.getBoundingClientRect().height > 0;
    let col = card;
    for (let p = card.parentElement; p && p !== document.body; p = p.parentElement) {
      if ([...p.children].some(shown)) {
        if (col === card || col.querySelector(`h1, ${TEXT_BOX}`)) return;
        hide(col, 'empty');
        p.setAttribute('data-lkc-solo', '');
        return;
      }
      col = p;
    }
  }

  /** Would hiding `el` blank the page: does it hold the top bar or the main content? */
  const holdsPage = (el, bar) => !!el.querySelector('main') || (!!bar && el.contains(bar));

  /** The block of links ending with the copyright line. */
  function footerOf(el, bar) {
    const footer = el.closest('footer');
    if (footer) return footer;
    let box = el;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      // While LinkedIn re-renders a page it is nearly empty: never climb to the app root then
      if (p.querySelector(`h1, h2, ${TEXT_BOX}, [role="listitem"]`) || p.textContent.length > 1500 || holdsPage(p, bar)) break;
      box = p;
    }
    return box === el ? null : box;
  }

  /** The right-hand column holding `el`: the widest box around it still narrower than a column. */
  function sideColumnOf(el) {
    const vw = window.innerWidth;
    let col = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const r = p.getBoundingClientRect();
      if (r.width > vw * 0.4) break;
      if (r.width) col = p;
    }
    if (!col || col.getBoundingClientRect().left < vw / 2) return null;
    return col.querySelector(`h1, ${TEXT_BOX}`) ? null : col;
  }

  // LinkedIn sizes some images (Activity carousel) in pixels on window resize only: tell it when a
  // column appears or disappears. The resize listener below also reruns fitText.
  const relayout = () => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  function applyFold(name) {
    const fold = FOLDS[name];
    document.documentElement.toggleAttribute(fold.attr, fold.folded);
    const btn = document.getElementById(`lkc-fold-${name}`);
    if (!btn) return;
    btn.title = `${fold.folded ? 'Show' : 'Hide'} the ${fold.label}`;
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-expanded', String(!fold.folded));
  }

  /** Make `col` the foldable column `name` (none on this page when null), with its panel button. */
  function foldColumn(name, col) {
    for (const el of document.querySelectorAll(`[${FOLD}="${name}"]`)) if (el !== col) el.removeAttribute(FOLD);
    for (const el of document.querySelectorAll(`[${FOLD_ROW}="${name}"]`)) {
      if (!col || el !== col.parentElement) el.removeAttribute(FOLD_ROW);
    }
    let btn = document.getElementById(`lkc-fold-${name}`);
    if (!btn && col) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `lkc-fold-${name}`;
      btn.className = 'lkc-fold';
      btn.appendChild(icon(name));
      btn.addEventListener('click', () => {
        FOLDS[name].folded = !FOLDS[name].folded;
        localStorage.setItem(FOLDS[name].key, FOLDS[name].folded ? '1' : '0');
        applyFold(name);
        relayout();
      });
      document.body.appendChild(btn);
      applyFold(name);
    }
    if (btn && btn.hidden !== !col) btn.hidden = !col;
    if (!col) return;
    if (col.getAttribute(FOLD) !== name) {
      col.setAttribute(FOLD, name);
      if (FOLDS[name].folded) relayout(); // folded from the start: the other columns just got wider
    }
    // The feed grid is already ours (see widen); elsewhere, let the rest of the row take the room
    const row = col.parentElement;
    if (name === 'side' && row && row.getAttribute(FOLD_ROW) !== name) row.setAttribute(FOLD_ROW, name);
  }

  // ---------- Fresh feed ----------
  // The feed loads 5 posts per POST to .../rsc-action/actions/pagination?sduiid=...feed.mainFeed,
  // with {"clientArguments":{"payload":{"startIndex":N,...}}} in the body. Past the limit that request
  // is left pending forever (a failed one would be retried), so LinkedIn simply stops loading.
  const FEED_PAGER = 'sduiid=com.linkedin.sdui.pagers.feed.mainFeed';
  let feedCapped = false;

  function feedStartIndex(init) {
    try {
      const body = init && init.body;
      return typeof body === 'string' ? JSON.parse(body).clientArguments.payload.startIndex : null;
    } catch {
      return null;
    }
  }

  function guardFeedPagination() {
    if (!FRESH_FEED_AFTER) return;
    const page = pageObj(window);
    const pageFetch = page.fetch;
    if (typeof pageFetch !== 'function') return;
    const fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.includes(FEED_PAGER)) {
        const start = feedStartIndex(init);
        // Unknown index (body not a string): only block once the limit was already hit
        if (start === null ? feedCapped : start >= FRESH_FEED_AFTER) {
          if (!feedCapped) console.info(`[linkedin-declutter] feed capped: blocked pagination at startIndex ${start}`);
          feedCapped = true;
          schedule(); // show the button
          return new page.Promise(pageFn(() => {}, window));
        }
      }
      return pageFetch.apply(this, arguments);
    };
    page.fetch = pageFn(fetch, window);
  }

  /** Once the feed is capped, offer a reload at its end. */
  function freshFeedButton() {
    if (!feedCapped) return;
    const feed = document.querySelector('[data-testid="mainFeed"]');
    if (!feed) return;
    let btn = feed.querySelector(':scope > .lkc-fresh');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lkc-fresh';
      btn.textContent = 'Load a fresh feed';
      const note = document.createElement('small');
      note.textContent = `${FRESH_FEED_AFTER} posts loaded: reloading frees the memory LinkedIn holds on to`;
      btn.appendChild(note);
      btn.addEventListener('click', () => {
        history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
        location.reload();
      });
    }
    if (feed.lastElementChild !== btn) feed.appendChild(btn);
    // The loading spinner waits for the blocked request forever: hide whatever follows the last post
    const kids = [...feed.children];
    const lastPost = kids.findLastIndex((c) => c.matches('[role="listitem"]') || c.querySelector('[role="listitem"]'));
    // (lazy-mount wrappers are posts LinkedIn unmounted while off-screen: they come back, keep them)
    for (const c of kids.slice(lastPost + 1)) {
      if (c !== btn && !c.hasAttribute(MOVED) && !c.hasAttribute('data-lazy-mount-id')) hide(c, 'cap');
    }
    const column = feed.closest('[data-testid="lazy-column"]') || feed.parentElement;
    for (const el of column.querySelectorAll('[role="progressbar"], [aria-busy="true"]')) {
      if (!el.closest('[role="listitem"]')) hide(el, 'cap');
    }
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
    // Without "Saved items" (single post), the left column is whatever sits left of the center one
    const cLeft = centerCol.getBoundingClientRect().left;
    const left = leftCol && leftCol.parentElement === grid ? leftCol : [...grid.children].find((c) => {
      const r = c.getBoundingClientRect();
      return c !== centerCol && !c.hasAttribute(HIDE) && r.width > 0 && r.right <= cLeft + 1;
    }) || null;
    if (isGrid) {
      const lw = left ? Math.round(left.getBoundingClientRect().width) : 0;
      if (left && !lw) return; // not laid out yet, retry on next pass
      grid.style.setProperty('--lkc-cols', left ? `${lw}px minmax(0, 1fr)` : 'minmax(0, 1fr)');
      grid.style.setProperty('--lkc-center-col', left ? '2' : '1');
    }
    if (left) left.setAttribute('data-lkc-col', 'left');
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
  // A single post (/posts/… or /feed/update/…): laid out like the feed
  const onPostPage = () => /^\/(posts|feed\/update)\//.test(location.pathname);

  /** The top bar: the widest bar-shaped box around "Me", so the sticky header of a company or
   *  profile page sliding under it (with its own "Home" and "Jobs" tabs) is never mistaken for it. */
  function topBar(me) {
    const nav = document.getElementById('global-nav');
    if (nav) return nav;
    if (!me) return null;
    let bar = me;
    for (let p = me.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.getBoundingClientRect().height > TOP_BAR_MAX_PX) break;
      bar = p;
    }
    return bar;
  }

  function run() {
    const f = scanText();
    const path = location.pathname;
    // Messaging (LinkedIn's older app) left an empty conversation list, gigabytes of memory and
    // "Something went wrong" with this script on: leave it alone
    if (path.startsWith('/messaging')) return;
    const onPost = onPostPage();
    const onFeed = path.startsWith('/feed') && !onPost;
    const wide = onFeed || onPost; // right rail hidden, center column widened
    const onPage = /^\/(company|in|school|showcase)\//.test(path);

    const startPost = [document.getElementById('shareboxProfilePictureComponentRef'), ...f.startPost]
      .find((el) => el && !el.closest(`[${MOVED}]`));
    const center = startPost
      || (composerHome && composerHome.isConnected ? composerHome : null)
      || document.querySelector('main [data-urn*="activity"], main [data-id*="activity"]')
      // (not the text of the image viewer: the "right rail" next to it would be the whole page)
      || (onPost ? [...document.querySelectorAll(TEXT_BOX)].find((t) => !inOverlay(t)) : null);
    const rightAnchor = f.puzzles[0] || f.addFeed[0] || f.copyright[0];
    const saved = document.querySelector('a[href*="/my-items"]');
    const centerCol = center && blockOf(center, rightAnchor || saved);

    // Top navigation: Jobs, For Business, Premium
    const bar = topBar(f.me.find((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.bottom < 120;
    }));
    // Safety net: a box hidden mid re-render that turns out to hold the whole page is shown again
    // (once hidden, "Me" has no size and `bar` is not found: any "Me" will do for the rules that climb)
    for (const el of [document.querySelector('main'), bar, ...f.me]) {
      const blank = el && el.closest(`[${HIDE}]`);
      if (!blank || (el !== bar && !blank.querySelector('main') && !['rail', 'footer'].includes(blank.getAttribute(HIDE)))) continue;
      console.warn(`[linkedin-declutter] unhid a box holding the page (hidden as "${blank.getAttribute(HIDE)}")`, blank);
      blank.removeAttribute(HIDE);
    }
    const inTopBar = (el) => !!bar && bar.contains(el);
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
          if (r.height > 0 && r.bottom < 120 && r.left >= meRight - 1 && bar.contains(s)) hide(s);
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

    // Upsell cards: "Limited offer" beside a post, "The latest hiring trends" on company pages
    for (const el of f.upsell) {
      if (inTopBar(el) || el.closest(`[${HIDE}]`)) continue;
      const card = cardOf(el);
      if (card) hide(card, 'upsell');
    }

    // "See a collection of ads by …" on company pages, and the column it leaves empty
    for (const el of f.adLibrary) {
      if (el.closest(`[${HIDE}]`)) continue;
      const card = cardOf(el);
      if (card) {
        hide(card, 'ads');
        hideEmptyColumn(card);
      }
    }

    // Footer links, in the right rail or at the bottom of company and profile pages
    for (const el of f.copyright) {
      const footer = !el.closest(`[${HIDE}]`) && footerOf(el, bar);
      if (footer) hide(footer, 'footer');
    }

    // Side column of company and profile pages. Once folded it has no size: keep the one found.
    let sideCol = null;
    if (onPage) {
      sideCol = document.querySelector(`[${FOLD}="side"]`);
      for (const h of f.side) if (!sideCol) sideCol = sideColumnOf(h);
    }
    foldColumn('side', sideCol);

    // Right rail + wider center column (feed and single posts)
    if (wide && rightAnchor && center) {
      const rightCol = blockOf(rightAnchor, center);
      const cCol = blockOf(center, rightAnchor);
      if (rightCol && cCol && rightCol.parentElement === cCol.parentElement && !holdsPage(rightCol, bar)) {
        hide(rightCol, 'rail');
        widen(rightCol.parentElement, cCol, leftCol);
      }
    } else if (!wide) {
      undoFeedLayout();
    }

    foldColumn('left', wide ? document.querySelector('[data-lkc-col="left"]') : null);
    if (bar) {
      // Fold buttons sit right under the top bar, or at the top once it scrolled away
      const bottom = `${Math.max(0, Math.round(bar.getBoundingClientRect().bottom))}px`;
      const root = document.documentElement.style;
      if (root.getPropertyValue('--lkc-bar') !== bottom) root.setProperty('--lkc-bar', bottom);
    }

    if (onFeed) freshFeedButton();
    if (onPage) {
      // Posts of a company or profile page, laid out like the feed. Only inside posts: the cover
      // image and the rest of the page are left alone.
      const root = document.querySelector('main') || document.body;
      const posts = new Set();
      for (const text of root.querySelectorAll(TEXT_BOX)) {
        const post = text.closest(':has(> h2)');
        if (post && isPostBody(post)) posts.add(post);
      }
      for (const post of posts) markMedia(post);
      postTexts(root);
      for (const card of root.querySelectorAll(`[${CARD}]`)) fillCard(card);
      for (const post of root.querySelectorAll(`[${POST}]`)) fitText(post);
    } else if (centerCol) {
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

    // Messaging pop-up: the "Messaging" label that is not in the top bar, up to its fixed container
    if (HIDE_MESSAGING_POPUP) {
      for (const el of f.messaging) {
        if (el.closest(`[${HIDE}]`) || inTopBar(el)) continue;
        if (el.getBoundingClientRect().top < window.innerHeight / 2) continue; // docked at the bottom only
        let box = el;
        while (box && box !== document.body && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
        if (box && box !== document.body) hide(box);
      }
    }

    // Pause videos once they leave the screen (they keep buffering otherwise)
    for (const v of document.querySelectorAll('video')) {
      if (!watched.has(v)) { watched.add(v); offscreen.observe(v); }
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

  // ---------- Scheduling (throttled, when the browser is idle; LinkedIn is an SPA) ----------
  let queued = false;
  const idle = window.requestIdleCallback
    ? (fn) => window.requestIdleCallback(fn, { timeout: 500 })
    : (fn) => setTimeout(fn, 250);
  const schedule = () => {
    if (queued) return;
    queued = true;
    idle(() => { queued = false; run(); });
  };
  new MutationObserver((records) => {
    for (const r of records) pendingRoots.push(...r.addedNodes);
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  document.addEventListener('load', schedule, true); // lazy images get their size late
  // Posts skipped by content-visibility have no size until scrolled into view
  window.addEventListener('scroll', schedule, { passive: true });

  guardFeedPagination();
  run();
})();
