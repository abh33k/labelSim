import { readFileSync, writeFileSync } from 'fs'

const html = readFileSync('dist/index.html', 'utf8')
const result = html.replace(/<script type="module"/, '<script defer')
writeFileSync('dist/index.html', result)
console.log('Post-build: stripped type="module", added defer')
