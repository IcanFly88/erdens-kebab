// Étlap – a monori üzlet nyomtatott étlapja alapján (2026. október 27.).
// Kebab Tál, Dürüm (tortilla), Pita: csirke / borjú ár (a borjú +500 Ft), Mix és Falafel fix áron.
// A tálak ára tartalmazza a választható köretet (hasábburgonya vagy jázmin rizs) és 1 szószt.
// Csomagolás (az étlap alján): tál 200 Ft, dürüm és pita 100 Ft – külön sorban számoljuk.
// Ezt a fájlt az app és a szerver is használja: árváltozásnál elég itt módosítani.

export type OptionChoice = { id: string; name: string; price?: number };

export type OptionGroup = {
  id: string;
  title: string;
  type: 'single' | 'multi';
  required?: boolean;
  max?: number;
  choices: OptionChoice[];
};

export type Category = { id: string; name: string; subtitle?: string };

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  popular?: boolean;
  tags?: ('vega' | 'csípős' | 'új')[];
  optionGroups?: string[];
  /** Csomagolási díj darabonként (elvitelnél és kiszállításnál). */
  packaging?: number;
};

/** groupId → kiválasztott choice id-k */
export type Selections = Record<string, string[]>;

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;

const IMAGES = {
  tal: img('1771818708792-d671ae9b4b46'),
  talMix: img('1689151128603-4828c1c2838f'),
  durum: img('1734468330969-93c69106993f'),
  durumFries: img('1633321702518-7feccafb94d5'),
  pita: img('1699728088614-7d1d4277414b'),
  pitaFeta: img('1529006557810-274b9b2fc783'),
  falafel: img('1593001872095-7d5b3868fb1d'),
  nuggets: img('1627662055487-551888db3aa8'),
  chiliCheese: img('1788600448499-0cc867441746'),
  strips: img('1768204039907-77a974159ef0'),
  friedCheese: img('1778850855907-8fbf7b089621'),
  fries: img('1630384060421-cb20d0e0649d'),
  rice: img('1705147271933-5c7052f15a90'),
  sauces: img('1790000135231-c6638649d30a'),
  garlic: img('1777199264017-84af9308a41f'),
  baklavaPistachio: img('1761828122856-8703baac8e86'),
  baklavaWalnut: img('1783199352933-1cbbc176eb0c'),
  baklavaChoco: img('1777543236646-b36f83fef810'),
};

const PACKAGING_TAL = 200;
const PACKAGING_WRAP = 100;

const BEEF_SURCHARGE = 500;

export const OPTION_GROUPS: Record<string, OptionGroup> = {
  meat: {
    id: 'meat',
    title: 'Hús',
    type: 'single',
    required: true,
    choices: [
      { id: 'csirke', name: 'Csirkehús' },
      { id: 'borju', name: 'Borjúhús', price: BEEF_SURCHARGE },
    ],
  },
  side: {
    id: 'side',
    title: 'Köret',
    type: 'single',
    required: true,
    choices: [
      { id: 'hasab', name: 'Hasábburgonya' },
      { id: 'rizs', name: 'Jázmin rizs' },
    ],
  },
  sauce: {
    id: 'sauce',
    title: 'Szósz',
    type: 'single',
    required: true,
    choices: [
      { id: 'fokhagymas', name: 'Fokhagymás (alap)' },
      { id: 'csipos', name: 'Csípős' },
      { id: 'andalouse', name: 'Andalouse' },
      { id: 'hannibal', name: 'Hannibal' },
      { id: 'curry', name: 'Curry' },
      { id: 'samurai', name: 'Samurai' },
      { id: 'tartar', name: 'Tartár' },
      { id: 'cheddar', name: 'Cheddar' },
    ],
  },
  remove: {
    id: 'remove',
    title: 'Kérésre kihagyjuk',
    type: 'multi',
    choices: [
      { id: 'no-hagyma', name: 'Hagyma nélkül' },
      { id: 'no-kaposzta', name: 'Káposzta nélkül' },
      { id: 'no-paradicsom', name: 'Paradicsom nélkül' },
    ],
  },
};

export const CATEGORIES: Category[] = [
  {
    id: 'tal',
    name: 'Kebab Tál',
    subtitle: 'Köret (hasábburgonya vagy jázmin rizs), friss zöldségek és 1 szósz az árban',
  },
  { id: 'durum', name: 'Dürüm', subtitle: 'Tortillába tekerve, friss zöldségekkel' },
  { id: 'pita', name: 'Pita', subtitle: 'Frissen sült pitában, friss zöldségekkel' },
  {
    id: 'ropogos',
    name: 'Ropogós Falatok',
    subtitle: 'Tálak köret (hasábburgonya vagy jázmin rizs) és 1 szósz árával',
  },
  { id: 'koret', name: 'Köretek' },
  { id: 'szosz', name: 'Szószok', subtitle: 'Extra szósz külön adagban' },
  { id: 'baklava', name: 'Baklava' },
];

/** Egy étlapsor: a `price` a csirkés ár (Mix és Falafel esetén a fix ár). */
type Row = { key: string; name: string; price: number; extra?: string; fixed?: 'mix' | 'falafel' };

