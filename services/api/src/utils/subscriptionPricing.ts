/** Plan row fields from DB (camelCase or snake_case). */
export type PlanDurationFields = {
  minMonths?: number | null;
  maxMonths?: number | null;
  min_months?: number | null;
  max_months?: number | null;
};

export function isFixedDurationPlan(plan: PlanDurationFields): boolean {
  const minM = plan.minMonths ?? plan.min_months ?? 1;
  const maxM = plan.maxMonths ?? plan.max_months;
  return maxM != null && minM === maxM;
}

/**
 * Fixed-duration plans (e.g. yearly 12 mo) store total price for the period.
 * Flexible plans charge unit price per selected month.
 */
export function computeSubscriptionAmount(
  unitPrice: number,
  months: number,
  plan: PlanDurationFields,
): number {
  if (isFixedDurationPlan(plan)) {
    return Number(unitPrice);
  }
  return Number(unitPrice) * Number(months);
}
