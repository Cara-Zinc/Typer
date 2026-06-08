import { describe, it, expect } from "vitest";
import { classifyExt } from "./formats";

describe("classifyExt", () => {
  it("should classify epub extensions", () => {
    expect(classifyExt("epub")).toEqual({ kind: "epub" });
    expect(classifyExt("EPUB")).toEqual({ kind: "epub" }); // Case-insensitivity
  });

  it("should classify pdf extensions", () => {
    expect(classifyExt("pdf")).toEqual({ kind: "pdf" });
    expect(classifyExt("PdF")).toEqual({ kind: "pdf" }); // Case-insensitivity
  });

  it("should classify markdown extensions", () => {
    expect(classifyExt("md")).toEqual({ kind: "text", format: "md" });
    expect(classifyExt("MD")).toEqual({ kind: "text", format: "md" });
    expect(classifyExt("markdown")).toEqual({ kind: "text", format: "md" });
  });

  it("should classify text extensions", () => {
    expect(classifyExt("txt")).toEqual({ kind: "text", format: "txt" });
    expect(classifyExt("TXT")).toEqual({ kind: "text", format: "txt" });
  });

  it("should classify json extensions", () => {
    expect(classifyExt("json")).toEqual({ kind: "text", format: "json" });
    expect(classifyExt("jSoN")).toEqual({ kind: "text", format: "json" });
  });

  it("should classify yaml extensions", () => {
    expect(classifyExt("yaml")).toEqual({ kind: "text", format: "yaml" });
    expect(classifyExt("yml")).toEqual({ kind: "text", format: "yaml" });
    expect(classifyExt("YML")).toEqual({ kind: "text", format: "yaml" });
  });

  it("should classify docx extensions", () => {
    expect(classifyExt("docx")).toEqual({ kind: "docx" });
    expect(classifyExt("DOCX")).toEqual({ kind: "docx" });
  });

  it("should classify doc extensions", () => {
    expect(classifyExt("doc")).toEqual({ kind: "doc" });
    expect(classifyExt("DoC")).toEqual({ kind: "doc" });
  });

  it("should return null for unsupported extensions", () => {
    expect(classifyExt("png")).toBeNull();
    expect(classifyExt("zip")).toBeNull();
    expect(classifyExt("html")).toBeNull();
    expect(classifyExt("js")).toBeNull();
    expect(classifyExt("ts")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(classifyExt("")).toBeNull();
  });

  it("should return null for space characters", () => {
    expect(classifyExt(" ")).toBeNull();
  });
});
