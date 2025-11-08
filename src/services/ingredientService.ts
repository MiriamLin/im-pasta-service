import ingredientsCsv from '../../data/ingredients.csv?raw';

export interface IngredientDetail {
  companyName?: string;
  brandName: string;
  productName?: string;
  ingredientName?: string;
  ingredientBrand?: string;
  servingSize?: string;
  calories?: string;
  infoUrl?: string;
}

interface CsvRow extends Record<string, string> {}

interface InternalIngredient extends IngredientDetail {
  normalizedBrand: string;
}

const CSV_HEADERS = {
  company: ['公司名稱', 'company_name'],
  brand: ['品牌名稱', 'brand_name'],
  product: ['產品名稱', 'product_name'],
  ingredient: ['原料名稱', 'ingredient_name'],
  ingredientBrand: ['原料品牌', 'ingredient_brand'],
  servingSize: ['每一份量', 'serving_size'],
  calories: ['熱量大卡', 'calories'],
  infoUrl: ['相關資訊連結', 'info_link', 'link'],
};

const internalIngredientList: InternalIngredient[] = parseCsv(ingredientsCsv)
  .map((row) => {
    const brandName = pickFirst(row, CSV_HEADERS.brand);
    if (!brandName) {
      return null;
    }

    return {
      companyName: pickFirst(row, CSV_HEADERS.company),
      brandName,
      productName: pickFirst(row, CSV_HEADERS.product),
      ingredientName: pickFirst(row, CSV_HEADERS.ingredient),
      ingredientBrand: pickFirst(row, CSV_HEADERS.ingredientBrand),
      servingSize: pickFirst(row, CSV_HEADERS.servingSize),
      calories: pickFirst(row, CSV_HEADERS.calories),
      infoUrl: pickFirst(row, CSV_HEADERS.infoUrl),
      normalizedBrand: normalizeKeyword(brandName),
    };
  })
  .filter((item): item is InternalIngredient => Boolean(item));

const brandMap = buildBrandMap(internalIngredientList);

export function suggestBrands(keyword: string) {
  const normalized = normalizeKeyword(keyword);

  if (!normalized) {
    return Array.from(brandMap.values()).map(({ brandName, companyName }) => ({
      brandName,
      companyName,
    }));
  }

  return Array.from(brandMap.values())
    .filter((summary) => summary.normalizedBrand.includes(normalized))
    .map(({ brandName, companyName }) => ({ brandName, companyName }));
}

export function getBrandIngredients(brandName: string): IngredientDetail[] {
  const normalized = normalizeKeyword(brandName);

  if (!normalized) {
    return [];
  }

  const matched = internalIngredientList.filter((item) => item.normalizedBrand === normalized);
  if (!matched.length) {
    return [];
  }

  const grouped = new Map<
    string,
    {
      detail: IngredientDetail;
      ingredientSet: Set<string>;
    }
  >();

  matched.forEach((item) => {
    const key = item.productName ?? item.ingredientName ?? item.brandName;
    if (!grouped.has(key)) {
      grouped.set(key, {
        detail: {
          companyName: item.companyName,
          brandName: item.brandName,
          productName: item.productName,
          ingredientName: undefined,
          ingredientBrand: item.ingredientBrand,
          servingSize: item.servingSize,
          calories: item.calories,
          infoUrl: item.infoUrl,
        },
        ingredientSet: new Set<string>(),
      });
    }

    const entry = grouped.get(key)!;

    if (item.ingredientBrand && !entry.detail.ingredientBrand) {
      entry.detail.ingredientBrand = item.ingredientBrand;
    }
    if (item.servingSize && !entry.detail.servingSize) {
      entry.detail.servingSize = item.servingSize;
    }
    if (item.calories && !entry.detail.calories) {
      entry.detail.calories = item.calories;
    }
    if (item.infoUrl && !entry.detail.infoUrl) {
      entry.detail.infoUrl = item.infoUrl;
    }

    if (item.ingredientName) {
      entry.ingredientSet.add(item.ingredientName);
    }
  });

  return Array.from(grouped.values()).map(({ detail, ingredientSet }) => {
    if (ingredientSet.size) {
      detail.ingredientName = Array.from(ingredientSet).join('、');
    }
    return detail;
  });
}

function buildBrandMap(list: InternalIngredient[]) {
  const map = new Map<string, { brandName: string; companyName?: string; normalizedBrand: string }>();
  list.forEach((item) => {
    if (!map.has(item.normalizedBrand)) {
      map.set(item.normalizedBrand, {
        brandName: item.brandName,
        companyName: item.companyName,
        normalizedBrand: item.normalizedBrand,
      });
    }
  });
  return map;
}

function stripInternalFields(record: InternalIngredient): IngredientDetail {
  const { normalizedBrand: _normalized, ...rest } = record;
  return rest;
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
