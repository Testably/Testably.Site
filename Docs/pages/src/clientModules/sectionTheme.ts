/**
 * Sets `data-section` on the <html> element based on the current route. The
 * value is consumed by `src/css/custom.css` to swap `--ifm-color-primary` per
 * library section, and by the swizzled `Logo` component to pick the matching
 * SVG icon.
 *
 * Sections: 'abstractions' | 'awexpect' | 'mockolate' | 'extensions'
 * Anything else (including `/`) leaves the attribute unset, falling back to
 * the bracket beige defined in `:root`.
 */

const SECTION_PATTERN = /^\/(abstractions|awexpect|mockolate|extensions)(?:\/|$)/i;

function getSection(pathname: string): string | null {
  const match = pathname.match(SECTION_PATTERN);
  return match ? match[1].toLowerCase() : null;
}

function applySection(): void {
  if (typeof document === 'undefined') return;
  const section = getSection(window.location.pathname);
  if (section) {
    document.documentElement.setAttribute('data-section', section);
  } else {
    document.documentElement.removeAttribute('data-section');
  }
}

if (typeof window !== 'undefined') {
  applySection();
  window.addEventListener('popstate', applySection);

  // Docusaurus uses the History API for client-side navigation; wrap pushState
  // and replaceState so we react to programmatic route changes too.
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<typeof original>) {
      const result = original.apply(this, args);
      applySection();
      return result;
    } as typeof original;
  }
}

export default function sectionTheme() {
  // Module entry point — side effects above run on first import.
}
