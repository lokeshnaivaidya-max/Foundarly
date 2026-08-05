-- Allow users to delete their own bookings
CREATE POLICY "Users can delete own bookings"
ON bookings FOR DELETE
USING (auth.uid() = user_id);
