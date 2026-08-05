import { supabase } from '@/lib/supabase';

export interface ReferralCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  created_by_user_id: string | null;
  is_active: boolean;
  usage_limit: number | null;
  times_used: number;
  created_at: string;
}

export interface ReferralUsage {
  id: string;
  referral_code_id: string | null;
  code: string;
  booking_id: string | null;
  user_email: string;
  user_id: string | null;
  referrer_user_id: string | null;
  discount_amount: number;
  original_price: number;
  final_price: number;
  created_at: string;
}

const FALLBACK_CODES: ReferralCode[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'FOUNDARLY10',
    discount_type: 'percentage',
    discount_value: 10,
    created_by_user_id: null,
    is_active: true,
    usage_limit: 1000,
    times_used: 14,
    created_at: new Date().toISOString()
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'WELCOME100',
    discount_type: 'fixed',
    discount_value: 100,
    created_by_user_id: null,
    is_active: true,
    usage_limit: 500,
    times_used: 8,
    created_at: new Date().toISOString()
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'STARTUP20',
    discount_type: 'percentage',
    discount_value: 20,
    created_by_user_id: null,
    is_active: true,
    usage_limit: 200,
    times_used: 25,
    created_at: new Date().toISOString()
  }
];

let localCodes: ReferralCode[] = [...FALLBACK_CODES];

export const referralsService = {
  async validateCode(codeString: string, originalPrice: number): Promise<{
    valid: boolean;
    codeObj?: ReferralCode;
    discountAmount: number;
    finalPrice: number;
    message: string;
  }> {
    const cleanCode = codeString.trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, discountAmount: 0, finalPrice: originalPrice, message: "Please enter a referral code" };
    }

    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('is_active', true)
        .maybeSingle();

      let refCode: ReferralCode | undefined = data as ReferralCode | undefined;

      if (error || !refCode) {
        refCode = localCodes.find(c => c.code === cleanCode && c.is_active);
      }

      if (!refCode) {
        return { valid: false, discountAmount: 0, finalPrice: originalPrice, message: "Invalid or inactive referral code" };
      }

      if (refCode.usage_limit !== null && refCode.times_used >= refCode.usage_limit) {
        return { valid: false, discountAmount: 0, finalPrice: originalPrice, message: "Referral code usage limit reached" };
      }

      let discountAmount = 0;
      if (refCode.discount_type === 'percentage') {
        discountAmount = Math.round((originalPrice * refCode.discount_value) / 100);
      } else {
        discountAmount = Math.min(originalPrice, refCode.discount_value);
      }

      const finalPrice = Math.max(0, originalPrice - discountAmount);

      return {
        valid: true,
        codeObj: refCode,
        discountAmount,
        finalPrice,
        message: `Referral code applied! You saved ${refCode.discount_type === 'percentage' ? `${refCode.discount_value}%` : `₹${refCode.discount_value}`}`
      };
    } catch {
      const fallbackMatch = localCodes.find(c => c.code === cleanCode && c.is_active);
      if (fallbackMatch) {
        let discountAmount = 0;
        if (fallbackMatch.discount_type === 'percentage') {
          discountAmount = Math.round((originalPrice * fallbackMatch.discount_value) / 100);
        } else {
          discountAmount = Math.min(originalPrice, fallbackMatch.discount_value);
        }
        const finalPrice = Math.max(0, originalPrice - discountAmount);
        return {
          valid: true,
          codeObj: fallbackMatch,
          discountAmount,
          finalPrice,
          message: `Referral code applied! Saved ${fallbackMatch.discount_type === 'percentage' ? `${fallbackMatch.discount_value}%` : `₹${fallbackMatch.discount_value}`}`
        };
      }
      return { valid: false, discountAmount: 0, finalPrice: originalPrice, message: "Error validating referral code" };
    }
  },

  async recordUsage(usage: {
    referral_code_id?: string | null;
    code: string;
    booking_id?: string | null;
    user_email: string;
    user_id?: string | null;
    referrer_user_id?: string | null;
    discount_amount: number;
    original_price: number;
    final_price: number;
  }) {
    try {
      await (supabase as any)
        .from('referral_usages')
        .insert(usage);

      // Increment times_used if referral_code_id exists
      if (usage.referral_code_id) {
        const localItem = localCodes.find(c => c.id === usage.referral_code_id);
        if (localItem) {
          localItem.times_used += 1;
        }

        const { data: codeData } = await supabase
          .from('referral_codes')
          .select('times_used')
          .eq('id', usage.referral_code_id)
          .maybeSingle();

        if (codeData) {
          await (supabase as any)
            .from('referral_codes')
            .update({ times_used: (codeData.times_used || 0) + 1 })
            .eq('id', usage.referral_code_id);
        }
      }
    } catch (e) {
      console.warn("Could not record referral usage to Supabase:", e);
    }
  },

  async getAllCodes(): Promise<ReferralCode[]> {
    try {
      const { data, error } = await supabase
        .from('referral_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        return localCodes;
      }
      // Sync localCodes with fetched data
      localCodes = data as ReferralCode[];
      return localCodes;
    } catch {
      return localCodes;
    }
  },

  async createCode(code: {
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    usage_limit?: number | null;
    is_active?: boolean;
  }): Promise<ReferralCode> {
    const cleanCode = code.code.trim().toUpperCase();
    const newLocalItem: ReferralCode = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ref-${Date.now()}`,
      code: cleanCode,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      created_by_user_id: null,
      is_active: code.is_active ?? true,
      usage_limit: code.usage_limit || null,
      times_used: 0,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await (supabase as any)
        .from('referral_codes')
        .insert({
          code: cleanCode,
          discount_type: code.discount_type,
          discount_value: code.discount_value,
          usage_limit: code.usage_limit || null,
          is_active: code.is_active ?? true
        })
        .select()
        .single();

      if (error || !data) {
        console.warn('Supabase create referral code notice:', error?.message);
        localCodes.unshift(newLocalItem);
        return newLocalItem;
      }

      const created = data as ReferralCode;
      localCodes.unshift(created);
      return created;
    } catch (err) {
      console.warn('Supabase create referral code exception:', err);
      localCodes.unshift(newLocalItem);
      return newLocalItem;
    }
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    // Synchronize local state
    const cached = localCodes.find(c => c.id === id);
    if (cached) {
      cached.is_active = isActive;
    }

    try {
      const { error } = await (supabase as any)
        .from('referral_codes')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) {
        console.warn('Supabase toggle referral code status notice:', error.message);
      }
    } catch (err) {
      console.warn('Supabase toggle referral code status exception:', err);
    }
  },

  async deleteCode(id: string): Promise<void> {
    localCodes = localCodes.filter(c => c.id !== id);
    try {
      const { error } = await (supabase as any)
        .from('referral_codes')
        .delete()
        .eq('id', id);

      if (error) {
        console.warn('Supabase delete referral code notice:', error.message);
      }
    } catch (err) {
      console.warn('Supabase delete referral code exception:', err);
    }
  },

  async getUsages(): Promise<ReferralUsage[]> {
    try {
      const { data, error } = await supabase
        .from('referral_usages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }
      return data as ReferralUsage[];
    } catch {
      return [];
    }
  }
};
