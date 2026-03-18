-- 011: Medication inventory tracking columns
-- All columns nullable/opt-in — no impact on existing medication workflows

-- Supply tracking
ALTER TABLE medications ADD COLUMN IF NOT EXISTS supply_unit TEXT DEFAULT 'mL';
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dose_amount DECIMAL;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS supply_remaining DECIMAL;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS supply_total DECIMAL;

-- Prescription tracking
ALTER TABLE medications ADD COLUMN IF NOT EXISTS refills_remaining INTEGER;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS prescription_source TEXT;

-- Expiry tracking
ALTER TABLE medications ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS opened_date DATE;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS days_after_opening INTEGER;

-- Alert threshold
ALTER TABLE medications ADD COLUMN IF NOT EXISTS low_supply_days INTEGER DEFAULT 3;
