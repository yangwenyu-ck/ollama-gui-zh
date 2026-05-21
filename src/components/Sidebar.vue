<script setup lang="ts">
import {
  IconMoon,
  IconPlus,
  IconSettings2,
  IconSun,
  IconTrashX,
  IconUserCircle,
  IconMessageCode,
  IconActivity,
  IconChevronDown,
  IconPencil,
  IconServer,
} from '@tabler/icons-vue'
import ConfirmDialog from './ConfirmDialog.vue'

import {
  isDarkMode,
  isSystemPromptOpen,
  isUsageStatsOpen,
  isModelMonitorOpen,
  toggleSettingsPanel,
  toggleSystemPromptPanel,
  toggleUsageStatsPanel,
  toggleModelMonitorPanel,
} from '../services/appConfig.ts'
import { useChats } from '../services/chat.ts'

const { sortedChats, activeChat, switchChat, deleteChat, startNewChat, renameChat } =
  useChats()
import { ref, onMounted, onUnmounted } from 'vue'

const openMenuChatId = ref<number | null>(null)
const editingChatId = ref<number | null>(null)
const editingChatName = ref('')
const deletingChatId = ref<number | null>(null)
const showConfirmDialog = ref(false)

const onNewChat = () => {
  checkPanels()
  closeMenu()
  return startNewChat('新对话')
}

const onSwitchChat = (chatId: number) => {
  checkPanels()
  closeMenu()
  return switchChat(chatId)
}

const checkPanels = () => {
  isSystemPromptOpen.value = false
  isUsageStatsOpen.value = false
  isModelMonitorOpen.value = false
}

const openMenu = (chatId: number, event: Event) => {
  event.stopPropagation()
  openMenuChatId.value = openMenuChatId.value === chatId ? null : chatId
}

const closeMenu = () => {
  openMenuChatId.value = null
}

const startRename = (chatId: number, chatName: string) => {
  editingChatId.value = chatId
  editingChatName.value = chatName
  closeMenu()
}

const confirmRename = () => {
  if (editingChatId.value && editingChatName.value.trim()) {
    renameChat(editingChatId.value, editingChatName.value.trim())
    editingChatId.value = null
    editingChatName.value = ''
  }
}

const cancelRename = () => {
  editingChatId.value = null
  editingChatName.value = ''
}

const handleDelete = (chatId: number) => {
  deletingChatId.value = chatId
  showConfirmDialog.value = true
}

const confirmDelete = () => {
  if (deletingChatId.value) {
    deleteChat(deletingChatId.value)
  }
  showConfirmDialog.value = false
  deletingChatId.value = null
}

