<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useFormStore } from '@/stores/form';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { useConnectionMessage } from '@/composables/useConnectionMessage';
import { useHandleConnectionData } from '@/composables/useHandleConnectionData';
import ServiceTabsView from '@/components/organisms/ServiceTabsView.vue';
import BaseInput from '@/components/atoms/BaseInput.vue';
import {
  searchGreenRestaurants,
  getEcoActionOptions,
  getAllGreenRestaurants,
  suggestGreenRestaurants,
  findGreenRestaurantByName,
  type GreenRestaurantRecord
} from '@/services/greenRestaurantService';
import {
  fetchRestaurantsByTown,
  getAdministrativeTown,
  type TgosNearbyRestaurant
} from '@/services/tgosRestaurantService';
import { city as taiwanCities } from '@/zipcode/city';
import type { User } from '@/stores/user';

interface RandomRestaurantCard extends GreenRestaurantRecord {
  pickId: string;
}

interface TargetTown {
  county: string;
  town: string;
}

interface NearbyRestaurant extends TgosNearbyRestaurant {
  county: string;
  town: string;
  distanceKm: number;
}

const TGOS_RESTAURANT_TARGETS: TargetTown[] = [
  { county: '臺北市', town: '中山區' },
  { county: '臺中市', town: '北屯區' },
  { county: '臺中市', town: '南屯區' },
  { county: '臺中市', town: '梧棲區' },
  { county: '臺中市', town: '大甲區' },
  { county: '彰化縣', town: '二林鎮' },
  { county: '嘉義縣', town: '布袋鎮' },
  { county: '雲林縣', town: '西螺鎮' },
  { county: '臺南市', town: '中西區' },
  { county: '臺南市', town: '新營區' },
  { county: '花蓮縣', town: '吉安鄉' }
];

const townsByCounty = taiwanCities.reduce<Record<string, string[]>>((acc, current) => {
  if (!acc[current.county]) {
    acc[current.county] = [];
  }
  if (!acc[current.county].includes(current.city)) {
    acc[current.county].push(current.city);
  }
  return acc;
}, {});

const ECO_ACTION_OPTIONS = getEcoActionOptions();
const ALL_GREEN_RESTAURANTS = getAllGreenRestaurants();

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
const restaurantResults = ref<GreenRestaurantRecord[]>([]);
const searchSuggestions = ref<GreenRestaurantRecord[]>([]);
const selectedRestaurant = ref<GreenRestaurantRecord | null>(null);
const notFoundQuery = ref<string | null>(null);
const isSearching = ref(false);
const errorMessage = ref<string | null>(null);
const hasSearched = ref(false);
const selectedEcoFilters = ref<string[]>([]);
const randomRestaurants = ref<RandomRestaurantCard[]>([]);
const nearbyRestaurants = ref<NearbyRestaurant[]>([]);
const isLocatingNearby = ref(false);
const hasRequestedNearby = ref(false);
const nearbyError = ref<string | null>(null);
const nearbyInfo = ref<string | null>(null);
const hasGeoSupport = typeof window !== 'undefined' && 'geolocation' in navigator;

const selectedEcoActionSet = computed(() => new Set(selectedEcoFilters.value));

const filteredRestaurantResults = computed(() => {
  if (!selectedEcoFilters.value.length) {
    return restaurantResults.value;
  }

  return restaurantResults.value.filter((item) =>
    item.ecoActions.some((action) => selectedEcoActionSet.value.has(action))
  );
});

watch(
  searchValue,
  (value) => {
    const keyword = value.trim();
    if (!keyword) {
      searchSuggestions.value = [];
      errorMessage.value = null;
      return;
    }

    searchSuggestions.value = suggestGreenRestaurants(keyword, 5);
    errorMessage.value = null;
  },
  { immediate: false }
);

const onSuggestionClick = (item: GreenRestaurantRecord) => {
  searchValue.value = item.restaurantName;
  onSearchClick();
};

