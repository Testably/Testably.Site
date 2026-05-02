import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Testably.Abstractions',
  tagline: 'Mock the unmockable.',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.testably.org',
  baseUrl: '/',

  organizationName: 'Testably',
  projectName: 'Testably.Site',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
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
      title: 'Testably.Abstractions',
      logo: {
        alt: 'Testably.Abstractions logo',
        src: 'img/testably-abstractions-light.svg',
        srcDark: 'img/testably-abstractions-dark.svg',
        width: 32,
        height: 32,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'abstractionsSidebar',
          position: 'left',
          label: 'Docs',
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
