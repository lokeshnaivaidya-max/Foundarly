import { supabase } from '@/lib/supabase';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order_index: number;
  created_at: string;
}

export const FALLBACK_FAQS: FAQ[] = [
  {
    id: "faq-1",
    question: "How can I become a consultant on Foundarly?",
    answer: "You can apply by submitting your professional details, experience, and portfolio for review. Click \"Become a Consultant\" in the navigation bar to get started.",
    order_index: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-2",
    question: "Are consultants employees of Foundarly?",
    answer: "No. Consultants are independent professionals who collaborate with Foundarly but are not employees of the platform.",
    order_index: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-3",
    question: "What happens after a consultation session?",
    answer: "Consultants are required to provide a PDF summary or report outlining the advice and recommendations given during the session.",
    order_index: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-4",
    question: "Can consultants connect with users outside the platform?",
    answer: "No. Consultants must not form personal business relationships or conduct off-platform transactions with users. All interactions must take place through Foundarly.",
    order_index: 4,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-5",
    question: "How much commission does Foundarly take?",
    answer: "Foundarly charges a 30% platform commission on each completed consultation.",
    order_index: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-6",
    question: "How are consultants paid?",
    answer: "After the consultation is completed and payment is processed, the consultant receives their earnings minus the platform commission.",
    order_index: 6,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-7",
    question: "What if a user leaves a complaint?",
    answer: "Foundarly reviews all complaints carefully. If necessary, appropriate action may be taken against the consultant after a thorough investigation.",
    order_index: 7,
    created_at: new Date().toISOString(),
  },
  {
    id: "faq-8",
    question: "Are consultants required to maintain confidentiality?",
    answer: "Yes. Consultants must respect user privacy and keep all consultation information strictly confidential.",
    order_index: 8,
    created_at: new Date().toISOString(),
  },
];

function sanitizeFAQ(faq: FAQ): FAQ {
  return {
    ...faq,
    question: faq.question.replace(/Foundrly/gi, 'Foundarly'),
    answer: faq.answer.replace(/Foundrly/gi, 'Foundarly'),
  };
}

export const faqsService = {
  async getAll(): Promise<FAQ[]> {
    try {
      const { data, error } = await (supabase as any)
        .from('faqs')
        .select('*')
        .order('order_index');
      
      if (error || !data || data.length === 0) {
        return FALLBACK_FAQS;
      }

      // Filter out old booking-related FAQs if they exist in the database table
      const filtered = (data as FAQ[]).filter(item => {
        const q = item.question.toLowerCase();
        const isOldBookingFaq = 
          q.includes('book a consultation') ||
          q.includes('online meetings work') ||
          q.includes('reschedule my booking') ||
          q.includes('payment methods are supported') ||
          q.includes('how do i book') ||
          q.includes('can i reschedule');
        return !isOldBookingFaq;
      }).map(sanitizeFAQ);

      // If database does not have all 8 official FAQs or is empty after filtering, prioritize official FALLBACK_FAQS
      if (filtered.length < 8) {
        return FALLBACK_FAQS;
      }

      return filtered;
    } catch {
      return FALLBACK_FAQS;
    }
  },

  async create(faq: { question: string; answer: string; order_index: number }) {
    const sanitized = {
      ...faq,
      question: faq.question.replace(/Foundrly/gi, 'Foundarly'),
      answer: faq.answer.replace(/Foundrly/gi, 'Foundarly'),
    };
    const { data, error } = await (supabase as any)
      .from('faqs')
      .insert(sanitized)
      .select()
      .single();
    
    if (error) throw error;
    return data as FAQ;
  },

  async update(id: string, updates: { question?: string; answer?: string; order_index?: number }) {
    const sanitized = {
      ...updates,
      ...(updates.question ? { question: updates.question.replace(/Foundrly/gi, 'Foundarly') } : {}),
      ...(updates.answer ? { answer: updates.answer.replace(/Foundrly/gi, 'Foundarly') } : {}),
    };
    const { data, error} = await (supabase as any)
      .from('faqs')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as FAQ;
  },

  async delete(id: string) {
    const { error } = await (supabase as any)
      .from('faqs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};
