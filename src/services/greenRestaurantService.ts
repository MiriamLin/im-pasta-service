import ecoFriendlyCsv from '../../data/eco-friendly.csv?raw';

export interface GreenRestaurantRecord {
  restaurantName: string;
  address?: string;
  phone?: string;
  ecoLevel?: string;
}

type CsvRow = Record<string, string>;

const CSV_HEADERS = {
  name: ['餐廳名稱', 'restaurant_name', 'name'],
  address: ['餐廳地址', '地址', 'address'],
  phone: ['餐廳電話', '電話', 'tel', 'phone'],
  ecoLevel: ['額外環保作為', '環保等級', 'eco_level'],
};

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
  return values.map((value) => value.trim());
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

const ecoRestaurantList: GreenRestaurantRecord[] = parseCsv(ecoFriendlyCsv)
  .map((row) => {
    const restaurantName = pickFirst(row, CSV_HEADERS.name);
    if (!restaurantName) {
      return null;
    }

    return {
      restaurantName,
      address: pickFirst(row, CSV_HEADERS.address),
      phone: pickFirst(row, CSV_HEADERS.phone),
      ecoLevel: pickFirst(row, CSV_HEADERS.ecoLevel),
    };
  })
  .filter((item): item is GreenRestaurantRecord => Boolean(item));

export async function searchGreenRestaurants(keyword: string) {
  const normalized = keyword.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return ecoRestaurantList.filter((restaurant) => {
    const nameMatch = restaurant.restaurantName.toLowerCase().includes(normalized);
    const addressMatch = restaurant.address?.toLowerCase().includes(normalized);
    return nameMatch || Boolean(addressMatch);
  });
}