function kebabItems(
  categoryId: string,
  label: string,
  rows: Row[],
  images: [string, string],
  options: { withSide?: boolean; popular?: string[]; packaging: number },
): MenuItem[] {
  return rows.map((r, i) => {
    const filling =
      r.fixed === 'falafel'
        ? 'Ropogós falafel'
        : r.fixed === 'mix'
          ? 'Csirke- és borjúhús vegyesen'
          : 'Csirke- vagy borjúhús';
    const extra = r.extra ? `, ${r.extra}` : '';
    const side = options.withSide ? ', választható köret és 1 szósz' : ', szósz';
    return {
      id: `${categoryId}-${r.key}`,
      categoryId,
      name: `${r.name} ${label}`,
      description: `${filling}${extra}, friss zöldségek${side}.`,
      price: r.price,
      image: r.fixed === 'falafel' ? IMAGES.falafel : images[i % 2],
      popular: options.popular?.includes(r.key),
      tags: r.fixed === 'falafel' ? ['vega'] : undefined,
      packaging: options.packaging,
      optionGroups: [
        ...(r.fixed ? [] : ['meat']),
        ...(options.withSide ? ['side'] : []),
        'sauce',
        'remove',
      ],
    };
  });
}

/** Külön rendelhető szószok – a leírás az étlapról. */
const SAUCES = [
  { id: 'fokhagymas', name: 'Fokhagymás szósz', description: 'A ház alapszósza.', price: 380 },
  { id: 'csipos', name: 'Csípős szósz', description: '', price: 380, hot: true },
  {
    id: 'andalouse',
    name: 'Andalouse szósz',
    description: 'Enyhén pikáns, paradicsomos-paprikás majonéz.',
    price: 380,
  },
  {
    id: 'hannibal',
    name: 'Hannibal szósz',
    description: 'Édeskés majonéz pirított hagymadarabokkal.',
    price: 380,
  },
  { id: 'curry', name: 'Curry szósz', description: 'Kellemesen fűszeres, édeskés curry ízvilág.', price: 380 },
  { id: 'samurai', name: 'Samurai szósz', description: 'Csípős, chilis majonéz.', price: 380, hot: true },
  { id: 'tartar', name: 'Tartármártás', description: 'Klasszikus majonézmártás.', price: 380 },
  { id: 'cheddar', name: 'Cheddar sajtszósz', description: 'Meleg sajtszósz.', price: 480 },
];

