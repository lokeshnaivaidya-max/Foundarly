-- =====================================================
-- CONSULTANT SYSTEM: Complete Setup
-- =====================================================
-- Features:
-- 1. Consultant earnings tracking
-- 2. Payout requests
-- 3. Meeting rescheduling
-- 4. Consultant bookings view
-- =====================================================

-- 1. Add consultant-specific fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_consultant BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consultant_bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consultant_hourly_rate DECIMAL(10,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS available_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(10,2) DEFAULT 0;

-- 2. Create payout_requests table
CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'bank_transfer', 'upi', 'paypal'
  payment_details JSONB NOT NULL, -- Store account details
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  admin_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create earnings_history table
CREATE TABLE IF NOT EXISTS earnings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'refunded'
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add rescheduling fields to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_requested_by UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS original_time TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reschedule_status TEXT; -- 'pending', 'approved', 'rejected'

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_consultant ON payout_requests(consultant_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_earnings_consultant ON earnings_history(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_consultant ON bookings(consultant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule ON bookings(reschedule_status) WHERE reschedule_status IS NOT NULL;

-- 6. Enable RLS
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for payout_requests

-- Consultants can view their own payout requests
DROP POLICY IF EXISTS "Consultants can view own payout requests" ON payout_requests;
CREATE POLICY "Consultants can view own payout requests"
  ON payout_requests FOR SELECT
  USING (auth.uid() = consultant_id);

-- Consultants can create payout requests
DROP POLICY IF EXISTS "Consultants can create payout requests" ON payout_requests;
CREATE POLICY "Consultants can create payout requests"
  ON payout_requests FOR INSERT
  WITH CHECK (auth.uid() = consultant_id);

-- Admins can view all payout requests
DROP POLICY IF EXISTS "Admins can view all payout requests" ON payout_requests;
CREATE POLICY "Admins can view all payout requests"
  ON payout_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update payout requests
DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;
CREATE POLICY "Admins can update payout requests"
  ON payout_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 8. RLS Policies for earnings_history

-- Consultants can view their own earnings
DROP POLICY IF EXISTS "Consultants can view own earnings" ON earnings_history;
CREATE POLICY "Consultants can view own earnings"
  ON earnings_history FOR SELECT
  USING (auth.uid() = consultant_id);

-- System can insert earnings (no user check needed)
DROP POLICY IF EXISTS "System can insert earnings" ON earnings_history;
CREATE POLICY "System can insert earnings"
  ON earnings_history FOR INSERT
  WITH CHECK (true);

-- Admins can view all earnings
DROP POLICY IF EXISTS "Admins can view all earnings" ON earnings_history;
CREATE POLICY "Admins can view all earnings"
  ON earnings_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 9. Update bookings RLS to allow consultants to view their bookings
DROP POLICY IF EXISTS "Consultants can view their bookings" ON bookings;
CREATE POLICY "Consultants can view their bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = consultant_id);

-- Consultants can update their bookings (for rescheduling)
DROP POLICY IF EXISTS "Consultants can update their bookings" ON bookings;
CREATE POLICY "Consultants can update their bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = consultant_id);

-- Users can update their bookings (for rescheduling)
DROP POLICY IF EXISTS "Users can update their bookings" ON bookings;
CREATE POLICY "Users can update their bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id);

-- 10. Function to calculate consultant earnings
CREATE OR REPLACE FUNCTION calculate_consultant_earnings(consultant_uuid UUID)
RETURNS TABLE (
  total_earnings DECIMAL,
  available_balance DECIMAL,
  withdrawn_amount DECIMAL,
  pending_payouts DECIMAL,
  completed_bookings INTEGER,
  upcoming_bookings INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN e.status = 'completed' THEN e.net_amount ELSE 0 END), 0) as total_earnings,
    COALESCE(p.available_balance, 0) as available_balance,
    COALESCE(p.withdrawn_amount, 0) as withdrawn_amount,
    COALESCE(SUM(CASE WHEN pr.status = 'pending' THEN pr.amount ELSE 0 END), 0) as pending_payouts,
    COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END)::INTEGER as completed_bookings,
    COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END)::INTEGER as upcoming_bookings
  FROM profiles p
  LEFT JOIN earnings_history e ON e.consultant_id = consultant_uuid
  LEFT JOIN payout_requests pr ON pr.consultant_id = consultant_uuid
  LEFT JOIN bookings b ON b.consultant_id = consultant_uuid
  WHERE p.user_id = consultant_uuid
  GROUP BY p.available_balance, p.withdrawn_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to process booking completion and create earnings
CREATE OR REPLACE FUNCTION process_booking_completion(booking_uuid UUID)
RETURNS VOID AS $$
DECLARE
  v_consultant_id UUID;
  v_amount DECIMAL;
  v_platform_fee DECIMAL;
  v_net_amount DECIMAL;
BEGIN
  -- Get booking details
  SELECT consultant_id, amount INTO v_consultant_id, v_amount
  FROM bookings WHERE id = booking_uuid;
  
  -- Calculate platform fee (10%)
  v_platform_fee := v_amount * 0.10;
  v_net_amount := v_amount - v_platform_fee;
  
  -- Create earnings record
  INSERT INTO earnings_history (consultant_id, booking_id, amount, platform_fee, net_amount, status)
  VALUES (v_consultant_id, booking_uuid, v_amount, v_platform_fee, v_net_amount, 'completed');
  
  -- Update consultant's available balance
  UPDATE profiles
  SET 
    total_earnings = total_earnings + v_net_amount,
    available_balance = available_balance + v_net_amount
  WHERE user_id = v_consultant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to approve payout request
CREATE OR REPLACE FUNCTION approve_payout_request(request_uuid UUID, admin_uuid UUID)
RETURNS VOID AS $$
DECLARE
  v_consultant_id UUID;
  v_amount DECIMAL;
BEGIN
  -- Get payout details
  SELECT consultant_id, amount INTO v_consultant_id, v_amount
  FROM payout_requests WHERE id = request_uuid;
  
  -- Update payout request
  UPDATE payout_requests
  SET 
    status = 'completed',
    processed_at = NOW(),
    processed_by = admin_uuid
  WHERE id = request_uuid;
  
  -- Update consultant's balance
  UPDATE profiles
  SET 
    available_balance = available_balance - v_amount,
    withdrawn_amount = withdrawn_amount + v_amount
  WHERE user_id = v_consultant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payout_requests_updated_at ON payout_requests;
CREATE TRIGGER update_payout_requests_updated_at
  BEFORE UPDATE ON payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 14. Grant permissions
GRANT SELECT, INSERT ON payout_requests TO authenticated;
GRANT SELECT ON earnings_history TO authenticated;
GRANT UPDATE ON bookings TO authenticated;
GRANT UPDATE ON profiles TO authenticated;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Next steps:
-- 1. Create consultant dashboard page
-- 2. Create payout request form
-- 3. Add reschedule functionality to MyBookings
-- 4. Create admin payout management page
-- =====================================================
