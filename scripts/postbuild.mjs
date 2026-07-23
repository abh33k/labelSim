import { readFileSync, writeFileSync } from 'fs'

const html = readFileSync('dist/index.html', 'utf8')
const result = html
  .replace(/<script type="module"/, '<script defer')
  .replace(/ crossorigin/g, '')
writeFileSync('dist/index.html', result)
console.log('Post-build: stripped type="module", added defer, removed crossorigin')