const onSearchClick = async () => {
  const keyword = searchValue.value.trim();

  if (!keyword) {
    hasSearched.value = false;
    restaurantResults.value = [];
    selectedRestaurant.value = null;
    notFoundQuery.value = null;
    errorMessage.value = '請輸入餐廳名稱後再查詢。';
    return;
  }

  hasSearched.value = true;
  errorMessage.value = null;
  selectedRestaurant.value = findGreenRestaurantByName(keyword);
  notFoundQuery.value = selectedRestaurant.value ? null : keyword;
  isSearching.value = true;

  try {
    restaurantResults.value = await searchGreenRestaurants(keyword);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '查詢服務目前無法使用，請稍後再試。';
    restaurantResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

const toggleEcoAction = (action: string) => {
  const next = new Set(selectedEcoFilters.value);
  if (next.has(action)) {
    next.delete(action);
  } else {
    next.add(action);
  }
  selectedEcoFilters.value = Array.from(next);
};

const clearEcoFilters = () => {
  selectedEcoFilters.value = [];
};

const pickRandomRestaurants = (count = 3) => {
  const total = ALL_GREEN_RESTAURANTS.length;
  if (!total) {
    return [];
  }
  const picksCount = Math.min(count, total);
  const indexes = new Set<number>();
  while (indexes.size < picksCount) {
    indexes.add(Math.floor(Math.random() * total));
  }
  const timestamp = Date.now();
  return Array.from(indexes).map((index, order) => {
    const item = ALL_GREEN_RESTAURANTS[index];
    return {
      ...item,
      pickId: `${item.restaurantName}-${timestamp}-${order}`
    } satisfies RandomRestaurantCard;
  });
};

const refreshRandomRestaurants = () => {
  randomRestaurants.value = pickRandomRestaurants();
};

const toRad = (value: number) => (value * Math.PI) / 180;

const computeDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distanceKm: number) => {
  if (distanceKm >= 1) {
    return `${distanceKm.toFixed(1)} 公里`;
  }
  return `${Math.round(distanceKm * 1000)} 公尺`;
};

const buildTargetQueue = (county: string, town: string) => {
  const queue: TargetTown[] = [];
  const pushUnique = (target: TargetTown) => {
    if (!queue.some((item) => item.county === target.county && item.town === target.town)) {
      queue.push(target);
    }
  };

  pushUnique({ county, town });
  const countyTowns = townsByCounty[county] ?? [];
  countyTowns
    .filter((townName) => townName !== town)
    .forEach((townName) => pushUnique({ county, town: townName }));
  TGOS_RESTAURANT_TARGETS.forEach((target) => pushUnique(target));

  return queue;
};

const fetchRestaurantCandidates = async (targets: TargetTown[], maxResults = 30) => {
  const aggregated: NearbyRestaurant[] = [];
  for (let index = 0; index < targets.length; index += 4) {
    const batch = targets.slice(index, index + 4);
    const responses = await Promise.all(
      batch.map(async (target) => {
        try {
          const list = await fetchRestaurantsByTown(target.county, target.town);
          return list.map<NearbyRestaurant>((item) => ({
            ...item,
            county: target.county,
            town: target.town,
            distanceKm: 0
          }));
        } catch (error) {
          console.warn('[TGOS] 查詢失敗', target, error);
          return [];
        }
      })
    );
    responses.forEach((list) => aggregated.push(...list));
    if (aggregated.length >= maxResults) {
      break;
    }
  }
  return aggregated;
};

const getCurrentPosition = () =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    if (!hasGeoSupport || !navigator.geolocation) {
      reject(new Error('目前裝置不支援定位功能'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 0
    });
  });

