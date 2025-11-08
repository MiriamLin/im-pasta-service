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
        <div class="p-4">
          <!-- 保留 tab 外層 -->
        </div>
      </template>
    </ServiceTabsView>
  </main>
</template>

<style lang="postcss"></style>
