import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Testably',
  tagline: 'Testing libraries that get out of your way.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.testably.org',
  baseUrl: '/',

  organizationName: 'Testably',
  projectName: 'Testably.Site',

  clientModules: ['./src/clientModules/sectionTheme.ts'],

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        docsRouteBasePath: '/',
        indexBlog: false,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        searchContextByPaths: [
          {label: 'Abstractions', path: 'Abstractions'},
          {label: 'aweXpect', path: 'aweXpect'},
          {label: 'Mockolate', path: 'Mockolate'},
          {label: 'Awaiten', path: 'Awaiten'},
        ],
        useAllContextsWithNoSearchContext: true,
      },
    ],
  ],

  plugins: [
    [
      './src/plugins/nuget-versions/index.ts',
      {
        packages: [
          'Testably.Abstractions',
          'Testably.Abstractions.Testing',
          'Testably.Abstractions.Compression',
          'Testably.Abstractions.AccessControl',
          'Testably.Abstractions.MemoryMappedFiles',
          'Testably.Abstractions.Migration',
          'aweXpect',
          'aweXpect.Core',
          'aweXpect.Chronology',
          'aweXpect.Json',
          'aweXpect.Logging',
          'aweXpect.Migration',
          'aweXpect.Mockolate',
          'aweXpect.Reflection',
          'aweXpect.Snapshots',
          'aweXpect.Snapshots.DiffEngine',
          'aweXpect.Snapshots.PublicApi',
          'aweXpect.Testably',
          'aweXpect.Web',
          'aweXpect.Xml',
          'Mockolate',
          'Mockolate.Migration',
          'Awaiten',
          'Awaiten.Extensions.DependencyInjection',
        ],
      },
    ],
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Pages moved by the aweXpect documentation restructuring.
        redirects: [
          {from: '/aweXpect/concepts', to: '/aweXpect/how-it-works/'},
          {from: '/aweXpect/equivalency', to: '/aweXpect/values/equivalency'},
          {from: '/aweXpect/write-extension', to: '/aweXpect/extending/'},
          {from: '/aweXpect/changelog-v3', to: '/aweXpect/migration/from-awexpect-2'},
          {from: '/aweXpect/advanced/multiple-expectations', to: '/aweXpect/how-it-works/combining'},
          {from: '/aweXpect/advanced/customization', to: '/aweXpect/how-it-works/configuration'},
          {from: '/aweXpect/advanced/cancellation', to: '/aweXpect/how-it-works/time-and-cancellation'},
          {from: '/aweXpect/advanced/ref-struct', to: '/aweXpect/how-it-works/'},
          {from: '/category/common-types', to: '/aweXpect/values/'},
          {from: '/Chronology', to: '/aweXpect/extensions/aweXpect.Chronology/'},
          ...[
            'boolean', 'string', 'char', 'number', 'enum', 'object', 'timespan',
            'datetime-offset', 'date-time-only', 'guid', 'version', 'stream',
          ].map((page) => ({from: `/aweXpect/common-types/${page}`, to: `/aweXpect/values/${page}`})),
        ],
        createRedirects(existingPath: string) {
          // Derived from the existing path, so they hold whether the folder is spelled "behaviour" or "behavior".
          const behaviorPage = existingPath.match(/^\/aweXpect\/behaviou?r\/(delegates|events|callbacks)$/)?.[1];
          if (behaviorPage) {
            return [behaviorPage === 'callbacks' ? '/aweXpect/advanced/callbacks' : `/aweXpect/${behaviorPage}`];
          }
          // The extension packages moved from the top-level Extensions section into the aweXpect section.
          const prefix = '/aweXpect/extensions';
          if (existingPath !== prefix && !existingPath.startsWith(`${prefix}/`)) {
            return undefined;
          }
          const rest = existingPath.substring(prefix.length);
          // GitHub Pages serves paths case-sensitively, so the lower-case spelling needs its own redirect file,
          // which a case-insensitive file system (Windows, macOS) cannot hold next to the original one.
          return process.platform === 'linux'
            ? [`/Extensions${rest}`, `/extensions${rest}`]
            : [`/Extensions${rest}`];
        },
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Testably',
      logo: {
        alt: 'Testably logo',
        src: 'img/testably-light.svg',
        srcDark: 'img/testably-dark.svg',
        width: 32,
        height: 32,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'abstractionsSidebar',
          position: 'left',
          label: 'Abstractions',
        },
        {
          type: 'docSidebar',
          sidebarId: 'awexpectSidebar',
          position: 'left',
          label: 'aweXpect',
        },
        {
          type: 'docSidebar',
          sidebarId: 'mockolateSidebar',
          position: 'left',
          label: 'Mockolate',
        },
        {
          type: 'docSidebar',
          sidebarId: 'awaitenSidebar',
          position: 'left',
          label: 'Awaiten',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          items: [
            {
              html: `<a href="https://github.com/Testably/Testably.Abstractions" class="footer__library-name">Testably.Abstractions</a>`,
            },
            {
              html: `<a href="https://www.nuget.org/packages/Testably.Abstractions" class="footer__nuget-badge"><img src="https://img.shields.io/nuget/v/Testably.Abstractions?label=NuGet&logo=nuget" alt="Testably.Abstractions on NuGet"/></a>`,
            },
          ],
        },
        {
          items: [
            {
              html: `<a href="https://github.com/Testably/aweXpect" class="footer__library-name">aweXpect</a>`,
            },
            {
              html: `<a href="https://www.nuget.org/packages/aweXpect" class="footer__nuget-badge"><img src="https://img.shields.io/nuget/v/aweXpect?label=NuGet&logo=nuget" alt="aweXpect on NuGet"/></a>`,
            },
          ],
        },
        {
          items: [
            {
              html: `<a href="https://github.com/Testably/Mockolate" class="footer__library-name">Mockolate</a>`,
            },
            {
              html: `<a href="https://www.nuget.org/packages/Mockolate" class="footer__nuget-badge"><img src="https://img.shields.io/nuget/v/Mockolate?label=NuGet&logo=nuget" alt="Mockolate on NuGet"/></a>`,
            },
          ],
        },
        {
          items: [
            {
              html: `<a href="https://github.com/Testably/Awaiten" class="footer__library-name">Awaiten</a>`,
            },
            {
              html: `<a href="https://www.nuget.org/packages/Awaiten" class="footer__nuget-badge"><img src="https://img.shields.io/nuget/v/Awaiten?label=NuGet&logo=nuget" alt="Awaiten on NuGet"/></a>`,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Testably.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['csharp', 'powershell', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
