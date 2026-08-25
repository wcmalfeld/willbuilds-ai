# willbuilds.ai — site guide

A static, single-page site. No build step — open `index.html` in a browser to preview, or upload the folder to any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages).

## Files

```
index.html      The whole site (about terminal + project list + contact)
css/style.css   All styling — colors, type, terminal-window chrome
js/main.js      Placeholder — the blinking cursor is CSS-only
```

## Add a new project

Find `<div class="proj-list">` in `index.html` and duplicate one `<article class="proj">...</article>` block. Update:

- The name after `<span class="glyph">&gt;</span>` — keep it lowercase-with-dashes for the terminal feel
- The description paragraph
- The `<span class="tag">` items (as many or few as fit — these render as `--tag-name`)
- The `status:` text (`live`, `in development`, `archived`, etc.)
- Add `<span class="proj-link"><a href="https://...">view</a></span>` inside `.proj-meta` once a project has a live link

## Colors & type

Design tokens live at the top of `css/style.css` under `:root`:

- `--green` / `--green-bright` — the terminal-green accent
- `--ink` — body text (near-black)
- `--muted` — comments / secondary text (gray)
- `--border` — the black hairlines used for the terminal window and dividers

Swap `--green` for `#B5651D` (amber) or `#1D4ED8` (blue) if you ever want to try a different terminal palette — everything else stays the same.

## Fonts

`IBM Plex Mono` for body text, `VT323` is loaded but not currently used anywhere prominent — it's a good option if you want an even more retro-CRT display font for a future hero headline.