const loadNearbyRestaurants = async (lat: number, lng: number) => {
  try {
    const area = await getAdministrativeTown(lat, lng);
    const targets = buildTargetQueue(area.county, area.town);
    const candidates = await fetchRestaurantCandidates(targets);

    if (!candidates.length) {
      nearbyRestaurants.value = [];
      nearbyError.value = '目前資料來源僅有極少量餐廳，無法計算距離。';
      nearbyInfo.value = null;
      return;
    }

    const uniqueMap = new Map<string, NearbyRestaurant>();
    candidates.forEach((item) => {
      const key = `${item.name}-${item.address ?? ''}-${item.lat}-${item.lng}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          ...item,
          distanceKm: computeDistanceKm(lat, lng, item.lat, item.lng)
        });
      }
    });

    const ordered = Array.from(uniqueMap.values()).sort((a, b) => a.distanceKm - b.distanceKm);
    nearbyRestaurants.value = ordered.slice(0, 10);

    if (!nearbyRestaurants.value.length) {
      nearbyError.value = '資料源目前查無符合條件的餐廳。';
      nearbyInfo.value = null;
    } else {
      nearbyError.value = null;
      nearbyInfo.value =
        nearbyRestaurants.value.length < 10
          ? '資料來源僅提供部分符合條件的餐廳，已依距離排序顯示。'
          : null;
    }
  } catch (error) {
    nearbyRestaurants.value = [];
    nearbyInfo.value = null;
    nearbyError.value =
      error instanceof Error ? error.message : '取得附近餐廳資料時發生錯誤。';
  }
};

const onLocateClick = async () => {
  hasRequestedNearby.value = true;
  nearbyError.value = null;
  nearbyInfo.value = null;

  try {
    isLocatingNearby.value = true;
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    await loadNearbyRestaurants(latitude, longitude);
  } catch (error) {
    nearbyRestaurants.value = [];
    nearbyError.value =
      error instanceof Error ? error.message : '無法取得定位資訊，請稍後再試。';
  } finally {
    isLocatingNearby.value = false;
  }
};

onMounted(() => {
  refreshRandomRestaurants();
});

</script>

<template>
  <main>
    <ServiceTabsView v-model="activeTab">
      <template #tab0>
        <div class="py-4">
          <section class="flex items-center px-4">
            <BaseInput
              v-model="searchValue"
              placeholder="請輸入想查詢的餐廳名稱"
              class="flex-grow"
              @keyup.enter="onSearchClick"
            />
            <button class="search-button" @click="onSearchClick">
              <img src="@/assets/images/search-icon.svg" alt="搜尋" />
            </button>
          </section>
          <section v-if="searchSuggestions.length" class="px-4 mt-2">
            <ul class="suggestion-list" role="listbox">
              <li v-for="item in searchSuggestions" :key="`${item.restaurantName}-${item.address}`">
                <button
                  type="button"
                  class="suggestion-item"
                  @click="onSuggestionClick(item)"
                >
                  <span class="suggestion-name">{{ item.restaurantName }}</span>
                  <span v-if="item.address" class="suggestion-address">{{ item.address }}</span>
                </button>
              </li>
            </ul>
          </section>
          <section class="px-4 mt-4 space-y-4" aria-live="polite">
            <div class="eco-summary" v-if="hasSearched">
              <p class="eco-summary__title">環保餐廳對照</p>
              <table class="eco-table">
                <thead>
                  <tr>
                    <th scope="col">餐廳名稱</th>
                    <th scope="col">是否為環保餐廳</th>
                    <th scope="col">餐廳地址</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="selectedRestaurant">
                    <td>{{ selectedRestaurant.restaurantName }}</td>
                    <td class="text-success">是</td>
                    <td>{{ selectedRestaurant.address ?? '—' }}</td>
                  </tr>
                  <tr v-else>
                    <td>{{ notFoundQuery ?? searchValue }}</td>
                    <td class="text-warn-200">否</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-grey-500 text-sm">
              透過關鍵字查詢，確認此餐廳是否列入臺北市環保餐廳名單。
            </p>
            <div class="filter-panel" aria-label="環保篩選">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold text-grey-800">環保篩選</p>
                <button
                  v-if="selectedEcoFilters.length"
                  type="button"
                  class="text-primary-500 text-sm"
                  @click="clearEcoFilters"
                >
                  清除
                </button>
              </div>
              <p class="text-xs text-grey-500">依額外環保作為縮小範圍</p>
              <div class="filter-chip-group">
                <button
                  v-for="option in ECO_ACTION_OPTIONS"
                  :key="option"
                  type="button"
                  class="filter-chip"
                  :class="{ 'filter-chip--active': selectedEcoActionSet.has(option) }"
                  @click="toggleEcoAction(option)"
                >
                  {{ option }}
                </button>
              </div>
            </div>
            <div class="space-y-2">
              <p v-if="errorMessage" class="text-warn-200 text-sm">
                {{ errorMessage }}
              </p>
              <p v-else-if="isSearching" class="text-grey-500 text-sm">查詢中，請稍候…</p>
              <template v-else-if="hasSearched">
                <p class="text-primary-500 font-bold">
                  {{
                    filteredRestaurantResults.length
                      ? `找到 ${filteredRestaurantResults.length} 家環保餐廳`
                      : '目前查無相關餐廳'
                  }}
                </p>
                <p
                  v-if="selectedEcoFilters.length && restaurantResults.length && !filteredRestaurantResults.length"
                  class="text-sm text-grey-500"
                >
                  已套用的環保篩選條件沒有符合結果，請調整篩選。
                </p>
                <ul v-if="filteredRestaurantResults.length" class="space-y-3">
                  <li
                    v-for="item in filteredRestaurantResults"
                    :key="`${item.restaurantName}-${item.address ?? 'NA'}`"
                    class="rounded-lg border border-grey-200 bg-white p-4 shadow-sm"
                  >
                    <p class="text-lg font-semibold text-primary-500">{{ item.restaurantName }}</p>
                    <p v-if="item.address" class="text-sm text-grey-600 mt-1">
                      地址：{{ item.address }}
                    </p>
                    <p v-if="item.phone" class="text-sm text-grey-600">
                      電話：{{ item.phone }}
                    </p>
                    <p v-if="item.ecoLevel" class="text-sm text-grey-600">
                      環保等級：{{ item.ecoLevel }}
                    </p>
                    <div v-if="item.ecoActions.length" class="flex flex-wrap gap-2 mt-2">
                      <span
                        v-for="tag in item.ecoActions"
                        :key="`${item.restaurantName}-${tag}`"
                        class="tag-chip"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </li>
                </ul>
              </template>
              <p v-else class="text-grey-500 text-sm">
                透過左上角搜尋或點選推薦，快速找到環保餐廳。
              </p>
            </div>
          </section>
        </div>
      </template>
      <template #tab1>
        <div class="p-4 space-y-6">
          <section class="panel-card space-y-3" aria-live="polite">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-lg font-semibold text-primary-600">附近餐廳</p>
                <p class="text-xs text-grey-500">資料來源：內政部主題 API（data.tgos.tw）</p>
              </div>
              <button
                type="button"
                class="secondary-button"
                :disabled="isLocatingNearby"
                @click="onLocateClick"
              >
                {{ isLocatingNearby ? '定位中…' : hasRequestedNearby ? '重新定位' : '探索附近' }}
              </button>
            </div>
            <p v-if="!hasRequestedNearby" class="text-sm text-grey-600">
              允許定位後，即可從公開資料找出距離最近的 10 家餐廳。
            </p>
            <p v-else-if="isLocatingNearby" class="text-sm text-grey-600">定位與資料查詢中…</p>
            <p v-if="nearbyError" class="text-sm text-warn-200">
              {{ nearbyError }}
            </p>
            <p v-else-if="nearbyInfo" class="text-sm text-grey-500">
              {{ nearbyInfo }}
            </p>
            <ul v-if="nearbyRestaurants.length" class="nearby-list">
              <li
                v-for="restaurant in nearbyRestaurants"
                :key="`${restaurant.name}-${restaurant.lat}-${restaurant.lng}`"
                class="nearby-item"
              >
                <div>
                  <p class="font-semibold text-primary-600">{{ restaurant.name }}</p>
                  <p v-if="restaurant.address" class="text-sm text-grey-600">
                    地址：{{ restaurant.address }}
                  </p>
                  <p v-if="restaurant.village" class="text-xs text-grey-500">
                    村里：{{ restaurant.village }}
                  </p>
                </div>
                <p class="text-sm font-semibold text-grey-800">
                  {{ formatDistance(restaurant.distanceKm) }}
                </p>
              </li>
            </ul>
          </section>
          <section class="panel-card space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-lg font-semibold text-primary-600">隨機推薦三家</p>
                <p class="text-xs text-grey-500">快速獲得靈感，可隨時重新整理。</p>
              </div>
              <button type="button" class="secondary-button" @click="refreshRandomRestaurants">
                換一批
              </button>
            </div>
            <TransitionGroup name="fade-list" tag="ul" class="space-y-3">
              <li v-for="item in randomRestaurants" :key="item.pickId" class="random-card">
                <p class="font-semibold text-primary-600">{{ item.restaurantName }}</p>
                <p v-if="item.address" class="text-sm text-grey-600 mt-1">
                  地址：{{ item.address }}
                </p>
                <p v-if="item.phone" class="text-sm text-grey-600">電話：{{ item.phone }}</p>
                <div v-if="item.ecoActions.length" class="flex flex-wrap gap-2 mt-2">
                  <span
                    v-for="tag in item.ecoActions"
                    :key="`${item.pickId}-${tag}`"
                    class="tag-chip tag-chip--ghost"
                  >
                    {{ tag }}
                  </span>
                </div>
              </li>
            </TransitionGroup>
          </section>
        </div>
      </template>
    </ServiceTabsView>
  </main>
</template>

<style lang="postcss">
.filter-panel {
  @apply rounded-xl border border-grey-200 bg-white p-4 shadow-sm space-y-2;
}

.filter-chip-group {
  @apply flex flex-wrap gap-2 mt-2;
  max-height: 148px;
  overflow-y: auto;
}

.filter-chip {
  @apply rounded-full border border-grey-200 px-3 py-1 text-xs text-grey-600 transition-colors;
}

.filter-chip--active {
  @apply bg-primary-500 text-white border-primary-500;
}

.panel-card {
  @apply rounded-2xl border border-grey-200 bg-white p-4 shadow-sm;
}

.secondary-button {
  @apply rounded-full border border-primary-500 px-4 py-1 text-sm font-semibold text-primary-600 transition-colors;
}

.secondary-button:disabled {
  @apply border-grey-200 text-grey-400 cursor-not-allowed;
}

.nearby-list {
  @apply space-y-3;
}

.nearby-item {
  @apply flex items-start justify-between gap-4 rounded-xl border border-grey-100 bg-primary-50/40 p-3;
}

.random-card {
  @apply rounded-xl border border-grey-100 bg-mid-50 p-4;
}

.tag-chip {
  @apply rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-primary-600;
}

.tag-chip--ghost {
  @apply bg-white border border-primary-200;
}

.suggestion-list {
  @apply space-y-2;
}

.suggestion-item {
  @apply w-full rounded-lg border border-grey-200 bg-white p-3 text-left shadow-sm transition-colors;
}

.suggestion-item:hover,
.suggestion-item:focus-visible {
  @apply border-primary-200 bg-primary-50/60;
}

.suggestion-name {
  @apply block font-semibold text-primary-600;
}

.suggestion-address {
  @apply block text-xs text-grey-500 mt-0.5;
}

.eco-summary {
  @apply space-y-2;
}

.eco-summary__title {
  @apply text-sm font-semibold text-grey-700;
}

.eco-table {
  @apply w-full overflow-hidden rounded-lg border border-grey-200;
}

.eco-table th {
  @apply bg-grey-50 text-xs font-semibold text-grey-600;
}

.eco-table th,
.eco-table td {
  @apply border-b border-grey-100 px-3 py-2 align-middle;
}

.eco-table tr:last-child td {
  @apply border-b-0;
}

.text-success {
  @apply text-green-500 font-semibold;
}

.fade-list-enter-active,
.fade-list-leave-active {
  transition: all 0.25s ease;
}

.fade-list-enter-from,
.fade-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.fade-list-move {
  transition: transform 0.25s ease;
}
</style>
