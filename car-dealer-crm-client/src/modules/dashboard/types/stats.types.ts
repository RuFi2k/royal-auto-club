export interface DashboardStats {
  totals: {
    all: number;
    available: number;
    sold: number;
    addedThisMonth: number;
  };
  addedByMonth: { month: string; count: number }[];
  soldByMonth:  { month: string; count: number }[];
  byBrand:  { brand: string; count: number }[];
  byOrigin: { carOrigin: string; count: number }[];
}
