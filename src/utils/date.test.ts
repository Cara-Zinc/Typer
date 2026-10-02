import { describe, it } from "node:test";
import * as assert from "node:assert";
import { formatDate } from "./date.ts";

describe("formatDate", () => {
  it("formats valid ISO dates", () => {
    // Using local time string to avoid timezone offset issues when testing local date methods
    assert.strictEqual(formatDate("2023-11-25T12:00:00"), "2023-11-25");
  });

  it("pads single-digit months and days", () => {
    assert.strictEqual(formatDate("2023-09-05T12:00:00"), "2023-09-05");
  });

  it("returns original string for invalid dates", () => {
    assert.strictEqual(formatDate("not-a-date"), "not-a-date");
    assert.strictEqual(formatDate("2023-13-45"), "2023-13-45");
  });

  it("returns original string for empty string", () => {
    assert.strictEqual(formatDate(""), "");
  });
});
