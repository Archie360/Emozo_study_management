-- Currency applies to both likely_total_revenue and estimated_total_expenses.
ALTER TABLE "studies" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
