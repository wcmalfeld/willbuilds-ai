#!/usr/bin/env node
/* ============================================================
   WILLBUILDS.AI — static site build
   Reads content/ and writes plain HTML pages. No dependencies:
   run `node build.mjs`, then commit the generated files.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://willbuilds.ai/';
// Folders this script owns. They are deleted and rebuilt on every run.
const GENERATED_DIRS = ['projects', 'lab', 'notes', 'about'];

const STATUS = {
  live: 'live',
  'in-development': 'in development',
  prototype: 'prototype',
  experimental: 'experimental',
  paused: 'paused',
  archived: 'archived',
};

const site = readJSON('content/site.json');
const projects = readJSON('content/projects.json');
const notes = readNotes();
validate();

const SECTIONS = {
  projects: { title: 'Projects', noun: ['project', 'projects'] },
  lab: { title: 'Lab', noun: ['experiment', 'experiments'] },
};
const inSection = (key) => projects.filter((p) => p.category === key);
// A section with nothing in it gets no page, nav link or homepage link.
const shown = (key) => (key === 'notes' ? notes.length > 0 : inSection(key).length > 0);

/* ---------- build ---------- */

for (const dir of GENERATED_DIRS) rmSync(join(ROOT, dir), { recursive: true, force: true });

const pages = [];
emit('', homePage());
for (const key of Object.keys(SECTIONS).filter(shown)) {
  emit(`${key}/`, listingPage(key));
  for (const p of inSection(key)) emit(`${key}/${p.slug}/`, projectPage(p));
}
if (notes.length) {
  emit('notes/', notesPage());
  for (const n of notes) emit(`notes/${n.slug}/`, notePage(n));
}
emit('about/', aboutPage());
write('404.html', notFoundPage());
write('sitemap.xml', sitemap());

console.log(`built ${pages.length} pages + 404.html, sitemap.xml (${projects.length} projects, ${notes.length} notes)`);

/* ---------- pages ---------- */

function homePage() {
  const r = '';
  const featured = projects.filter((p) => p.featured);
  // Nine fills three full rows of the three-column card grid.
  const picks = (featured.length ? featured : inSection('projects')).slice(0, 9);
  const recent = notes.slice(0, 3);
  const body = `
  <section class="term" aria-labelledby="intro-title">
    <div class="term-bar" aria-hidden="true">
      <span class="term-dot"></span><span class="term-dot"></span><span class="term-dot"></span>
      <span class="term-title">will@builds — 80x24</span>
    </div>
    <div class="term-body">
      <p class="term-line"><span class="term-prompt" aria-hidden="true">$</span> whoami</p>
      <h1 class="term-line term-out term-h1" id="intro-title">${esc(site.name.toLowerCase())} — ${esc(site.role)}</h1>
      <p class="term-line"><span class="term-prompt" aria-hidden="true">$</span> cat about.txt</p>
${site.intro.map((l) => `      <p class="term-line term-out">${esc(l)}</p>`).join('\n')}
      <div class="term-actions">
        <a class="btn btn--primary" href="projects/">explore projects →</a>${shown('lab') ? `
        <a class="btn" href="lab/">visit the lab →</a>` : ''}${notes.length ? `
        <a class="btn" href="notes/">read notes →</a>` : ''}
      </div>
      <p class="term-line"><span class="term-prompt" aria-hidden="true">$</span> <span class="cursor" aria-hidden="true"></span></p>
    </div>
  </section>
${picks.length ? `
  <section class="sect" aria-labelledby="featured-title">
    ${sectHead('featured-title', '$ ls ./projects --featured', 'Featured projects')}
    <ul class="card-grid">
${picks.map((p) => projectCard(p, r)).join('\n')}
    </ul>
    <p class="sect-more">
      <a href="projects/">all projects (${inSection('projects').length}) →</a>${shown('lab') ? `
      <a href="lab/">lab experiments (${inSection('lab').length}) →</a>` : ''}
    </p>
  </section>` : ''}
${recent.length ? `
  <section class="sect" aria-labelledby="notes-title">
    ${sectHead('notes-title', '$ ls -t ./notes | head -3', 'Recent notes')}
    <ul class="proj-list">
${recent.map((n) => noteRow(n, r, 'h3')).join('\n')}
    </ul>
    <p class="sect-more"><a href="notes/">all notes (${notes.length}) →</a></p>
  </section>` : ''}`;
  return shell({
    path: '',
    title: site.title,
    description: featuredDescription(picks),
    head: `<script>
  /* The site used to be one page; send old #projects / #about links to the new pages. */
  (function () { var to = { '#projects': 'projects/', '#about': 'about/' }[location.hash]; if (to) location.replace(to); })();
</script>`,
    body,
  });
}

