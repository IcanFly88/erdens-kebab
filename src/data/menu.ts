// Étlap. A termékek és változatok az erdenskebap.hu étlapjáról származnak
// (Pita, Tortilla, Tál, Box · Sima, Feta, Antalya, Istanbul, Falafel · csirke / borjú).
// Az árak becsültek, az italok példák — élesítés előtt cseréld a valós árlapra!

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
};

/** groupId → kiválasztott choice id-k */
export type Selections = Record<string, string[]>;

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;

const IMAGES = {
  pita: img('1699728088614-7d1d4277414b'),
  pitaFeta: img('1529006557810-274b9b2fc783'),
  tortilla: img('1734468330969-93c69106993f'),
  tortillaFries: img('1633321702518-7feccafb94d5'),
  tal: img('1676471980189-08de3e001215'),
  talMix: img('1644364935906-792b2245a2c0'),
  box: img('1771818708792-d671ae9b4b46'),
  boxLoaded: img('1689151128603-4828c1c2838f'),
  falafel: img('1593001872095-7d5b3868fb1d'),
  fries: img('1630384060421-cb20d0e0649d'),
  friesBig: img('1518013431117-eb1465fa5752'),
  sauces: img('1790000135231-c6638649d30a'),
  garlic: img('1777199264017-84af9308a41f'),
  cola: img('1622483767028-3f66f32aef97'),
  water: img('1523362628745-0c100150b504'),
};

export const OPTION_GROUPS: Record<string, OptionGroup> = {
  meat: {
    id: 'meat',
    title: 'Hús',
    type: 'single',
    required: true,
    choices: [
      { id: 'csirke', name: 'Csirkehús' },
      { id: 'borju', name: 'Borjúhús', price: 400 },
    ],
  },
  sauce: {
    id: 'sauce',
    title: 'Szósz',
    type: 'single',
    required: true,
    choices: [
      { id: 'fokhagymas', name: 'Fokhagymás' },
      { id: 'joghurtos', name: 'Joghurtos' },
      { id: 'csipos', name: 'Csípős' },
      { id: 'vegyes', name: 'Vegyes (fokhagymás + csípős)' },
    ],
  },
  side: {
    id: 'side',
    title: 'Köret',
    type: 'single',
    required: true,
    choices: [
      { id: 'hasab', name: 'Hasábburgonya' },
      { id: 'rizs', name: 'Rizs' },
      { id: 'fele', name: 'Fele-fele' },
    ],
  },
  extras: {
    id: 'extras',
    title: 'Extrák',
    type: 'multi',
    max: 4,
    choices: [
      { id: 'extra-hus', name: 'Extra hús', price: 700 },
      { id: 'extra-feta', name: 'Extra feta', price: 350 },
      { id: 'hasab-bele', name: 'Hasábburgonya bele', price: 300 },
      { id: 'jalapeno', name: 'Jalapeño', price: 250 },
      { id: 'kukorica', name: 'Kukorica', price: 200 },
    ],
  },
  remove: {
    id: 'remove',
    title: 'Kérésre kihagyjuk',
    type: 'multi',
    choices: [
      { id: 'no-hagyma', name: 'Hagyma nélkül' },
      { id: 'no-paradicsom', name: 'Paradicsom nélkül' },
      { id: 'no-uborka', name: 'Uborka nélkül' },
      { id: 'no-kaposzta', name: 'Káposzta nélkül' },
    ],
  },
  dip: {
    id: 'dip',
    title: 'Kérsz mellé szószt?',
    type: 'multi',
    max: 3,
    choices: [
      { id: 'dip-fokhagymas', name: 'Fokhagymás szósz', price: 250 },
      { id: 'dip-csipos', name: 'Csípős szósz', price: 250 },
      { id: 'dip-ketchup', name: 'Ketchup', price: 250 },
      { id: 'dip-majonez', name: 'Majonéz', price: 250 },
    ],
  },
};

export const CATEGORIES: Category[] = [
  { id: 'box', name: 'Kebab Box', subtitle: 'Hasábburgonya ágyon, bőséges hússal és szósszal' },
  { id: 'pita', name: 'Pita', subtitle: 'Frissen sült pitában, ropogós zöldségekkel' },
  { id: 'tortilla', name: 'Tortilla', subtitle: 'Tortillába tekerve – a klasszikus dürüm' },
  { id: 'tal', name: 'Tál', subtitle: 'Hús, köret, saláta és szósz egy tányéron' },
  { id: 'koretek', name: 'Köretek' },
  { id: 'szoszok', name: 'Szószok' },
  { id: 'italok', name: 'Italok' },
];

type Variant = { key: string; name: string; extra: string; delta: number; vega?: boolean };

const VARIANTS: Variant[] = [
  { key: 'sima', name: 'Sima', extra: '', delta: 0 },
  { key: 'feta', name: 'Feta', extra: 'feta sajttal', delta: 300 },
  { key: 'antalya', name: 'Antalya', extra: 'ananásszal és kukoricával', delta: 300 },
  { key: 'istanbul', name: 'Istanbul', extra: 'paprikával, kukoricával és fetával', delta: 500 },
  { key: 'falafel', name: 'Falafel', extra: '', delta: 0, vega: true },
];

