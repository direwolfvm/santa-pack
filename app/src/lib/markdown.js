import { h } from './dom.js';

/**
 * Just enough Markdown for docs/guide.md: headings, paragraphs, lists, tables,
 * **bold**, *italic*, `code` and links. Everything becomes DOM nodes through
 * h(), so the text can never turn into markup.
 *
 * @typedef {import('./dom.js').Child} Child
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/;
const SAFE_HREF = /^(\/|#|https:\/\/|mailto:)/;

/** @param {string} text @returns {Child[]} */
export function inline(text) {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) return h('strong', null, ...inline(part.slice(2, -2)));
      if (part.startsWith('`') && part.endsWith('`')) return h('code', null, part.slice(1, -1));
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) return SAFE_HREF.test(link[2]) ? h('a', { href: link[2] }, ...inline(link[1])) : link[1];
      if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return h('em', null, part.slice(1, -1));
      return part;
    });
}

/** A heading's anchor id: "Who's who" → "whos-who". @param {string} text */
export function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** @param {string} row */
const cells = (row) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());

/**
 * @param {string} source
 * @returns {{ title: string, nodes: HTMLElement[], sections: { id: string, text: string }[] }}
 *   The first-level heading is returned as `title`; second-level headings are listed in `sections`.
 */
export function renderMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  /** @type {HTMLElement[]} */
  const nodes = [];
  /** @type {{ id: string, text: string }[]} */
  const sections = [];
  let title = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      if (level === 1 && !title) title = text;
      else {
        const id = slug(text);
        if (level === 2) sections.push({ id, text });
        nodes.push(h(/** @type {'h2' | 'h3' | 'h4'} */ (`h${Math.max(level, 2)}`), { id }, ...inline(text)));
      }
      i += 1;
      continue;
    }

    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      const [head, , ...body] = rows;
      nodes.push(
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            null,
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                head.map((cell) => h('th', { scope: 'col' }, ...inline(cell))),
              ),
            ),
            h(
              'tbody',
              null,
              body.map((row) =>
                h(
                  'tr',
                  null,
                  row.map((cell) => h('td', null, ...inline(cell))),
                ),
              ),
            ),
          ),
        ),
      );
      continue;
    }

    const bullet = /^[-*]\s+/;
    const numbered = /^\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const marker = bullet.test(line) ? bullet : numbered;
      const items = [];
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ''));
      nodes.push(
        h(
          marker === bullet ? 'ul' : 'ol',
          null,
          items.map((item) => h('li', null, ...inline(item))),
        ),
      );
      continue;
    }

    // The first line always belongs here, so an odd line (say "#hashtag") can't stall the loop.
    const paragraph = [lines[i++].trim()];
    while (i < lines.length && lines[i].trim() && !/^(#|\||[-*]\s|\d+\.\s)/.test(lines[i])) {
      paragraph.push(lines[i++].trim());
    }
    nodes.push(h('p', null, ...inline(paragraph.join(' '))));
  }
  return { title, nodes, sections };
}
