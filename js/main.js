// Section tree, search and tag filters for the Projects and Lab listings.
// build.mjs renders every entry as plain HTML; this script only hides and
// shows rows, so without JavaScript the full list still appears (unfiltered).

document.querySelectorAll('[data-listing]').forEach((listing) => {
  const input = listing.querySelector('[data-query]');
  const clear = listing.querySelector('[data-clear]');
  const reset = listing.querySelector('[data-reset]');
  const count = listing.querySelector('[data-count]');
  const empty = listing.querySelector('[data-empty]');
  const chips = [...listing.querySelectorAll('[data-tag]')];
  const rows = [...listing.querySelectorAll('[data-search]')];
  const groups = [...listing.querySelectorAll('[data-group]')];
  const links = [...listing.querySelectorAll('[data-show]')];
  const { noun, nouns } = listing.dataset;
  let activeTag = '';

  // Which group the tree has open: '' means all of them.
  const groupFromHash = () => {
    const key = location.hash.slice(1);
    if (key === 'all') return '';
    return groups.some((g) => g.dataset.group === key) ? key : null;
  };
  let current = groups.length ? groupFromHash() ?? groups[0].dataset.group : '';

  listing.querySelector('[data-tools]').hidden = false;

  function apply() {
    const q = input.value.trim().toLowerCase();
    // While searching or filtering, look across every group.
    const searching = Boolean(q || activeTag);
    let shown = 0;
    let inView = 0;
    rows.forEach((row) => {
      const group = row.closest('[data-group]')?.dataset.group;
      const visibleGroup = searching || !current || group === current;
      const match =
        visibleGroup &&
        (!q || row.dataset.search.includes(q)) &&
        (!activeTag || row.dataset.tags.split(' ').includes(activeTag));
      row.hidden = !match;
      if (visibleGroup) inView++;
      if (match) shown++;
    });
    groups.forEach((g) => {
      g.hidden = !g.querySelector('[data-search]:not([hidden])');
    });
    links.forEach((a) => {
      if (!searching && a.dataset.show === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    count.textContent = searching
      ? `${shown} of ${rows.length} ${nouns} match`
      : `${inView} ${inView === 1 ? noun : nouns}`;
    clear.hidden = !input.value;
    empty.hidden = shown > 0;
  }

  function setTag(tag) {
    activeTag = tag;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.tag === tag)));
    apply();
  }

  function show(key) {
    current = key;
    input.value = '';
    setTag('');
  }

  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) { input.value = ''; apply(); }
  });
  clear.addEventListener('click', () => { input.value = ''; apply(); input.focus(); });
  reset.addEventListener('click', () => { input.value = ''; setTag(''); input.focus(); });
  chips.forEach((c) => c.addEventListener('click', () => setTag(c.dataset.tag)));
  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    try { history.replaceState(null, '', a.getAttribute('href')); } catch { /* sandboxed */ }
    show(a.dataset.show);
  }));
  window.addEventListener('hashchange', () => {
    const key = groupFromHash();
    if (key !== null) show(key);
  });

  apply();
});