function listingPage(key) {
  const path = `${key}/`;
  const r = rel(path);
  const { title, noun } = SECTIONS[key];
  const items = inSection(key);
  const groups = site.groups?.[key];
  const members = (match) => items.filter(match).map((p) => p.slug).join();
  // Only offer a tag as a filter when it narrows the list to more than one
  // item, and doesn't just repeat a group that's already its own heading.
  const groupSets = (groups || []).map((g) => members((p) => p.group === g.key));
  const counts = {};
  items.forEach((p) => p.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
  const filterTags = Object.keys(counts)
    .filter((t) => counts[t] > 1 && counts[t] < items.length && !groupSets.includes(members((p) => p.tags.includes(t))))
    .sort();
  const usedGroups = (groups || []).filter((g) => items.some((p) => p.group === g.key));
  const sections = usedGroups.map((g) => {
    const rows = items.filter((p) => p.group === g.key);
    return `      <section class="proj-group" id="${g.key}" data-group="${g.key}" aria-labelledby="group-${g.key}">
        <div class="group-head">
          <h2 class="group-title" id="group-${g.key}"><span class="hash" aria-hidden="true"># </span>${esc(g.title)}</h2>${g.blurb ? `
          <p class="group-blurb">${esc(g.blurb)}${g.link ? ` <a href="${esc(g.link.url)}" target="_blank" rel="noopener">${esc(g.link.text)} →</a>` : ''}</p>` : ''}
        </div>
        <ul class="proj-list">
${rows.map((p) => projectRow(p, r, 'h3', { compact: true })).join('\n')}
        </ul>
      </section>`;
  });
  // Grouped sections get a file-tree sidebar; js/main.js shows one group at a
  // time. Without JavaScript the tree is plain jump links over a stacked list.
  const list = usedGroups.length
    ? `    <div class="explorer">
      <nav class="tree" aria-label="${esc(title)} sections">
        <ul>
          <li class="tree-root"><a href="#all" data-show=""><span class="tree-name">${key}/</span><span class="tree-count">${items.length}</span></a></li>
${usedGroups.map((g) => `          <li><a href="#${g.key}" data-show="${g.key}"><span class="tree-name">${g.key}/</span><span class="tree-count">${items.filter((p) => p.group === g.key).length}</span></a></li>`).join('\n')}
        </ul>
      </nav>
      <div class="explorer-main">
        <p class="list-count" data-count aria-live="polite">${plural(items.length, noun)}</p>
${sections.join('\n')}
        <div class="empty" data-empty hidden>
          <p>No ${noun[1]} match that search.</p>
          <button class="btn btn--small" type="button" data-reset>clear search and filters</button>
        </div>
      </div>
    </div>`
    : `    <p class="list-count" data-count aria-live="polite">${plural(items.length, noun)}</p>
    <ul class="proj-list">
${items.map((p) => projectRow(p, r, 'h2', { compact: true })).join('\n')}
    </ul>
    <div class="empty" data-empty hidden>
      <p>No ${noun[1]} match that search.</p>
      <button class="btn btn--small" type="button" data-reset>clear search and filters</button>
    </div>`;
  const body = `
  ${pageHead(r, [[key]], title, site.sections[key])}
  <section class="listing" data-listing data-noun="${noun[0]}" data-nouns="${noun[1]}" aria-label="${esc(title)}">
    <div class="list-tools" data-tools hidden>
      <div class="search">
        <label class="search-label" for="q-${key}"><span aria-hidden="true">$ grep -i</span><span class="visually-hidden">Search ${noun[1]}</span></label>
        <input class="search-input" id="q-${key}" type="search" placeholder="search ${noun[1]}…" autocomplete="off" spellcheck="false" data-query>
        <button class="btn btn--small" type="button" data-clear hidden>clear</button>
      </div>${filterTags.length ? `
      <div class="filters" role="group" aria-label="Filter by tag">
        <button class="chip" type="button" data-tag="" aria-pressed="true">all</button>
${filterTags.map((t) => `        <button class="chip" type="button" data-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('\n')}
      </div>` : ''}
    </div>
${list}
  </section>`;
  return shell({ path, title: `${title} — willbuilds.ai`, description: site.sections[key], active: key, body });
}

function projectPage(p) {
  const path = `${p.category}/${p.slug}/`;
  const r = rel(path);
  const section = SECTIONS[p.category];
  const group = site.groups?.[p.category]?.find((g) => g.key === p.group);
  const sectionHref = `${r}${p.category}/${group ? `#${group.key}` : ''}`;
  const links = [
    p.liveUrl && `<a class="btn btn--primary" href="${esc(p.liveUrl)}" target="_blank" rel="noopener">open live project →</a>`,
    p.readmeUrl && `<a class="btn${p.liveUrl ? '' : ' btn--primary'}" href="${esc(p.readmeUrl)}" target="_blank" rel="noopener">read the readme →</a>`,
    p.sourceUrl && `<a class="btn" href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">source code →</a>`,
  ].filter(Boolean);
  const meta = [
    ['status', statusBadge(p.status, '')],
    ['section', `<a href="${sectionHref}">${p.category}${group ? ` / ${group.key}` : ''}</a>`],
    p.technologies?.length && ['built with', esc(p.technologies.join(', '))],
  ].filter(Boolean);
  const body = `
  <article class="readme">
    ${pageHead(r, [[p.category], [p.slug]], p.title, p.description)}
    <dl class="readme-meta">
${meta.map(([k, v]) => `      <div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n')}
    </dl>${links.length ? `
    <div class="btn-row">${links.join('\n      ')}</div>` : ''}${p.thumbnail ? `
    <figure class="readme-media"><img src="${r}${esc(p.thumbnail)}" alt="${esc(p.thumbnailAlt || `${p.title} screenshot`)}"></figure>` : ''}
${readmeSection('overview', p.overview?.map((t) => `<p>${esc(t)}</p>`).join('\n'))}
${readmeSection('problem', p.problem && `<p>${esc(p.problem)}</p>`)}
${readmeSection('solution', p.solution && `<p>${esc(p.solution)}</p>`)}
${readmeSection('how to use it', howToHtml(p.howTo))}
${readmeSection('details', p.details?.length && `<ul>${p.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`)}
${readmeSection('tags', tagList(p.tags))}
    <p class="back-link"><a href="${sectionHref}">← back to ${group ? esc(group.title.toLowerCase()) : section.title.toLowerCase()}</a></p>
  </article>`;
  return shell({
    path,
    title: `${p.title} — willbuilds.ai`,
    description: p.description,
    active: p.category,
    image: p.thumbnail,
    body,
  });
}

function notesPage() {
  const path = 'notes/';
  const r = rel(path);
  const body = `
  ${pageHead(r, [['notes']], 'Notes', site.sections.notes)}
  <ul class="proj-list">
${notes.map((n) => noteRow(n, r, 'h2')).join('\n')}
  </ul>`;
  return shell({ path, title: 'Notes — willbuilds.ai', description: site.sections.notes, active: 'notes', body });
}

function notePage(n) {
  const path = `notes/${n.slug}/`;
  const r = rel(path);
  const body = `
  <article class="readme">
    ${pageHead(r, [['notes'], [n.slug]], n.title, n.summary)}
    <p class="note-meta">${n.date ? `<time datetime="${esc(n.date)}">${esc(n.date)}</time>` : ''}${n.tags.length ? ` ${tagList(n.tags)}` : ''}</p>
    <div class="prose">
${markdown(n.body)}
    </div>
    <p class="back-link"><a href="${r}notes/">← back to notes</a></p>
  </article>`;
  return shell({ path, title: `${n.title} — willbuilds.ai`, description: n.summary, active: 'notes', body });
}

function aboutPage() {
  const path = 'about/';
  const r = rel(path);
  const body = `
  ${pageHead(r, [['about']], 'About', `${site.name} — ${site.role}`)}
  <div class="prose">
${site.about.map((t) => `    <p>${linkify(esc(t))}</p>`).join('\n')}
  </div>
${readmeSection('skills', site.skills.length && tagList(site.skills))}
${readmeSection('currently exploring', site.interests.length && `<ul>${site.interests.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`)}
${readmeSection('elsewhere', `<ul class="link-list">
${site.links.map((l) => `      <li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text)}</a></li>`).join('\n')}
      <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
    </ul>`)}`;
  return shell({ path, title: 'About — willbuilds.ai', description: `${site.name}, ${site.role}.`, active: 'about', body });
}

function notFoundPage() {
  // Served by GitHub Pages at any missing URL, so it uses root-absolute paths.
  const r = '/';
  const body = `
  <section class="term" aria-labelledby="nf-title">
    <div class="term-bar" aria-hidden="true">
      <span class="term-dot"></span><span class="term-dot"></span><span class="term-dot"></span>
      <span class="term-title">will@builds — 404</span>
    </div>
    <div class="term-body">
      <p class="term-line"><span class="term-prompt" aria-hidden="true">$</span> cd <span data-path>this-page</span></p>
      <h1 class="term-line term-out term-h1" id="nf-title">404: no such file or directory</h1>
      <p class="term-line term-comment"># the page may have moved when the site was reorganized</p>
      <div class="term-actions">
        <a class="btn btn--primary" href="${r}">go home →</a>
        <a class="btn" href="${r}projects/">projects →</a>${shown('lab') ? `
        <a class="btn" href="${r}lab/">lab →</a>` : ''}
      </div>
    </div>
  </section>`;
  return shell({ path: '404.html', root: r, title: 'Not found — willbuilds.ai', description: site.description, body, noindex: true });
}

function sitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n')}
</urlset>
`;
}

