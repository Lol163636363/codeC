'use strict';

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  book: '<path d="M5 3h14v18H6a3 3 0 0 1 0-6h13M5 3v12M8 7h7"/>',
  'book-open': '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-3-1-6-2-10 1z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  code: '<path d="m7 7-5 5 5 5m10-10 5 5-5 5M14 4l-4 16"/>',
  sparkles: '<path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3zM20 2v4m-2-2h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings: '<path d="m9 3-.5 3-2.5 1-2.5-1.5L1 10l2.5 2L3 15l-1 2 4 3 2-2 3 1 1 3 5-1v-3l2-2 3 .5 1-5-3-1-1-3 1-2-4-3-2 2-3-1z" transform="translate(1 0) scale(.9)"/><circle cx="12" cy="12" r="3"/>',
  'arrow-up': '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H4m6-6-6 6 6 6"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  terminal: '<path d="m5 7 5 5-5 5m8 0h6"/>',
};
const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24">${paths[name] || paths.code}</svg>`;
function hydrate(root = document) {
  $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}
function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Navigation privée : l’app reste utilisable. */ }
}
const storedFavorites = readStore('cstudio-favorites', []);
const state = {
  catalog: null,
  favorites: new Set(Array.isArray(storedFavorites) ? storedFavorites.filter(x => typeof x === 'string') : []),
  recent: readStore('cstudio-recent', null),
  model: readStore('cstudio-model', ''),
  page: null,
  context: null,
  history: [],
  busy: false,
  ai: null,
  routeToken: 0,
};
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
}
async function request(url, options) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('Le serveur a renvoyé une réponse inattendue.'); }
  if (!response.ok) {
    const error = new Error(data.error || 'La requête a échoué.');
    error.data = data;
    throw error;
  }
  return data;
}
function chapter(id) { return state.catalog.chapters.find(c => c.id === Number(id)); }
function title(value) {
  return value.replace(/\b[A-ZÀÂÇÉÈÊËÎÏÔÙÛÜ][A-ZÀÂÇÉÈÊËÎÏÔÙÛÜ ,'-]{4,}/g,
    text => text.charAt(0) + text.slice(1).toLocaleLowerCase('fr'));
}
const kindLabels = {lesson: 'Cours', exercise: 'Exercices', solution: 'Corrigé'};
function pageLink(id) { return '#/page/' + encodeURIComponent(id); }
function highlight(text, query) {
  const words = [...new Set(query.split(/\s+/).filter(w => w.length > 2))].slice(0, 15);
  if (!words.length) return esc(text);
  const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(${pattern})`, 'giu');
  return String(text).split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
}
function searchForm(query = '') {
  return `<div class="search-wrap"><form class="search-form" id="main-search-form" role="search">${icon('search')}<label class="sr-only" for="main-search">Rechercher dans le cours</label><input id="main-search" name="q" autocomplete="off" maxlength="500" placeholder="Une notion, une fonction, une question…" value="${esc(query)}"><span class="keycap">Ctrl K</span><button class="search-submit" type="submit"><span class="search-text">Rechercher</span>${icon('arrow-right')}</button></form></div>`;
}
function quickTopics() {
  return `<div class="quick-topics"><span>À explorer</span>${['Pointeurs', 'Boucles', 'Tableaux', 'printf'].map(t => `<a class="topic-chip" href="#/search?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>`;
}
function card(doc, query = '') {
  const chap = chapter(doc.chapter);
  return `<a class="result-card" href="${pageLink(doc.id)}"><div class="result-meta"><span class="kind-badge ${esc(doc.kind)}">${kindLabels[doc.kind] || 'Cours'}</span><span>${doc.chapter > 0 && doc.chapter < 12 ? 'Chapitre ' + doc.chapter + ' · ' : ''}${esc(chap?.title || 'Le cours')}</span></div><h2>${highlight(title(doc.title), query)}${icon('arrow-up-right')}</h2><p>${highlight(doc.snippet || `${doc.words} mots · ${doc.id}`, query)}</p></a>`;
}
function empty(heading, text, symbol = 'search') {
  return `<div class="empty-state">${icon(symbol)}<h2>${esc(heading)}</h2><p>${esc(text)}</p></div>`;
}
function setView(html, breadcrumb) {
  $('#main').innerHTML = html;
  $('#breadcrumb').innerHTML = `Mon espace <span>/</span> ${esc(breadcrumb)}`;
  hydrate($('#main'));
  window.scrollTo({top: 0, behavior: 'instant'});
}
function chapterCard(c) {
  const symbols = {1: '>_', 2: '{}', 3: '+ −', 4: 'I/O', 5: '? :', 6: '↻', 7: '[ ]', 8: '" "', 9: '* &', 10: 'f(x)', 11: '.txt'};
  return `<a class="chapter-card" href="#/chapter/${c.id}"><div class="card-top"><div class="card-icon">${esc(symbols[c.id] || '{}')}</div><span>${String(c.id).padStart(2, '0')}</span></div><h3>${esc(c.title)}</h3><span class="card-meta">${c.count} pages à explorer ${icon('arrow-up-right')}</span></a>`;
}
function renderHome() {
  const c = state.catalog;
  const recent = c.documents.find(d => d.id === state.recent?.id);
  const selected = [2, 3, 6, 7, 9, 10].map(id => chapter(id));
  setView(`<section class="home-hero"><div class="eyebrow">APPRENDRE. COMPRENDRE. PRATIQUER.</div><h1>Le C, un peu<br><em>plus clair.</em></h1><p>Retrouve une notion, explore un exemple et avance à ton rythme.<br>Tout le cours de <strong>Fred Faber</strong>, dans un seul espace.</p>${searchForm()}${quickTopics()}<div class="stats-strip"><div><strong>11</strong><span>chapitres pour progresser</span></div><div><strong>${c.pages}</strong><span>pages à portée de recherche</span></div><div><strong>${c.solutions}</strong><span>corrigés pour pratiquer</span></div></div></section>${recent ? `<a class="continue-card" href="${pageLink(recent.id)}">${icon('book-open')}<span><small>REPRENDRE MA LECTURE</small><strong>${esc(title(recent.title))}</strong></span>${icon('arrow-right')}</a>` : ''}<section class="course-banner"><div class="banner-content"><div class="eyebrow">DE LA PREMIÈRE LIGNE AU PREMIER DÉCLIC</div><h2>Chaque notion a son point de départ.</h2><p>Variables, boucles, fonctions… Construis tes bases, un chapitre après l’autre.</p><a class="text-link" href="#/chapter/2">Commencer par les bases ${icon('arrow-right')}</a></div><div class="code-decoration" aria-label="Exemple de programme C"><div class="window-dots"><i></i><i></i><i></i></div><pre><span class="comment">// Tout commence ici.</span>\n<span class="keyword">#include</span> &lt;stdio.h&gt;\n\n<span class="keyword">int</span> main(<span class="keyword">void</span>) {\n  printf(<span class="string">"Bonjour, le C !"</span>);\n  <span class="keyword">return</span> 0;\n}</pre></div></section><section><div class="section-heading"><div><h2>Une notion à explorer</h2><p>Les essentiels, à ton rythme.</p></div><a class="subtle-link" href="#/chapters">Tout le programme ${icon('arrow-right')}</a></div><div class="chapter-grid">${selected.map(chapterCard).join('')}</div></section><footer class="home-footer"><span>${icon('book-open')}Cours original : Fred Faber · ANSI-C</span><span>Un espace simple pour les idées qui compilent.</span></footer>`, 'Vue d’ensemble');
}
function renderChapters() {
  setView(`<div class="eyebrow">LE PROGRAMME</div><h1 class="page-title">D’une ligne à la suivante.</h1><p class="page-subtitle">Les 11 chapitres du cours de Fred Faber, avec leurs exercices et leurs corrigés.</p><div class="chapter-lessons"><div class="chapter-grid">${state.catalog.chapters.filter(c => c.id > 0 && c.id < 12).map(chapterCard).join('')}</div><div class="section-heading"><h2>Pour aller plus loin</h2></div><div class="results-list">${state.catalog.chapters.filter(c => c.id === 0 || c.id === 12).map(c => `<a class="result-card" href="#/chapter/${c.id}"><h2>${esc(c.title)} ${icon('arrow-up-right')}</h2><p>${c.count} pages du cours</p></a>`).join('')}</div></div>`, 'Tout le programme');
}
function filters(kind, chapterId) {
  return `<div class="filters" role="group" aria-label="Filtrer les résultats">${[['all','Tout'],['lesson','Cours'],['exercise','Exercices'],['solution','Corrigés']].map(([id,label]) => `<button class="filter-button ${id === kind ? 'active' : ''}" data-filter="${id}" aria-pressed="${id === kind}">${label}</button>`).join('')}<label class="sr-only" for="chapter-filter">Chapitre</label><select id="chapter-filter" class="chapter-filter"><option value="">Tous les chapitres</option>${state.catalog.chapters.map(c => `<option value="${c.id}" ${String(c.id) === String(chapterId) ? 'selected' : ''}>${c.id > 0 && c.id < 12 ? c.id + '. ' : ''}${esc(c.title)}</option>`).join('')}</select></div>`;
}
async function renderSearch(params, token) {
  const q = params.get('q') || '';
  const kind = params.get('kind') || 'all';
  const chapterId = params.get('chapter') || '';
  setView(`<section class="search-page"><div class="eyebrow">EXPLORER LE COURS</div><h1 class="page-title">La réponse est peut-être ici.</h1><p class="page-subtitle">Recherche dans les chapitres, les exemples et les corrigés.</p>${searchForm(q)}${filters(kind,chapterId)}<div id="search-results"><div class="initial-loading"><span class="spinner"></span>Recherche dans le cours…</div></div></section>`, 'Explorer le cours');
  const data = await request('/api/search?' + new URLSearchParams({q, kind, chapter: chapterId}));
  if (state.routeToken !== token) return;
  $('#search-results').innerHTML = `<p class="result-count">${data.total} page${data.total > 1 ? 's' : ''} ${q ? 'pour « ' + esc(q) + ' »' : 'dans le cours'}${data.total > data.results.length ? ` · ${data.results.length} premiers résultats` : ''}</p><div class="results-list">${data.results.map(d => card(d, q)).join('') || empty('Aucun résultat pour le moment.', 'Essaie un terme plus simple : pointeur, tableau, printf…')}</div>`;
  if (!q && !chapterId) $('#main-search').focus({preventScroll: true});
}
function renderChapter(id) {
  const c = chapter(id);
  if (!c) return setView(empty('Chapitre introuvable.', 'Choisis un chapitre dans le menu.'), 'Le programme');
  const documents = state.catalog.documents.filter(d => d.chapter === c.id);
  setView(`<a class="reader-back" href="#/chapters">${icon('arrow-left')}Tout le programme</a><div class="eyebrow chapter-lessons">${c.id > 0 && c.id < 12 ? 'CHAPITRE ' + String(c.id).padStart(2,'0') : 'LE COURS'}</div><h1 class="page-title">${esc(c.title)}</h1><p class="page-subtitle">${documents.length} pages pour comprendre et pratiquer.</p><div class="chapter-lessons">${[['lesson','Comprendre la notion'],['exercise','Passer à la pratique'],['solution','Consulter les corrigés']].map(([kind,label]) => {const docs=documents.filter(d => d.kind === kind); return docs.length ? `<div class="section-heading"><h2>${label}</h2><span class="result-count">${docs.length} pages</span></div><div class="results-list">${docs.map(d => card(d)).join('')}</div>` : '';}).join('')}</div>`, c.title);
}
function renderBookmarks() {
  const docs = state.catalog.documents.filter(d => state.favorites.has(d.id));
  setView(`<div class="eyebrow">MES FAVORIS</div><h1 class="page-title">Les pages à garder sous la main.</h1><p class="page-subtitle">${docs.length} page${docs.length > 1 ? 's' : ''} enregistrée${docs.length > 1 ? 's' : ''} dans ton navigateur.</p><div class="chapter-lessons results-list">${docs.map(d => card(d)).join('') || empty('Ton carnet commence ici.', 'Ouvre une page du cours et clique sur le signet pour la retrouver ici.', 'bookmark')}</div>`, 'Mes favoris');
}
async function renderPage(id, params, token) {
  setView('<div class="initial-loading"><span class="spinner"></span>Ouverture de la page…</div>', 'Lecture du cours');
  const doc = await request('/api/page?' + new URLSearchParams({id}));
  if (token !== state.routeToken) return;
  state.page = doc;
  state.context = doc.id;
  state.recent = {id:doc.id};
  writeStore('cstudio-recent', state.recent);
  const chap = chapter(doc.chapter);
  const previous = state.catalog.documents.find(d => d.id === doc.previous);
  const next = state.catalog.documents.find(d => d.id === doc.next);
  const saved = state.favorites.has(doc.id);
  setView(`<div class="reader-top"><a class="reader-back" href="#/chapter/${doc.chapter}">${icon('arrow-left')}${esc(chap?.title || 'Le cours')}</a><div class="reader-actions"><button class="button favorite-button" data-save="${esc(doc.id)}" aria-pressed="${saved}" title="${saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon(saved ? 'check' : 'bookmark')}<span class="button-label">${saved ? 'Enregistré' : 'Garder'}</span></button><button class="button" data-explain="${esc(doc.id)}">${icon('sparkles')}<span class="button-label">M’expliquer</span></button></div></div><div class="eyebrow">${doc.chapter > 0 && doc.chapter < 12 ? 'CHAPITRE ' + doc.chapter : 'LE COURS'} · ${kindLabels[doc.kind].toLocaleUpperCase('fr')}</div><h1 class="reader-title">${esc(title(doc.title))}</h1><div class="reader-meta"><span>Fred Faber</span><span>·</span><span>${Math.max(1, Math.ceil(doc.words / 180))} min de lecture</span><span>·</span><span>${esc(doc.id)}</span></div><div class="legacy-note">Ce cours décrit l’ANSI-C historique. Certains exemples utilisent des fonctions anciennes, comme gets. L’assistant peut t’aider à les comprendre et à les adapter.</div><article class="article" id="course-article">${doc.html}</article><nav class="article-footer" aria-label="Pages du cours">${previous ? `<a href="${pageLink(previous.id)}"><small>← PAGE PRÉCÉDENTE</small>${esc(title(previous.title))}</a>` : ''}${next ? `<a href="${pageLink(next.id)}"><small>PAGE SUIVANTE →</small>${esc(title(next.title))}</a>` : ''}</nav>`, chap?.title || 'Lecture du cours');
  updateContext();
  if (params.get('anchor')) {
    const element = document.getElementById(params.get('anchor'));
    if (element && $('#course-article').contains(element)) element.scrollIntoView({block:'start'});
  }
}
function updateContext() {
  const doc = state.catalog.documents.find(d => d.id === state.context);
  $('#reading-context').hidden = !doc;
  if (doc) $('#reading-context>span:nth-child(2)').textContent = title(doc.title);
}
async function route() {
  if (!state.catalog) return;
  const token = ++state.routeToken;
  const url = new URL(location.hash.slice(1) || '/', location.origin);
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  state.page = null;
  $('#shell').classList.remove('menu-open');
  $('#menu-button').setAttribute('aria-expanded','false');
  $$('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === (parts[0] === 'search' ? 'search' : parts[0] === 'bookmarks' ? 'bookmarks' : !parts[0] ? 'home' : '')));
  $$('#chapter-nav a').forEach(a => a.classList.toggle('active', parts[0] === 'chapter' && a.dataset.chapter === parts[1]));
  try {
    if (!parts[0]) renderHome();
    else if (parts[0] === 'search') await renderSearch(url.searchParams, token);
    else if (parts[0] === 'chapters') renderChapters();
    else if (parts[0] === 'chapter') renderChapter(parts[1]);
    else if (parts[0] === 'bookmarks') renderBookmarks();
    else if (parts[0] === 'page') await renderPage(parts[1], url.searchParams, token);
    else setView(empty('Cette page n’existe pas.', 'Utilise le menu pour retrouver le cours.'), 'Page introuvable');
  } catch (error) {
    if (token === state.routeToken) setView(empty('La page n’a pas pu s’ouvrir.', error.message), 'Une erreur est survenue');
  }
}
function searchNavigate(changes) {
  const url = new URL(location.hash.slice(1) || '/', location.origin);
  const params = url.pathname === '/search' ? url.searchParams : new URLSearchParams();
  for (const [key,value] of Object.entries(changes)) {
    if (value === '' || value == null) params.delete(key); else params.set(key,value);
  }
  const hash = '#/search?' + params;
  if (location.hash === hash) route(); else location.hash = hash;
}
function updateFavoriteCount() { $('#favorite-count').textContent = state.favorites.size; }
function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  writeStore('cstudio-favorites', [...state.favorites]);
  updateFavoriteCount();
  const saved = state.favorites.has(id);
  const button = $('.favorite-button');
  if (button) {
    button.setAttribute('aria-pressed', String(saved));
    button.title = saved ? 'Retirer des favoris' : 'Ajouter aux favoris';
    button.innerHTML = icon(saved ? 'check' : 'bookmark') + `<span class="button-label">${saved ? 'Enregistré' : 'Garder'}</span>`;
  }
  toast(saved ? 'Page ajoutée à tes favoris.' : 'Page retirée des favoris.');
}
function setAssistant(open) {
  $('#shell').classList.toggle('ai-hidden', !open);
  $('#assistant-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('#chat-input').focus({preventScroll:true});
}
async function refreshAI() {
  $('#ai-status').innerHTML = '<span class="status-dot checking"></span>Vérification de l’IA…';
  try {
    const data = await request('/api/status');
    state.ai = data;
    $('#ai-status').innerHTML = `<span class="status-dot ${data.available ? 'ready' : ''}"></span>${data.available ? 'IA locale prête' : data.connected ? 'Un modèle est nécessaire' : 'IA locale à connecter'}`;
    const select = $('#model-select');
    select.innerHTML = data.models.length ? data.models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('') : '<option value="">Aucun modèle détecté</option>';
    if (!data.models.includes(state.model)) state.model = data.models[0] || '';
    select.value = state.model;
    $('#settings-feedback').textContent = data.message;
  } catch {
    $('#ai-status').innerHTML = '<span class="status-dot"></span>Connexion indisponible';
    $('#settings-feedback').textContent = 'Vérifie que l’application et Ollama sont lancés.';
  }
}
function inlineMarkdown(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(\d+)\]/g, (_, n) => `<button class="citation" data-citation="${n}">[${n}]</button>`);
}
function markdown(text) {
  // Le texte du modèle est échappé ; aucun HTML ou lien arbitraire n’est exécuté.
  return text.split(/```(?:[\w+-]*)\s*\n([\s\S]*?)```/g).map((part,index) => {
    if (index % 2) return `<pre><code>${esc(part.trimEnd())}</code></pre>`;
    return part.split(/\n\s*\n/).map(block => {
      if (/^#{1,4} /.test(block)) return `<h3>${inlineMarkdown(block.replace(/^#{1,4} /,''))}</h3>`;
      const lines = block.split('\n');
      if (lines.every(line => /^\s*[-*] /.test(line))) return `<ul>${lines.map(line => `<li>${inlineMarkdown(line.replace(/^\s*[-*] /,''))}</li>`).join('')}</ul>`;
      if (lines.every(line => /^\s*\d+[.)] /.test(line))) return `<ol>${lines.map(line => `<li>${inlineMarkdown(line.replace(/^\s*\d+[.)] /,''))}</li>`).join('')}</ol>`;
      return `<p>${lines.map(inlineMarkdown).join('<br>')}</p>`;
    }).join('');
  }).join('');
}
function sourcesHTML(sources) {
  if (!sources?.length) return '';
  return `<div class="source-list"><div class="source-list-label">Passages du cours utilisés</div>${sources.map(s => `<div class="source-card" data-source="${s.number}"><a href="${pageLink(s.id)}"><span class="source-number">${s.number}</span><span>${esc(title(s.title))}</span></a><details><summary>Voir le passage</summary><p>${esc(s.excerpt)}</p></details></div>`).join('')}</div>`;
}
function scrollChat() { $('#chat-messages').scrollTo({top:$('#chat-messages').scrollHeight,behavior:'smooth'}); }
function addMessage(role, content, sources = [], isError = false) {
  $('#assistant-welcome')?.remove();
  const item = document.createElement('div');
  item.className = `message ${role}${isError ? ' error' : ''}`;
  item.innerHTML = `<div class="message-label">${role === 'user' ? 'TOI' : icon('sparkles') + ' ASSISTANT DU COURS'}</div><div class="message-body">${role === 'user' ? esc(content) : markdown(content)}</div>${sourcesHTML(sources)}${isError ? `<button class="text-link" data-setup>Configurer l’IA ${icon('arrow-right')}</button>` : ''}`;
  $('#chat-messages').append(item);
  scrollChat();
  return item;
}
async function ask(question) {
  question = question.trim();
  if (!question || state.busy) return;
  if (question.length > 3000) return toast('Limite : 3 000 caractères par question.');
  setAssistant(true);
  state.busy = true;
  $('#send-button').disabled = true;
  $('#chat-input').value = '';
  addMessage('user', question);
  const loading = document.createElement('div');
  loading.className = 'message loading-message';
  loading.innerHTML = '<span class="spinner"></span><span>Je lis les passages du cours…<br>Le premier chargement du modèle peut prendre un moment.</span>';
  $('#chat-messages').append(loading);
  scrollChat();
  try {
    const data = await request('/api/ask', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({question, model:state.model, page:state.context, history:state.history.slice(-6)})});
    loading.remove();
    addMessage('assistant', data.answer, data.sources);
    state.history.push({role:'user',content:question},{role:'assistant',content:data.answer});
    state.history = state.history.slice(-6);
  } catch (error) {
    loading.remove();
    addMessage('assistant', error.message + (error.data?.sources?.length ? '\n\nTu peux déjà consulter ces passages trouvés dans le cours.' : ''), error.data?.sources || [], true);
  } finally {
    state.busy = false;
    $('#send-button').disabled = false;
    $('#chat-input').focus({preventScroll:true});
  }
}
document.addEventListener('submit', event => {
  if (event.target.id === 'main-search-form') {event.preventDefault(); searchNavigate({q:$('#main-search').value});}
  if (event.target.id === 'chat-form') {event.preventDefault(); ask($('#chat-input').value);}
});
document.addEventListener('click', async event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.dataset.filter) searchNavigate({kind:target.dataset.filter});
  else if (target.dataset.save) toggleFavorite(target.dataset.save);
  else if (target.dataset.prompt) ask(target.dataset.prompt);
  else if (target.dataset.explain) ask(`Explique-moi simplement la page « ${state.page?.title || ''} » et donne-moi un petit exemple.`);
  else if (target.hasAttribute('data-setup')) {$('#settings-dialog').showModal(); refreshAI();}
  else if (target.dataset.copy) {
    try {await navigator.clipboard.writeText(target.dataset.copy); toast('Commande copiée.');} catch {toast('Sélectionne la commande pour la copier.');}
  } else if (target.dataset.citation) {
    const source = target.closest('.message')?.querySelector(`[data-source="${Number(target.dataset.citation)}"]`);
    if (source) { $('details', source).open = true; source.scrollIntoView({block:'nearest',behavior:'smooth'}); }
  }
});
$('#chapter-filter')?.addEventListener('change', event => searchNavigate({chapter:event.target.value}));
document.addEventListener('change', event => {
  if (event.target.id === 'chapter-filter') searchNavigate({chapter:event.target.value});
});
$('#assistant-toggle').addEventListener('click', () => setAssistant($('#shell').classList.contains('ai-hidden')));
$('#close-assistant').addEventListener('click', () => setAssistant(false));
$('#menu-button').addEventListener('click', () => {
  const open = $('#shell').classList.toggle('menu-open');
  $('#menu-button').setAttribute('aria-expanded', String(open));
});
$('#main').addEventListener('click', () => {$('#shell').classList.remove('menu-open'); $('#menu-button').setAttribute('aria-expanded','false');});
$('#settings-button').addEventListener('click', () => {$('#settings-dialog').showModal(); refreshAI();});
$('#refresh-ai').addEventListener('click', async () => {$('#refresh-ai').disabled=true; await refreshAI(); $('#refresh-ai').disabled=false;});
$('#model-select').addEventListener('change', event => {state.model=event.target.value;writeStore('cstudio-model',state.model);});
$('#clear-context').addEventListener('click', () => {state.context=null;updateContext();});
$('#chat-input').addEventListener('keydown', event => {if (event.key === 'Enter' && !event.shiftKey) {event.preventDefault();ask(event.target.value);}});
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if ($('#main-search')) {$('#main-search').focus();$('#main-search').select();} else location.hash='#/search';
  }
  if (event.key === 'Escape' && !$('#settings-dialog').open) {setAssistant(false);$('#shell').classList.remove('menu-open');$('#menu-button').setAttribute('aria-expanded','false');}
});
window.addEventListener('hashchange',route);
async function init() {
  hydrate();
  setAssistant(window.innerWidth > 1000);
  updateFavoriteCount();
  try {
    state.catalog = await request('/api/catalog');
    $('#chapter-nav').innerHTML = state.catalog.chapters.map(c => `<a href="#/chapter/${c.id}" data-chapter="${c.id}"><span class="chapter-number">${c.id === 0 ? '↗' : c.id === 12 ? '+' : String(c.id).padStart(2,'0')}</span><span>${esc(c.title)}</span></a>`).join('');
    await route();
    refreshAI();
  } catch (error) {
    setView(empty('Le cours ne s’est pas chargé.', error.message + ' Relance l’application puis recharge cette page.'), 'Connexion au cours');
  }
}
init();
