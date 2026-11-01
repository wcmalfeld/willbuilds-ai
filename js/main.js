// Search + tag filters for the Projects and Lab listings.
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
  const { noun, nouns } = listing.dataset;
  let activeTag = '';

  listing.querySelector('[data-tools]').hidden = false;

  function apply() {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    rows.forEach((row) => {
      const match =
        (!q || row.dataset.search.includes(q)) &&
        (!activeTag || row.dataset.tags.split(' ').includes(activeTag));
      row.hidden = !match;
      if (match) shown++;
    });
    const total = rows.length;
    count.textContent = shown === total
      ? `${total} ${total === 1 ? noun : nouns}`
      : `${shown} of ${total} ${nouns} shown`;
    clear.hidden = !input.value;
    empty.hidden = shown > 0;
    listing.querySelectorAll('[data-group]').forEach((g) => {
      g.hidden = !g.querySelector('[data-search]:not([hidden])');
    });
  }

  function setTag(tag) {
    activeTag = tag;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.tag === tag)));
    apply();
  }

  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) { input.value = ''; apply(); }
  });
  clear.addEventListener('click', () => { input.value = ''; apply(); input.focus(); });
  reset.addEventListener('click', () => { input.value = ''; setTag(''); input.focus(); });
  chips.forEach((c) => c.addEventListener('click', () => setTag(c.dataset.tag)));
});
