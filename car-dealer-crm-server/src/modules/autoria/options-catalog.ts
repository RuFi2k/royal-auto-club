// AUTO.RIA option catalog for passenger cars (category 1).
// Verified live against the developer API (2026-07-14):
//  - BINARY options come from GET /auto/categories/1/options ({name,value}).
//  - SELECTABLE options are separate ad-payload fields (e.g. seatHeated:{id}) with
//    the 1-based value enums from the add-ad spec (parameter_structure).
//
// AUTO.RIA keeps the ad's equipment in TWO stores and the cabinet UI reads only
// the newer one, so every option also carries its `v2` id (from
// GET /used_auto/get_options/1/optionsV2) — see client.riaPutAdOptionsV2.
// GENERATED — regenerate rather than hand-edit when AUTO.RIA changes the catalog.

export interface BinaryOption {
  id: number;
  // optionsV2 id — absent for the 8 classic-only options v2 has no equivalent
  // for (Шноркель, Лебідка, MirrorLink…). Those can't be shown on an ad.
  v2?: number;
  label: string;
  group: string;
}

export interface SelectableValue {
  id: number;
  // optionsV2 value id for this enum member.
  v2: number;
  label: string;
}

export interface SelectableOption {
  // Internal id used as CarOption.optionId (SELECTABLE_ID_BASE + optionsV2 field
  // id) — kept clear of binary classic ids (which top out at 645).
  id: number;
  // AUTO.RIA ad-payload field name, e.g. "seatHeated".
  field: string;
  label: string;
  group: string;
  values: SelectableValue[];
}

export const GROUP_ORDER: string[] = [
  "Безпека",
  "Подушка безпеки",
  "Салон та комфорт",
  "Мультимедіа",
  "Оптика",
  "Система допомоги при паркуванні",
  "Кузов",
  "Додаткове обладнання",
  "Енергоефективність",
  "Стан",
];

