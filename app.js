// === Configuration keys & defaults ===
const STORAGE_KEY = 'topTweets_pwa_handles_v1';
const SETTINGS_KEY = 'topTweets_pwa_settings_v1';

const DEFAULTS = {
  nitterBase: 'https://nitter.net',
  perHandle: 8,
  topN: 12
};

// === UI refs ===
const handlesListEl = document.getElementById('handlesList');
const handleInput = document.getElementById('handleInput');
const addHandleBtn = document.getElementById('addHandleBtn');
const tweetsContainer = document.getElementById('tweetsContainer');
const refreshBtn = document.getElementById('refreshBtn');
const openSettings = document.getElementById('openSettings');
const settingsModal = document.getElementById('settingsModal');
const nitterInput = document.getElementById('nitterInput');
const saveSettings = document.getElementById('saveSettings');
const closeSettings = document.getElementById('closeSettings');
const topNInput = document.getElementById('topN');
const perHandleInput = document.getElementById('perHandle');

// === Helpers ===
function readHandles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}
function writeHandles(handles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(handles));
}
function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function writeSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// show handles UI
function renderHandles() {
  const handles = readHandles();
  handlesListEl.innerHTML = '';
  if (handles.length === 0) {
    handlesListEl.innerHTML = '<span class="muted">No handles saved yet — add one to begin.</span>';
    return;
  }
  for (const h of handles) {
    const pill = document.createElement('div');
    pill.className = 'handle-pill';
    pill.innerHTML = `<span>@${h}</span><button class="remove" title="Remove" aria-label="Remove">✕</button>`;
    pill.querySelector('.remove').addEventListener('click', () => {
      const filtered = handles.filter(x => x !== h);
      writeHandles(filtered);
      renderHandles();
    });
    handlesListEl.appendChild(pill);
  }
}

// add handle
addHandleBtn.addEventListener('click', () => {
  const value = (handleInput.value || '').trim().replace(/^@+/, '').toLowerCase();
  if (!value) return;
  const list = readHandles();
  if (!list.includes(value)) {
    list.unshift(value); // keep most recent first
    writeHandles(list);
    renderHandles();
    handleInput.value = '';
  }
});

// initial render
renderHandles();

// open settings
openSettings.addEventListener('click', () => {
  const s = readSettings();
  nitterInput.value = s.nitterBase;
  topNInput.value = s.topN;
  perHandleInput.value = s.perHandle;
  settingsModal.classList.remove('hidden');
});
closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettings.addEventListener('click', () => {
  const s = {
    nitterBase: (nitterInput.value || '').trim() || DEFAULTS.nitterBase,
    topN: Math.max(1, parseInt(topNInput.value || DEFAULTS.topN, 10)),
    perHandle: Math.max(1, parseInt(perHandleInput.value || DEFAULTS.perHandle, 10))
  };
  writeSettings(s);
  settingsModal.classList.add('hidden');
});

// Utility: try fetch, if CORS error -> fallback to AllOrigins
async function fetchWithCorsFallback(url) {
  try {
    const r = await fetch(url, {cache: 'no-cache'});
    if (!r.ok) throw new Error('Fetch failed');
    const text = await r.text();
    // quick check for HTML that indicates Nitter served content; if wrong it will still be parsed
    return text;
  } catch (err) {
    // fallback to public CORS proxy
    const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
    const r = await fetch(proxy);
    if (!r.ok) throw new Error('Proxy fetch failed');
    return r.text();
  }
}

// Parse RSS text to items
function parseNitterRSS(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const items = Array.from(doc.querySelectorAll('item'));
  return items.map(it => {
    const titleEl = it.querySelector('title');
    const linkEl = it.querySelector('link');
    const descEl = it.querySelector('description');
    const dateEl = it.querySelector('pubDate');

    // Nitter RSS description often contains HTML; remove tags
    const descHtml = descEl ? descEl.textContent || descEl.text : '';
    const text = titleEl ? (titleEl.textContent || '') : (descHtml || '');
    return {
      text: (text || '').trim(),
      link: linkEl ? (linkEl.textContent || '') : '',
      pubDate: dateEl ? new Date(dateEl.textContent) : new Date(),
      rawDesc: descHtml
    };
  });
}

