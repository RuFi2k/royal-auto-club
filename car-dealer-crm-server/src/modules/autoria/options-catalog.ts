// AUTO.RIA option catalog for passenger cars (category 1).
// Verified live against the developer API (2026-07-13):
//  - BINARY options come from GET /auto/categories/1/options ({name,value}); they
//    are published in the `options:[{id}]` array. (The newer optionsV2 catalog is
//    NOT accepted by the publish API — do not use those ids.)
//  - SELECTABLE options are separate ad-payload fields (e.g. seatHeated:{id}) with
//    the 1-based value enums from the add-ad spec (parameter_structure).
// GENERATED — regenerate rather than hand-edit when AUTO.RIA changes the catalog.

export interface BinaryOption {
  id: number;
  label: string;
  group: string;
}

export interface SelectableValue {
  id: number;
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
  { id: 604, label: "Імобілайзер", group: "Безпека" },
  { id: 217, label: "Антиблокувальна система (ABS)", group: "Безпека" },
  { id: 606, label: "Антипробуксовочна система (ASR)", group: "Безпека" },
  { id: 622, label: "Блокування замків задніх дверей", group: "Безпека" },
  { id: 617, label: "Датчик втоми водія", group: "Безпека" },
  { id: 623, label: "Датчик проникнення в салон (датчик об`єму)", group: "Безпека" },
  { id: 620, label: "Датчик тиску в шинах", group: "Безпека" },
  { id: 611, label: "Допомога при спуску", group: "Безпека" },
  { id: 609, label: "Допомога при старті в гору", group: "Безпека" },
  { id: 612, label: "Запобігання зіткнення", group: "Безпека" },
  { id: 616, label: "Контроль за смугою руху", group: "Безпека" },
  { id: 615, label: "Контроль сліпих зон", group: "Безпека" },
  { id: 619, label: "Нічне бачення", group: "Безпека" },
  { id: 608, label: "Розподіл гальмівних зусиль (BAS, EBD)", group: "Безпека" },
  { id: 618, label: "Розпізнавання дорожніх знаків", group: "Безпека" },
  { id: 303, label: "Сигналізація", group: "Безпека" },
  { id: 621, label: "Система кріплення IsoFix", group: "Безпека" },
  { id: 459, label: "Система стабілізації (ESP)", group: "Безпека" },
  { id: 607, label: "Стабілізація рульового управління (VSM)", group: "Безпека" },
  { id: 137, label: "Центральний замок", group: "Безпека" },
  { id: 626, label: "Бічні задні", group: "Подушка безпеки" },
  { id: 625, label: "Бічні передні", group: "Подушка безпеки" },
  { id: 211, label: "Водія", group: "Подушка безпеки" },
  { id: 627, label: "Віконні (шторки)", group: "Подушка безпеки" },
  { id: 628, label: "Колін водія", group: "Подушка безпеки" },
  { id: 624, label: "Пасажира", group: "Подушка безпеки" },
  { id: 634, label: "Центральна подушка між водієм та пасажиром", group: "Подушка безпеки" },
  { id: 591, label: "Адаптивний круїз", group: "Салон та комфорт" },
  { id: 585, label: "Бардачок з охолодженням", group: "Салон та комфорт" },
  { id: 546, label: "Бездротова зарядка для смартфону", group: "Салон та комфорт" },
  { id: 188, label: "Бортовий комп'ютер", group: "Салон та комфорт" },
  { id: 610, label: "Вибір режиму руху", group: "Салон та комфорт" },
  { id: 582, label: "Відкриття багажника без допомоги рук", group: "Салон та комфорт" },
  { id: 255, label: "Датчик дощу", group: "Салон та комфорт" },
  { id: 564, label: "Декоративне підсвічування салону", group: "Салон та комфорт" },
  { id: 565, label: "Декоративні накладки на педалі", group: "Салон та комфорт" },
  { id: 595, label: "Дистанційний запуск двигуна", group: "Салон та комфорт" },
  { id: 587, label: "Доводчик дверей", group: "Салон та комфорт" },
  { id: 594, label: "Електронна приладова панель", group: "Салон та комфорт" },
  { id: 583, label: "Електропривід дзеркал", group: "Салон та комфорт" },
  { id: 629, label: "Електропривід кришки багажника", group: "Салон та комфорт" },
  { id: 576, label: "Електрорегулювання керма", group: "Салон та комфорт" },
  { id: 584, label: "Електроскладання дзеркал", group: "Салон та комфорт" },
  { id: 525, label: "Запуск двигуна з кнопки", group: "Салон та комфорт" },
  { id: 577, label: "Кермо з пам'яттю положення", group: "Салон та комфорт" },
  { id: 632, label: "Керування жестами", group: "Салон та комфорт" },
  { id: 605, label: "Круїз контроль", group: "Салон та комфорт" },
  { id: 132, label: "Люк", group: "Салон та комфорт" },
  { id: 579, label: "Мультифункціональне кермо", group: "Салон та комфорт" },
  { id: 524, label: "Обігрів керма", group: "Салон та комфорт" },
  { id: 589, label: "Обігрів лобового скла", group: "Салон та комфорт" },
  { id: 555, label: "Оздоблення керма шкірою", group: "Салон та комфорт" },
  { id: 559, label: "Оздоблення стелі чорного кольору", group: "Салон та комфорт" },
  { id: 556, label: "Оздоблення шкірою важеля КПП", group: "Салон та комфорт" },
  { id: 558, label: "Панорамний дах / Лобове скло", group: "Салон та комфорт" },
  { id: 560, label: "Передній центральний підлокітник", group: "Салон та комфорт" },
  { id: 575, label: "Проекційний дисплей", group: "Салон та комфорт" },
  { id: 588, label: "Підкурювач і попільничка", group: "Салон та комфорт" },
  { id: 580, label: "Підрульові пелюстки перемикання передач", group: "Салон та комфорт" },
  { id: 443, label: "Підігрів дзеркал", group: "Салон та комфорт" },
  { id: 586, label: "Регульований педальний вузол", group: "Салон та комфорт" },
  { id: 568, label: "Розетка 12V", group: "Салон та комфорт" },
  { id: 567, label: "Розетка 220V", group: "Салон та комфорт" },
  { id: 581, label: "Сидіння з масажем", group: "Салон та комфорт" },
  { id: 574, label: "Система «старт-стоп»", group: "Салон та комфорт" },
  { id: 572, label: "Система доступу без ключа", group: "Салон та комфорт" },
  { id: 548, label: "Складане заднє сидіння", group: "Салон та комфорт" },
  { id: 554, label: "Складний столик на спинках передніх сидінь", group: "Салон та комфорт" },
  { id: 631, label: "Сонцезахисна шторка на задньому склі", group: "Салон та комфорт" },
  { id: 563, label: "Сонцезахисні шторки в задніх дверях", group: "Салон та комфорт" },
  { id: 486, label: "Тоновані вікна", group: "Салон та комфорт" },
  { id: 550, label: "Третій задній підголівник", group: "Салон та комфорт" },
  { id: 551, label: "Третій ряд сидінь", group: "Салон та комфорт" },
  { id: 549, label: "Функція складання спинки сидіння пасажира", group: "Салон та комфорт" },
  { id: 590, label: "Холодильник", group: "Салон та комфорт" },
  { id: 538, label: "AUX", group: "Мультимедіа" },
  { id: 544, label: "Android Auto", group: "Мультимедіа" },
  { id: 539, label: "Bluetooth", group: "Мультимедіа" },
  { id: 545, label: "CarPlay", group: "Мультимедіа" },
  { id: 633, label: "MirrorLink", group: "Мультимедіа" },
  { id: 540, label: "USB", group: "Мультимедіа" },
  { id: 258, label: "Акустика", group: "Мультимедіа" },
  { id: 534, label: "Аудіопідготовка", group: "Мультимедіа" },
  { id: 543, label: "Голосове керування", group: "Мультимедіа" },
  { id: 536, label: "Мультимедіа система з LCD-екраном", group: "Мультимедіа" },
  { id: 355, label: "Навігаційна система", group: "Мультимедіа" },
  { id: 541, label: "Система мультимедіа для задніх пасажирів", group: "Мультимедіа" },
  { id: 437, label: "Датчик світла", group: "Оптика" },
  { id: 527, label: "Денні ходові вогні", group: "Оптика" },
  { id: 441, label: "Омивач фар", group: "Оптика" },
  { id: 528, label: "Протитуманні фари", group: "Оптика" },
  { id: 531, label: "Система адаптивного освітлення", group: "Оптика" },
  { id: 532, label: "Система управління дальнім світлом", group: "Оптика" },
  { id: 602, label: "Задня камера", group: "Система допомоги при паркуванні" },
  { id: 603, label: "Камера 360", group: "Система допомоги при паркуванні" },
  { id: 598, label: "Парктронік задній", group: "Система допомоги при паркуванні" },
  { id: 192, label: "Парктронік передній", group: "Система допомоги при паркуванні" },
  { id: 601, label: "Передня камера", group: "Система допомоги при паркуванні" },
  { id: 599, label: "Система автоматичного паркування", group: "Система допомоги при паркуванні" },
  { id: 635, label: "Багажник на дах", group: "Кузов" },
  { id: 515, label: "Броньований кузов", group: "Кузов" },
  { id: 552, label: "Довга база", group: "Кузов" },
  { id: 569, label: "Захист картера", group: "Кузов" },
  { id: 570, label: "Захист коробки", group: "Кузов" },
  { id: 553, label: "Кузов MAXI", group: "Кузов" },
  { id: 566, label: "Накладки на пороги", group: "Кузов" },
  { id: 571, label: "Фаркоп", group: "Кузов" },
  { id: 596, label: "Автономний обігрівач webasto", group: "Додаткове обладнання" },
  { id: 645, label: "Адаптивна підвіска", group: "Додаткове обладнання" },
  { id: 246, label: "Газобалонне обладнання (ГБО)", group: "Додаткове обладнання" },
  { id: 640, label: "Кабель зарядки змінним струмом (AC)", group: "Додаткове обладнання" },
  { id: 636, label: "Лебідка", group: "Додаткове обладнання" },
  { id: 638, label: "Ліфтована підвіска", group: "Додаткове обладнання" },
  { id: 526, label: "Пандус для людей з інвалідністю", group: "Додаткове обладнання" },
  { id: 592, label: "Пневмопідвіска", group: "Додаткове обладнання" },
  { id: 502, label: "Ручне керування для людей з інвалідністю", group: "Додаткове обладнання" },
  { id: 637, label: "Шноркель", group: "Додаткове обладнання" },
  { id: 642, label: "Двостороння зарядка (V2H, V2L, V2G)", group: "Енергоефективність" },
  { id: 643, label: "Рекуперація енергії при гальмуванні", group: "Енергоефективність" },
  { id: 644, label: "Рекуперація тепла", group: "Енергоефективність" },
  { id: 641, label: "Температурний менеджмент батареї", group: "Енергоефективність" },
  { id: 639, label: "Тепловий насос", group: "Енергоефективність" },
  { id: 597, label: "Швидка зарядка CHAdeMO", group: "Енергоефективність" },
  { id: 630, label: "Авто в кредиті", group: "Стан" },
  { id: 477, label: "Гаражне зберігання", group: "Стан" },
  { id: 501, label: "Перша реєстрація", group: "Стан" },
  { id: 496, label: "Перший власник", group: "Стан" },
  { id: 484, label: "Сервісна книжка", group: "Стан" },
];