export const BINARY_OPTIONS: BinaryOption[] = [
  { id: 604, v2: 93, label: "Імобілайзер", group: "Безпека" },
  { id: 217, v2: 7, label: "Антиблокувальна система (ABS)", group: "Безпека" },
  { id: 606, v2: 95, label: "Антипробуксовочна система (ASR)", group: "Безпека" },
  { id: 622, v2: 109, label: "Блокування замків задніх дверей", group: "Безпека" },
  { id: 617, v2: 104, label: "Датчик втоми водія", group: "Безпека" },
  { id: 623, v2: 110, label: "Датчик проникнення в салон (датчик об`єму)", group: "Безпека" },
  { id: 620, v2: 107, label: "Датчик тиску в шинах", group: "Безпека" },
  { id: 611, v2: 100, label: "Допомога при спуску", group: "Безпека" },
  { id: 609, v2: 98, label: "Допомога при старті в гору", group: "Безпека" },
  { id: 612, v2: 101, label: "Запобігання зіткнення", group: "Безпека" },
  { id: 616, v2: 103, label: "Контроль за смугою руху", group: "Безпека" },
  { id: 615, v2: 102, label: "Контроль сліпих зон", group: "Безпека" },
  { id: 619, v2: 106, label: "Нічне бачення", group: "Безпека" },
  { id: 608, v2: 97, label: "Розподіл гальмівних зусиль (BAS, EBD)", group: "Безпека" },
  { id: 618, v2: 105, label: "Розпізнавання дорожніх знаків", group: "Безпека" },
  { id: 303, v2: 11, label: "Сигналізація", group: "Безпека" },
  { id: 621, v2: 108, label: "Система кріплення IsoFix", group: "Безпека" },
  { id: 459, v2: 18, label: "Система стабілізації (ESP)", group: "Безпека" },
  { id: 607, v2: 96, label: "Стабілізація рульового управління (VSM)", group: "Безпека" },
  { id: 137, v2: 3, label: "Центральний замок", group: "Безпека" },
  { id: 626, v2: 113, label: "Бічні задні", group: "Подушка безпеки" },
  { id: 625, v2: 112, label: "Бічні передні", group: "Подушка безпеки" },
  { id: 211, v2: 6, label: "Водія", group: "Подушка безпеки" },
  { id: 627, v2: 114, label: "Віконні (шторки)", group: "Подушка безпеки" },
  { id: 628, v2: 115, label: "Колін водія", group: "Подушка безпеки" },
  { id: 624, v2: 111, label: "Пасажира", group: "Подушка безпеки" },
  { id: 634, label: "Центральна подушка між водієм та пасажиром", group: "Подушка безпеки" },
  { id: 591, v2: 82, label: "Адаптивний круїз", group: "Салон та комфорт" },
  { id: 585, v2: 76, label: "Бардачок з охолодженням", group: "Салон та комфорт" },
  { id: 546, v2: 43, label: "Бездротова зарядка для смартфону", group: "Салон та комфорт" },
  { id: 188, v2: 4, label: "Бортовий комп'ютер", group: "Салон та комфорт" },
  { id: 610, v2: 99, label: "Вибір режиму руху", group: "Салон та комфорт" },
  { id: 582, v2: 73, label: "Відкриття багажника без допомоги рук", group: "Салон та комфорт" },
  { id: 255, v2: 9, label: "Датчик дощу", group: "Салон та комфорт" },
  { id: 564, v2: 57, label: "Декоративне підсвічування салону", group: "Салон та комфорт" },
  { id: 565, v2: 58, label: "Декоративні накладки на педалі", group: "Салон та комфорт" },
  { id: 595, v2: 85, label: "Дистанційний запуск двигуна", group: "Салон та комфорт" },
  { id: 587, v2: 78, label: "Доводчик дверей", group: "Салон та комфорт" },
  { id: 594, v2: 84, label: "Електронна приладова панель", group: "Салон та комфорт" },
  { id: 583, v2: 74, label: "Електропривід дзеркал", group: "Салон та комфорт" },
  { id: 629, v2: 116, label: "Електропривід кришки багажника", group: "Салон та комфорт" },
  { id: 576, v2: 68, label: "Електрорегулювання керма", group: "Салон та комфорт" },
  { id: 584, v2: 75, label: "Електроскладання дзеркал", group: "Салон та комфорт" },
  { id: 525, v2: 28, label: "Запуск двигуна з кнопки", group: "Салон та комфорт" },
  { id: 577, v2: 69, label: "Кермо з пам'яттю положення", group: "Салон та комфорт" },
  { id: 632, label: "Керування жестами", group: "Салон та комфорт" },
  { id: 605, v2: 94, label: "Круїз контроль", group: "Салон та комфорт" },
  { id: 132, v2: 2, label: "Люк", group: "Салон та комфорт" },
  { id: 579, v2: 70, label: "Мультифункціональне кермо", group: "Салон та комфорт" },
  { id: 524, v2: 27, label: "Обігрів керма", group: "Салон та комфорт" },
  { id: 589, v2: 80, label: "Обігрів лобового скла", group: "Салон та комфорт" },
  { id: 555, v2: 51, label: "Оздоблення керма шкірою", group: "Салон та комфорт" },
  { id: 559, v2: 54, label: "Оздоблення стелі чорного кольору", group: "Салон та комфорт" },
  { id: 556, v2: 52, label: "Оздоблення шкірою важеля КПП", group: "Салон та комфорт" },
  { id: 558, v2: 53, label: "Панорамний дах / Лобове скло", group: "Салон та комфорт" },
  { id: 560, v2: 55, label: "Передній центральний підлокітник", group: "Салон та комфорт" },
  { id: 575, v2: 67, label: "Проекційний дисплей", group: "Салон та комфорт" },
  { id: 588, v2: 79, label: "Підкурювач і попільничка", group: "Салон та комфорт" },
  { id: 580, v2: 71, label: "Підрульові пелюстки перемикання передач", group: "Салон та комфорт" },
  { id: 443, v2: 17, label: "Підігрів дзеркал", group: "Салон та комфорт" },
  { id: 586, v2: 77, label: "Регульований педальний вузол", group: "Салон та комфорт" },
  { id: 568, v2: 61, label: "Розетка 12V", group: "Салон та комфорт" },
  { id: 567, v2: 60, label: "Розетка 220V", group: "Салон та комфорт" },
  { id: 581, v2: 72, label: "Сидіння з масажем", group: "Салон та комфорт" },
  { id: 574, v2: 66, label: "Система «старт-стоп»", group: "Салон та комфорт" },
  { id: 572, v2: 65, label: "Система доступу без ключа", group: "Салон та комфорт" },
  { id: 548, v2: 44, label: "Складане заднє сидіння", group: "Салон та комфорт" },
  { id: 554, v2: 50, label: "Складний столик на спинках передніх сидінь", group: "Салон та комфорт" },
  { id: 631, v2: 118, label: "Сонцезахисна шторка на задньому склі", group: "Салон та комфорт" },
  { id: 563, v2: 56, label: "Сонцезахисні шторки в задніх дверях", group: "Салон та комфорт" },
  { id: 486, v2: 22, label: "Тоновані вікна", group: "Салон та комфорт" },
  { id: 550, v2: 46, label: "Третій задній підголівник", group: "Салон та комфорт" },
  { id: 551, v2: 47, label: "Третій ряд сидінь", group: "Салон та комфорт" },
  { id: 549, v2: 45, label: "Функція складання спинки сидіння пасажира", group: "Салон та комфорт" },
  { id: 590, v2: 81, label: "Холодильник", group: "Салон та комфорт" },
  { id: 538, v2: 36, label: "AUX", group: "Мультимедіа" },
  { id: 544, v2: 41, label: "Android Auto", group: "Мультимедіа" },
  { id: 539, v2: 37, label: "Bluetooth", group: "Мультимедіа" },
  { id: 545, v2: 42, label: "CarPlay", group: "Мультимедіа" },
  { id: 633, label: "MirrorLink", group: "Мультимедіа" },
  { id: 540, v2: 38, label: "USB", group: "Мультимедіа" },
  { id: 258, v2: 10, label: "Акустика", group: "Мультимедіа" },
  { id: 534, v2: 34, label: "Аудіопідготовка", group: "Мультимедіа" },
  { id: 543, v2: 40, label: "Голосове керування", group: "Мультимедіа" },
  { id: 536, v2: 35, label: "Мультимедіа система з LCD-екраном", group: "Мультимедіа" },
  { id: 355, v2: 12, label: "Навігаційна система", group: "Мультимедіа" },
  { id: 541, v2: 39, label: "Система мультимедіа для задніх пасажирів", group: "Мультимедіа" },
  { id: 437, v2: 13, label: "Датчик світла", group: "Оптика" },
  { id: 527, v2: 30, label: "Денні ходові вогні", group: "Оптика" },
  { id: 441, v2: 15, label: "Омивач фар", group: "Оптика" },
  { id: 528, v2: 31, label: "Протитуманні фари", group: "Оптика" },
  { id: 531, v2: 32, label: "Система адаптивного освітлення", group: "Оптика" },
  { id: 532, v2: 33, label: "Система управління дальнім світлом", group: "Оптика" },
  { id: 602, v2: 91, label: "Задня камера", group: "Система допомоги при паркуванні" },
  { id: 603, v2: 92, label: "Камера 360", group: "Система допомоги при паркуванні" },
  { id: 598, v2: 88, label: "Парктронік задній", group: "Система допомоги при паркуванні" },
  { id: 192, v2: 5, label: "Парктронік передній", group: "Система допомоги при паркуванні" },
  { id: 601, v2: 90, label: "Передня камера", group: "Система допомоги при паркуванні" },
  { id: 599, v2: 89, label: "Система автоматичного паркування", group: "Система допомоги при паркуванні" },
  { id: 635, label: "Багажник на дах", group: "Кузов" },
  { id: 515, v2: 26, label: "Броньований кузов", group: "Кузов" },
  { id: 552, v2: 48, label: "Довга база", group: "Кузов" },
  { id: 569, v2: 62, label: "Захист картера", group: "Кузов" },
  { id: 570, v2: 63, label: "Захист коробки", group: "Кузов" },
  { id: 553, v2: 49, label: "Кузов MAXI", group: "Кузов" },
  { id: 566, v2: 59, label: "Накладки на пороги", group: "Кузов" },
  { id: 571, v2: 64, label: "Фаркоп", group: "Кузов" },
  { id: 596, v2: 86, label: "Автономний обігрівач webasto", group: "Додаткове обладнання" },
  { id: 645, v2: 144, label: "Адаптивна підвіска", group: "Додаткове обладнання" },
  { id: 246, v2: 8, label: "Газобалонне обладнання (ГБО)", group: "Додаткове обладнання" },
  { id: 640, v2: 127, label: "Кабель зарядки змінним струмом (AC)", group: "Додаткове обладнання" },
  { id: 636, label: "Лебідка", group: "Додаткове обладнання" },
  { id: 638, label: "Ліфтована підвіска", group: "Додаткове обладнання" },
  { id: 526, v2: 29, label: "Пандус для людей з інвалідністю", group: "Додаткове обладнання" },
  { id: 592, v2: 83, label: "Пневмопідвіска", group: "Додаткове обладнання" },
  { id: 502, v2: 25, label: "Ручне керування для людей з інвалідністю", group: "Додаткове обладнання" },
  { id: 637, label: "Шноркель", group: "Додаткове обладнання" },
  { id: 642, v2: 141, label: "Двостороння зарядка (V2H, V2L, V2G)", group: "Енергоефективність" },
  { id: 643, v2: 142, label: "Рекуперація енергії при гальмуванні", group: "Енергоефективність" },
  { id: 644, v2: 143, label: "Рекуперація тепла", group: "Енергоефективність" },
  { id: 641, v2: 140, label: "Температурний менеджмент батареї", group: "Енергоефективність" },
  { id: 639, v2: 126, label: "Тепловий насос", group: "Енергоефективність" },
  { id: 597, label: "Швидка зарядка CHAdeMO", group: "Енергоефективність" },
  { id: 630, v2: 117, label: "Авто в кредиті", group: "Стан" },
  { id: 477, v2: 20, label: "Гаражне зберігання", group: "Стан" },
  { id: 501, v2: 24, label: "Перша реєстрація", group: "Стан" },
  { id: 496, v2: 23, label: "Перший власник", group: "Стан" },
  { id: 484, v2: 21, label: "Сервісна книжка", group: "Стан" },
];

