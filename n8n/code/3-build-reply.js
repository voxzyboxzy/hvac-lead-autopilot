// n8n Code node: "Time Window, Review Checks & Reply Draft"  (mode: Run Once for Each Item)
const { lead, triage } = $json;
const BUSINESS = 'Homestead Comfort HVAC';   // <- change to the real company name
const PHONE = '(305) 555-0142';              // <- and phone number
const now = new Date(lead.receivedAt);
const es = triage.language === 'es';

// --- Time window ---
function addBusinessDays(from, n) {
  const d = new Date(from);
  while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
  return d.toLocaleDateString(es ? 'es-US' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
let timeWindow;
if (triage.urgency === 'emergency') timeWindow = es ? 'hoy, llegada en 2-4 horas' : 'today, arriving within 2-4 hours';
else if (triage.urgency === 'urgent') timeWindow = now.getHours() < 14 ? (es ? 'hoy en la tarde (12pm-6pm)' : 'today, afternoon slot (12pm-6pm)') : (es ? 'mañana temprano (8am-11am)' : 'tomorrow, first morning slot (8am-11am)');
else timeWindow = `${addBusinessDays(now, 2)} - ${addBusinessDays(now, 5)}`;

// --- When should a person check before anything goes out? ---
const reviewReasons = [];
if (triage.confidence < 0.6) reviewReasons.push('low AI confidence');
if (!lead.phone && !lead.email) reviewReasons.push('no way to contact customer');
if (!lead.address && triage.urgency !== 'routine') reviewReasons.push('no address for a dispatch');
if (triage.classifiedBy === 'rules-fallback') reviewReasons.push('AI was down, rules were used');
if (triage.jobType === 'install_quote') reviewReasons.push('sales lead — owner sets the quote');

// --- Reply draft (NOT sent automatically) ---
const name = lead.name.split(' ')[0] || (es ? 'cliente' : 'there');
let replyDraft;
if (triage.jobType === 'gas_or_co_safety') {
  replyDraft = es
    ? `Hola ${name}, le habla ${BUSINESS}. Si huele a gas o su alarma de monóxido suena, salga de la casa ahora y llame al 911 o a la compañía de gas desde afuera. Nuestro técnico llegará en 2-4 horas. ${PHONE}`
    : `Hi ${name}, this is ${BUSINESS}. If you smell gas or your CO alarm is going off, leave the house now and call 911 or your gas company from outside. Our on-call tech is arriving within 2-4 hours. ${PHONE}`;
} else if (triage.urgency === 'emergency') {
  replyDraft = es
    ? `Hola ${name}, le habla ${BUSINESS}. Tratamos su caso como emergencia: nuestro técnico llegará en 2-4 horas. Preguntas: ${PHONE}.`
    : `Hi ${name}, this is ${BUSINESS}. We're treating this as an emergency — our on-call tech is arriving within 2-4 hours. Questions? ${PHONE}.`;
} else if (triage.urgency === 'urgent') {
  replyDraft = es
    ? `Hola ${name}, gracias por contactar a ${BUSINESS}. Podemos enviarle un técnico ${timeWindow}. Responda SÍ para confirmar.`
    : `Hi ${name}, thanks for contacting ${BUSINESS}. We can get a tech to you ${timeWindow}. Reply YES to lock it in.`;
} else {
  replyDraft = es
    ? `Hola ${name}, ¡gracias por contactar a ${BUSINESS}! Próximas citas: ${timeWindow}. Responda con el día que le convenga.`
    : `Hi ${name}, thanks for contacting ${BUSINESS}! Our next openings are ${timeWindow}. Reply with a day that works and we'll book it.`;
}

const icon = triage.urgency === 'emergency' ? '🚨' : triage.urgency === 'urgent' ? '⚠️' : '🗓️';
const techAlert = `${icon} ${triage.summary}\nCustomer: ${lead.name || 'unknown'} | ${lead.phone || 'no phone'} | ${lead.address || 'no address'}\nWindow: ${timeWindow}\nSpeaks: ${es ? 'Spanish' : 'English'}${reviewReasons.length ? ' | NEEDS OFFICE REVIEW: ' + reviewReasons.join('; ') : ''}`;

// Flat row for the Google Sheet "mini CRM" (column names = sheet headers)
return {
  json: {
    lead_id: lead.id, received_at: lead.receivedAt, name: lead.name, phone: lead.phone, email: lead.email, address: lead.address,
    message: lead.message, language: triage.language, urgency: triage.urgency, job_type: triage.jobType, summary: triage.summary,
    time_window: timeWindow, needs_review: reviewReasons.length ? 'YES' : 'no', review_reasons: reviewReasons.join('; '),
    classified_by: triage.classifiedBy, confidence: triage.confidence, reply_draft: replyDraft,
    status: reviewReasons.length ? 'waiting for office review' : 'reply ready to send',
    tech_alert: techAlert,
  },
};
