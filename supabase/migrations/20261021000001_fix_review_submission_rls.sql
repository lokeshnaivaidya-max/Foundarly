-- ============================================================================
-- FOUNDARLY PRODUCTION DATABASE MIGRATION:
-- SECURE CLIENT REVIEW SUBMISSION RLS FOR TESTIMONIALS
-- ============================================================================

-- 1. Ensure required columns and unique constraint exist on testimonials
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES public.consultants(id) ON DELETE SET NULL;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;

-- Enforce at most one review per booking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_booking_id_unique'
  ) THEN
    ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_booking_id_unique UNIQUE (booking_id);
  END IF;
END $$;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_testimonials_consultant_id ON public.testimonials(consultant_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_booking_id ON public.testimonials(booking_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON public.testimonials(status);

-- 2. Enable RLS on testimonials
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing review policies
DROP POLICY IF EXISTS "Allow authenticated users to insert testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Allow users to insert their own reviews" ON public.testimonials;
DROP POLICY IF EXISTS "Clients can submit review for own consultation" ON public.testimonials;
DROP POLICY IF EXISTS "Clients can view own draft reviews" ON public.testimonials;
DROP POLICY IF EXISTS "Public read published testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Public can view published testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Authenticated users can view all testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins can manage all testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Public read published and own reviews" ON public.testimonials;

-- 4. Narrowest secure INSERT policy:
-- Allows an authenticated client to insert a review ONLY if:
-- - status is strictly 'draft' (held for moderation; clients cannot publish directly)
-- - booking_id is provided
-- - the booking belongs to the authenticated user (by auth.uid() or verified email)
-- - the booking matches the consultant
-- - the booking is completed or confirmed and paid
CREATE POLICY "Clients can submit review for own consultation"
ON public.testimonials
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'draft' AND
  booking_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = testimonials.booking_id
      AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
      AND b.consultant_id = testimonials.consultant_id
      AND b.status IN ('completed', 'confirmed')
      AND b.payment_status = 'paid'
  )
);

-- 5. SELECT policy:
-- Anyone can view published reviews, AND authenticated clients can view their own draft reviews
-- so they can verify previous submissions without seeing drafts of other clients
CREATE POLICY "Public read published and own reviews"
ON public.testimonials
FOR SELECT
USING (
  status = 'published' OR
  (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = testimonials.booking_id
        AND (b.user_id = auth.uid() OR LOWER(b.email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
    )
  ) OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  )
);

-- 6. Admins maintain full management permissions
CREATE POLICY "Admins manage testimonials"
ON public.testimonials
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ) OR
  LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@foundarly.com'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ) OR
  LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@foundarly.com'
);

-- 7. Grant proper table permissions
GRANT SELECT, INSERT ON TABLE public.testimonials TO authenticated;
GRANT SELECT ON TABLE public.testimonials TO anon;
GRANT ALL ON TABLE public.testimonials TO service_role;
