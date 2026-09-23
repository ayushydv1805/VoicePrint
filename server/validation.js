export const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;
export const PHONE_E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export function isValidIdempotencyKey(value) {
  return typeof value === "string" && IDEMPOTENCY_KEY_PATTERN.test(value);
}

export function cleanContact(value) {
  const name = typeof value?.name === "string" ? value.name.trim().slice(0, 80) : "";
  const phone = typeof value?.phone_e164 === "string" ? value.phone_e164.trim() : "";
  const relationship = typeof value?.relationship === "string" ? value.relationship.trim().slice(0, 40) : "Other";

  if (!name || !PHONE_E164_PATTERN.test(phone)) return null;

  return { name, phone_e164: phone, relationship: relationship || "Other" };
}

export function cleanLocation(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  const accuracy = Number(value?.accuracy);

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) return null;

  return {
    latitude,
    longitude,
    accuracy_m: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    captured_at: new Date().toISOString(),
  };
}