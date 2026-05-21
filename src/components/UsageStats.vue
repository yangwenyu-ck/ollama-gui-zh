<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { db, UsageStats } from '../services/database'
import { IconActivity, IconClock, IconMessageCircle, IconHash } from '@tabler/icons-vue'

const stats = ref<UsageStats[]>([])
const isLoading = ref(true)

const loadStats = async () => {
  isLoading.value = true
  stats.value = await db.usageStats.toArray()
  isLoading.value = false
}

const totalTokens = computed(() => 
  stats.value.reduce((sum, s) => sum + s.totalTokens, 0)
)

const totalChats = computed(() => stats.value.length)

const avgDuration = computed(() => {
  if (stats.value.length === 0) return 0
  return Math.round(stats.value.reduce((sum, s) => sum + s.duration, 0) / stats.value.length / 1000 * 10) / 10
})

const totalPromptTokens = computed(() => 
  stats.value.reduce((sum, s) => sum + s.promptTokens, 0)
)

const totalCompletionTokens = computed(() => 
  stats.value.reduce((sum, s) => sum + s.completionTokens, 0)
)

onMounted(() => loadStats())
</script>

<template>
  <div class="p-6">
    <div class="flex items-center gap-2 mb-6">
      <IconActivity class="h-6 w-6 text-blue-600" />
      <h2 class="text-xl font-semibold">用量分析</h2>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconHash class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">总 Token</span>
        </div>
        <div class="text-2xl font-bold">{{ totalTokens.toLocaleString() }}</div>
      </div>

      <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconMessageCircle class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">对话次数</span>
        </div>
        <div class="text-2xl font-bold">{{ totalChats }}</div>
      </div>

      <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconClock class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">平均耗时</span>
        </div>
        <div class="text-2xl font-bold">{{ avgDuration }}s</div>
      </div>

      <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconHash class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">输出 Token</span>
        </div>
        <div class="text-2xl font-bold">{{ totalCompletionTokens.toLocaleString() }}</div>
      </div>
    </div>

    <!-- Token 分布 -->
    <div class="bg-white rounded-xl p-4 shadow-sm mb-6">
      <h3 class="text-sm font-medium mb-4 text-gray-700">Token 分布</h3>
      <div class="flex h-8 rounded-full overflow-hidden">
        <div 
          class="bg-gray-400 transition-all duration-500"
          :style="{ width: `${totalPromptTokens / (totalTokens || 1) * 100}%` }"
          title="输入 Token"
        ></div>
        <div 
          class="bg-blue-500 transition-all duration-500"
          :style="{ width: `${totalCompletionTokens / (totalTokens || 1) * 100}%` }"
          title="输出 Token"
        ></div>
      </div>
      <div class="flex justify-between mt-2 text-xs text-gray-500">
        <span>输入: {{ totalPromptTokens.toLocaleString() }}</span>
        <span>输出: {{ totalCompletionTokens.toLocaleString() }}</span>
      </div>
    </div>

    <!-- 详细记录 -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 border-b">
        <h3 class="text-sm font-medium text-gray-700">详细使用记录</h3>
      </div>
      <div v-if="isLoading" class="p-8 text-center text-gray-500">
        加载中...
      </div>
      <div v-else-if="stats.length === 0" class="p-8 text-center text-gray-500">
        暂无使用记录
      </div>
      <table v-else class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">时间</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500">模型</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">输入</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">输出</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">总计</th>
            <th class="px-4 py-2 text-right text-xs font-medium text-gray-500">耗时</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="stat in stats.slice().reverse()" :key="stat.id" class="hover:bg-gray-50">
            <td class="px-4 py-3 text-sm text-gray-700">
              {{ new Date(stat.createdAt).toLocaleString() }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-700">
              {{ stat.model }}
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 text-right">{{ stat.promptTokens }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 text-right">{{ stat.completionTokens }}</td>
            <td class="px-4 py-3 text-sm font-medium text-blue-600 text-right">{{ stat.totalTokens }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 text-right">{{ (stat.duration / 1000).toFixed(1) }}s</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
