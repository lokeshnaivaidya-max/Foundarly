import { motion } from "framer-motion";
import { CreditCard, Smartphone } from "lucide-react";
import { Card } from "./ui/card";

interface PaymentMethodSelectorProps {
  selected: 'razorpay' | 'upi';
  onSelect: (method: 'razorpay' | 'upi') => void;
}

export function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground block mb-3">
        Select Payment Method
      </label>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Razorpay Option */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('razorpay')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            selected === 'razorpay'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border hover:border-primary/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selected === 'razorpay' ? 'bg-primary/20' : 'bg-secondary'
            }`}>
              <CreditCard className={`h-5 w-5 ${
                selected === 'razorpay' ? 'text-primary' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Razorpay</p>
              <p className="text-xs text-muted-foreground">Instant Payment</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pay with cards, UPI, wallets & more. Instant confirmation.
          </p>
        </motion.button>

        {/* UPI Direct Option */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('upi')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            selected === 'upi'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border hover:border-primary/40'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              selected === 'upi' ? 'bg-primary/20' : 'bg-secondary'
            }`}>
              <Smartphone className={`h-5 w-5 ${
                selected === 'upi' ? 'text-primary' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">Direct UPI</p>
              <p className="text-xs text-muted-foreground">Manual Verification</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pay via UPI & submit transaction ID. Verified within 24 hours.
          </p>
        </motion.button>
      </div>
    </div>
  );
}
