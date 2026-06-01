export interface CommissionInput {
  askingPrice: number; // PLN stored value (e.g. 1_000_000 for 1 mln PLN)
  commissionPercent: number; // percentage 0–100 (e.g. 2.5 for 2.5%)
  agencyPercent: number; // percentage 0–100 (e.g. 50 for 50%)
  taxRate: number; // percentage 0–100 (e.g. 23 for 23%)
}

export interface CommissionSplit {
  brutto: number; // PLN — total commission
  agencyAmount: number; // PLN — agency portion
  grossIncome: number; // PLN — agent pre-tax income
  taxAmount: number; // PLN — tax provision
  agentNet: number; // PLN — agent net payout
}

export function calculateCommissionSplit(input: CommissionInput): CommissionSplit {
  // askingPrice (PLN) × commissionPercent (%) = price × p/100 × 100 grosze
  // by unit cancellation; divide by 100 to recover PLN.
  const brutto_c = Math.round(input.askingPrice * input.commissionPercent);
  const agency_c = Math.round((brutto_c * input.agencyPercent) / 100);
  const gross_c = brutto_c - agency_c;
  const tax_c = Math.round((gross_c * input.taxRate) / 100);
  const agent_c = gross_c - tax_c;

  // Regression tripwire: agency_c + tax_c + agent_c ≡ brutto_c by algebraic
  // construction (gross_c = brutto_c − agency_c; agent_c = gross_c − tax_c).
  // This cannot fail with the current formula; it will surface any future edit
  // that breaks the PRD invariant "split must sum to the entered total".
  if (agency_c + tax_c + agent_c !== brutto_c) {
    throw new Error(`Commission invariant violated: ${agency_c} + ${tax_c} + ${agent_c} ≠ ${brutto_c}`);
  }

  return {
    brutto: brutto_c / 100,
    agencyAmount: agency_c / 100,
    grossIncome: gross_c / 100,
    taxAmount: tax_c / 100,
    agentNet: agent_c / 100,
  };
}
