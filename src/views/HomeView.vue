<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useFormStore } from '@/stores/form';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { useConnectionMessage } from '@/composables/useConnectionMessage';
import { useHandleConnectionData } from '@/composables/useHandleConnectionData';
import ServiceTabsView from '@/components/organisms/ServiceTabsView.vue';
import BaseInput from '@/components/atoms/BaseInput.vue';
import type { User } from '@/stores/user';
import ecoFriendlyCsv from '@/../data/eco-friendly.csv?raw';

const store = useFormStore();

store.reset();

const userStore = useUserStore();

const { user } = storeToRefs(userStore);

const handleUserInfo = (event: { data: string }) => {
  const result: { name: string; data: User } = JSON.parse(event.data);

  user.value = result.data;
};

/**
 * 同頁面要處理多個雙向連結資料參考
 */
// const handleConnectionData = (event: { data: string }) => {
//   const result: { name: string; data: any } = JSON.parse(event.data);
//   const name = result.name;

//   switch (name) {
//     case 'userinfo':
//       handleUserInfo(event);
//       break;
//     case 'phone_call':
//       //....
//       break;
//     default:
//       break;
//   }
// };

useConnectionMessage('userinfo', null);

useHandleConnectionData(handleUserInfo);

const route = useRoute();

const activeTab = ref(0);

if (route.query.isSearch) {
  activeTab.value = 1;
}

const searchValue = ref('');

interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  tags: string[];
}

type CsvRecord = Record<string, string>;

const splitCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsv = (text: string): CsvRecord[] => {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n').filter((line) => line.trim().length);

  if (!lines.length) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<CsvRecord>((record, header, index) => {
      record[header] = values[index] ?? '';
      return record;
    }, {});
  });
};

const buildTags = (record: CsvRecord) => {
  const tags = new Set<string>(['環保']);
  const extra = record['額外環保作為'] ?? '';
  const friendlyHints = ['友善'];
  if (friendlyHints.some((hint) => extra.includes(hint))) {
    tags.add('友善');
  }
  return Array.from(tags);
};

const restaurantList = ref<Restaurant[]>(
  parseCsv(ecoFriendlyCsv).map((record) => ({
    id: record['序號'] || crypto.randomUUID(),
    name: record['餐廳名稱'] || '未命名餐廳',
    description: record['額外環保作為']?.replace(/^"|"$/g, '') || '尚未提供',
    address: record['餐廳地址'] || '地址更新中',
    phone: record['餐廳電話'] || '—',
    tags: buildTags(record)
  }))
);

const filterOptions = ['環保', '友善'];
const activeFilter = ref<string | null>(null);

const filteredRestaurants = computed(() => {
  if (!activeFilter.value) {
    return restaurantList.value;
  }
  return restaurantList.value.filter((restaurant) => restaurant.tags.includes(activeFilter.value!));
});

const toggleFilter = (option: string) => {
  activeFilter.value = activeFilter.value === option ? null : option;
};

const randomSuggestion = ref<Restaurant | null>(null);

const showRandomSuggestion = () => {
  if (!filteredRestaurants.value.length) {
    randomSuggestion.value = null;
    return;
  }
  const pool = filteredRestaurants.value;
  const randomIndex = Math.floor(Math.random() * pool.length);
  randomSuggestion.value = pool[randomIndex];
};

watch(filteredRestaurants, (list) => {
  if (randomSuggestion.value && !list.some((item) => item.id === randomSuggestion.value?.id)) {
    randomSuggestion.value = null;
  }
});
</script>

<template>
  <main>
    <ServiceTabsView v-model="activeTab">
      <template #tab0>
        <div class="py-4">
          <section class="flex items-center px-4">
            <BaseInput v-model="searchValue" placeholder="請輸入想查詢的餐廳名稱" class="flex-grow" />
            <button class="search-button">
              <img src="@/assets/images/search-icon.svg" alt="搜尋" />
            </button>
          </section>
        </div>
      </template>
      <template #tab1>
        <div class="p-4 space-y-6">
          <section>
            <p class="text-lg font-bold text-grey-900">找餐廳</p>
            <p class="text-sm text-grey-500 mt-1">選擇標籤即可快速篩選符合條件的餐廳。</p>
          </section>
          <section>
            <div class="flex gap-2">
              <button
                v-for="option in filterOptions"
                :key="option"
                class="filter-chip"
                :class="{ 'filter-chip--active': activeFilter === option }"
                type="button"
                @click="toggleFilter(option)"
              >
                {{ option }}
              </button>
            </div>
            <p v-if="activeFilter" class="text-xs text-grey-500 mt-2">
              顯示「{{ activeFilter }}」餐廳，點擊標籤可取消篩選。
            </p>
          </section>
          <section class="space-y-3">
            <button
              class="random-button"
              type="button"
              :disabled="!filteredRestaurants.length"
              @click="showRandomSuggestion"
            >
              有選擇困難嗎？
            </button>
            <article
              v-if="randomSuggestion"
              class="restaurant-card border-primary-100 bg-primary-50/60"
            >
              <p class="text-sm font-semibold text-primary-500 mb-2">為你推薦</p>
              <p class="font-bold text-lg text-grey-900">{{ randomSuggestion.name }}</p>
              <p class="text-sm text-grey-600 mt-1">{{ randomSuggestion.description }}</p>
              <p class="text-sm text-grey-700 mt-3">{{ randomSuggestion.address }}</p>
              <p class="text-sm text-grey-600 mt-2">電話：{{ randomSuggestion.phone }}</p>
              <div class="flex flex-wrap gap-2 mt-4">
                <span v-for="tag in randomSuggestion.tags" :key="tag" class="restaurant-tag">
                  {{ tag }}
                </span>
              </div>
            </article>
          </section>
          <section class="space-y-4">
            <article
              v-for="restaurant in filteredRestaurants"
              :key="restaurant.id"
              class="restaurant-card"
            >
              <p class="font-bold text-lg text-grey-900">{{ restaurant.name }}</p>
              <p class="text-sm text-grey-600 mt-1">{{ restaurant.description }}</p>
              <p class="text-sm text-grey-700 mt-3">{{ restaurant.address }}</p>
              <p class="text-sm text-grey-600 mt-2">電話：{{ restaurant.phone }}</p>
              <div class="flex flex-wrap gap-2 mt-4">
                <span v-for="tag in restaurant.tags" :key="tag" class="restaurant-tag">
                  {{ tag }}
                </span>
              </div>
            </article>
            <div v-if="!filteredRestaurants.length" class="text-center text-grey-500 py-10">
              目前沒有符合「{{ activeFilter }}」條件的餐廳
            </div>
          </section>
        </div>
      </template>
    </ServiceTabsView>
  </main>
</template>

<style lang="postcss">
.filter-chip {
  @apply px-4 py-2 rounded-full border border-grey-200 text-sm text-grey-600;
  @apply bg-white transition-colors;

  &--active {
    @apply border-primary-500 bg-primary-50 text-primary-600;
  }
}

.restaurant-card {
  @apply rounded-2xl border border-grey-100 bg-white p-4 shadow-sm;
}

.random-button {
  @apply w-full rounded-2xl bg-grey-900 text-white py-3 font-semibold;
  @apply transition active:scale-[0.99] disabled:bg-grey-200 disabled:text-grey-500;
}

.restaurant-tag {
  @apply text-xs px-3 py-1 rounded-full bg-grey-100 text-grey-600;
}
</style>