export const MENU: MenuItem[] = [
  ...kebabItems(
    'tal',
    'tál',
    [
      { key: 'sima', name: 'Sima', price: 3380 },
      { key: 'feta', name: 'Feta', price: 3780, extra: 'feta' },
      { key: 'antalya', name: 'Antalya', price: 3780, extra: 'ananász, kukorica' },
      { key: 'istanbul', name: 'Istanbul', price: 4180, extra: 'paprika, kukorica, feta' },
      { key: 'mix', name: 'Mix', price: 3780, fixed: 'mix' },
      { key: 'falafel', name: 'Falafel', price: 3280, fixed: 'falafel' },
    ],
    [IMAGES.tal, IMAGES.talMix],
    { withSide: true, popular: ['sima', 'istanbul'], packaging: PACKAGING_TAL },
  ),
  ...kebabItems(
    'durum',
    'dürüm',
    [
      { key: 'sima', name: 'Sima', price: 2480 },
      { key: 'feta', name: 'Feta', price: 2880, extra: 'feta' },
      { key: 'antalya', name: 'Antalya', price: 2880, extra: 'ananász, kukorica' },
      { key: 'istanbul', name: 'Istanbul', price: 3280, extra: 'paprika, kukorica, feta' },
      { key: 'mix', name: 'Mix', price: 2880, fixed: 'mix' },
      { key: 'falafel', name: 'Falafel', price: 2380, fixed: 'falafel' },
    ],
    [IMAGES.durum, IMAGES.durumFries],
    { popular: ['feta'], packaging: PACKAGING_WRAP },
  ),
  ...kebabItems(
    'pita',
    'pita',
    [
      { key: 'sima', name: 'Sima', price: 2380 },
      { key: 'feta', name: 'Feta', price: 2780, extra: 'feta' },
      { key: 'antalya', name: 'Antalya', price: 2780, extra: 'ananász, kukorica' },
      { key: 'istanbul', name: 'Istanbul', price: 3180, extra: 'paprika, kukorica, feta' },
      { key: 'mix', name: 'Mix', price: 2780, fixed: 'mix' },
      { key: 'falafel', name: 'Falafel', price: 2280, fixed: 'falafel' },
    ],
    [IMAGES.pita, IMAGES.pitaFeta],
    { popular: ['sima'], packaging: PACKAGING_WRAP },
  ),
  {
    id: 'ropogos-nuggets',
    categoryId: 'ropogos',
    name: 'Classic Nuggets tál',
    description: 'Gyerekeknek is. Csirke nuggets, választható köret és 1 szósz.',
    price: 1880,
    image: IMAGES.nuggets,
    popular: true,
    optionGroups: ['side', 'sauce'],
    packaging: PACKAGING_TAL,
  },
  {
    id: 'ropogos-chili-cheese',
    categoryId: 'ropogos',
    name: 'Chili Cheese Nuggets tál',
    description: 'Csípős-sajtos falatok, választható köret és 1 szósz.',
    price: 1880,
    image: IMAGES.chiliCheese,
    tags: ['csípős'],
    optionGroups: ['side', 'sauce'],
    packaging: PACKAGING_TAL,
  },
  {
    id: 'ropogos-csirkemell',
    categoryId: 'ropogos',
    name: 'Rántott csirkemell csíkok tál',
    description: 'Ropogós csirkemell csíkok, választható köret és 1 szósz.',
    price: 2980,
    image: IMAGES.strips,
    optionGroups: ['side', 'sauce'],
    packaging: PACKAGING_TAL,
  },
  {
    id: 'ropogos-sajt',
    categoryId: 'ropogos',
    name: 'Rántott sajt tál',
    description: 'Rántott sajt, választható köret és 1 szósz.',
    price: 2680,
    image: IMAGES.friedCheese,
    optionGroups: ['side', 'sauce'],
    packaging: PACKAGING_TAL,
  },
  {
    id: 'koret-hasab',
    categoryId: 'koret',
    name: 'Hasábburgonya',
    description: 'Egy adag ropogós hasábburgonya.',
    price: 1180,
    image: IMAGES.fries,
    tags: ['vega'],
  },
  {
    id: 'koret-rizs',
    categoryId: 'koret',
    name: 'Jázmin rizs',
    description: 'Egy adag párolt jázmin rizs.',
    price: 1180,
    image: IMAGES.rice,
    tags: ['vega'],
  },
  ...SAUCES.map(
    (s): MenuItem => ({
      id: `szosz-${s.id}`,
      categoryId: 'szosz',
      name: s.name,
      description: s.description,
      price: s.price,
      image: s.id === 'fokhagymas' ? IMAGES.garlic : IMAGES.sauces,
      tags: s.hot ? ['csípős'] : undefined,
    }),
  ),
  {
    id: 'baklava-pisztacia',
    categoryId: 'baklava',
    name: 'Pisztáciás baklava',
    description: 'Ropogós leveles tészta, pisztácia, szirup.',
    price: 680,
    image: IMAGES.baklavaPistachio,
  },
  {
    id: 'baklava-dios',
    categoryId: 'baklava',
    name: 'Diós baklava',
    description: 'Ropogós leveles tészta, dió, szirup.',
    price: 580,
    image: IMAGES.baklavaWalnut,
  },
  {
    id: 'baklava-csokis',
    categoryId: 'baklava',
    name: 'Csokis baklava',
    description: 'Ropogós leveles tészta csokoládéval.',
    price: 580,
    image: IMAGES.baklavaChoco,
  },
];

export function getItem(id: string | undefined): MenuItem | undefined {
  return MENU.find((m) => m.id === id);
}

export function itemsInCategory(categoryId: string): MenuItem[] {
  return MENU.filter((m) => m.categoryId === categoryId);
}

export function groupsFor(item: MenuItem): OptionGroup[] {
  return (item.optionGroups ?? []).map((g) => OPTION_GROUPS[g]);
}

export function hasRequiredOptions(item: MenuItem): boolean {
  return groupsFor(item).some((g) => g.required);
}

export function unitPrice(item: MenuItem, selections: Selections): number {
  return groupsFor(item).reduce((sum, group) => {
    const chosen = selections[group.id] ?? [];
    return (
      sum +
      group.choices.filter((c) => chosen.includes(c.id)).reduce((s, c) => s + (c.price ?? 0), 0)
    );
  }, item.price);
}

/** Pl. "Borjúhús · Hasábburgonya · Fokhagymás" */
export function describeSelections(item: MenuItem, selections: Selections): string {
  return groupsFor(item)
    .flatMap((group) =>
      group.choices.filter((c) => selections[group.id]?.includes(c.id)).map((c) => c.name),
    )
    .join(' · ');
}

export function missingRequired(item: MenuItem, selections: Selections): OptionGroup | undefined {
  return groupsFor(item).find((g) => g.required && !(selections[g.id]?.length));
}

/** A csomagolási díj összesen (tál 200 Ft, dürüm és pita 100 Ft darabonként). */
export function packagingFor(lines: { itemId: string; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + (getItem(l.itemId)?.packaging ?? 0) * l.qty, 0);
}

/** Csak az étlapon ma is létező opciókat tartja meg (pl. régebbi kosárból vagy rendelésből). */
export function sanitizeSelections(item: MenuItem, selections: Selections): Selections {
  const clean: Selections = {};
  for (const group of groupsFor(item)) {
    const valid = (selections[group.id] ?? []).filter((id) =>
      group.choices.some((c) => c.id === id),
    );
    if (valid.length) clean[group.id] = valid;
  }
  return clean;
}

export function searchMenu(query: string): MenuItem[] {
  const q = normalize(query.trim());
  if (!q) return [];
  return MENU.filter((m) => normalize(`${m.name} ${m.description}`).includes(q));
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
