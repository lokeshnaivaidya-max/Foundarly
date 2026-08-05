import React, { useState, useEffect } from "react";
import { upiPaymentService, UPIPayment } from "@/services/upiPayment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, CheckCircle2, Clock, XCircle, FileImage, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface UploadProofProps {
  bookingId: string;
  amount?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess?: (payment: UPIPayment) => void;
  className?: string;
}

export const UploadProof: React.FC<UploadProofProps> = ({
  bookingId,
  amount = 0,
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  onSuccess,
  className = "",
}) => {
  const { user } = useAuth();
  const [transactionId, setTransactionId] = useState("");
  const [name, setName] = useState(customerName);
  const [email, setEmail] = useState(customerEmail);
  const [phone, setPhone] = useState(customerPhone);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingPayment, setExistingPayment] = useState<UPIPayment | null>(null);

  useEffect(() => {
    if (bookingId) {
      loadExistingPayment();
    } else {
      setLoading(false);
    }
  }, [bookingId]);

  const loadExistingPayment = async () => {
    try {
      setLoading(true);
      const payment = await upiPaymentService.getPaymentByBookingId(bookingId);
      if (payment) {
        setExistingPayment(payment);
        setTransactionId(payment.transaction_id);
        if (payment.proof_url) {
          setPreviewUrl(payment.proof_url);
        }
      }
    } catch (error) {
      console.log("No existing payment proof found");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file (PNG, JPG, JPEG)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transactionId || transactionId.trim().length < 3) {
      toast.error("Please enter a valid Transaction / UTR ID");
      return;
    }

    try {
      setUploading(true);
      let proofUrl = existingPayment?.proof_url || null;

      // Upload image if selected
      if (selectedFile) {
        toast.loading("Uploading payment screenshot...", { id: "upload-proof" });
        proofUrl = await upiPaymentService.uploadProofImage(selectedFile);
        toast.dismiss("upload-proof");
      }

      const paymentData = {
        booking_id: bookingId,
        user_id: user?.id || "",
        customer_name: name || user?.user_metadata?.full_name || "Customer",
        customer_email: email || user?.email || "",
        customer_phone: phone || "",
        transaction_id: transactionId.trim(),
        payment_amount: amount,
        payment_method: "UPI",
        proof_url: proofUrl || undefined,
      };

      const payment = await upiPaymentService.createPayment(paymentData);
      setExistingPayment(payment);
      toast.success("Payment proof submitted successfully! Pending verification.");
      
      if (onSuccess) {
        onSuccess(payment);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit payment proof");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Card className={`p-6 text-center ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground mt-2">Checking payment status...</p>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm ${className}`}>
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Payment Verification & Proof Upload
          </CardTitle>

          {existingPayment && (
            <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border ${
              existingPayment.status === 'verified'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : existingPayment.status === 'rejected'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}>
              {existingPayment.status === 'verified' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {existingPayment.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
              {existingPayment.status === 'pending' && <Clock className="w-3.5 h-3.5 animate-pulse" />}
              <span className="capitalize">{existingPayment.status}</span>
            </div>
          )}
        </div>
        <CardDescription>
          Upload your payment transaction receipt or UTR ID to complete payment verification.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {existingPayment?.status === 'verified' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-emerald-700 dark:text-emerald-300 text-sm space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Payment Verified!
            </div>
            <p>Your payment of ₹{existingPayment.payment_amount || amount} (UTR: {existingPayment.transaction_id}) has been verified by the administrator.</p>
            {existingPayment.proof_url && (
              <a 
                href={existingPayment.proof_url} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary underline mt-1"
              >
                <FileImage className="w-3.5 h-3.5" /> View Uploaded Receipt
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {existingPayment?.status === 'rejected' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <XCircle className="w-4 h-4 text-red-500" /> Payment Rejected
                </div>
                <p className="text-xs">
                  {existingPayment.admin_notes || "Please check your UTR / transaction ID and re-upload proof."}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="trx-id" className="text-xs font-medium">
                  Transaction / UTR ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="trx-id"
                  placeholder="e.g. 320984920198"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  required
                />
              </div>

              {amount > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount</Label>
                  <Input value={`₹${amount}`} disabled className="bg-muted/50" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cust-name" className="text-xs font-medium">Your Name</Label>
                <Input
                  id="cust-name"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cust-email" className="text-xs font-medium">Email Address</Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-primary" />
                Payment Screenshot (Optional but recommended)
              </Label>
              
              <div className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-4 text-center cursor-pointer relative bg-muted/20">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {previewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="Payment Proof Preview"
                      className="max-h-40 mx-auto rounded-lg object-contain shadow-sm border"
                    />
                    <p className="text-xs text-muted-foreground">Click or drag to replace screenshot</p>
                  </div>
                ) : (
                  <div className="space-y-2 py-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Click to select screenshot</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG or JPEG (Max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={uploading}
              className="w-full h-11 font-medium gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting Proof...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {existingPayment ? "Update Payment Proof" : "Submit Payment Verification"}
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadProof;
