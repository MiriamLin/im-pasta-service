<script setup lang="ts">
import { computed } from 'vue';
import type { TabsProps } from '@/interfaces/tab-props.interface';

const props = withDefaults(defineProps<TabsProps>(), {
  tabList: () => [
    {
      id: 1,
      title: '餐廳搜尋'
    },
    {
      id: 2,
      title: '食品搜尋'
    },
    {
      id: 3,
      title: '找餐廳'
    }
  ],
  contentType: false
});

const activeTab = defineModel({ default: 0 });

const tabCount = computed(() => Math.max(1, props.tabList.length));
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${tabCount.value}, minmax(0, 1fr))`
}));
const sliderWidth = computed(() => `calc(100% / ${tabCount.value})`);
</script>

<template>
  <section class="tabs" :class="{ 'tabs__content-type': props.contentType }" :style="gridStyle">
    <button
      v-for="(item, index) in props.tabList"
      :key="item.id"
      class="tab-label"
      :class="{
        'tab-label--active': index === activeTab && !props.contentType,
        'tab-label__content-type': props.contentType,
        'tab-label__content-type--active': index === activeTab && props.contentType
      }"
      @click="activeTab = index"
    >
      {{ item.title }}
    </button>
  </section>
</template>

<style lang="postcss">
.tabs {
  @apply grid;
  @apply px-4 pt-2;
  @apply border-b border-b-grey-300;

  &__content-type {
    @apply px-0;
  }
}

.tab-label {
  @apply text-grey-700 bg-white font-bold mb-2;

  &__content-type {
    @apply rounded-t-[10px] border-x border-t border-grey-200;
    @apply px-3 py-2 mb-0;
    @apply transition-colors;

    &--active {
      @apply bg-primary-50 border-transparent;
    }
  }

  &--active {
    @apply text-primary-500;
  }
}
</style>
