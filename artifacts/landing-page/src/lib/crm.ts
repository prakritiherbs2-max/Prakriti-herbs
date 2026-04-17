export const CRM_POST_URL = "https://api.prakritiherbs.com/api/Indstore";

const MAX_RETRIES    = 2;
const RETRY_DELAY_MS = 800;
const LS_BACKUP_KEY  = "crm_failed_leads";

export class DuplicateOrderError extends Error {
  constructor() {
    super("DUPLICATE_ORDER");
    this.name = "DuplicateOrderError";
  }
}

function getTodayIST(): string {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  const d     = new Date(istMs);
  const pad   = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function hasOrderedToday(mobile: string): boolean {
  try {
    const key = `crm_ordered_${mobile}_${getTodayIST()}`;
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markOrderedToday(mobile: string): void {
  try {
    const key = `crm_ordered_${mobile}_${getTodayIST()}`;
    localStorage.setItem(key, "1");
    console.log("[CRM] Order marked for today:", key);
  } catch (e) {
    console.error("[CRM] Could not mark order in localStorage:", e);
  }
}

export function cleanMobile(raw: string): string | null {
  let num = raw.replace(/\D/g, "");
  if (num.startsWith("91") && num.length === 12) num = num.slice(2);
  if (num.startsWith("0")  && num.length === 11) num = num.slice(1);
  return num.length === 10 ? num : null;
}

export function cleanPincode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : "111111";
}

export function getISTTimestamp(): string {
  const now   = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const ist   = new Date(istMs);
  const pad   = (n: number) => String(n).padStart(2, "0");
  return (
    `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ` +
    `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())} +0530`
  );
}

function saveLeadToLocalStorage(payload: object): void {
  try {
    const existing = JSON.parse(localStorage.getItem(LS_BACKUP_KEY) ?? "[]");
    existing.push({ ...payload, savedAt: new Date().toISOString() });
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(existing));
    console.warn("[CRM] Lead saved to localStorage backup:", payload);
  } catch (lsErr) {
    console.error("[CRM] localStorage backup failed:", lsErr);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptCRM(payload: object): Promise<void> {
  console.log("[CRM] Sending POST →", CRM_POST_URL);
  console.log("[CRM] Payload:", JSON.stringify(payload, null, 2));

  let response: Response;
  try {
    response = await fetch(CRM_POST_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.error("[CRM] Network error (fetch failed):", networkErr);
    throw networkErr;
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = await response.text().catch(() => "(no body)");
  }

  console.log("[CRM] API response status:", response.status, response.statusText);
  console.log("[CRM] API response body:", responseBody);

  if (!response.ok) {
    throw new Error(`CRM API error ${response.status}: ${JSON.stringify(responseBody)}`);
  }

  console.log("[CRM] Request sent successfully");
}

export interface CRMFields {
  name:    string;
  address: string;
  pincode: string;
  Number:  string;
  STATE?:  string;
}

export async function sendLeadToCRM(fields: CRMFields): Promise<void> {
  if (hasOrderedToday(fields.Number)) {
    console.warn("[CRM] Duplicate order blocked for mobile:", fields.Number, "on", getTodayIST());
    throw new DuplicateOrderError();
  }

  const payload: Record<string, string> = {
    name:          fields.name,
    address:       fields.address,
    pincode:       cleanPincode(fields.pincode),
    Number:        fields.Number,
    reason:        "New",
    status:        "New",
    websiteSource: "ind Store",
    date:          getISTTimestamp(),
  };
  if (fields.STATE) payload.STATE = fields.STATE;

  console.log("[CRM] Payload to be sent:", JSON.stringify(payload, null, 2));

  let lastError: Error = new Error("Unknown CRM error");

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      await attemptCRM(payload);
      console.log(`[CRM] Success on attempt ${attempt}`);
      markOrderedToday(fields.Number);
      return;
    } catch (err) {
      lastError = err as Error;
      console.error(`[CRM] Attempt ${attempt}/${MAX_RETRIES + 1} failed:`, lastError.message);

      if (attempt <= MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`[CRM] Retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }

  console.error("[CRM] All retries exhausted. Saving to backup.");
  saveLeadToLocalStorage(payload);
  throw lastError;
}
