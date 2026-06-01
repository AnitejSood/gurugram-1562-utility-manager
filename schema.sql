-- SQL Schema for Combined Utility Billing System
-- Run this in the Supabase SQL Editor to set up your database tables.

-- 1. Create Tables

-- Settings table for global configurations
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO settings (key, value) VALUES 
('rate_per_unit', '10'),
('default_water_charge', '350'),
('default_motor_charge', '150')
ON CONFLICT (key) DO NOTHING;

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  flat_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'inactive'
  water_charge NUMERIC NOT NULL DEFAULT 350,
  motor_charge NUMERIC NOT NULL DEFAULT 150,
  motor_charge_rule TEXT NOT NULL DEFAULT 'add', -- 'add' (Shivam), 'deduct' (Aditya), 'none'
  default_maintenance NUMERIC NOT NULL DEFAULT 0,
  last_reading NUMERIC NOT NULL DEFAULT 0,
  password TEXT NOT NULL DEFAULT '1234',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Submissions table (Tenant meter uploads)
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  reading NUMERIC NOT NULL,
  photo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  submitted_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Bills table (Landlord approved bills)
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  month TEXT NOT NULL, -- e.g., "May 2026"
  previous_reading NUMERIC NOT NULL,
  current_reading NUMERIC NOT NULL,
  units_consumed NUMERIC NOT NULL,
  rate_per_unit NUMERIC NOT NULL,
  electricity_charge NUMERIC NOT NULL,
  water_charge NUMERIC NOT NULL,
  motor_charge NUMERIC NOT NULL,
  motor_charge_rule TEXT NOT NULL,
  maintenance_charge NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  bill_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid', 'paid'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Configure Storage Buckets
-- Note: You should create the following buckets in your Supabase Dashboard:
-- - 'meter-photos' (Public access enabled)
-- - 'bill-images' (Public access enabled)
--
-- Make sure to create them as PUBLIC storage buckets. If not public, you will need policies to allow public reads.
-- Run the following script in the SQL editor to allow anyone to upload/read (or set up authenticated policies).
-- For simplicity in setup, these policies enable public upload and select.

-- (Optional) If you want to enable storage policies via SQL:
-- Make sure the buckets exist first before running storage policies.

-- Disable RLS on all tables to allow the app client to execute operations
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
