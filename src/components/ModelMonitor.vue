<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PROXY_URL, baseUrl } from '../services/appConfig.ts'
import {
  IconServer,
  IconActivity,
  IconCpu,
  IconClock,
  IconRefresh,
  IconTrashX,
  IconPlayerPlay,
  IconTrendingUp,
} from '@tabler/icons-vue'

interface InferenceLog {
  id: number
  timestamp: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  totalDuration: number
  evalDuration: number
  tokensPerSecond: number
  status: string
}

interface MonitorStats {
  totalCalls: number
  totalTokens: number
  totalPromptTokens: number
  avgSpeed: number
  avgDuration: number
  models: Array<{
    model: string
    calls: number
    totalTokens: number
    avgSpeed: string
    avgDuration: string
  }>
}

interface RunningModel {
  model: string
  size: number
  size_vram: number
  expires_at: string
  context_length: number
  details: {
    family: string
    parameter_size: string
    quantization_level: string
  }
}

interface SpeedPoint {
  id: number
  timestamp: string
  model: string
  tokensPerSecond: number
  completionTokens: number
}

const stats = ref<MonitorStats | null>(null)
const logs = ref<InferenceLog[]>([])
const runningModels = ref<RunningModel[]>([])
const speedTrend = ref<SpeedPoint[]>([])
const isLoading = ref(true)
const proxyConnected = ref(false)
const ollamaConnected = ref(false)
const autoRefresh = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const proxyApi = (path: string) => `${PROXY_URL}/monitor${path}`

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatDuration = (ms: number) => {
  if (ms < 1000) return ms.toFixed(0) + 'ms'
  return (ms / 1000).toFixed(2) + 's'
}

const fetchStats = async () => {
  try {
    const res = await fetch(proxyApi('/stats'))
    if (res.ok) {
      stats.value = await res.json()
      proxyConnected.value = true
    }
  } catch {
    proxyConnected.value = false
  }
}

const fetchLogs = async () => {
  try {
    const res = await fetch(proxyApi('/logs?limit=100'))
    if (res.ok) {
      const data = await res.json()
      logs.value = data.logs || []
    }
  } catch {}
}

const ollamaRoot = computed(() => {
  const url = baseUrl.value.replace(/\/api\/?$/, '')
  return url || 'http://localhost:11434'
})

const fetchRunningModels = async () => {
  try {
    const res = await fetch(proxyApi('/ps'))
    if (res.ok) {
      const data = await res.json()
      runningModels.value = data.models || []
      return
    }
  } catch {}
  try {
    const res = await fetch(`${ollamaRoot.value}/api/ps`)
    if (res.ok) {
      const data = await res.json()
      runningModels.value = data.models || []
    } else {
      runningModels.value = []
    }
  } catch {
    runningModels.value = []
  }
}

const checkOllamaHealth = async () => {
  try {
    const res = await fetch(`${ollamaRoot.value}/api/tags`)
    ollamaConnected.value = res.ok
  } catch {
    ollamaConnected.value = false
  }
}

const fetchSpeedTrend = async () => {
  try {
    const res = await fetch(proxyApi('/speed-trend?limit=80'))
    if (res.ok) {
      const data = await res.json()
      speedTrend.value = data.trend || []
    }
  } catch {}
}

const clearLogs = async () => {
  try {
    await fetch(proxyApi('/clear'), { method: 'POST' })
    await refreshAll()
  } catch {}
}

const refreshAll = async () => {
  isLoading.value = true
  await Promise.all([fetchStats(), fetchLogs(), fetchRunningModels(), fetchSpeedTrend(), checkOllamaHealth()])
  isLoading.value = false
}

const startAutoRefresh = () => {
  stopAutoRefresh()
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) {
      fetchStats()
      fetchLogs()
      fetchRunningModels()
      fetchSpeedTrend()
      checkOllamaHealth()
    }
  }, 3000)
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

const maxSpeed = computed(() => {
  if (speedTrend.value.length === 0) return 10
  return Math.max(...speedTrend.value.map(p => p.tokensPerSecond), 10)
})

