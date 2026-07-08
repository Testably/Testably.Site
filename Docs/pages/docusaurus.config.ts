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

  // Relaxed for the multi-library preview — links across sections from the
  // original single-library sites have not yet been fixed up.
  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
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
          editUrl:
            'https://github.com/Testably/Testably.Site/tree/main/Docs/pages/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-preview.png',
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
        {
          type: 'docSidebar',
          sidebarId: 'chronologySidebar',
          position: 'right',
          label: 'Chronology',
        },
        {
          type: 'docSidebar',
          sidebarId: 'extensionsSidebar',
          position: 'right',
          label: 'Extensions',
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
