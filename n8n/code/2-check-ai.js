// n8n Code node: "Check AI Answer (fallback + safety guardrail)"  (mode: Run Once for Each Item)
// 1) Use the AI's JSON if it passes validation.  2) Otherwise fall back to keyword rules.
// 3) Gas / CO words ALWAYS force an emergency, whatever the AI said.
const lead = $('Validate & Clean Lead').item.json.lead;
const text = lead.message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const URGENCIES = ['emergency', 'urgent', 'routine'];
const JOB_TYPES = ['no_heat', 'no_cooling', 'gas_or_co_safety', 'water_leak', 'noise_or_smell', 'thermostat', 'maintenance', 'install_quote', 'other'];
const GAS = ['gas smell', 'smell gas', 'smells like gas', 'olor a gas', 'huele a gas', 'carbon monoxide', 'co alarm', 'co detector', 'monoxido'];

function rules() {
  const RULES = [
    ['gas_or_co_safety', GAS],
    ['no_heat', ['no heat', 'not heating', 'blowing cold', 'sin calefaccion', 'no hay calefaccion', 'no calienta']],
    ['no_cooling', ['no ac', 'ac not', 'not cooling', 'blowing warm', 'blowing hot', 'sin aire', 'no enfria', 'aire no']],
    ['water_leak', ['leak', 'dripping', 'flood', 'gotea', 'fuga de agua']],
    ['noise_or_smell', ['noise', 'loud', 'banging', 'squeal', 'rattle', 'burning smell', 'ruido']],
    ['thermostat', ['thermostat', 'termostato']],
    ['maintenance', ['tune-up', 'tune up', 'maintenance', 'checkup', 'clean', 'filter', 'mantenimiento', 'limpieza']],
    ['install_quote', ['quote', 'estimate', 'new system', 'replace', 'install', 'heat pump', 'cotizacion', 'presupuesto']],
  ];
  const hit = RULES.find(([, words]) => words.some((w) => text.includes(w)));
  const jobType = hit ? hit[0] : 'other';
  const vulnerable = ['baby', 'elderly', 'grandma', 'oxygen', 'medical', 'bebe', 'abuela', 'anciano'].some((w) => text.includes(w));
  let urgency = 'routine';
  if (jobType === 'gas_or_co_safety') urgency = 'emergency';
  else if (jobType === 'no_heat' || jobType === 'no_cooling') urgency = vulnerable ? 'emergency' : 'urgent';
  else if (jobType === 'water_leak') urgency = 'urgent';
  const es = ['hola', 'por favor', 'gracias', 'no hay', 'aire', 'necesito', 'funciona', 'mi casa'].filter((w) => text.includes(w)).length >= 2;
  return { urgency, jobType, language: es ? 'es' : 'en', summary: `${urgency.toUpperCase()}: ${jobType.replace(/_/g, ' ')}${vulnerable ? ' — vulnerable person in home' : ''}`, confidence: hit ? 0.75 : 0.3 };
}

let triage;
let classifiedBy;
try {
  // If the AI node is deactivated, its input passes straight through (no "choices") — that's normal rules mode.
  if (!$json.choices && $json.valid !== undefined) throw new Error('AI node off');
  const ai = JSON.parse($json.choices[0].message.content);
  if (!URGENCIES.includes(ai.urgency) || !JOB_TYPES.includes(ai.jobType) || !['en', 'es'].includes(ai.language)) {
    throw new Error('AI answer failed validation');
  }
  triage = { ...ai, confidence: Math.min(1, Math.max(0, Number(ai.confidence) || 0.5)) };
  classifiedBy = 'llm';
} catch (err) {
  triage = rules();
  classifiedBy = err.message === 'AI node off' ? 'rules' : 'rules-fallback';
}

// SAFETY GUARDRAIL
if (GAS.some((w) => text.includes(w))) {
  triage.urgency = 'emergency';
  triage.jobType = 'gas_or_co_safety';
}

return { json: { lead, triage: { ...triage, classifiedBy } } };
