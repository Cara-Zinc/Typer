import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyExt } from "./formats.ts";

describe("classifyExt", () => {
  it("should classify epub extensions", () => {
    assert.deepEqual(classifyExt("epub"), { kind: "epub" });
    assert.deepEqual(classifyExt("EPUB"), { kind: "epub" }); // Case-insensitivity
  });

  it("should classify pdf extensions", () => {
    assert.deepEqual(classifyExt("pdf"), { kind: "pdf" });
    assert.deepEqual(classifyExt("PdF"), { kind: "pdf" }); // Case-insensitivity
  });

  it("should classify markdown extensions", () => {
    assert.deepEqual(classifyExt("md"), { kind: "text", format: "md" });
    assert.deepEqual(classifyExt("MD"), { kind: "text", format: "md" });
    assert.deepEqual(classifyExt("markdown"), { kind: "text", format: "md" });
  });

  it("should classify text extensions", () => {
    assert.deepEqual(classifyExt("txt"), { kind: "text", format: "txt" });
    assert.deepEqual(classifyExt("TXT"), { kind: "text", format: "txt" });
  });

  it("should classify json extensions", () => {
    assert.deepEqual(classifyExt("json"), { kind: "text", format: "json" });
    assert.deepEqual(classifyExt("jSoN"), { kind: "text", format: "json" });
  });

  it("should classify yaml extensions", () => {
    assert.deepEqual(classifyExt("yaml"), { kind: "text", format: "yaml" });
    assert.deepEqual(classifyExt("yml"), { kind: "text", format: "yaml" });
    assert.deepEqual(classifyExt("YML"), { kind: "text", format: "yaml" });
  });

  it("should classify docx extensions", () => {
    assert.deepEqual(classifyExt("docx"), { kind: "docx" });
    assert.deepEqual(classifyExt("DOCX"), { kind: "docx" });
  });

  it("should classify doc extensions", () => {
    assert.deepEqual(classifyExt("doc"), { kind: "doc" });
    assert.deepEqual(classifyExt("DoC"), { kind: "doc" });
  });

  it("should return null for unsupported extensions", () => {
    assert.equal(classifyExt("png"), null);
    assert.equal(classifyExt("zip"), null);
    assert.equal(classifyExt("html"), null);
    assert.equal(classifyExt("js"), null);
    assert.equal(classifyExt("ts"), null);
  });

  it("should return null for empty string", () => {
    assert.equal(classifyExt(""), null);
  });

  it("should return null for space characters", () => {
    assert.equal(classifyExt(" "), null);
  });
});
