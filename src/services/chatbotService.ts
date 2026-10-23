/**
 * Foundarly Knowledge-Based Support Chatbot Service
 * 
 * Fully deterministic, local knowledge-based support engine.
 * - ZERO external AI dependencies (No Gemini, OpenAI, Groq, or external paid APIs required).
 * - Live dynamic consultant & pricing integration via consultantsService.
 * - Strict security filter preventing secret or private data exposure.
 * - Actionable internal navigation links and follow-up prompt suggestions.
 */

import { matchIntent, MatchResult, REFUSAL_MESSAGE } from './chatbotIntentMatcher';
import { KNOWLEDGE_BASE, SUPPORT_EMAIL } from './chatbotKnowledge';
import { consultantsService } from './consultants';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUps?: string[];
  links?: { label: string; url: string }[];
  isRefusal?: boolean;
}

export interface ChatbotResponse {
  content: string;
  followUps: string[];
  links: { label: string; url: string }[];
  isRefusal?: boolean;
}

const SAFE_FOUNDARLY_FOLLOW_UPS = [
  'How do I book a consultation?',
  'What are the consultation fees?',
  'Which consultants are available?',
  'How does UPI payment work?',
];

const SAFE_FOUNDARLY_LINKS = [
  { label: 'Browse Consultants', url: '/consultants' },
  { label: 'Book a Session', url: '/booking' },
];

export const chatbotService = {
  /**
   * Main entry point to process a user question and return a structured response.
   */
  async sendMessage(userInput: string, history: ChatMessage[] = []): Promise<ChatbotResponse> {
    const clean = (userInput || '').trim();
    if (!clean) {
      return {
        content: 'Please enter a question about our consultants, booking process, session pricing, or meetings.',
        followUps: SAFE_FOUNDARLY_FOLLOW_UPS,
        links: SAFE_FOUNDARLY_LINKS,
      };
    }

    const match: MatchResult = matchIntent(clean);

    // 1. Security & Privacy Guardrail Triggered (credentials, passwords, API keys, env vars, customer info, system details)
    if (match.isSecurityBlock && match.securityMessage) {
      return {
        content: match.securityMessage,
        isRefusal: true,
        followUps: SAFE_FOUNDARLY_FOLLOW_UPS,
        links: SAFE_FOUNDARLY_LINKS,
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
        isRefusal: false,
      };
    }

    // 4. Refusal for questions outside Foundarly services
    return {
      content: REFUSAL_MESSAGE,
      isRefusal: true,
      followUps: SAFE_FOUNDARLY_FOLLOW_UPS,
      links: SAFE_FOUNDARLY_LINKS,
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
