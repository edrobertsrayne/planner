# Lesson plans are markdown end to end

The Lesson editor's "Notes & objectives" field advertised markdown in its placeholder but was a
plain textarea, and the Session panel printed the body verbatim. Both the Lesson body and the
Session note are now authored in a WYSIWYG markdown editor and read back rendered. The stored
format is unchanged: markdown text in `lesson.body` and `session.note`.

## Why

Tiptap 3 with `@tiptap/markdown` is the authoring surface, chosen over a plain textarea with a
preview toggle, and over Milkdown Crepe, which drags in Vue, KaTeX and CodeMirror and a
competing theme stylesheet. Two markdown implementations on purpose: Tiptap owns the editing
round-trip, `markdown-it` owns read-only rendering. Rendering with Tiptap instead would pull
ProseMirror into the Session panel and the Class page; `markdown-it` with `html: false` also
makes the `{@html}` safe by construction, with no sanitiser.

## Consequences

The body and the note stay markdown text in SQLite — no schema change, no migration, no change
to any write path or API. One WYSIWYG editor component (`markdown-editor.svelte`) serves the
Lesson editor and the Session panel; one read-only renderer (`markdown.svelte` over
`renderMarkdown`) serves the Session panel body and the Class page's "Last taught" note; one
`.markdown` stylesheet in `layout.css` covers both sides so written and read text look the
same. `@tailwindcss/typography` stays dropped — ADR-0012's "nothing in the app renders prose"
no longer holds, but `.markdown` covers the whole of what the editor can produce, on the app's
own tokens.

> **Amended 2026-10-07.** Lesson bodies and Session notes now render LaTeX maths, chemistry (`\ce{}`, mhchem) included, through KaTeX. KaTeX was one of the reasons Milkdown was rejected. It now arrives on its own, without Vue or CodeMirror. Both renderers read one syntax: `$…$` inline and `$$…$$` block, with regexes copied from `@tiptap/extension-mathematics` into `markdown.ts`. A ready-made markdown-it plugin would apply Pandoc's stricter `$` rules, so the read-only view would disagree with the editor. A literal dollar is `\$`. The editor patches `@tiptap/markdown`'s text escaping so that it writes `\$`. The `{@html}` stays safe only while markdown-it has `html: false` and KaTeX has `trust: false`. Both conditions are now load-bearing.

> **Amended 2026-10-10 (ADR-0026).** The Session note became the **Teaching note**, stored as
> markdown in `lesson_note.body`. Nothing else here changes.
