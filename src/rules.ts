// rules.ts — a keyword "mock AI" that needs no API key.
// It is used (1) when no OPENAI_API_KEY is set, (2) as a fallback when the AI call fails,
// and (3) as a SAFETY GUARDRAIL: gas / carbon monoxide words always force an emergency.

import type { JobType, Language, Triage, Urgency } from "./types.ts";

// Lowercase + strip accents so "calefacción" matches "calefaccion".
export function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const SPANISH_WORDS = [
  "hola", "por favor", "gracias", "no hay", "calefaccion", "aire", "casa", "necesito",
  "funciona", "mantenimiento", "cotizacion", "olor", "manana", "tarde", "bebe", "mi casa", "el aire",
];

export function detectLanguage(text: string): Language {
  const t = normalize(text);
  const hits = SPANISH_WORDS.filter((w) => t.includes(w)).length;
  return hits >= 2 ? "es" : "en";
}

// Each job type has trigger words in English and Spanish. First match wins, so the
// most dangerous problems are listed first. Maintenance sits BEFORE install_quote on
// purpose: "tune-up for my heat pump" is a tune-up, not a sales lead (a test caught this).
const JOB_RULES: { type: JobType; words: string[] }[] = [
  { type: "gas_or_co_safety", words: ["gas smell", "smell gas", "smells like gas", "olor a gas", "huele a gas", "carbon monoxide", "co alarm", "co detector", "monoxido"] },
  { type: "no_heat", words: ["no heat", "not heating", "furnace won't", "furnace wont", "furnace not", "blowing cold", "sin calefaccion", "no hay calefaccion", "no calienta", "heat isn't", "heat is not"] },
  { type: "no_cooling", words: ["no ac", "no a/c", "ac not", "ac isn't", "ac is not", "not cooling", "blowing warm", "blowing hot", "no cool", "sin aire", "no enfria", "aire no", "aire acondicionado no"] },
  { type: "water_leak", words: ["leak", "leaking", "water on the floor", "dripping", "flood", "gotea", "goteando", "fuga de agua", "agua en el piso"] },
  { type: "noise_or_smell", words: ["noise", "loud", "banging", "squeal", "rattle", "burning smell", "ruido", "olor a quemado"] },
  { type: "thermostat", words: ["thermostat", "termostato"] },
  { type: "maintenance", words: ["tune-up", "tune up", "tuneup", "maintenance", "check-up", "checkup", "service plan", "clean", "filter", "mantenimiento", "revision", "limpieza"] },
  { type: "install_quote", words: ["quote", "estimate", "new system", "replace", "replacement", "install", "heat pump", "cotizacion", "presupuesto", "instalar", "sistema nuevo"] },
];

// People who are at higher risk when the house is too hot or too cold.
const VULNERABLE = ["baby", "infant", "newborn", "elderly", "grandma", "grandmother", "grandpa", "oxygen", "medical", "pregnant", "bebe", "abuela", "abuelo", "anciano", "embarazada"];

const EQUIPMENT = ["heat pump", "furnace", "mini split", "mini-split", "boiler", "air handler", "condenser", "package unit", "window unit", "bomba de calor", "minisplit"];

export function classifyWithRules(message: string): Triage {
  const t = normalize(message);
  const language = detectLanguage(message);

  const match = JOB_RULES.find((rule) => rule.words.some((w) => t.includes(w)));
  const jobType: JobType = match ? match.type : "other";
  const vulnerable = VULNERABLE.some((w) => t.includes(w));

  // Decide urgency from the job type, then bump it up if someone vulnerable is in the home.
  let urgency: Urgency;
  if (jobType === "gas_or_co_safety") urgency = "emergency";
  else if (jobType === "no_heat" || jobType === "no_cooling") urgency = vulnerable ? "emergency" : "urgent";
  else if (jobType === "water_leak") urgency = "urgent";
  else urgency = "routine";

  const equipment = EQUIPMENT.find((e) => t.includes(e));

  // Pull out simple timing hints like "tomorrow morning" or "after 3pm".
  const timeMatch = message.match(/\b(today|tonight|tomorrow( morning| afternoon)?|this weekend|after \d{1,2}\s?(am|pm)|before \d{1,2}\s?(am|pm)|hoy|manana|mañana|esta noche|fin de semana)\b/i);

  return {
    urgency,
    jobType,
    language,
    summary: buildSummary(jobType, urgency, equipment, vulnerable),
    equipment,
    preferredTime: timeMatch ? timeMatch[0] : undefined,
    // Rules are confident when a keyword matched, unsure when nothing did.
    confidence: match ? 0.75 : 0.3,
    classifiedBy: "rules",
  };
}

function buildSummary(jobType: JobType, urgency: Urgency, equipment?: string, vulnerable?: boolean): string {
  const label = jobType.replace(/_/g, " ");
  return `${urgency.toUpperCase()}: ${label}${equipment ? ` (${equipment})` : ""}${vulnerable ? " — vulnerable person in home" : ""}`;
}

/** True if the text mentions gas or carbon monoxide. Used as a guardrail on top of the AI. */
export function isSafetyHazard(message: string): boolean {
  const t = normalize(message);
  return JOB_RULES[0].words.some((w) => t.includes(w));
}
