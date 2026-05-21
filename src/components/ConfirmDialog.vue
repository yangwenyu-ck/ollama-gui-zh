<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { IconX, IconAlertCircle, IconCheck, IconAlertTriangle } from '@tabler/icons-vue'

interface Props {
  show: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'info' | 'warning' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  title: '确认操作',
  message: '确定要执行此操作吗？',
  confirmText: '确定',
  cancelText: '取消',
  type: 'info'
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('cancel')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const iconClass = {
  info: 'text-blue-500 bg-blue-50',
  warning: 'text-yellow-500 bg-yellow-50',
  danger: 'text-red-500 bg-red-50'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="emit('cancel')"
      >
        <Transition name="scale">
          <div
            v-if="show"
            class="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <button
              @click="emit('cancel')"
              class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <IconX class="size-5 text-gray-500 dark:text-gray-400" />
            </button>
            
            <div class="flex flex-col items-center px-6 py-8">
              <div
                :class="iconClass[type]"
                class="flex h-16 w-16 items-center justify-center rounded-full mb-4"
              >
                <IconAlertCircle v-if="type === 'info'" class="size-8" />
                <IconAlertTriangle v-else-if="type === 'warning'" class="size-8" />
                <IconAlertCircle v-else class="size-8" />
              </div>
              
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {{ title }}
              </h3>
              
              <p class="text-center text-gray-600 dark:text-gray-300 mb-6">
                {{ message }}
              </p>
              
              <div class="flex gap-3 w-full">
                <button
                  @click="emit('cancel')"
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  {{ cancelText }}
                </button>
                <button
                  @click="emit('confirm')"
                  :class="{
                    'bg-blue-600 hover:bg-blue-700': type === 'info',
                    'bg-yellow-500 hover:bg-yellow-600': type === 'warning',
                    'bg-red-600 hover:bg-red-700': type === 'danger'
                  }"
                  class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium transition-all duration-200 shadow-sm"
                >
                  <IconCheck class="size-4" />
                  {{ confirmText }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>