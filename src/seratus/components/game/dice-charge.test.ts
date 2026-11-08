import { describe, expect, it } from "vitest";
import { diceCharge } from "./dice-charge";

describe("visual dice energy", () => {
  it("moves from low to high and back while held", () => {
    expect(diceCharge(0)).toBe(0);
    expect(diceCharge(450)).toBe(50);
    expect(diceCharge(900)).toBe(100);
    expect(diceCharge(1350)).toBe(50);
    expect(diceCharge(1800)).toBe(0);
  });
  it("remains bounded on repeated cycles", () => {
    for (let ms = -100; ms < 12000; ms += 37) {
      expect(diceCharge(ms)).toBeGreaterThanOrEqual(0);
      expect(diceCharge(ms)).toBeLessThanOrEqual(100);
    }
  });
});