const sparklinePath = computed(() => {
  const points = speedTrend.value
  if (points.length < 2) return ''

  const w = 600
  const h = 120
  const pad = 4
  const max = maxSpeed.value

  return points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = h - pad - (p.tokensPerSecond / max) * (h - pad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const sparklineArea = computed(() => {
  const points = speedTrend.value
  if (points.length < 2) return ''

  const w = 600
  const h = 120
  const pad = 4
  const max = maxSpeed.value

  const path = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = h - pad - (p.tokensPerSecond / max) * (h - pad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const lastX = pad + ((points.length - 1) / (points.length - 1)) * (w - pad * 2)
  return `${path} L${lastX.toFixed(1)},${h} L${pad},${h} Z`
})

onMounted(() => {
  refreshAll()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <IconServer class="h-6 w-6 text-blue-600" />
        <h2 class="text-xl font-semibold">推理服务监控</h2>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 text-xs">
          <span
            :class="proxyConnected ? 'bg-green-400' : 'bg-red-400'"
            class="inline-block h-2 w-2 rounded-full"
          ></span>
          <span class="text-gray-500">Proxy {{ proxyConnected ? '已连接' : '未连接' }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span
            :class="ollamaConnected ? 'bg-green-400' : 'bg-red-400'"
            class="inline-block h-2 w-2 rounded-full"
          ></span>
          <span class="text-gray-500">Ollama {{ ollamaConnected ? '已连接' : '未连接' }}</span>
        </div>
        <button
          @click="autoRefresh = !autoRefresh"
          :class="autoRefresh ? 'text-green-600' : 'text-gray-400'"
          class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <IconPlayerPlay class="h-3 w-3" :class="{ 'animate-pulse': autoRefresh }" />
          {{ autoRefresh ? '自动刷新' : '已暂停' }}
        </button>
        <button
          @click="refreshAll"
          class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <IconRefresh class="h-3 w-3" />
          刷新
        </button>
      </div>
    </div>

    <div v-if="!proxyConnected" class="mb-6 rounded-xl border-2 border-dashed border-yellow-300 bg-yellow-50 p-6 text-center dark:border-yellow-700 dark:bg-yellow-900/20">
      <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
        Proxy 服务未运行
      </p>
      <p class="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
        请在终端运行 <code class="rounded bg-yellow-100 px-1.5 py-0.5 font-mono dark:bg-yellow-800">npm run proxy</code> 启动代理服务
      </p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconActivity class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">总调用次数</span>
        </div>
        <div class="text-2xl font-bold">{{ stats?.totalCalls ?? 0 }}</div>
      </div>

      <div class="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconTrendingUp class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">平均推理速度</span>
        </div>
        <div class="text-2xl font-bold">{{ stats?.avgSpeed ?? 0 }} <span class="text-sm font-normal opacity-80">tok/s</span></div>
      </div>

      <div class="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconCpu class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">输出 Token</span>
        </div>
        <div class="text-2xl font-bold">{{ (stats?.totalTokens ?? 0).toLocaleString() }}</div>
      </div>

      <div class="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
        <div class="flex items-center gap-2 mb-2">
          <IconClock class="h-5 w-5 opacity-80" />
          <span class="text-sm opacity-80">平均耗时</span>
        </div>
        <div class="text-2xl font-bold">{{ stats?.avgDuration ?? 0 }}<span class="text-sm font-normal opacity-80">s</span></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div class="lg:col-span-2 rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <h3 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">推理速度趋势</h3>
        <div v-if="speedTrend.length < 2" class="flex h-[140px] items-center justify-center text-xs text-gray-400">
          等待数据... (需通过 Proxy 产生调用)
        </div>
        <svg v-else viewBox="0 0 600 120" class="w-full h-[140px]" preserveAspectRatio="none">
          <path :d="sparklineArea" fill="rgba(59,130,246,0.1)" />
          <path :d="sparklinePath" fill="none" stroke="rgb(59,130,246)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <line x1="4" :y1="120 - 4 - (stats?.avgSpeed ?? 0) / maxSpeed * 112" x2="596" :y2="120 - 4 - (stats?.avgSpeed ?? 0) / maxSpeed * 112" stroke="rgb(239,68,68)" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />
        </svg>
        <div v-if="speedTrend.length >= 2" class="mt-1 flex justify-between text-[10px] text-gray-400">
          <span>{{ formatTime(speedTrend[0]?.timestamp) }}</span>
          <span class="text-red-400">- - 平均 {{ stats?.avgSpeed ?? 0 }} tok/s</span>
          <span>{{ formatTime(speedTrend[speedTrend.length - 1]?.timestamp) }}</span>
        </div>
      </div>

      <div class="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-800">
        <h3 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
          当前加载模型
          <span class="ml-1 text-xs text-gray-400">({{ runningModels.length }})</span>
        </h3>
        <div v-if="runningModels.length === 0" class="flex h-[120px] items-center justify-center text-xs text-gray-400">
          暂无加载的模型
        </div>
        <div v-else class="space-y-3 max-h-[140px] overflow-y-auto">
          <div v-for="m in runningModels" :key="m.model" class="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{{ m.model }}</div>
            <div class="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>{{ m.details?.parameter_size }} · {{ m.details?.quantization_level }}</span>
              <span>CTX: {{ m.context_length }}</span>
            </div>
            <div class="mt-2 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                class="h-full rounded-full bg-blue-500 transition-all"
                :style="{ width: `${Math.min((m.size_vram / m.size) * 100, 100)}%` }"
              ></div>
            </div>
            <div class="mt-1 flex items-center justify-between text-[10px] text-gray-400">
              <span>VRAM: {{ formatBytes(m.size_vram) }}</span>
              <span>总计: {{ formatBytes(m.size) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="stats?.models?.length" class="rounded-xl bg-white p-4 shadow-sm mb-6 dark:bg-gray-800">
      <h3 class="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">模型统计</h3>
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-100 dark:border-gray-700">
            <th class="pb-2 text-left text-xs font-medium text-gray-500">模型</th>
            <th class="pb-2 text-right text-xs font-medium text-gray-500">调用次数</th>
            <th class="pb-2 text-right text-xs font-medium text-gray-500">输出 Token</th>
            <th class="pb-2 text-right text-xs font-medium text-gray-500">平均速度</th>
            <th class="pb-2 text-right text-xs font-medium text-gray-500">平均耗时</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in stats.models" :key="m.model" class="border-b border-gray-50 dark:border-gray-700/50">
            <td class="py-2 text-sm font-medium text-gray-800 dark:text-gray-100">{{ m.model }}</td>
            <td class="py-2 text-sm text-gray-600 text-right dark:text-gray-300">{{ m.calls }}</td>
            <td class="py-2 text-sm text-gray-600 text-right dark:text-gray-300">{{ m.totalTokens.toLocaleString() }}</td>
            <td class="py-2 text-sm text-blue-600 font-medium text-right dark:text-blue-400">{{ m.avgSpeed }} tok/s</td>
            <td class="py-2 text-sm text-gray-600 text-right dark:text-gray-300">{{ m.avgDuration }}s</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="rounded-xl bg-white shadow-sm overflow-hidden dark:bg-gray-800">
      <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">调用日志</h3>
        <button
          v-if="logs.length > 0"
          @click="clearLogs"
          class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <IconTrashX class="h-3 w-3" />
          清空
        </button>
      </div>
      <div v-if="isLoading && logs.length === 0" class="p-8 text-center text-gray-500 text-sm">
        加载中...
      </div>
      <div v-else-if="logs.length === 0" class="p-8 text-center text-gray-400 text-sm">
        <p>暂无调用记录</p>
        <p class="mt-1 text-xs text-gray-400">
          将其他工具的 API 地址指向 Proxy 后，调用记录将显示在这里
        </p>
      </div>
      <div v-else class="max-h-[400px] overflow-y-auto">
        <table class="w-full">
          <thead class="sticky top-0 bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">时间</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">模型</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">输入</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">输出</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">速度</th>
              <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">耗时</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatTime(log.timestamp) }}
              </td>
              <td class="px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-[160px] truncate">
                {{ log.model }}
              </td>
              <td class="px-4 py-2.5 text-xs text-gray-500 text-right dark:text-gray-400">
                {{ log.promptTokens.toLocaleString() }}
              </td>
              <td class="px-4 py-2.5 text-xs text-gray-500 text-right dark:text-gray-400">
                {{ log.completionTokens.toLocaleString() }}
              </td>
              <td class="px-4 py-2.5 text-xs font-medium text-right"
                :class="log.tokensPerSecond > (stats?.avgSpeed ?? 0) ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'"
              >
                {{ log.tokensPerSecond }} tok/s
              </td>
              <td class="px-4 py-2.5 text-xs text-gray-500 text-right dark:text-gray-400">
                {{ formatDuration(log.totalDuration) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
