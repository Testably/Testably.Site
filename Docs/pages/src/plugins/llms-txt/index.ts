/**
 * Writes an `llms.txt` (https://llmstxt.org) that lists every docs page with its title and description, grouped by
 * library in sidebar order, so AI tools can find the right page without crawling the site.
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import type {LoadContext, Plugin} from '@docusaurus/types';
import type {LoadedContent} from '@docusaurus/plugin-content-docs';

type Options = {libraries: string[]};

type Page = {title: string; description: string; permalink: string; sortKey: string};

export default function llmsTxtPlugin(context: LoadContext, options: Options): Plugin {
  let pages: Page[] = [];
  return {
    name: 'llms-txt',
    async allContentLoaded({allContent}) {
      const docs = allContent['docusaurus-plugin-content-docs']?.default as LoadedContent | undefined;
      pages = (docs?.loadedVersions[0].docs ?? [])
        .filter((doc) => !doc.unlisted)
        .map((doc) => ({
          title: doc.title,
          description: doc.description,
          permalink: doc.permalink,
          // The landing page is renamed to `index`, so it would sort after the numbered pages of its folder.
          sortKey: doc.source.replace(/\/index(\.mdx?)$/, '/00-index$1'),
        }))
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    },
    async postBuild({outDir}) {
      const {url, title, tagline} = context.siteConfig;
      const sections = options.libraries.map((library) => {
        const links = pages
          .filter((page) => page.permalink.startsWith(`/${library}/`))
          .map((page) => `- [${page.title}](${url}${page.permalink})${page.description ? `: ${page.description}` : ''}`);
        return `## ${library}\n\n${links.join('\n')}`;
      });
      await writeFile(path.join(outDir, 'llms.txt'), `# ${title}\n\n> ${tagline}\n\n${sections.join('\n\n')}\n`);
    },
  };
}
