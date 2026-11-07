// reply.ts — drafts the text/email back to the customer in THEIR language.
// These are templates on purpose: predictable wording for anything customer-facing.
// The draft is NOT sent automatically — an office manager approves it first.

import type { Lead, Triage } from "./types.ts";
import { translateWindow } from "./schedule.ts";

const BUSINESS = () => process.env.BUSINESS_NAME ?? "Homestead Comfort HVAC";
const PHONE = () => process.env.BUSINESS_PHONE ?? "(305) 555-0142";

export function draftReply(lead: Lead, triage: Triage, timeWindow: string): string {
  const first = (lead.name ?? "").trim().split(/\s+/)[0] || (triage.language === "es" ? "cliente" : "there");
  return triage.language === "es" ? spanish(first, triage, timeWindow) : english(first, triage, timeWindow);
}

function english(name: string, t: Triage, when: string): string {
  if (t.jobType === "gas_or_co_safety") {
    return `Hi ${name}, this is ${BUSINESS()}. If you smell gas or your CO alarm is going off, please leave the house now and call 911 or your gas company from outside. Don't flip switches or use flames. Our on-call tech is on the way, arriving within 2-4 hours. Call us at ${PHONE()} anytime.`;
  }
  if (t.urgency === "emergency") {
    return `Hi ${name}, this is ${BUSINESS()}. We got your message and are treating it as an emergency. Our on-call tech is on the way, arriving within 2-4 hours. We'll text when they're close. Questions? Call ${PHONE()}.`;
  }
  if (t.urgency === "urgent") {
    return `Hi ${name}, thanks for reaching out to ${BUSINESS()}. We can get a tech to you ${lowerFirst(when)}. Reply YES to lock it in, or tell us a better time.`;
  }
  return `Hi ${name}, thanks for contacting ${BUSINESS()}! We'd be glad to help with your ${label(t)}. Our next openings are ${when}. Reply with a day that works and we'll book it.`;
}

function spanish(name: string, t: Triage, when: string): string {
  const cuando = translateWindow(when);
  if (t.jobType === "gas_or_co_safety") {
    return `Hola ${name}, le habla ${BUSINESS()}. Si huele a gas o su alarma de monóxido está sonando, salga de la casa ahora y llame al 911 o a la compañía de gas desde afuera. No use interruptores ni llamas. Nuestro técnico de guardia va en camino y llegará en 2-4 horas. Llámenos al ${PHONE()}.`;
  }
  if (t.urgency === "emergency") {
    return `Hola ${name}, le habla ${BUSINESS()}. Recibimos su mensaje y lo tratamos como emergencia. Nuestro técnico va en camino y llegará en 2-4 horas. Le avisaremos por texto cuando esté cerca. Preguntas: ${PHONE()}.`;
  }
  if (t.urgency === "urgent") {
    return `Hola ${name}, gracias por contactar a ${BUSINESS()}. Podemos enviarle un técnico: ${cuando}. Responda SÍ para confirmar o díganos otra hora.`;
  }
  return `Hola ${name}, ¡gracias por contactar a ${BUSINESS()}! Con gusto le ayudamos. Nuestras próximas citas: ${cuando}. Responda con el día que le convenga y lo agendamos.`;
}

// Friendly wording for each job type in the customer reply.
const FRIENDLY: Partial<Record<Triage["jobType"], string>> = {
  maintenance: "tune-up",
  install_quote: "new system estimate",
  thermostat: "thermostat",
  noise_or_smell: "system check",
  other: "request",
};
const label = (t: Triage) => FRIENDLY[t.jobType] ?? "service call";
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
