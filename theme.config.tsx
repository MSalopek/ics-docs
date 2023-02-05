import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'
import { useConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span>Replicated Security Docs</span>,
  project: {
    link: 'https://github.com/cosmos/interchain-security',
  },
  // chat: {
  //   link: 'https://discord.com',
  // },
  docsRepositoryBase: 'https://github.com/cosmos/interchain-security/tree/main/docs',
  footer: {
    text: 'Replicated Security Docs',
  },
  useNextSeoProps() {
    const { frontMatter } = useConfig()
    return {
      // additionalLinkTags: [
      //   {
      //     href: '/apple-icon-180x180.png',
      //     rel: 'apple-touch-icon',
      //     sizes: '180x180'
      //   },
      //   {
      //     href: '/android-icon-192x192.png',
      //     rel: 'icon',
      //     sizes: '192x192',
      //     type: 'image/png'
      //   },
      //   {
      //     href: '/favicon-96x96.png',
      //     rel: 'icon',
      //     sizes: '96x96',
      //     type: 'image/png'
      //   },
      //   {
      //     href: '/favicon-32x32.png',
      //     rel: 'icon',
      //     sizes: '32x32',
      //     type: 'image/png'
      //   },
      //   {
      //     href: '/favicon-16x16.png',
      //     rel: 'icon',
      //     sizes: '16x16',
      //     type: 'image/png'
      //   }
      // ],
      additionalMetaTags: [
        { content: 'en', httpEquiv: 'Content-Language' },
        { content: 'Nextra', name: 'apple-mobile-web-app-title' },
        { content: '#fff', name: 'msapplication-TileColor' },
        { content: '/ms-icon-144x144.png', name: 'msapplication-TileImage' }
      ],
      description:
        frontMatter.description || 'ICS Docs: Replicated Security docs page for Cosmos SDK based chains',
      // openGraph: {
      //   images: [
      //     { url: frontMatter.image || 'https://nextra.vercel.app/og.png' }
      //   ]
      // },
      titleTemplate: '%s – Replicated Security Docs',
      // twitter: {
      // cardType: 'summary_large_image',
      // site: 'https://nextra.vercel.app'
      // }
    }
  }
}

export default config
