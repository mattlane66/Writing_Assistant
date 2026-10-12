export const MAX_IMPORT_BYTES = 16_000_000;
export async function readPrivateJson(file: File) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Choose a JSON file smaller than 16 MB. Nothing was imported.");
  try { return JSON.parse(await file.text()) as unknown; } catch { throw new Error("The selected file is not valid JSON. Your current workspace is unchanged."); }
}
export async function reviewRequest<T>(token: string, operation: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/review/${operation}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Review-Token": token }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error("The record was not accepted. Check the current fingerprint, complete criteria, human attestation and whether a review is already locked. Private text is not shown in errors.");
  return response.json() as Promise<T>;
}
export function downloadPrivateJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function hashReview(value: unknown) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, "0")).join("");
}