// Engagement proxy scoring function (transparent and simple)
function scoreTweet(tweet) {
  const t = tweet.text || '';
  // base score by length
  let score = Math.min(250, t.length);

  // add points for hashtags
  const hashtags = (t.match(/#\w+/g) || []).length;
  score += hashtags * 18;

  // mentions
  const mentions = (t.match(/@\w+/g) || []).length;
  score += mentions * 12;

  // numbers (often indicate metrics or retweets/likes written) add small boost
  const numbers = (t.match(/\d+[kKmM]?/g) || []).length;
  score += numbers * 8;

  // presence of words like 'retweet', 'likes', 'k', 'm' in rawDesc (some Nitter feeds include "· 12K likes")
  const raw = (tweet.rawDesc||'').toLowerCase();
  if (raw.match(/\blike(s)?\b|\bretweet(s)?\b|\breply\b/)) score += 30;
  if (raw.match(/\b\d+k\b|\d+m\b/)) score += 40;

  // small recency factor (newer = small bonus)
  const ageHours = Math.max(0, (Date.now() - tweet.pubDate.getTime())/ (1000*60*60));
  score += Math.max(0, 24 - Math.min(24, ageHours)) * 2; // up to +48 for very new tweets

  return score;
}

// fetch tweets per handle
async function fetchTweetsForHandle(handle, perHandle, nitterBase) {
  const url = `${nitterBase.replace(/\/+$/, '')}/${encodeURIComponent(handle)}/rss`;
  const text = await fetchWithCorsFallback(url);
  const items = parseNitterRSS(text);
  const sliced = items.slice(0, perHandle || 8);
  return sliced.map(it => Object.assign({}, it, { handle }));
}

// Main load function
let isLoading = false;
async function loadAndRender() {
  if (isLoading) return;
  isLoading = true;
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Fetching…';
  tweetsContainer.innerHTML = '';

  const handles = readHandles();
  if (!handles || handles.length === 0) {
    tweetsContainer.innerHTML = `<div class="card">No handles yet. Add a handle to get started.</div>`;
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Fetch Now';
    isLoading = false;
    return;
  }

  const settings = readSettings();
  const all = [];
  try {
    for (const h of handles) {
      try {
        const fetched = await fetchTweetsForHandle(h, settings.perHandle, settings.nitterBase);
        for (const t of fetched) {
          all.push(Object.assign({}, t));
        }
      } catch (e) {
        console.warn('fetch failed for', h, e);
      }
    }

    // score & sort
    all.forEach(a => a._score = scoreTweet(a));
    all.sort((a,b) => b._score - a._score || b.pubDate - a.pubDate);

    // show top N
    const top = all.slice(0, settings.topN);
    if (top.length === 0) {
      tweetsContainer.innerHTML = `<div class="card">No tweets found for these handles — try again or change Nitter instance in Settings.</div>`;
    } else {
      tweetsContainer.innerHTML = top.map(renderTweetCard).join('');
    }
  } catch (err) {
    tweetsContainer.innerHTML = `<div class="card">Error fetching tweets. Try again. ${err.message}</div>`;
    console.error(err);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Fetch Now';
    isLoading = false;
    renderHandles();
  }
}

// Render single tweet as HTML
function renderTweetCard(t) {
  const timeAgo = timeSince(t.pubDate);
  const text = escapeHtml(t.text);
  const link = t.link || (t.handle ? `https://twitter.com/${t.handle}` : '#');
  const handleLabel = t.handle ? '@' + t.handle : '';
  const score = Math.round(t._score || 0);
  return `
  <article class="tweet-card">
    <div class="tweet-meta">
      <div class="meta-left">
        <strong>${handleLabel}</strong>
        <span class="muted">• ${timeAgo}</span>
      </div>
      <div class="muted">Score ${score}</div>
    </div>
    <div class="tweet-text">${linkify(text)}</div>
    <div class="tweet-meta">
      <div class="muted small">${truncateLink(link)}</div>
      <div><a class="btn ghost small" target="_blank" rel="noopener" href="${link}">View on Twitter</a></div>
    </div>
  </article>`;
}

// small helpers
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function linkify(text){ return (text||'').replace(/(https?:\/\/[^\s]+)/g, '<a target="_blank" rel="noopener" href="$1">$1</a>').replace(/#(\w+)/g, '<a target="_blank" rel="noopener" href="https://twitter.com/hashtag/$1">#$1</a>').replace(/@(\w+)/g, '<a target="_blank" rel="noopener" href="https://twitter.com/$1">@$1</a>'); }
function truncateLink(url){ try { const u = new URL(url); return u.hostname + u.pathname; } catch(e){ return url; } }
function timeSince(d) {
  if(!d) return '';
  const seconds = Math.floor((Date.now() - d.getTime())/1000);
  const intervals = [
    {label:'y', sec:31536000},
    {label:'mo', sec:2592000},
    {label:'d', sec:86400},
    {label:'h', sec:3600},
    {label:'m', sec:60},
    {label:'s', sec:1},
  ];
  for (const i of intervals){
    const val = Math.floor(seconds / i.sec);
    if (val >=1) return `${val}${i.label} ago`;
  }
  return 'just now';
}

// initial UI wiring
refreshBtn.addEventListener('click', loadAndRender);

// on enter key in input
handleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addHandleBtn.click(); });

// settings values defaults
(function init() {
  const s = readSettings();
  nitterInput.value = s.nitterBase;
  topNInput.value = s.topN;
  perHandleInput.value = s.perHandle;
  renderHandles();
  // auto-load on first visit
  setTimeout(loadAndRender, 250);
})();

// Simple exposure for debugging
window.topTweets = { readHandles, writeHandles, readSettings, writeSettings, loadAndRender };
