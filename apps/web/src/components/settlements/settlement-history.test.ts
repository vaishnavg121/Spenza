import { describe, it, expect } from "vitest";
import { formatMinorUnitToAmount } from "../../lib/money";

describe("settlement UI formatting", () => {
    it("formats minor units correctly for settlements", () => {
        expect(formatMinorUnitToAmount("5000")).toBe("50.00");
    });
});
