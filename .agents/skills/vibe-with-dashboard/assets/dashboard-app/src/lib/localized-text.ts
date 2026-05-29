import type { LocaleTranslations } from "@/lib/types";

export function pickLocalizedText(
  entity: { translations?: LocaleTranslations },
  locale: string,
  field: keyof LocaleTranslations[string],
  fallback = ""
) {
  const translated = entity.translations?.[locale]?.[field];
  const english = entity.translations?.en?.[field];
  return translated?.trim() || english?.trim() || fallback;
}