export const SELECTABLE_ID_BASE = 100000;

export const SELECTABLE_OPTIONS: SelectableOption[] = [
  { id: 100135, field: "conditionerType", label: "Кондиціонер", group: "Салон та комфорт", values: [{ id: 1, v2: 30, label: "Кондиціонер" }, { id: 2, v2: 31, label: "Клімат-контроль 1-зонний" }, { id: 3, v2: 32, label: "Клімат-контроль 2-зонний" }, { id: 4, v2: 33, label: "Клімат-контроль багатозонний" }] },
  { id: 100134, field: "windowLifter", label: "Електросклопідйомники", group: "Салон та комфорт", values: [{ id: 1, v2: 27, label: "Передні" }, { id: 2, v2: 28, label: "Передні та задні" }] },
  { id: 100128, field: "interiorMaterials", label: "Матеріали салону", group: "Салон та комфорт", values: [{ id: 1, v2: 1, label: "Тканина" }, { id: 2, v2: 2, label: "Шкіра" }, { id: 3, v2: 3, label: "Велюр" }, { id: 4, v2: 4, label: "Комбінований" }, { id: 5, v2: 5, label: "Штучна шкіра" }, { id: 6, v2: 6, label: "Алькантара" }] },
  { id: 100129, field: "interiorColor", label: "Колір салону", group: "Салон та комфорт", values: [{ id: 1, v2: 8, label: "Світлий" }, { id: 2, v2: 9, label: "Темний" }, { id: 3, v2: 10, label: "Коричневий" }] },
  { id: 100136, field: "powerSteering", label: "Підсилювач керма", group: "Салон та комфорт", values: [{ id: 1, v2: 37, label: "Гідро" }, { id: 2, v2: 38, label: "Електро" }] },
  { id: 100137, field: "steeringWheelAdjustment", label: "Регулювання керма", group: "Салон та комфорт", values: [{ id: 1, v2: 43, label: "По висоті" }, { id: 2, v2: 44, label: "По висоті та по вильоту" }] },
  { id: 100130, field: "seatAdjustment", label: "Регулювання сидінь по висоті", group: "Салон та комфорт", values: [{ id: 1, v2: 11, label: "Ручне регулювання сидіння водія" }, { id: 2, v2: 12, label: "Ручне регулювання передніх сидінь" }, { id: 3, v2: 13, label: "Електрорегулювання сидіння водія" }, { id: 4, v2: 14, label: "Електрорегулювання передніх сидінь" }, { id: 5, v2: 15, label: "Електрорегулювання передніх та задніх сидінь" }] },
  { id: 100133, field: "memorySeatModule", label: "Пам'ять положення сидіння", group: "Салон та комфорт", values: [{ id: 1, v2: 24, label: "Сидіння водія" }, { id: 2, v2: 25, label: "Передні сидіння" }, { id: 3, v2: 26, label: "Передні та задні сидіння" }] },
  { id: 100132, field: "seatHeated", label: "Підігрів сидінь", group: "Салон та комфорт", values: [{ id: 1, v2: 21, label: "Передні сидіння" }, { id: 2, v2: 22, label: "Передні та задні сидіння" }] },
  { id: 100131, field: "seatVentilation", label: "Вентиляція сидінь", group: "Салон та комфорт", values: [{ id: 1, v2: 18, label: "Передні сидіння" }, { id: 2, v2: 19, label: "Передні та задні сидіння" }] },
  { id: 100138, field: "spareWheel", label: "Запасне колесо", group: "Додаткове обладнання", values: [{ id: 1, v2: 46, label: "Повнорозмірне" }, { id: 2, v2: 47, label: "Докатка" }] },
  { id: 100139, field: "headlights", label: "Фари", group: "Оптика", values: [{ id: 1, v2: 49, label: "Ксенонові / Біксенонові" }, { id: 2, v2: 50, label: "Лазерні" }, { id: 3, v2: 51, label: "Світлодіодні" }, { id: 4, v2: 52, label: "Матричні" }, { id: 5, v2: 53, label: "Галогенні" }] },
];

