/**
 * Словарь метрик для тултипов. Используется в MetricInfo (ⓘ).
 * Source of truth для названия + формулы + единицы измерения.
 */

export interface MetricDef {
  label: string;
  desc: string;
  formula?: string;
  unit?: string;
}

export const METRICS: Record<string, MetricDef> = {
  // === Деньги ===
  revenue: {
    label: 'Выручка',
    desc: 'Сумма продаж за период (в тенге, без вычета себестоимости).',
    formula: 'SUM(чек.сумма)',
    unit: '₸',
  },
  cost: {
    label: 'Себестоимость',
    desc: 'Закупочная стоимость проданного товара (без НДС).',
    formula: 'SUM(qty × ССБ единицы)',
    unit: '₸',
  },
  profit: {
    label: 'Прибыль',
    desc: 'Валовая прибыль: выручка минус себестоимость.',
    formula: 'revenue − cost',
    unit: '₸',
  },
  rentability: {
    label: 'Рентабельность',
    desc: 'Доля прибыли в выручке. Сколько копеек чистого с каждого тенге продаж.',
    formula: 'profit / revenue × 100%',
    unit: '%',
  },
  markup: {
    label: 'Наценка',
    desc: 'Накрутка на себестоимость. Сколько процентов накинули сверху закупки.',
    formula: 'profit / cost × 100%',
    unit: '%',
  },
  surplus: {
    label: 'Излишки',
    desc: 'Замороженный капитал — стоимость текущих остатков по средней ССБ.',
    formula: 'SUM(остаток × ССБ)',
    unit: '₸',
  },

  // === Объём ===
  qty: {
    label: 'Кол-во',
    desc: 'Сколько штук товара продано за период.',
    unit: 'шт',
  },
  soldQty: {
    label: 'Продано',
    desc: 'Кол-во проданных единиц этого товара за период.',
    unit: 'шт',
  },
  receiptCount: {
    label: 'Чеков',
    desc: 'Количество пробитых чеков за период.',
    unit: 'шт',
  },
  avgCheck: {
    label: 'Ср. чек',
    desc: 'Средняя сумма одного чека.',
    formula: 'AVG(сумма чека)',
    unit: '₸',
  },
  medianCheck: {
    label: 'Мед. чек',
    desc: 'Медиана сумм чеков — устойчивая к выбросам оценка типичного чека.',
    formula: 'PERCENTILE(0.5)',
    unit: '₸',
  },

  // === SKU / ассортимент ===
  soldSkuCount: {
    label: 'SKU с продажами',
    desc: 'Сколько уникальных позиций номенклатуры продавалось.',
    unit: 'шт',
  },
  deadSkuCount: {
    label: 'Без продаж',
    desc: 'Сколько SKU есть на складе, но они не продавались за период.',
    unit: 'шт',
  },
  abcClass: {
    label: 'ABC',
    desc: 'Группа товара по выручке: A — top 80%, B — следующие 15%, C — остаток 5%, D — без продаж.',
  },
  xyzClass: {
    label: 'XYZ',
    desc: 'Группа товара по стабильности спроса: X — стабильный, Y — сезонный, Z — случайный.',
  },

  // === Запасы ===
  freeStock: {
    label: 'Остаток',
    desc: 'Сколько единиц этого товара лежит на складе сейчас.',
    unit: 'шт',
  },
  speed: {
    label: 'Скорость',
    desc: 'Сколько штук этого товара продаётся в день в среднем.',
    formula: 'qty / дней в периоде',
    unit: 'шт/день',
  },
  daysSupply: {
    label: 'Запас на N дней',
    desc: 'На сколько дней хватит остатка при текущей скорости продаж.',
    formula: 'остаток / скорость',
    unit: 'дней',
  },
  daysInStock: {
    label: 'Дней в наличии',
    desc: 'Сколько дней этот товар был доступен на складе за период.',
    unit: 'дней',
  },
};

/** Hardcoded helpers для пары revenue+profit без таблиц. */
export function rentabilityPct(revenue: number, profit: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

export function markupPct(cost: number, profit: number): number {
  return cost > 0 ? (profit / cost) * 100 : 0;
}
