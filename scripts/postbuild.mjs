import { readFileSync, writeFileSync } from 'fs'

const html = readFileSync('dist/index.html', 'utf8')

const startMarker = '<script type="module"'
const startIdx = html.indexOf(startMarker)
if (startIdx === -1) process.exit(0)

const firstClose = html.indexOf('>', startIdx) + 1
const endIdx = html.indexOf('</script>', firstClose) + '</script>'.length

const scriptContent = html.slice(firstClose, endIdx - '</script>'.length)
const cleanScript = '<script>' + scriptContent + '</script>'
const withoutScript = html.slice(0, startIdx) + html.slice(endIdx)
const result = withoutScript.replace('  </body>', '  ' + cleanScript + '\n  </body>')

writeFileSync('dist/index.html', result)
console.log('Post-build: moved inline script after #root, stripped type="module"')