// Fast lookups.
export const BINARY_IDS = new Set<number>(BINARY_OPTIONS.map((o) => o.id));

// classic id → optionsV2 id, for the ad equipment PUT. Omits the classic-only
// options (no v2 equivalent) so callers can treat a miss as "not publishable".
export const BINARY_V2_BY_ID = new Map<number, number>(
  BINARY_OPTIONS.filter((o) => o.v2 !== undefined).map((o) => [o.id, o.v2 as number]),
);
export const SELECTABLE_BY_ID = new Map<number, SelectableOption>(
  SELECTABLE_OPTIONS.map((o) => [o.id, o]),
);

// Every valid optionId (binary + selectable) — used to validate the public
// `?options=` filter so unknown ids are silently dropped.
export const ALL_OPTION_IDS = new Set<number>([
  ...BINARY_OPTIONS.map((o) => o.id),
  ...SELECTABLE_OPTIONS.map((o) => o.id),
]);

// Flat, boolean-only catalog for the public site filter + AI search: selectable
// options collapse to a single "has feature" checkbox (their value enums are
// dropped — buyers filter by presence, not exact value). Grouped in GROUP_ORDER.
export interface FilterOption {
  id: number;
  label: string;
}
export interface FilterGroup {
  group: string;
  options: FilterOption[];
}