export const SELECTABLE_ID_BASE = 100000;

export const SELECTABLE_OPTIONS: SelectableOption[] = [
  { id: 100135, field: "conditionerType", label: "Кондиціонер", group: "Салон та комфорт", values: [{ id: 1, label: "Кондиціонер" }, { id: 2, label: "Клімат-контроль 1-зонний" }, { id: 3, label: "Клімат-контроль 2-зонний" }, { id: 4, label: "Клімат-контроль багатозонний" }] },
  { id: 100134, field: "windowLifter", label: "Електросклопідйомники", group: "Салон та комфорт", values: [{ id: 1, label: "Передні" }, { id: 2, label: "Передні та задні" }] },
  { id: 100128, field: "interiorMaterials", label: "Матеріали салону", group: "Салон та комфорт", values: [{ id: 1, label: "Тканина" }, { id: 2, label: "Шкіра" }, { id: 3, label: "Велюр" }, { id: 4, label: "Комбінований" }, { id: 5, label: "Штучна шкіра" }, { id: 6, label: "Алькантара" }] },
  { id: 100129, field: "interiorColor", label: "Колір салону", group: "Салон та комфорт", values: [{ id: 1, label: "Світлий" }, { id: 2, label: "Темний" }, { id: 3, label: "Коричневий" }] },
  { id: 100136, field: "powerSteering", label: "Підсилювач керма", group: "Салон та комфорт", values: [{ id: 1, label: "Гідро" }, { id: 2, label: "Електро" }] },
  { id: 100137, field: "steeringWheelAdjustment", label: "Регулювання керма", group: "Салон та комфорт", values: [{ id: 1, label: "По висоті" }, { id: 2, label: "По висоті та по вильоту" }] },
  { id: 100130, field: "seatAdjustment", label: "Регулювання сидінь по висоті", group: "Салон та комфорт", values: [{ id: 1, label: "Ручне регулювання сидіння водія" }, { id: 2, label: "Ручне регулювання передніх сидінь" }, { id: 3, label: "Електрорегулювання сидіння водія" }, { id: 4, label: "Електрорегулювання передніх сидінь" }, { id: 5, label: "Електрорегулювання передніх та задніх сидінь" }] },
  { id: 100133, field: "memorySeatModule", label: "Пам'ять положення сидіння", group: "Салон та комфорт", values: [{ id: 1, label: "Сидіння водія" }, { id: 2, label: "Передні сидіння" }, { id: 3, label: "Передні та задні сидіння" }] },
  { id: 100132, field: "seatHeated", label: "Підігрів сидінь", group: "Салон та комфорт", values: [{ id: 1, label: "Передні сидіння" }, { id: 2, label: "Передні та задні сидіння" }] },
  { id: 100131, field: "seatVentilation", label: "Вентиляція сидінь", group: "Салон та комфорт", values: [{ id: 1, label: "Передні сидіння" }, { id: 2, label: "Передні та задні сидіння" }] },
  { id: 100138, field: "spareWheel", label: "Запасне колесо", group: "Додаткове обладнання", values: [{ id: 1, label: "Повнорозмірне" }, { id: 2, label: "Докатка" }] },
  { id: 100139, field: "headlights", label: "Фари", group: "Оптика", values: [{ id: 1, label: "Ксенонові / Біксенонові" }, { id: 2, label: "Лазерні" }, { id: 3, label: "Світлодіодні" }, { id: 4, label: "Матричні" }, { id: 5, label: "Галогенні" }] },
];

// Fast lookups.
export const BINARY_IDS = new Set<number>(BINARY_OPTIONS.map((o) => o.id));
export const SELECTABLE_BY_ID = new Map<number, SelectableOption>(
  SELECTABLE_OPTIONS.map((o) => [o.id, o]),
);

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
