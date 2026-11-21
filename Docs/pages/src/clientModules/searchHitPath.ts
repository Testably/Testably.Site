/**
 * The search plugin renders the breadcrumb of a hit as plain text, e.g. `Mockolate › Setup › Events`, so neither its
 * library nor its page can be styled by CSS alone. As the hits appear, the library name is replaced with its icon and,
 * in the dropdown, the page is wrapped in <b>.
 */

const SEPARATOR = ' › ';

const LIBRARY_ICONS: Record<string, string> = {
  Abstractions: 'testably-abstractions',
  aweXpect: 'awexpect',
  Mockolate: 'mockolate',
};

/** Both variants, so CSS shows the one of the current color mode, also after it is switched with hits on screen. */
function libraryIcons(library: string): HTMLImageElement[] {
  return (['light', 'dark'] as const).map((theme) => {
    const icon = document.createElement('img');
    icon.src = `/img/${LIBRARY_ICONS[library]}-${theme}.svg`;
    icon.alt = library;
    icon.width = 16;
    icon.height = 16;
    icon.className = `search-hit-library search-hit-library--${theme}`;
    return icon;
  });
}

function decorate(path: HTMLElement, emphasizePage: boolean): void {
  path.dataset.decorated = '';
  const segments = (path.textContent ?? '').split(SEPARATOR);
  if (!(segments[0] in LIBRARY_ICONS)) return;
  const icons = libraryIcons(segments[0]);
  if (segments.length > 1) segments.shift();
  const page = segments.pop() ?? '';
  path.textContent = segments.map((segment) => segment + SEPARATOR).join('');
  path.prepend(...icons);
  path.append(emphasizePage ? Object.assign(document.createElement('b'), {textContent: page}) : page);
}

function decorateHits(): void {
  for (const path of document.querySelectorAll<HTMLElement>('[class*="hitPath_"]:not([data-decorated])')) {
    decorate(path, true);
  }
  for (const path of document.querySelectorAll<HTMLElement>('[class*="searchResultItemPath_"]:not([data-decorated])')) {
    decorate(path, false);
  }
}

if (typeof window !== 'undefined') {
  new MutationObserver(decorateHits).observe(document.documentElement, {childList: true, subtree: true});
}

export default function searchHitPath() {
  // Module entry point — side effects above run on first import.
}
