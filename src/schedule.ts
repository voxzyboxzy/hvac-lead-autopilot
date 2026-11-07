// schedule.ts — time windows the office can promise.
// The rules live in schedule-core.js. The n8n Code node runs that same file
// (n8n/build-workflow.mjs copies it in) so the CLI and the workflow cannot
// schedule different days for the same lead.

export { estimateTimeWindow, scheduleInstant, translateWindow, SHOP_TIME_ZONE } from "./schedule-core.js";
