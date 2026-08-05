export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      consultants: {
        Row: {
          id: string
          name: string
          title: string
          bio: string
          expertise: string[]
          pricing_30: number
          pricing_60: number
          image_url: string | null
          gender: 'male' | 'female'
          is_active: boolean
          created_at: string
          email?: string | null
          location?: string | null
          qualification?: string | null
          experience?: string | null
          preferred_time?: string | null
          languages?: string[] | null
          categories?: string[] | null
          availability?: string | null
          social_links?: Json | null
        }
        Insert: {
          id?: string
          name: string
          title: string
          bio: string
          expertise: string[]
          pricing_30: number
          pricing_60: number
          image_url?: string | null
          gender?: 'male' | 'female'
          is_active?: boolean
          created_at?: string
          email?: string | null
          location?: string | null
          qualification?: string | null
          experience?: string | null
          preferred_time?: string | null
          languages?: string[] | null
          categories?: string[] | null
          availability?: string | null
          social_links?: Json | null
        }
        Update: {
          id?: string
          name?: string
          title?: string
          bio?: string
          expertise?: string[]
          pricing_30?: number
          pricing_60?: number
          image_url?: string | null
          gender?: 'male' | 'female'
          is_active?: boolean
          created_at?: string
          email?: string | null
          location?: string | null
          qualification?: string | null
          experience?: string | null
          preferred_time?: string | null
          languages?: string[] | null
          categories?: string[] | null
          availability?: string | null
          social_links?: Json | null
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          display_order?: number
          created_at?: string
        }
      }
      referral_codes: {
        Row: {
          id: string
          code: string
          discount_type: 'percentage' | 'fixed'
          discount_value: number
          created_by_user_id: string | null
          is_active: boolean
          usage_limit: number | null
          times_used: number
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          discount_type: 'percentage' | 'fixed'
          discount_value: number
          created_by_user_id?: string | null
          is_active?: boolean
          usage_limit?: number | null
          times_used?: number
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          discount_type?: 'percentage' | 'fixed'
          discount_value?: number
          created_by_user_id?: string | null
          is_active?: boolean
          usage_limit?: number | null
          times_used?: number
          created_at?: string
        }
      }
      referral_usages: {
        Row: {
          id: string
          referral_code_id: string | null
          code: string
          booking_id: string | null
          user_email: string
          user_id: string | null
          referrer_user_id: string | null
          discount_amount: number
          original_price: number
          final_price: number
          created_at: string
        }
        Insert: {
          id?: string
          referral_code_id?: string | null
          code: string
          booking_id?: string | null
          user_email: string
          user_id?: string | null
          referrer_user_id?: string | null
          discount_amount?: number
          original_price: number
          final_price: number
          created_at?: string
        }
        Update: {
          id?: string
          referral_code_id?: string | null
          code?: string
          booking_id?: string | null
          user_email?: string
          user_id?: string | null
          referrer_user_id?: string | null
          discount_amount?: number
          original_price?: number
          final_price?: number
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          user_id: string | null
          consultant_id: string
          name: string
          email: string
          date: string
          time: string
          message: string | null
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          payment_status: 'pending' | 'paid' | 'refunded'
          session_duration: number | null
          session_price: number | null
          meeting_room_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          consultant_id: string
          name: string
          email: string
          date: string
          time: string
          message?: string | null
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          payment_status?: 'pending' | 'paid' | 'refunded'
          session_duration?: number | null
          session_price?: number | null
          meeting_room_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          consultant_id?: string
          name?: string
          email?: string
          date?: string
          time?: string
          message?: string | null
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          payment_status?: 'pending' | 'paid' | 'refunded'
          session_duration?: number | null
          session_price?: number | null
          meeting_room_id?: string | null
          created_at?: string
        }
      }
      testimonials: {
        Row: {
          id: string
          client_name: string
          designation: string
          company: string | null
          review: string
          rating: number
          image_url: string | null
          status: 'published' | 'draft'
          consultant_id: string | null
          booking_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_name: string
          designation: string
          company?: string | null
          review: string
          rating: number
          image_url?: string | null
          status?: 'published' | 'draft'
          consultant_id?: string | null
          booking_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_name?: string
          designation?: string
          company?: string | null
          review?: string
          rating?: number
          image_url?: string | null
          status?: 'published' | 'draft'
          consultant_id?: string | null
          booking_id?: string | null
          created_at?: string
        }
      }
      blog: {
        Row: {
          id: string
          title: string
          content: string
          featured_image: string | null
          meta_title: string | null
          meta_description: string | null
          status: 'published' | 'draft'
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          featured_image?: string | null
          meta_title?: string | null
          meta_description?: string | null
          status?: 'published' | 'draft'
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          featured_image?: string | null
          meta_title?: string | null
          meta_description?: string | null
          status?: 'published' | 'draft'
          created_at?: string
        }
      }
      content_sections: {
        Row: {
          id: string
          section_name: string
          title: string
          subtitle: string | null
          description: string | null
          button_text: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          section_name: string
          title: string
          subtitle?: string | null
          description?: string | null
          button_text?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          section_name?: string
          title?: string
          subtitle?: string | null
          description?: string | null
          button_text?: string | null
          updated_at?: string
        }
      }
      site_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          role: 'admin' | 'consultant' | 'client'
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          role?: 'admin' | 'consultant' | 'client'
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'consultant' | 'client'
          full_name?: string | null
          created_at?: string
        }
      }
      consultant_applications: {
        Row: {
          id: string
          name: string
          age: number
          gender: 'male' | 'female'
          qualification: string
          current_job: string
          location: string
          experience: string
          preferred_session_timing: string | null
          email: string
          phone: string
          whatsapp: string
          linkedin_url: string | null
          status: 'pending' | 'approved' | 'rejected'
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          age: number
          gender: 'male' | 'female'
          qualification: string
          current_job: string
          location: string
          experience: string
          preferred_session_timing?: string | null
          email: string
          phone: string
          whatsapp: string
          linkedin_url?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          age?: number
          gender?: 'male' | 'female'
          qualification?: string
          current_job?: string
          location?: string
          experience?: string
          preferred_session_timing?: string | null
          email?: string
          phone?: string
          whatsapp?: string
          linkedin_url?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      faqs: {
        Row: {
          id: string
          question: string
          answer: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question: string
          answer: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question?: string
          answer?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      page_content: {
        Row: {
          id: string
          page_key: string
          title: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          page_key: string
          title: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          page_key?: string
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
      pricing_tiers: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          duration_minutes: number | null
          features: string[]
          is_popular: boolean
          is_active: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          duration_minutes?: number | null
          features?: string[]
          is_popular?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          duration_minutes?: number | null
          features?: string[]
          is_popular?: boolean
          is_active?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
