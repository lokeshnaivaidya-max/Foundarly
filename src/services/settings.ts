import { supabase } from '@/lib/supabase';

interface SiteSetting {
  id: string;
  setting_key: string;
  setting_value: string | null;
  updated_at: string;
}

const FALLBACK_SETTINGS: SiteSetting[] = [
  { id: '1', setting_key: 'site_logo_text', setting_value: 'Foundarly', updated_at: new Date().toISOString() },
  { id: '2', setting_key: 'currency', setting_value: 'INR', updated_at: new Date().toISOString() },
  { id: '3', setting_key: 'site_theme', setting_value: 'light', updated_at: new Date().toISOString() },
  { id: '4', setting_key: 'platform_name', setting_value: 'Foundarly', updated_at: new Date().toISOString() },
  { id: '5', setting_key: 'support_email', setting_value: 'support@foundarly.com', updated_at: new Date().toISOString() },
  { id: '6', setting_key: 'default_session_duration', setting_value: '60', updated_at: new Date().toISOString() },
  { id: '7', setting_key: 'cancellation_window', setting_value: '24', updated_at: new Date().toISOString() }
];

export const settingsService = {
  async getAll() {
    try {
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('*');
      
      if (error) {
        console.warn('[Site Settings] Fetch error, using default settings:', error.message);
        return FALLBACK_SETTINGS;
      }
      return (data && data.length > 0 ? data : FALLBACK_SETTINGS) as SiteSetting[];
    } catch (err: any) {
      console.warn('[Site Settings] Unexpected fetch error, using default settings:', err);
      return FALLBACK_SETTINGS;
    }
  },

  async getBySetting(settingKey: string) {
    try {
      const { data, error } = await (supabase as any)
        .from('site_settings')
        .select('*')
        .eq('setting_key', settingKey)
        .maybeSingle();
      
      if (error || !data) {
        const fallback = FALLBACK_SETTINGS.find(s => s.setting_key === settingKey);
        return fallback || { id: '0', setting_key: settingKey, setting_value: null, updated_at: new Date().toISOString() };
      }
      return data as SiteSetting;
    } catch (err: any) {
      const fallback = FALLBACK_SETTINGS.find(s => s.setting_key === settingKey);
      return fallback || { id: '0', setting_key: settingKey, setting_value: null, updated_at: new Date().toISOString() };
    }
  },

  async update(settingKey: string, settingValue: string | null) {
    return this.upsert(settingKey, settingValue);
  },

  async upsert(settingKey: string, settingValue: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { 
      setting_key: settingKey, 
      setting_value: settingValue,
      updated_at: new Date().toISOString()
    };

    // Standard client UPSERT
    const { data, error, status, statusText } = await (supabase as any)
      .from('site_settings')
      .upsert(payload, { onConflict: 'setting_key' })
      .select()
      .maybeSingle();

    if (error) {
      const logData = {
        tableName: 'site_settings',
        settingKey,
        payload,
        authenticatedUserId: user?.id || 'Unauthenticated / Anonymous',
        supabaseErrorObject: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status,
          statusText
        }
      };
      console.error('[Supabase Upsert Failure Log]: Complete Supabase Error Object:', JSON.stringify(logData, null, 2));
      throw new Error(`Failed to save setting '${settingKey}': ${error.message || 'Database write failed'}`);
    }

    return data as SiteSetting;
  },
};