const BASE = 'saláta, paradicsom, uborka, lilahagyma';

function variantItems(
  categoryId: string,
  label: string,
  basePrice: number,
  images: [string, string],
  options: { withSide?: boolean; variants?: Variant[]; popular?: string[]; lead?: string } = {},
): MenuItem[] {
  const variants = options.variants ?? VARIANTS;
  return variants.map((v, i) => {
    const meatPart = v.vega ? 'ropogós csicseriborsó-falafel' : 'csirke- vagy borjúhús';
    const extraPart = v.extra ? `, ${v.extra}` : '';
    const sidePart = options.withSide ? ', választható köret' : '';
    const text = `${meatPart}${extraPart}, ${BASE}${sidePart}.`;
    return {
      id: `${categoryId}-${v.key}`,
      categoryId,
      name: `${v.name} ${label}`,
      description: options.lead
        ? `${options.lead} ${text}`
        : `${text.charAt(0).toUpperCase()}${text.slice(1)}`,
      price: basePrice + v.delta,
      image: v.vega ? IMAGES.falafel : images[i % 2],
      popular: options.popular?.includes(v.key),
      tags: v.vega ? ['vega'] : undefined,
      optionGroups: [
        ...(v.vega ? [] : ['meat']),
        ...(options.withSide ? ['side'] : []),
        'sauce',
        'extras',
        'remove',
      ],
    };
  });
}

export const MENU: MenuItem[] = [
  ...variantItems('box', 'Box', 2790, [IMAGES.box, IMAGES.boxLoaded], {
    variants: VARIANTS.filter((v) => !v.vega),
    popular: ['istanbul', 'sima'],
    lead: 'Hasábburgonya ágyon:',
  }),
  ...variantItems('pita', 'pita', 2290, [IMAGES.pita, IMAGES.pitaFeta], { popular: ['feta'] }),
  ...variantItems('tortilla', 'tortilla', 2490, [IMAGES.tortilla, IMAGES.tortillaFries], {
    popular: ['antalya'],
  }),
  ...variantItems('tal', 'tál', 3290, [IMAGES.tal, IMAGES.talMix], { withSide: true }),
  {
    id: 'hasab-kicsi',
    categoryId: 'koretek',
    name: 'Hasábburgonya (kis adag)',
    description: 'Ropogós, aranybarna hasábburgonya.',
    price: 890,
    image: IMAGES.fries,
    optionGroups: ['dip'],
  },
  {
    id: 'hasab-nagy',
    categoryId: 'koretek',
    name: 'Hasábburgonya (nagy adag)',
    description: 'Ropogós, aranybarna hasábburgonya – nagy adag.',
    price: 1290,
    image: IMAGES.friesBig,
    optionGroups: ['dip'],
  },
  ...[
    ['fokhagymas', 'Fokhagymás szósz', 'A ház kedvence, krémes fokhagymás szósz.', IMAGES.garlic],
    ['joghurtos', 'Joghurtos szósz', 'Friss, enyhe joghurtos szósz.', IMAGES.garlic],
    ['csipos', 'Csípős szósz', 'Tüzes, paprikás csípős szósz.', IMAGES.sauces],
    ['barbecue', 'Barbecue szósz', 'Füstös, édeskés BBQ szósz.', IMAGES.sauces],
    ['ketchup', 'Ketchup', '', undefined],
    ['majonez', 'Majonéz', '', undefined],
  ].map(
    ([key, name, description, image]): MenuItem => ({
      id: `szosz-${key}`,
      categoryId: 'szoszok',
      name: name!,
      description: description ?? '',
      price: 250,
      image,
      tags: key === 'csipos' ? ['csípős'] : undefined,
    }),
  ),
  {
    id: 'cola',
    categoryId: 'italok',
    name: 'Coca-Cola 0,33 l',
    description: 'Dobozos üdítő.',
    price: 590,
    image: IMAGES.cola,
  },
  {
    id: 'cola-zero',
    categoryId: 'italok',
    name: 'Coca-Cola Zero 0,33 l',
    description: 'Dobozos üdítő, cukormentes.',
    price: 590,
    image: IMAGES.cola,
  },
  {
    id: 'fanta',
    categoryId: 'italok',
    name: 'Fanta narancs 0,33 l',
    description: 'Dobozos üdítő.',
    price: 590,
  },
  {
    id: 'ayran',
    categoryId: 'italok',
    name: 'Ayran 0,25 l',
    description: 'Hűsítő török joghurtital – a kebab legjobb barátja.',
    price: 490,
  },
  {
    id: 'viz',
    categoryId: 'italok',
    name: 'Ásványvíz 0,5 l',
    description: 'Szénsavas vagy mentes.',
    price: 450,
    image: IMAGES.water,
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

/** Pl. "Borjúhús · Fokhagymás · Extra feta" */
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
