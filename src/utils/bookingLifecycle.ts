/**
 * Booking Lifecycle Definition & Mutually Exclusive State Guards
 *
 * Every booking permanently belongs to exactly ONE state:
 * - 'pending'   : newly created / awaiting payment verification
 * - 'confirmed' : admin has verified/confirmed the booking (or session completed)
 * - 'rejected'  : admin rejected/cancelled the booking
 */

export type BookingLifecycleState = 'pending' | 'confirmed' | 'rejected';

export const isBookingRejected = (b: any): boolean => {
  if (!b) return false;
  const status = (b.status || '').toLowerCase();
  const paymentStatus = (b.payment_status || '').toLowerCase();
  const upiStatus = (b.upi_payment?.status || '').toLowerCase();

  return (
    status === 'rejected' ||
    status === 'cancelled' ||
    paymentStatus === 'rejected' ||
    upiStatus === 'rejected'
  );
};

export const isBookingConfirmed = (b: any): boolean => {
  if (!b) return false;
  // A rejected booking can never be confirmed
  if (isBookingRejected(b)) return false;

  const status = (b.status || '').toLowerCase();
  const paymentStatus = (b.payment_status || '').toLowerCase();
  const upiStatus = (b.upi_payment?.status || '').toLowerCase();

  return (
    status === 'confirmed' ||
    status === 'completed' ||
    paymentStatus === 'paid' ||
    upiStatus === 'verified'
  );
};

export const isBookingPending = (b: any): boolean => {
  if (!b) return false;
  return !isBookingConfirmed(b) && !isBookingRejected(b);
};

export const getBookingState = (b: any): BookingLifecycleState => {
  if (isBookingRejected(b)) return 'rejected';
  if (isBookingConfirmed(b)) return 'confirmed';
  return 'pending';
};
