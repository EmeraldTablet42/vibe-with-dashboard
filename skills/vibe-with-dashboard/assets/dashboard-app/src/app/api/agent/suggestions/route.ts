import { NextResponse } from "next/server";
import { z } from "zod";

import { replaceDuckSuggestions } from "@/lib/db/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const translationSchema = z.record(
  z.string(),
  z.object({
    keyword: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    detail: z.string().optional(),
    actionPrompt: z.string().optional(),
  })
);

const suggestionSchema = z.object({
  keyword: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(""),
  detail: z.string().default(""),
  actionPrompt: z.string().default(""),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  source: z.string().min(1).optional(),
  translations: translationSchema.optional(),
});

const suggestionsSchema = z.object({
  source: z.string().min(1).default("agent"),
  suggestions: z.array(suggestionSchema).max(5).default([]),
});

export async function POST(request: Request) {
  const input = suggestionsSchema.parse(await request.json());
  const result = replaceDuckSuggestions(input);
  return NextResponse.json({ ok: true, result }, { status: 201 });
}
