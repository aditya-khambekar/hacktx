/** Source workbook fields retained without flattening ranges or fee conditions. */
export type CuratedPlan = {
  id: string; name: string; variant: string; beds: number | null; baths: number | null;
  sqft: number | null; baseRent: number | null; baseRentMax: number | null;
  reportedTotal: number | null; reportedTotalMax: number | null;
  rentBasis: "per person" | "per unit" | null; cadence: string;
  sourceUrl: string | null; occupancy: string | null; eligibility: string | null;
  availability: string | null; imageUrl: string | null; features: string | null;
  promotion: string | null;
};

export type CuratedFee = {
  id: string; name: string; requirement: string; cadence: string;
  amount: number | null; min: number | null; max: number | null;
  rate: number | null; estimate: number | null; scope: string; condition: string;
};

export type CuratedProperty = {
  id: string; name: string; address: string | null; website: string | null;
  leaseStart: string | null; leaseEnd: string | null; installments: number | null;
  leaseNotes?: string | null;
  rentBasis: string; utilities: string | null; amenities: string[];
  checkedAt: string; sourceUrl: string | null; notes: string[];
  floorplans: CuratedPlan[]; fees: CuratedFee[];
};

export type CuratedDetails = Omit<CuratedProperty, "floorplans">;
