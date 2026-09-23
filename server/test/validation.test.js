import test from "node:test";
import assert from "node:assert/strict";
import { cleanContact, cleanLocation, isValidIdempotencyKey } from "../validation.js";

test("accepts valid E.164 phone numbers", () => {
  assert.deepEqual(cleanContact({ name: "Mom", phone_e164: "+919876543210", relationship: "Family" }), {
    name: "Mom", phone_e164: "+919876543210", relationship: "Family",
  });
});

test("rejects malformed phone numbers and empty names", () => {
  assert.equal(cleanContact({ name: "", phone_e164: "+919876543210" }), null);
  assert.equal(cleanContact({ name: "Mom", phone_e164: "9876543210" }), null);
  assert.equal(cleanContact({ name: "Mom", phone_e164: "+0000000000" }), null);
});

test("accepts only bounded idempotency keys", () => {
  assert.equal(isValidIdempotencyKey("12345678"), true);
  assert.equal(isValidIdempotencyKey("sos:key_2026"), true);
  assert.equal(isValidIdempotencyKey("short"), false);
  assert.equal(isValidIdempotencyKey("bad key 123"), false);
});

test("validates location bounds and normalizes accuracy", () => {
  const result = cleanLocation({ latitude: 30.7046, longitude: 76.7179, accuracy: "12.5" });
  assert.equal(result.latitude, 30.7046);
  assert.equal(result.longitude, 76.7179);
  assert.equal(result.accuracy_m, 12.5);
  assert.match(result.captured_at, /^20\d{2}-\d{2}-\d{2}T/);
});

test("rejects invalid location coordinates", () => {
  assert.equal(cleanLocation({ latitude: 91, longitude: 76 }), null);
  assert.equal(cleanLocation({ latitude: 30, longitude: 181 }), null);
  assert.equal(cleanLocation({ latitude: "abc", longitude: 76 }), null);
});
test("normalizes optional contact fields safely", () => {
  const result = cleanContact({
    name: "  Emergency Contact  ".repeat(10),
    phone_e164: " +919876543210 ",
    relationship: " ",
  });
  assert.equal(result.phone_e164, "+919876543210");
  assert.equal(result.relationship, "Other");
  assert.ok(result.name.length <= 80);
});

test("drops non-finite location accuracy", () => {
  const result = cleanLocation({ latitude: 0, longitude: 0, accuracy: "Infinity" });
  assert.equal(result.accuracy_m, null);
});