export const FILTER_GROUPS: FilterGroup[] = (() => {
  const byGroup = new Map<string, FilterOption[]>();
  for (const g of GROUP_ORDER) byGroup.set(g, []);
  const push = (group: string, opt: FilterOption) => {
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group)!.push(opt);
  };
  for (const o of BINARY_OPTIONS) push(o.group, { id: o.id, label: o.label });
  for (const o of SELECTABLE_OPTIONS) push(o.group, { id: o.id, label: o.label });
  return GROUP_ORDER.filter((g) => (byGroup.get(g)?.length ?? 0) > 0).map((g) => ({
    group: g,
    options: byGroup.get(g)!,
  }));
})();

export interface SelectedOption {
  optionId: number;
  valueId: number | null;
}

// Validate + normalize a client-supplied option selection against the catalog:
// keeps only known binary ids (valueId forced to null) and known selectable ids
// with an allowed valueId; dedupes by optionId. Invalid entries are dropped.
export function normalizeSelectedOptions(input: unknown): SelectedOption[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<number, SelectedOption>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const optionId = Number((raw as { optionId?: unknown }).optionId);
    if (!Number.isInteger(optionId)) continue;
    const selectable = SELECTABLE_BY_ID.get(optionId);
    if (selectable) {
      const valueId = Number((raw as { valueId?: unknown }).valueId);
      if (!selectable.values.some((v) => v.id === valueId)) continue;
      byId.set(optionId, { optionId, valueId });
    } else if (BINARY_IDS.has(optionId)) {
      byId.set(optionId, { optionId, valueId: null });
    }
  }
  return [...byId.values()];
}
