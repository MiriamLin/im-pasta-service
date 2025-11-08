import safetyCsv from '../../data/safety.csv?raw';
import { city as taiwanCities } from '@/zipcode/city';

export interface GreenRestaurantRecord {
  restaurantName: string;
  address?: string;
  phone?: string;
  ecoLevel?: string;
  ecoActions: string[];
  county?: string;
  town?: string;
}

type CsvRow = Record<string, string>;

const CSV_HEADERS = {
  name: ['業者名稱店名', '餐廳名稱', 'name'],
  address: ['地址', '餐廳地址', 'address'],
  phone: ['餐廳電話', '電話', 'tel', 'phone'],
  evaluation: ['評核結果', 'evaluation', '結果']
};

interface InternalRestaurant extends GreenRestaurantRecord {
  normalizedName: string;
  normalizedAddress: string;
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
}

function parseCsv(content: string): CsvRow[] {
  const sanitized = content.replace(/^\uFEFF/, '');
  const lines = sanitized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return [];
  }

  const headers = splitCsvLine(lines.shift() ?? '').map((header) => header.replace(/^\uFEFF/, ''));

  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function pickFirst(row: CsvRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeKeyword(value: string) {
  return value.replace(/\s|\u3000/g, '').toLowerCase();
}

function stripInternalFields(record: InternalRestaurant): GreenRestaurantRecord {
  const { normalizedName: _name, normalizedAddress: _address, ...rest } = record;
  return rest;
}

function normalizeCounty(value: string) {
  return value.replace(/台/g, '臺');
}

function extractCountyTown(address?: string) {
  if (!address) {
    return { county: undefined, town: undefined };
  }
  const normalized = normalizeCounty(address);
  const entry = taiwanCities.find((item) =>
    normalized.startsWith(normalizeCounty(item.county + item.city))
  );
  if (entry) {
    return { county: normalizeCounty(entry.county), town: entry.city };
  }
  const countyOnly = taiwanCities.find((item) =>
    normalized.startsWith(normalizeCounty(item.county))
  );
  if (countyOnly) {
    return { county: normalizeCounty(countyOnly.county), town: undefined };
  }
  return { county: undefined, town: undefined };
}

const internalRestaurantList: InternalRestaurant[] = parseCsv(safetyCsv)
  .map((row) => {
    const restaurantName = pickFirst(row, CSV_HEADERS.name);
    if (!restaurantName) {
      return null;
    }

    const address = pickFirst(row, CSV_HEADERS.address);
    const evaluation = pickFirst(row, CSV_HEADERS.evaluation);
    const { county, town } = extractCountyTown(address);

    return {
      restaurantName,
      address,
      phone: pickFirst(row, CSV_HEADERS.phone),
      ecoLevel: evaluation,
      ecoActions: [],
      normalizedName: normalizeKeyword(restaurantName),
      normalizedAddress: address ? normalizeKeyword(address) : '',
      county,
      town
    };
  })
  .filter((item): item is InternalRestaurant => Boolean(item));

const safetyRestaurantList = internalRestaurantList.map(stripInternalFields);

export function getAllGreenRestaurants() {
  return safetyRestaurantList;
}

export function getSafetyRestaurantsWithRegion() {
  return safetyRestaurantList;
}

export function getEcoActionOptions() {
  return [];
}

export async function searchGreenRestaurants(keyword: string) {
  const normalized = normalizeKeyword(keyword);

  if (!normalized) {
    return [];
  }

  const matched = internalRestaurantList.filter((restaurant) => {
    const nameMatch = restaurant.normalizedName.includes(normalized);
    const addressMatch = restaurant.normalizedAddress.includes(normalized);
    return nameMatch || addressMatch;
  });

  return matched.map(stripInternalFields);
}

export function suggestGreenRestaurants(keyword: string, limit = 5) {
  const normalized = normalizeKeyword(keyword);

  if (!normalized) {
    return [];
  }

  return internalRestaurantList
    .filter((restaurant) => restaurant.normalizedName.includes(normalized))
    .slice(0, limit)
    .map(stripInternalFields);
}

export function findGreenRestaurantByName(name: string) {
  const normalized = normalizeKeyword(name);

  if (!normalized) {
    return null;
  }

  const matched = internalRestaurantList.find(
    (restaurant) => restaurant.normalizedName === normalized
  );

  return matched ? stripInternalFields(matched) : null;
}
