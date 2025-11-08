const TGOS_BASE_URL = 'https://data.tgos.tw/MOIDataThemeAPIMgr';
const TGOS_DEFAULT_API_KEY =
  'asySA/gDHZzdRmc0YreYFft7V7RuFfvk2utaUxdSBFT/g0WDA978OZfxZt6jJ7BDAZX7hL4pFj+P4sc97pW+k+amXFABx6eA7JXW+1qBJAsCAItTQqhQaUDP1zDZhY47';
const TGOS_RESTAURANT_THEME_ID = 'amk94aCG';
const RESTAURANT_KEYWORD = '餐';

type Primitive = string | number | boolean | undefined | null;

type FetchParams = Record<string, Primitive>;

interface TgosRangeResponse {
  responseMessage: string | { parameter: string; message: string }[];
  responseCount: number;
  responseData?: Array<{
    countyname: string;
    townname: string;
  }>;
}

interface TgosThemeFeature {
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    category?: string;
    address?: string;
    villname?: string;
    lng?: number;
    lat?: number;
  };
}

interface TgosThemeResponse {
  responseMessage: string | { parameter: string; message: string }[];
  responseCount: number;
  features?: TgosThemeFeature[];
}

export interface TgosNearbyRestaurant {
  name: string;
  address?: string;
  village?: string;
  lng: number;
  lat: number;
}

function getApiKey() {
  const key = import.meta.env.VITE_TGOS_API_KEY;
  return key && key.trim().length ? key : TGOS_DEFAULT_API_KEY;
}

async function tgosRequest<T>(path: string, params: FetchParams): Promise<T> {
  const searchParams = new URLSearchParams();
  searchParams.set('Apikey', getApiKey());

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    searchParams.set(key, String(value));
  });

  const response = await fetch(`${TGOS_BASE_URL}${path}?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`TGOS 服務回應異常 (${response.status})`);
  }
  const data = (await response.json()) as TgosRangeResponse | TgosThemeResponse;
  const message = (data as TgosRangeResponse).responseMessage;

  if (Array.isArray(message)) {
    const detail = message.map((item) => `${item.parameter}: ${item.message}`).join(', ');
    throw new Error(`TGOS 服務回應錯誤：${detail}`);
  }

  return data as T;
}

export async function getAdministrativeTown(lat: number, lng: number) {
  const data = await tgosRequest<TgosRangeResponse>('/Range/Administrative', {
    Unit: 'town',
    Lng: lng,
    Lat: lat,
  });

  if (!data.responseCount || !data.responseData?.length) {
    throw new Error('TGOS 無法辨識所在行政區');
  }

  const unit = data.responseData[0];
  return {
    county: unit.countyname,
    town: unit.townname,
  };
}

export async function fetchRestaurantsByTown(county: string, town: string) {
  const data = await tgosRequest<TgosThemeResponse>('/Theme/Query', {
    Theme_Id: TGOS_RESTAURANT_THEME_ID,
    County: county,
    Town: town,
    Keywords: RESTAURANT_KEYWORD,
  });

  if (!data.responseCount || !data.features) {
    return [];
  }

  return data.features
    .map((feature) => {
      const lng = feature.properties.lng ?? feature.geometry.coordinates[0];
      const lat = feature.properties.lat ?? feature.geometry.coordinates[1];
      if (typeof lng !== 'number' || typeof lat !== 'number') {
        return null;
      }

      const name = feature.properties.category?.trim() || '未命名餐廳';

      return {
        name,
        address: feature.properties.address ?? undefined,
        village: feature.properties.villname ?? undefined,
        lng,
        lat,
      } as TgosNearbyRestaurant;
    })
    .filter((item): item is TgosNearbyRestaurant => Boolean(item));
}
