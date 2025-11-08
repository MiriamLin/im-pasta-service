import ecoFriendlyCsv from '../../data/eco-friendly.csv?raw';

export interface GreenRestaurantRecord {
  restaurantName: string;
  address?: string;
  phone?: string;
  ecoLevel?: string;
  ecoActions: string[];
}

type CsvRow = Record<string, string>;

const CSV_HEADERS = {
  name: ['餐廳名稱', 'restaurant_name', 'name'],
  address: ['餐廳地址', '地址', 'address'],
  phone: ['餐廳電話', '電話', 'tel', 'phone'],
  ecoLevel: ['額外環保作為', '環保等級', 'eco_level'],
};

interface InternalRestaurant extends GreenRestaurantRecord {
  normalizedName: string;
  normalizedAddress: string;
}

function parseEcoActions(raw?: string): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(/[、,，]/)
    .map((item) => item.replace(/^["'\s]+|["'\s]+$/g, ''))
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !/^\d+$/.test(item));
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
  return values.map((value) =>
    value
      .replace(/^"|"$/g, '')
      .replace(/""/g, '"')
      .trim()
  );
}

function parseCsv(content: string): CsvRow[] {
  const sanitized = content.replace(/^\uFEFF/, '');
  const lines = sanitized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
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
  return value.replace(/\s|　/g, '').toLowerCase();
}

function stripInternalFields(record: InternalRestaurant): GreenRestaurantRecord {
  const { normalizedName: _name, normalizedAddress: _address, ...rest } = record;
  return rest;
}

const internalRestaurantList: InternalRestaurant[] = parseCsv(ecoFriendlyCsv)
  .map((row) => {
    const restaurantName = pickFirst(row, CSV_HEADERS.name);
    if (!restaurantName) {
      return null;
    }

    const address = pickFirst(row, CSV_HEADERS.address);
    const ecoLevel = pickFirst(row, CSV_HEADERS.ecoLevel);

    return {
      restaurantName,
      address,
      phone: pickFirst(row, CSV_HEADERS.phone),
      ecoLevel,
      ecoActions: parseEcoActions(ecoLevel),
      normalizedName: normalizeKeyword(restaurantName),
      normalizedAddress: address ? normalizeKeyword(address) : ''
    };
  })
  .filter((item): item is InternalRestaurant => Boolean(item));

const ecoRestaurantList = internalRestaurantList.map(stripInternalFields);

const ecoActionOptions = Array.from(
  new Set(internalRestaurantList.flatMap((item) => item.ecoActions))
).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

export function getAllGreenRestaurants() {
  return ecoRestaurantList;
}

export function getEcoActionOptions() {
  return ecoActionOptions;
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
