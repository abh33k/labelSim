import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

function stripModuleType() {
  return {
    name: 'strip-module-type',
    enforce: 'post',
    transformIndexHtml(html: string) {
      return html.replace(/<script type="module"/g, '<script')
    },
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), stripModuleType()],
  base: './',
  server: {
    allowedHosts: ['cartouche'],
  },
})
