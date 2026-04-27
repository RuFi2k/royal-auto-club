// 18 body parts shared between the create form, the detail view, and the
// downstream public site's crash diagram. Order is meaningful for display.
export const CRASH_BODY_PARTS = [
  "hood", "roof", "trunk",
  "front_bumper", "rear_bumper",
  "front_left", "front_right", "rear_left", "rear_right",
  "left_side", "right_side",
  "windshield", "rear_window",
  "undercarriage", "frame", "engine_bay", "interior", "other",
] as const;

export type CrashBodyPart = (typeof CRASH_BODY_PARTS)[number];

export const CRASH_BODY_PART_LABELS: Record<CrashBodyPart, string> = {
  hood: "Капот", roof: "Дах", trunk: "Багажник",
  front_bumper: "Передній бампер", rear_bumper: "Задній бампер",
  front_left: "Переднє ліве", front_right: "Переднє праве",
  rear_left: "Заднє ліве", rear_right: "Заднє праве",
  left_side: "Ліва сторона", right_side: "Права сторона",
  windshield: "Лобове скло", rear_window: "Заднє скло",
  undercarriage: "Днище", frame: "Рама", engine_bay: "Моторний відсік",
  interior: "Салон", other: "Інше",
};
