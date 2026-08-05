import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

export const PaymentRealtimeListener = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Listen on upi_payments changes for this user
    const upiChannel = supabase
      .channel(`upi_payments_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'upi_payments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          const oldRecord = payload.old;

          if (newRecord && newRecord.status !== oldRecord?.status) {
            if (newRecord.status === 'verified') {
              toast.success(
                `Payment Verified! Your payment of ₹${newRecord.payment_amount || ''} (UTR: ${newRecord.transaction_id}) has been approved.`,
                {
                  duration: 8000,
                  icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
                }
              );
            } else if (newRecord.status === 'rejected') {
              toast.error(
                `Payment Status Updated: Your payment (UTR: ${newRecord.transaction_id}) was rejected. ${
                  newRecord.admin_notes ? `Reason: ${newRecord.admin_notes}` : ''
                }`,
                {
                  duration: 8000,
                  icon: <XCircle className="w-5 h-5 text-red-500" />,
                }
              );
            }
          }
        }
      )
      .subscribe();

    // Also listen on payments table changes for this user
    const paymentsChannel = supabase
      .channel(`payments_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          const oldRecord = payload.old;

          if (newRecord && newRecord.status !== oldRecord?.status) {
            if (newRecord.status === 'verified') {
              toast.success(
                `Payment Verified! Your payment of ₹${newRecord.amount || ''} (UTR: ${newRecord.transaction_id}) has been verified by admin.`,
                {
                  duration: 8000,
                  icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
                }
              );
            } else if (newRecord.status === 'rejected') {
              toast.error(
                `Payment Status: Your payment (UTR: ${newRecord.transaction_id}) was rejected. ${
                  newRecord.admin_notes ? `Reason: ${newRecord.admin_notes}` : ''
                }`,
                {
                  duration: 8000,
                  icon: <XCircle className="w-5 h-5 text-red-500" />,
                }
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(upiChannel);
      supabase.removeChannel(paymentsChannel);
    };
  }, [user?.id]);

  return null;
};

export default PaymentRealtimeListener;
