<script setup lang="ts">
import { ref, watchEffect } from 'vue'

type Props = {
  label?: string
  modelValue: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const toggleState = ref(props.modelValue)

const toggle = () => {
  if (props.disabled) return
  toggleState.value = !toggleState.value
  emit('update:modelValue', toggleState.value)
}

watchEffect(() => {
  toggleState.value = props.modelValue
})
</script>

<template>
  <div class="flex items-center mb-4 justify-between">
    <label
      @click="toggle"
      :class="disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
      class="block px-2 text-sm font-medium text-gray-900 dark:text-gray-100"
      v-if="label"
    >
      {{ label }}
    </label>
    <button
      :disabled="disabled"
      :class="[toggleState ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer']"
      class="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      @click="toggle"
      role="switch"
      :aria-checked="toggleState"
    >
      <span
        :class="toggleState ? 'translate-x-5' : 'translate-x-0'"
        aria-hidden="true"
        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
      ></span>
    </button>
  </div>
</template>
