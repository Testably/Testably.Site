import type {PrismTheme} from 'prism-react-renderer';

type Palette = {
  background: string;
  foreground: string;
  keyword: string;
  type: string;
  string: string;
  comment: string;
  inserted: string;
  deleted: string;
};

/** Builds a Prism theme from the code colors of the start page (src/pages/index.module.css), so code looks the same everywhere. */
function theme(palette: Palette): PrismTheme {
  return {
    plain: {color: palette.foreground, backgroundColor: palette.background},
    styles: [
      {types: ['comment', 'prolog', 'doctype', 'cdata'], style: {color: palette.comment}},
      {types: ['keyword', 'boolean', 'builtin', 'tag', 'selector', 'important'], style: {color: palette.keyword}},
      {types: ['class-name', 'namespace', 'attr-name', 'property', 'variable'], style: {color: palette.type}},
      {types: ['string', 'char', 'number', 'attr-value', 'regex', 'url'], style: {color: palette.string}},
      {types: ['inserted'], style: {color: palette.inserted}},
      {types: ['deleted'], style: {color: palette.deleted}},
    ],
  };
}

export const lightCodeTheme = theme({
  background: '#f6f5f2',
  foreground: '#2b2a28',
  keyword: '#2f5d8a',
  type: '#8a6f2b',
  string: '#a3520f',
  comment: '#6f6a62',
  inserted: '#2e7d32',
  deleted: '#b3261e',
});

export const darkCodeTheme = theme({
  background: '#111113',
  foreground: '#d8d4cd',
  keyword: '#8fb3d9',
  type: '#e6c07b',
  string: '#d7ba7d',
  comment: '#8a847c',
  inserted: '#81c784',
  deleted: '#e57373',
});
