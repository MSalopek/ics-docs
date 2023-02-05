const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  unstable_staticImage: true,
  staticImage: true,
})

module.exports = withNextra()
