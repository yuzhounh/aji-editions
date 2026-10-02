import assert from "node:assert/strict";
import test from "node:test";
import {
  combineIssnParts, formatIssnDisplay, getLegacyFavoriteId,
  getPrimaryIssn, getJcrReleaseYear, normalizeIssnPart, splitIssnDisplay,
} from "@aji/core";

test("blank placeholders never become usable identifiers", () => {
  for (const value of [undefined, null, "", " ", "-", "N/A", "n/a"]) {
    assert.equal(normalizeIssnPart(value), "");
  }
  assert.equal(combineIssnParts(" N/A ", "1234-567X"), "/1234-567X");
  assert.equal(combineIssnParts("-", ""), "");
});

test("print and electronic identifiers keep the same display and primary-ID rules", () => {
  assert.equal(getPrimaryIssn(" 1234-5678 / 8765-432X "), "1234-5678");
  assert.equal(getPrimaryIssn("-/8765-432X"), "8765-432X");
  assert.equal(getPrimaryIssn("N/A/8765-432X"), "8765-432X");
  assert.equal(formatIssnDisplay("/8765-432X"), "8765-432X");
  assert.deepEqual(splitIssnDisplay("1234-5678"), { print: "1234-5678", electronic: "-" });
  assert.equal(formatIssnDisplay("N/A/-"), "-");
});

test("legacy favorites remain byte-for-byte compatible with existing IDs", () => {
  for (const value of ["1234-5678/8765-432X", " 1234-5678 /8765-432X", "/8765-432X", "N/A/-"]) {
    assert.equal(getLegacyFavoriteId(value), value.split("/")[0]);
  }
});

test("JCR release year stays distinct from the IF data year", () => {
  assert.equal(getJcrReleaseYear(2024), 2025);
  assert.equal(getJcrReleaseYear(2025), 2026);
});
