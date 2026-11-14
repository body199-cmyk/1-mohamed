import { normalizeMasterKey } from "../master-data/master-data-validation";

/** Messages are the exact strings consumers display; do not reword without updating tests. */
const MESSAGES = {
  plateRequired: "أدخل رقم اللوحة.",
  plateDuplicate: "اللوحة مسجلة بالفعل. اخترها من القائمة بدل إضافتها مرتين.",
  nameRequired: "أدخل اسم المقاول.",
  nameDuplicate: "الاسم مسجل بالفعل. اختره من القائمة بدل إضافتها مرتين.",
} as const;

export function validateQuickPlate(plate: string, activePlates: readonly string[]): string | null {
  const normalized = normalizeMasterKey(plate);
  if (!normalized) return MESSAGES.plateRequired;
  if (activePlates.some(existing => normalizeMasterKey(existing) === normalized)) return MESSAGES.plateDuplicate;
  return null;
}

export function validateQuickContractorName(name: string, activeNames: readonly string[]): string | null {
  const normalized = normalizeMasterKey(name);
  if (!normalized) return MESSAGES.nameRequired;
  if (activeNames.some(existing => normalizeMasterKey(existing) === normalized)) return MESSAGES.nameDuplicate;
  return null;
}
