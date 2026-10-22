/**
 * Foundarly Chatbot Service Adapter
 * 
 * Replaces the legacy external Gemini AI dependency with our fully predefined,
 * local knowledge-based Foundarly Support engine.
 * Requires ZERO external AI provider keys or dependencies.
 */

import { chatbotService, ChatMessage as BaseChatMessage } from './chatbotService';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUps?: string[];
  links?: { label: string; url: string }[];
}

export const geminiService = {
  async sendMessage(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<string> {
    const response = await chatbotService.sendMessage(userMessage, conversationHistory);
    return response.content;
  },
};
