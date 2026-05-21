import { Component, computed, defineComponent, h, ref } from 'vue'
import markdownit from 'markdown-it'

const Markdown: Component = defineComponent({
  props: {
    source: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const md = ref<markdownit>(markdownit({
      html: true,
      linkify: true,
    }))

    const content = computed(() => {
      try {
        return md.value.render(props.source)
      } catch (e) {
        console.warn('Markdown render error:', e)
        return props.source
      }
    })

    const codeBlocks = ref<Map<number, { code: string; expanded: boolean }>>(new Map())

    const copyToClipboard = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        showToast('已复制')
      } catch (err) {
        console.error('复制失败:', err)
      }
    }

    const showToast = (message: string) => {
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 right-4 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-50 animate-fade-in'
      toast.textContent = message
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.classList.add('animate-fade-out')
        setTimeout(() => toast.remove(), 300)
      }, 2000)
    }

    const htmlEscape = (text: string): string => {
      const div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    const renderMarkdown = () => {
      const rendered = md.value.render(props.source)
      
      const codeBlockRegex = /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g
      let currentId = 0
      
      const processed = rendered.replace(codeBlockRegex, (match, attrs, code) => {
        const originalCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        const escapedCode = htmlEscape(originalCode)
        const blockId = currentId++
        
        codeBlocks.value.set(blockId, { code: originalCode, expanded: false })
        
        return `
          <div class="not-prose code-block-container relative rounded-lg overflow-hidden bg-gray-900" data-block-id="${blockId}">
            <div class="code-toolbar absolute top-0 right-0 flex items-center gap-1 p-2 bg-gray-800/80">
              <button 
                class="code-toolbar-btn p-1.5 hover:bg-gray-700 rounded transition-colors" 
                onclick="window.__copyCode(${blockId})"
                title="复制"
              >
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button 
                class="code-toolbar-btn p-1.5 hover:bg-gray-700 rounded transition-colors" 
                onclick="window.__expandCode(${blockId})"
                title="放大"
              >
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
            <pre class="m-0 p-4 overflow-x-auto text-sm whitespace-pre-wrap break-all"><code class="text-white">${escapedCode}</code></pre>
          </div>
        `
      })
      
      return processed
    }

    window.__copyCode = (id: number) => {
      const block = codeBlocks.value.get(id)
      if (block) {
        copyToClipboard(block.code)
      }
    }

    window.__expandCode = (id: number) => {
      const block = codeBlocks.value.get(id)
      if (block) {
        block.expanded = !block.expanded
        codeBlocks.value.set(id, block)
        
        const container = document.querySelector(`[data-block-id="${id}"]`)
        if (container) {
          container.classList.toggle('expanded')
        }
      }
    }

    return () => h('div', { 
      class: 'markdown-content',
      innerHTML: renderMarkdown()
    })
  },
})

export default Markdown