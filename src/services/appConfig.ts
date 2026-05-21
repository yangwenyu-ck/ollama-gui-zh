import { useLocalStorage } from '@vueuse/core'
import { Config, db } from './database'

export const currentModel = useLocalStorage('currentModel', 'none')
export const historyMessageLength = useLocalStorage('historyMessageLength', 10)
export const enableMarkdown = useLocalStorage('markdown', true)
export const showSystem = useLocalStorage('systemMessages', true)
export const baseUrl = useLocalStorage('baseUrl', 'http://localhost:11434/api')
export const PROXY_URL = 'http://localhost:11435'
export const useProxy = useLocalStorage('useProxy', false)
export const isDarkMode = useLocalStorage('darkMode', true)
export const isSettingsOpen = useLocalStorage('settingsPanelOpen', true)
export const isSystemPromptOpen = useLocalStorage('systemPromptOpen', false)
export const isUsageStatsOpen = useLocalStorage('usageStatsOpen', false)
export const isModelMonitorOpen = useLocalStorage('modelMonitorOpen', false)
export const toggleSettingsPanel = () => (isSettingsOpen.value = !isSettingsOpen.value)
export const toggleSystemPromptPanel = () => {
  const opening = !isSystemPromptOpen.value
  isSystemPromptOpen.value = opening
  isUsageStatsOpen.value = false
  isModelMonitorOpen.value = false
}
export const toggleUsageStatsPanel = () => {
  const opening = !isUsageStatsOpen.value
  isUsageStatsOpen.value = opening
  isSystemPromptOpen.value = false
  isModelMonitorOpen.value = false
}
export const toggleModelMonitorPanel = () => {
  const opening = !isModelMonitorOpen.value
  isModelMonitorOpen.value = opening
  isSystemPromptOpen.value = false
  isUsageStatsOpen.value = false
}

// Database Layer
export const configDbLayer = {
  async getConfig(model: string) {
    const filteredConfig = await db.config.where('model').equals(model).limit(1)
    return filteredConfig.first()
  },

  async getCurrentConfig(model: string) {
    let config = await this.getConfig(model)
    if (!config?.systemPrompt) {
      config = await this.getConfig('default')
    }
    return config
  },

  async setConfig(config: Config) {
    await db.config.put(config)
  },

  async clearConfig() {
    return db.config.clear()
  },
}

export function useConfig() {
  const setConfig = async (newConfig: Config) => {
    newConfig.id = await generateIdFromModel(newConfig.model)
    await configDbLayer.setConfig(newConfig)
  }

  const getCurrentSystemMessage = async () => {
    let config = await configDbLayer.getCurrentConfig(currentModel.value)
    return config?.systemPrompt ?? null
  }

  const generateIdFromModel = async (model: string): Promise<number> => {
    let hash = 0
    for (let i = 0; i < model.length; i++) {
      hash += model.charCodeAt(i)
    }
    return hash
  }

  const initializeConfig = async (model: string) => {
    try {
      const modelConfig = await configDbLayer.getConfig(model)
      const defaultConfig = await configDbLayer.getConfig('default')
      return { modelConfig: modelConfig, defaultConfig: defaultConfig }
    } catch (error) {
      console.error('Failed to initialize config:', error)
    }
    return null
  }

  return {
    initializeConfig,
    setConfig,
    getCurrentSystemMessage,
  }
}
