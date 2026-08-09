import { describe, expect, it } from "vitest";
import { safeAuthReturnPath } from "./auth-return";

describe("safeAuthReturnPath", () => {
  it("preserves only local group invite destinations", () => {
    expect(safeAuthReturnPath("/join/abc.DEF_123-xyz")).toBe("/join/abc.DEF_123-xyz");
    expect(safeAuthReturnPath("https://attacker.example/join/token")).toBeUndefined();
    expect(safeAuthReturnPath("//attacker.example/join/token")).toBeUndefined();
    expect(safeAuthReturnPath("/dashboard")).toBeUndefined();
  });
});