/* ---------- shared components ---------- */

function shell({ path, root, title, description, active, image, head = '', body, noindex = false }) {
  const r = root ?? rel(path);
  const home = r || './';
  const nav = [['projects'], shown('lab') && ['lab'], shown('notes') && ['notes'], ['about']].filter(Boolean).map(([key]) => {
    const current = path === `${key}/` ? ' aria-current="page"' : active === key ? ' aria-current="true"' : '';
    return `        <li><a href="${r}${key}/"${current}>${key}</a></li>`;
  });
  const ogImage = image ? `\n<meta property="og:image" content="${SITE_URL}${esc(image)}">` : '';
  return `<!DOCTYPE html>
<!-- Generated by build.mjs from content/ — edit content/, then run: node build.mjs -->
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">${noindex ? '\n<meta name="robots" content="noindex">' : `
<link rel="canonical" href="${SITE_URL}${path}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="willbuilds.ai">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">${ogImage}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${r}css/style.css">${head ? `\n${head}` : ''}
</head>
<body>
<a class="skip-link" href="#main">skip to content</a>

<header class="topbar">
  <div class="wrap">
    <a class="prompt-logo" href="${home}" aria-label="willbuilds.ai home"><span class="user">will</span><span class="at">@</span><span class="host">builds</span><span class="sep">:~$</span></a>
    <nav aria-label="Primary">
      <ul class="topnav">
${nav.join('\n')}
      </ul>
    </nav>
  </div>
</header>

<main class="wrap" id="main">
${body}
</main>

<footer class="site-footer" id="contact">
  <div class="wrap">
    <h2 class="footer-title">contact</h2>
    <div class="footer-lines">
      <p class="term-line"><span class="term-prompt" aria-hidden="true">$</span> contact --email <a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
${site.links.map((l) => `      <p class="term-line"><span class="term-prompt" aria-hidden="true">$</span> contact ${esc(l.flag)} <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.text)}</a></p>`).join('\n')}
    </div>
    <p class="footer-note"># © ${new Date().getFullYear()} ${esc(site.name)} · willbuilds.ai</p>
  </div>
</footer>

<script src="${r}js/main.js" defer></script>
</body>
</html>
`;
}

function pageHead(r, trail, title, lede) {
  // trail: [[segment], ...] — every segment but the last links to its folder.
  let href = r;
  const crumbs = trail.map(([seg], i) => {
    href += `${seg}/`;
    return i === trail.length - 1
      ? `<li aria-current="page">${esc(seg)}</li>`
      : `<li><a href="${href}">${esc(seg)}</a></li>`;
  });
  return `<header class="page-head">
    <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${r || './'}">willbuilds.ai</a></li>${crumbs.join('')}</ol></nav>
    <h1 class="page-title">${esc(title)}</h1>${lede ? `
    <p class="page-lede">${esc(lede)}</p>` : ''}
  </header>`;
}

function sectHead(id, cmd, title) {
  return `<div class="sect-head">
      <p class="sect-cmd" aria-hidden="true">${esc(cmd)}</p>
      <h2 class="sect-title" id="${id}">${esc(title)}</h2>
    </div>`;
}

function projectRow(p, r, h, { compact = false } = {}) {
  const search = [p.title, p.summary, p.description, ...p.tags, ...(p.technologies || []), ...(p.overview || []), ...(p.details || []), ...(p.howTo?.steps || [])]
    .join(' ').toLowerCase();
  if (compact) {
    return `          <li class="proj proj--compact" data-search="${esc(search)}" data-tags="${esc(p.tags.join(' '))}">
            <div class="proj-line">
              <${h} class="proj-name"><a class="proj-title" href="${r}${p.category}/${p.slug}/"><span class="glyph" aria-hidden="true">&gt;</span>${esc(p.title)}</a></${h}>
              ${statusBadge(p.status, '')}
            </div>
            <p class="proj-summary">${esc(p.summary || p.description)}</p>
          </li>`;
  }
  return `      <li class="proj${p.thumbnail ? ' proj--thumb' : ''}" data-search="${esc(search)}" data-tags="${esc(p.tags.join(' '))}">
        <div class="proj-body">
          <${h} class="proj-name"><a class="proj-title" href="${r}${p.category}/${p.slug}/"><span class="glyph" aria-hidden="true">&gt;</span>${esc(p.title)}</a></${h}>
          <p class="proj-desc">${esc(p.description)}</p>
          <div class="proj-meta">${statusBadge(p.status)}${tagList(p.tags)}</div>
        </div>${p.thumbnail ? `
        <img class="proj-thumb" src="${r}${esc(p.thumbnail)}" alt="" loading="lazy">` : ''}
      </li>`;
}

// The homepage description (what Google shows under the link) leads with the
// featured projects in homepage order, then site.tagline. Names are added
// while the whole thing stays within ~160 characters, Google's usual cutoff.
function featuredDescription(picks) {
  const tail = ` — ${site.tagline}`;
  const names = [];
  for (const p of picks) {
    if (`${listJoin([...names, p.title])}${tail}`.length > 160) break;
    names.push(p.title);
  }
  if (!names.length) return site.description;
  const more = names.length < picks.length ? ' and more' : '';
  return `${listJoin(names, !more)}${more}${tail}`;
}

function listJoin(items, useAnd = true) {
  if (items.length < 2 || !useAnd) return items.join(', ');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function projectCard(p, r) {
  const folder = p.group || p.category;
  return `      <li class="card">${p.thumbnail ? `
        <img class="card-thumb" src="${r}${esc(p.thumbnail)}" alt="" loading="lazy">` : ''}
        <div class="card-body">
          <p class="card-path" aria-hidden="true">~/${esc(p.category)}/${p.group ? `${esc(folder)}/` : ''}</p>
          <h3 class="card-title"><a class="proj-title" href="${r}${p.category}/${p.slug}/">${esc(p.title)}</a></h3>
          <p class="card-desc">${esc(p.summary || p.description)}</p>
          <div class="card-meta">${statusBadge(p.status)}</div>
        </div>
      </li>`;
}

function noteRow(n, r, h) {
  return `      <li class="proj">
        <div class="proj-body">
          <${h} class="proj-name"><a class="proj-title" href="${r}notes/${n.slug}/"><span class="glyph" aria-hidden="true">&gt;</span>${esc(n.title)}</a></${h}>
          ${n.summary ? `<p class="proj-desc">${esc(n.summary)}</p>` : ''}
          <div class="proj-meta">${n.date ? `<time class="status" datetime="${esc(n.date)}">${esc(n.date)}</time>` : ''}${tagList(n.tags)}</div>
        </div>
      </li>`;
}

// Optional "how to use it" section: { intro, setup: [commands], steps: [..], tryAlso: [..] }.
// Every part is optional; with none of them the section is left out.
function howToHtml(h) {
  if (!h) return '';
  return [
    h.intro && `<p>${esc(h.intro)}</p>`,
    h.setup?.length && `<pre class="howto-cmd"><code>${h.setup.map(esc).join('\n')}</code></pre>`,
    h.steps?.length && `<ol class="howto-steps">${h.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
    h.tryAlso?.length && `<p class="howto-sub">other things to try</p>
      <ul>${h.tryAlso.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`,
  ].filter(Boolean).join('\n      ');
}

