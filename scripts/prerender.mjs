import { build } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')

// Build the SSR bundle
await build({
  root,
  build: {
    ssr: 'src/entry-prerender.jsx',
    outDir: 'dist-ssr',
    rollupOptions: {
      output: { format: 'es' },
    },
  },
  logLevel: 'warn',
})

// Import the SSR bundle
const { render } = await import(pathToFileURL(path.join(ssrDir, 'entry-prerender.js')).href)

// Read the client-built index.html as template
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')

const routes = ['/', '/privacy', '/terms']

for (const route of routes) {
  const html = render(route)
  const page = template.replace(
    '<div id="root"></div>',
    `<div id="root">${html}</div>`
  )

  if (route === '/') {
    fs.writeFileSync(path.join(distDir, 'index.html'), page)
  } else {
    const dir = path.join(distDir, route.slice(1))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), page)
  }

  console.log(`Pre-rendered: ${route}`)
}

// Clean up SSR build
fs.rmSync(ssrDir, { recursive: true, force: true })

console.log('Pre-rendering complete!')
