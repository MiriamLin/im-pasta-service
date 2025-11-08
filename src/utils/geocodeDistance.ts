declare global {
  interface Window {
    TGOS?: any;
    proj4?: any;
  }
}

export interface GeocodeOptions {
  tgosAppId?: string;
  tgosApiKey?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  type?: string;
  source: 'tgos' | 'nominatim';
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const PROJ4_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.0/proj4.js';

let tgosLoader: Promise<void> | null = null;
let proj4Loader: Promise<void> | null = null;
const geocodeCache = new Map<string, GeocodeResult>();

function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`failed to load ${url}`)));
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${url}`));
    document.head.appendChild(script);
  });
}

async function ensureProj4() {
  if (typeof window === 'undefined') {
    throw new Error('proj4 僅支援瀏覽器環境');
  }
  if (window.proj4) {
    return;
  }
  if (!proj4Loader) {
    proj4Loader = loadScript(PROJ4_CDN);
  }
  await proj4Loader;
}

async function loadTGOS(appId: string, apiKey: string) {
  if (typeof window === 'undefined') {
    throw new Error('TGOS 需在瀏覽器中執行');
  }
  if (window.TGOS) {
    return;
  }
  if (!tgosLoader) {
    const encodedAppId = encodeURIComponent(appId);
    const encodedKey = encodeURIComponent(apiKey);
    const url = `https://api.tgos.tw/TGOS_API/tgos?ver=2&AppID=${encodedAppId}&APIKey=${encodedKey}`;
    tgosLoader = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('TGOS 載入失敗'));
      document.head.appendChild(script);
    });
  }
  await tgosLoader;
}

async function locateViaTGOS(address: string, options: GeocodeOptions): Promise<GeocodeResult> {
  if (!options.tgosAppId || !options.tgosApiKey) {
    throw new Error('缺少 TGOS AppID / APIKey');
  }
  await loadTGOS(options.tgosAppId, options.tgosApiKey);
  await ensureProj4();

  if (!window.TGOS) {
    throw new Error('TGOS 未正確載入');
  }

  const locator = new window.TGOS.TGLocateService();
  const rawResult = await new Promise<any>((resolve, reject) => {
    locator.locateTWD97({ address }, (result: any, status: number) => {
      if (status !== window.TGOS.TGLocatorStatus.OK || !result?.length) {
        reject(new Error('TGOS 無法解析地址'));
        return;
      }
      resolve(result[0]);
    });
  });

  if (!window.proj4?.defs?.['EPSG:3826']) {
    window.proj4?.defs(
      'EPSG:3826',
      '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs'
    );
  }

  const [lng, lat] = window.proj4('EPSG:3826', 'EPSG:4326', [
    Number(rawResult.geometry.location.x),
    Number(rawResult.geometry.location.y)
  ]);

  return {
    lat: Number(lat),
    lng: Number(lng),
    displayName: rawResult.display_name || rawResult.name || address,
    type: rawResult.type,
    source: 'tgos'
  };
}

async function locateViaNominatim(address: string): Promise<GeocodeResult> {
  const url = `${NOMINATIM_ENDPOINT}?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`;
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'zh-TW' }
  });
  if (!resp.ok) {
    throw new Error('Nominatim 服務異常');
  }
  const data = await resp.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error('Nominatim 找不到對應地址');
  }
  const target = data[0];
  return {
    lat: Number(target.lat),
    lng: Number(target.lon),
    displayName: target.display_name ?? address,
    type: target.type,
    source: 'nominatim'
  };
}

export async function geocodeAddress(address: string, options?: GeocodeOptions) {
  const normalized = address.trim();
  if (!normalized) {
    throw new Error('地址不得為空');
  }
  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized)!;
  }

  let result: GeocodeResult;
  if (options?.tgosAppId && options?.tgosApiKey) {
    try {
      result = await locateViaTGOS(normalized, options);
    } catch (error) {
      console.warn('[TGOS] 定位失敗，改用 Nominatim', error);
      result = await locateViaNominatim(normalized);
    }
  } else {
    result = await locateViaNominatim(normalized);
  }

  geocodeCache.set(normalized, result);
  return result;
}
