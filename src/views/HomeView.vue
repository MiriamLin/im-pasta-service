<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useFormStore } from '@/stores/form';
import { useUserStore } from '@/stores/user';
import { storeToRefs } from 'pinia';
import { useConnectionMessage } from '@/composables/useConnectionMessage';
import { useHandleConnectionData } from '@/composables/useHandleConnectionData';
import ServiceTabsView from '@/components/organisms/ServiceTabsView.vue';
import BaseInput from '@/components/atoms/BaseInput.vue';
import { searchGreenRestaurants, type GreenRestaurantRecord } from '@/services/greenRestaurantService';
import type { User } from '@/stores/user';

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
const isSearching = ref(false);
const errorMessage = ref<string | null>(null);
const hasSearched = ref(false);

const onSearchClick = async () => {
  const keyword = searchValue.value.trim();
  hasSearched.value = true;

  if (!keyword) {
    restaurantResults.value = [];
    errorMessage.value = '請輸入餐廳名稱後再查詢。';
    return;
  }

  errorMessage.value = null;
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
          <section class="px-4 mt-4 space-y-4" aria-live="polite">
            <p v-if="!hasSearched && !errorMessage" class="text-grey-500 text-sm">
              透過關鍵字查詢，確認此餐廳是否列入臺北市環保餐廳名單。
            </p>
            <p v-if="errorMessage" class="text-warn-200 text-sm">
              {{ errorMessage }}
            </p>
            <p v-else-if="isSearching" class="text-grey-500 text-sm">查詢中，請稍候…</p>
            <template v-else-if="hasSearched">
              <p class="text-primary-500 font-bold">
                {{
                  restaurantResults.length
                    ? `找到 ${restaurantResults.length} 家環保餐廳`
                    : '目前查無相關餐廳'
                }}
              </p>
              <ul v-if="restaurantResults.length" class="space-y-3">
                <li
                  v-for="item in restaurantResults"
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
                </li>
              </ul>
            </template>
          </section>
        </div>
      </template>
      <template #tab1>
        <div class="p-4">
          <!-- 保留 tab 外層 -->
        </div>
      </template>
    </ServiceTabsView>
  </main>
</template>

<style lang="postcss"></style>
