// n8n Code node: "Validate & Clean Lead"  (mode: Run Once for Each Item)
// Takes the raw webhook body, cleans it up, and marks whether it's usable.
const b = $json.body ?? $json;                       // Webhook puts the form data in .body
const message = String(b.message ?? '').trim();

// Turn any US phone format into (305) 555-1234; blank if it isn't 10 digits.
let digits = String(b.phone ?? '').replace(/\D/g, '');
if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
const phone = digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : '';

return {
  json: {
    valid: message.length > 0,                       // a blank message can't be triaged
    lead: {
      id: b.id || `lead-${Date.now()}`,
      name: String(b.name ?? '').trim(),
      phone,
      email: b.email || '',
      address: b.address || '',
      message,
      source: b.source || 'webhook',
      receivedAt: b.receivedAt || new Date().toISOString(),
    },
  },
};
