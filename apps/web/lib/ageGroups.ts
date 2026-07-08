export type AgeGroup = {
  id: number;
  name: string;
  slug: string;
  minAge?: number | null;
  maxAge?: number | null;
  color?: string;
  sortOrder?: number;
};
