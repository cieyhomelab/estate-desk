import { describe, expect, it } from "vitest";
import { calculateCommissionSplit } from "./commission";

describe("calculateCommissionSplit", () => {
  it("commission split matches PRD oracle", () => {
    // Source: context/changes/pricing-and-commission/research.md example
    // 1 mln PLN property, 1% commission → 10 000 zł total; 50% agency, 25% tax
    const result = calculateCommissionSplit({
      askingPrice: 1_000_000,
      commissionPercent: 1,
      agencyPercent: 50,
      taxRate: 25,
    });
    expect(result.brutto).toBe(10_000);
    expect(result.agencyAmount).toBe(5_000);
    expect(result.grossIncome).toBe(5_000);
    expect(result.taxAmount).toBe(1_250);
    expect(result.agentNet).toBe(3_750);
  });

  it("zero rates: full pass-through to agent", () => {
    const result = calculateCommissionSplit({
      askingPrice: 1_000_000,
      commissionPercent: 1,
      agencyPercent: 0,
      taxRate: 0,
    });
    expect(result.agencyAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.agentNet).toBe(result.brutto);
  });

  it("100% agency: agent receives nothing", () => {
    const result = calculateCommissionSplit({
      askingPrice: 500_000,
      commissionPercent: 2,
      agencyPercent: 100,
      taxRate: 23,
    });
    expect(result.agencyAmount).toBe(result.brutto);
    expect(result.grossIncome).toBe(0);
    expect(result.agentNet).toBe(0);
  });

  it("rounding boundary: half-grosz split sums exactly to total", () => {
    // 333 333 PLN × 1% → brutto_c = 333 333 grosze
    // agency_c = Math.round(333 333 × 0.5) = Math.round(166 666.5) = 166 667
    // gross_c = 166 666; tax_c = Math.round(166 666 × 0.25) = Math.round(41 666.5) = 41 667
    // agent_c = 124 999; sum = 166 667 + 41 667 + 124 999 = 333 333 ✓
    const result = calculateCommissionSplit({
      askingPrice: 333_333,
      commissionPercent: 1,
      agencyPercent: 50,
      taxRate: 25,
    });
    expect(result.brutto).toBe(3_333.33);
    expect(result.agencyAmount).toBe(1_666.67);
    expect(result.grossIncome).toBe(1_666.66);
    expect(result.taxAmount).toBe(416.67);
    expect(result.agentNet).toBe(1_249.99);
    expect(result.agencyAmount + result.taxAmount + result.agentNet).toBe(result.brutto);
  });
});
