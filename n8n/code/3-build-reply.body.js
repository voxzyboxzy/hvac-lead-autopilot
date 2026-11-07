// n8n Code node: "Time Window, Review Checks & Reply Draft"  (mode: Run Once for Each Item)
// estimateTimeWindow, scheduleInstant, and translateWindow are prepended from src/schedule-core.js.
const { lead, triage } = $json;
const BUSINESS = 'Homestead Comfort HVAC';   // <- change to the real company name
const PHONE = '(305) 555-0142';              // <- and phone number
const now = scheduleInstant(lead);
const es = triage.language === 'es';
const timeWindow = estimateTimeWindow(triage.urgency, now);
const spoken = es ? translateWindow(timeWindow) : timeWindow;
const inline = spoken.charAt(0).toLowerCase() + spoken.slice(1);

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
    ? `Hola ${name}, gracias por contactar a ${BUSINESS}. Podemos enviarle un técnico ${inline}. Responda SÍ para confirmar.`
    : `Hi ${name}, thanks for contacting ${BUSINESS}. We can get a tech to you ${inline}. Reply YES to lock it in.`;
} else {
  replyDraft = es
    ? `Hola ${name}, ¡gracias por contactar a ${BUSINESS}! Próximas citas: ${spoken}. Responda con el día que le convenga.`
    : `Hi ${name}, thanks for contacting ${BUSINESS}! Our next openings are ${spoken}. Reply with a day that works and we'll book it.`;
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