const cancelDelete = () => {
  showConfirmDialog.value = false
  deletingChatId.value = null
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.chat-menu-container')) {
    closeMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const lang = navigator.language
</script>

<template>
  <aside class="flex">
    <div
      class="flex h-screen w-60 flex-col overflow-y-auto border-r border-gray-200 bg-white pt-2 dark:border-gray-800 dark:bg-gray-900 sm:h-screen sm:w-64"
    >
      <div class="mx-2 mb-2">
        <button
          @click="onNewChat"
          class="flex w-full items-center justify-center gap-x-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-offset-gray-900"
        >
          <IconPlus class="h-5 w-5" />
          <span>新对话</span>
        </button>
      </div>

      <div
        class="h-full space-y-2 overflow-y-auto border-b border-gray-200 px-2 py-4 dark:border-gray-800"
      >
        <div
        v-for="chat in sortedChats"
        :key="chat.id"
        :class="{
          'bg-gray-100 dark:bg-gray-800': activeChat?.id == chat.id,
        }"
        class="relative flex items-center rounded-md transition-all duration-150 ease-in-out hover:bg-gray-100 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 cursor-pointer"
      >
        <button
          v-if="editingChatId !== chat.id"
          @click="onSwitchChat(chat.id!)"
          @keyup.delete="deleteChat(chat.id!)"
          class="flex-1 flex flex-col gap-y-1 px-3 py-2.5 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
        >
          <span class="truncate text-sm font-medium leading-none text-gray-900 transition-colors dark:text-gray-100">
            {{ chat.name }}
          </span>
          <span class="text-xs leading-none text-gray-500 dark:text-gray-400">
            {{ chat.model }}
          </span>
          <span class="text-xs leading-none text-gray-400 dark:text-gray-500">
            {{
              chat.createdAt.toLocaleDateString(lang, {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })
            }}
          </span>
        </button>
        
        <div v-else class="flex-1 flex items-center gap-1.5 px-3 py-2.5">
          <input
            v-model="editingChatName"
            @keyup.enter="confirmRename"
            @keyup.esc="cancelRename"
            class="max-w-[140px] rounded-md border-2 border-blue-400 bg-gray-50 px-2 py-1 text-sm font-medium text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:bg-gray-700 dark:text-gray-100"
            autofocus
          />
          <div class="flex gap-0.5 shrink-0">
            <button
              @click.stop="confirmRename"
              class="flex h-6 w-6 items-center justify-center rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
              title="确认"
            >
              ✓
            </button>
            <button
              @click.stop="cancelRename"
              class="flex h-6 w-6 items-center justify-center rounded bg-gray-400 text-white hover:bg-gray-500 transition-colors"
              title="取消"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div v-if="editingChatId !== chat.id" class="chat-menu-container relative">
          <button
            @click="openMenu(chat.id!, $event)"
            class="flex h-8 w-8 items-center justify-center rounded-md opacity-0 transition-all duration-150 hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <IconChevronDown class="size-4 text-gray-400 dark:text-gray-500 rotate-90" />
          </button>
          
          <Transition name="menu">
            <div
              v-if="openMenuChatId === chat.id"
              class="absolute right-0 top-full mt-1.5 w-36 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700 z-50"
            >
              <div class="py-1">
                <button
                  @click="startRename(chat.id!, chat.name)"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <IconPencil class="size-4 text-gray-400" />
                  重命名
                </button>
                <button
                  @click="handleDelete(chat.id!)"
                  class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <IconTrashX class="size-4" />
                  删除
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
      </div>

      <div class="mt-auto w-full space-y-2 px-2 py-4">
        <button
          @click="isDarkMode = !isDarkMode"
          class="group flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors duration-100 ease-in-out hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-500"
        >
          <IconSun v-if="isDarkMode" class="size-4 opacity-50 group-hover:opacity-80" />
          <IconMoon v-else class="size-4 opacity-50 group-hover:opacity-80" />
          {{ isDarkMode ? '切换浅色模式' : '切换深色模式' }}
        </button>
        <button
          v-if="false"
          class="group flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors duration-100 ease-in-out hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-500"
        >
          <IconUserCircle class="size-4 opacity-50 group-hover:opacity-80" />
          用户
        </button>
        <button
          @click="toggleSystemPromptPanel"
          class="group flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors duration-100 ease-in-out hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-500"
        >
          <IconMessageCode class="size-4 opacity-50 group-hover:opacity-80" />

          系统提示
        </button>
        <button
          @click="toggleUsageStatsPanel"
          class="group flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors duration-100 ease-in-out hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-500"
        >
          <IconActivity class="size-4 opacity-50 group-hover:opacity-80" />

          用量分析
        </button>
        <button
          @click="toggleModelMonitorPanel"
          class="group flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors duration-100 ease-in-out hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-500"
        >
          <IconServer class="size-4 opacity-50 group-hover:opacity-80" />

          推理服务监控
        </button>
        <button
          @click="toggleSettingsPanel"
          class="group flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm font-medium text-gray-900 transition-colors duration-100 ease-in-out hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-300 dark:hover:bg-gray-700 dark:focus:ring-blue-500"
        >
          <IconSettings2 class="size-4 opacity-50 group-hover:opacity-80" />

          设置
        </button>
      </div>
    </div>
  </aside>
  
  <ConfirmDialog
    :show="showConfirmDialog"
    title="删除对话"
    message="确定要删除这个对话吗？此操作无法撤销。"
    confirmText="删除"
    cancelText="取消"
    type="danger"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: all 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
