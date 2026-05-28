import { describe, expect, it } from "vitest";

import { resolveLocale } from "@/lib/i18n";

describe("locale matching", () => {
  it("matches English browser locales", () => {
    expect(resolveLocale(["en-US"])).toBe("en");
  });

  it("matches Korean browser locales", () => {
    expect(resolveLocale(["ko-KR"])).toBe("ko");
  });

  it("falls back to English for unsupported locales", () => {
    expect(resolveLocale(["fr-FR", "de-DE"])).toBe("en");
  });
});
