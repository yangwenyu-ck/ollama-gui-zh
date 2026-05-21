<script setup lang="ts">
import { Message } from '../../services/database.ts'
import { enableMarkdown, currentModel } from '../../services/appConfig.ts'
import Markdown from '../Markdown.ts'
import logo from '/logo.png'
import { computed } from 'vue'

type Props = {
  message: Message
}

const { message } = defineProps<Props>()
const thought = computed(() => {
  const end = message.content.indexOf('</think>')
  if (end != -1) {
    return [
      message.content.substring('<think>'.length, end),
      message.content.substring(end + '</think>'.length),
    ]
  } else {
    return [null, message.content]
  }
})

const hasMeta = computed(() => {
  return message.meta && 
         typeof message.meta.completionTokens === 'number' && 
         typeof message.meta.tokensPerSecond === 'string'
})
</script>

<template>
  <div class="flex rounded-xl bg-gray-100 px-2 py-6 dark:bg-gray-800 sm:px-4">
    <img
      class="mr-2 flex size-10 aspect-square rounded-full border border-gray-200 bg-white object-contain sm:mr-4"
      :src="logo"
      alt="Ollama"
    />

    <div class="flex flex-col max-w-3xl rounded-xl">
      <code v-if="!enableMarkdown" class="whitespace-pre-line">{{ message.content }}</code>
      <div
        v-else
        class="prose prose-base max-w-full dark:prose-invert prose-headings:font-semibold prose-headings:text-gray-600 dark:prose-headings:text-gray-100 prose-h1:text-lg prose-h2:text-base prose-h3:text-base prose-p:first:mt-0 prose-a:text-blue-600 prose-code:text-sm prose-code:text-gray-700 prose-pre:p-2"
      >
        <details
          v-if="thought[0]"
          class="whitespace-pre-wrap rounded-md mb-4 border border-blue-200 bg-blue-50 p-4 text-sm leading-tight text-blue-900 dark:border-blue-700 dark:bg-blue-800 dark:text-blue-50"
        >
          <summary>思考过程</summary>
          {{ thought[0] }}
        </details>
        <Markdown :source="thought[1]" />
      </div>
      
      <div 
        v-if="hasMeta" 
        class="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400"
      >
        <span class="font-medium text-gray-600 dark:text-gray-300">{{ currentModel }}</span>
        <span class="flex items-center gap-1">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ message.meta.tokensPerSecond }} tokens/s</span>
        </span>
        <span class="flex items-center gap-1">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>{{ message.meta.completionTokens }} tokens</span>
        </span>
        <span class="flex items-center gap-1">
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ message.meta.duration }}s</span>
        </span>
      </div>
    </div>
  </div>
</template>