function readmeSection(title, html) {
  if (!html) return '';
  return `    <section class="readme-sect">
      <h2 class="readme-h"><span class="hash" aria-hidden="true">## </span>${esc(title)}</h2>
      ${html}
    </section>`;
}

function statusBadge(status, label = 'status: ') {
  return `<span class="status status--${status}"><span class="status-mark" aria-hidden="true"></span>${label}${STATUS[status]}</span>`;
}

function tagList(tags) {
  if (!tags?.length) return '';
  return `<ul class="tags" aria-label="Tags">${tags.map((t) => `<li class="tag">${esc(t)}</li>`).join('')}</ul>`;
}

/* ---------- content loading ---------- */

function readNotes() {
  const dir = join(ROOT, 'content/notes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const raw = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      if (!m) fail(`content/notes/${f}: missing the --- front matter block at the top`);
      const meta = Object.fromEntries(
        m[1].split('\n').filter((l) => l.includes(':')).map((l) => {
          const i = l.indexOf(':');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
      );
      if (!meta.title) fail(`content/notes/${f}: front matter needs a title`);
      return {
        slug: f.replace(/\.md$/, ''),
        title: meta.title,
        date: meta.date || '',
        summary: meta.summary || '',
        tags: meta.tags ? meta.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        body: m[2],
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function validate() {
  const seen = new Set();
  projects.forEach((p, i) => {
    const where = `content/projects.json, entry ${i + 1}${p.slug ? ` (${p.slug})` : ''}`;
    for (const k of ['slug', 'title', 'category', 'status', 'description']) if (!p[k]) fail(`${where}: missing "${k}"`);
    if (!/^[a-z0-9-]+$/.test(p.slug)) fail(`${where}: slug must be lowercase-with-dashes`);
    if (seen.has(p.slug)) fail(`${where}: duplicate slug`);
    seen.add(p.slug);
    if (!['projects', 'lab'].includes(p.category)) fail(`${where}: category must be "projects" or "lab"`);
    if (!STATUS[p.status]) fail(`${where}: status must be one of ${Object.keys(STATUS).join(', ')}`);
    const groups = site.groups?.[p.category];
    if (groups && !groups.some((g) => g.key === p.group)) {
      fail(`${where}: "group" must be one of ${groups.map((g) => g.key).join(', ')} (set in content/site.json)`);
    }
    if (p.thumbnail && !existsSync(join(ROOT, p.thumbnail))) fail(`${where}: thumbnail ${p.thumbnail} not found`);
    p.tags ||= [];
  });
}

/* ---------- helpers ---------- */

function markdown(src) {
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const block = /^(```|#{2,4}\s|[-*]\s|\d+\.\s|>\s?)/;
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++;
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{2,4})\s+(.*)/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    const list = [[/^[-*]\s+/, 'ul'], [/^\d+\.\s+/, 'ol']].find(([re]) => re.test(line));
    if (list) {
      const [re, tag] = list;
      const items = [];
      while (i < lines.length && re.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(re, ''))}</li>`);
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !block.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

function linkify(escaped) {
  // Turn bare domains in About copy (e.g. willmalfeld.com) into links.
  return escaped.replace(/\b([a-z0-9-]+\.(?:com|ai|dev|io|org))\b/g, '<a href="https://$1" target="_blank" rel="noopener">$1</a>');
}

function plural(n, [one, many]) {
  return `${n} ${n === 1 ? one : many}`;
}

function rel(path) {
  return '../'.repeat(path.split('/').filter(Boolean).length);
}

function emit(path, html) {
  pages.push(path);
  write(path ? `${path}index.html` : 'index.html', html);
}

function write(file, contents) {
  const full = join(ROOT, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
  } catch (e) {
    fail(`${file}: ${e.message}`);
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fail(msg) {
  console.error(`build failed: ${msg}`);
  process.exit(1);
}
