/**
 * Foundarly Knowledge-Based Support Chatbot Service
 * 
 * Fully deterministic, local knowledge-based support engine.
 * - ZERO external AI dependencies (No Gemini, OpenAI, Groq, or external paid APIs required).
 * - Live dynamic consultant & pricing integration via consultantsService.
 * - Strict security filter preventing secret or private data exposure.
 * - Actionable internal navigation links and follow-up prompt suggestions.
 */

import { matchIntent, MatchResult } from './chatbotIntentMatcher';
import { KNOWLEDGE_BASE, SUPPORT_EMAIL } from './chatbotKnowledge';
import { consultantsService } from './consultants';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUps?: string[];
  links?: { label: string; url: string }[];
}

export interface ChatbotResponse {
  content: string;
  followUps: string[];
  links: { label: string; url: string }[];
}

export const chatbotService = {
  /**
   * Main entry point to process a user question and return a structured response.
   */
  async sendMessage(userInput: string, history: ChatMessage[] = []): Promise<ChatbotResponse> {
    const clean = (userInput || '').trim();
    if (!clean) {
      return {
        content: 'Please enter a question about our consultants, booking process, session pricing, or meetings.',
        followUps: [
          'How do I book a consultation?',
          'What are the consultation fees?',
          'Which consultants are available?',
        ],
        links: [
          { label: 'Browse Consultants', url: '/consultants' },
          { label: 'Book a Session', url: '/booking' },
        ],
      };
    }

    const match: MatchResult = matchIntent(clean);

    // 1. Security & Privacy Guardrail Triggered
    if (match.isSecurityBlock && match.securityMessage) {
      return {
        content: match.securityMessage,
        followUps: [
          'What is Foundarly?',
          'How does consultation booking work?',
          'What are the consultation fees?',
        ],
        links: [
          { label: 'About Foundarly', url: '/about' },
          { label: 'Browse Consultants', url: '/consultants' },
        ],
      };
    }

    // 2. Dynamic Consultant / Pricing query check
    const isConsultantListQuery = /\b(which|who|list|available|current|evaru|all)\b/i.test(clean) &&
      /\b(consultant|consultants|expert|experts|advisors|rates|fees|prices|unnaara)\b/i.test(clean);

    // 3. Matched Knowledge Topic
    if (match.topic) {
      let finalContent = match.topic.detailedResponse;

      // Enhance with live consultant data if asking about consultants or current rates
      if (isConsultantListQuery || match.topic.id === 'consultants_info' || match.topic.id === 'pricing_info') {
        try {
          const liveConsultants = await consultantsService.getAll(true);
          if (liveConsultants && liveConsultants.length > 0) {
            const listItems = liveConsultants.slice(0, 5).map((c) => {
              const p30 = c.pricing_30 ? `₹${c.pricing_30}` : '₹1,000';
              const p60 = c.pricing_60 ? `₹${c.pricing_60}` : '₹1,299';
              const timing = c.preferred_time ? ` (${c.preferred_time})` : '';
              return `• **${c.name}** (${c.title}) — 30m: **${p30}** | 60m: **${p60}**${timing}`;
            }).join('\n');

            finalContent += `\n\n**Current Live Verified Consultants:**\n${listItems}`;
          }
        } catch (e) {
          console.warn('[ChatbotService] Dynamic consultant data lookup notice:', e);
        }
      }

      return {
        content: finalContent,
        followUps: match.topic.suggestedFollowUps,
        links: match.topic.actionLinks || [],
      };
    }

    // 4. Fallback for unclassified questions
    return {
      content:
        `I want to make sure you get accurate information about Foundarly, but I couldn't find a direct answer for your question.\n\n` +
        `Here are the most popular topics I can help you with:\n` +
        `• **Consultation Pricing & Durations**: 30-min & 60-min sessions in INR (₹)\n` +
        `• **Booking Instructions**: Selecting dates, available slots, and referral codes\n` +
        `• **Payment Methods**: UPI QR scan (GPay, PhonePe, Paytm) & Bank Transfer verification\n` +
        `• **Meeting Access**: Browser video rooms, 5-minute lobby, and 7-day post-meeting rejoin\n` +
        `• **Rescheduling & Cancellation**: Submitting change requests from My Bookings\n` +
        `• **Becoming a Consultant**: Join our roster of verified business mentors\n\n` +
        `If your question requires personalized help, reach our team at **${SUPPORT_EMAIL}**.`,
      followUps: [
        'How do I book a consultation?',
        'What are the consultation fees?',
        'How does UPI payment work?',
        'How to join my video meeting?',
      ],
      links: [
        { label: 'Browse Consultants', url: '/consultants' },
        { label: 'Book a Session', url: '/booking' },
        { label: 'Frequently Asked Questions', url: '/faqs' },
      ],
    };
  },

  /**
   * Returns standard quick questions for the chatbot greeting.
   */
  getQuickQuestions(): string[] {
    return [
      'How do I book a consultation?',
      'What are the consultation fees?',
      'Which consultants are available?',
      'How do payments & UPI work?',
      'Meeting access & 7-day rejoin',
      'How do I reschedule a booking?',
    ];
  },
};
