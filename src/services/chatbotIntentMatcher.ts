/**
 * Foundarly Chatbot Intent Matcher & Security Guardrail
 * 
 * Capabilities:
 * 1. Strict Security & Privacy Guardrails: Blocks attempts to query API keys, secrets, private customer data, or admin bypasses.
 * 2. Telugu-English (Tanglish) Transliteration support: Understands common natural phrasing in bilingual English/Telugu.
 * 3. Fuzzy & Keyword Token Matching: Ranks knowledge topics deterministically without external AI models.
 */

import { KNOWLEDGE_BASE, KnowledgeTopic } from './chatbotKnowledge';

export interface MatchResult {
  topic: KnowledgeTopic | null;
  confidence: number;
  matchedCategory?: string;
  isSecurityBlock: boolean;
  securityMessage?: string;
  matchedKeywords: string[];
}

export const REFUSAL_TITLE = '⚠️ Unable to Process Request';
export const REFUSAL_BODY = 'Sorry, I can only help with Foundarly-related questions. I can’t provide credentials, passwords, private information, or internal system details.';
export const REFUSAL_MESSAGE = `**${REFUSAL_TITLE}**\n${REFUSAL_BODY}`;

// Patterns that attempt to query credentials, passwords, API keys, environment variables, private customer data, personal data, or internal system details
const SECURITY_PATTERNS = [
  // Admin credentials, portal credentials, passwords, tokens, secrets
  /(admin|developer|portal|root|superuser|service[_\s-]?role)[_\s-]*(credential|credentials|login|password|pass|passwd|auth|secret|token|key|cookie|session)/i,
  /(api[_\s-]?key|apikey|secret|token|password|credential|passwd|pwd|auth_token|refresh_token|jwt|bearer)/i,

  // Environment variables and secrets
  /(environment[_\s-]?variable|env[_\s-]?var|dotenv|\.env|process\.env|vite_[a-z0-9_]+)/i,
  /(gemini|supabase|agora|resend|smtp|database|db)[_\s-]*(key|secret|token|pass|password|dump|drop|url|config)/i,

  // Private customer information, personal data, PII, database dump
  /(private\s+(customer|user|client)\s+(information|data|details|records)|customer\s+(information|data|details|records)|personal\s+(data|information|details)|pii|credit\s*cards?|phone\s*numbers?)/i,
  /(dump\s+(the\s+)?database|select\s+\*\s+from|drop\s+table|union\s+select|sql\s+injection|show\s+all\s+(users|customers|emails|passwords|records))/i,

  // Internal system details, source code, architecture, system prompts, jailbreaks
  /(internal\s+(system\s+details|system|internals|architecture|code|endpoints?|infra)|system\s+internals|backend\s+(source|code|internals|server)|server\s+internals|source\s+code|github\s+token)/i,
  /(system[_\s-]?prompt|ignore\s+(all\s+)?previous\s+instructions|reveal\s+(your\s+)?instructions|jailbreak)/i,
];

// Telugu-English mapping to standard English conceptual terms
const TELUGU_SYNONYM_MAP: Record<string, string[]> = {
  pricing: ['entha', 'fees', 'cost', 'charge', 'rate', 'rupees', 'karchu', 'dhara', 'ammount'],
  booking: ['ela book', 'book cheyali', 'book chesukovali', 'booking ela', 'slot kavali', 'book chesukovadam'],
  payment: ['payment success', 'confirmation ekkada', 'utr ekkada', 'dabbu', 'paid chesa', 'upi ekkada'],
  meetings: ['join avvatledhu', 'join avvaledhu', 'open avvatledu', 'camera ravatledhu', 'sound ravatledhu', 'mic issue', 'link ekkada'],
  reschedule: ['time change', 'change cheyavacha', 'reschedule ela', 'date marchukovaccha', 'postpone'],
  refund: ['refund vastunda', 'cancel cheyavacha', 'money back vastunda', 'dabbu tirigi'],
  consultants: ['consultant unnaara', 'evaru unnaru', 'experts evaru', 'doctor laaga', 'advisors'],
  about: ['e website enti', 'deni gurinchi', 'cheppandi', 'em chestundi', 'foundarly ante enti'],
};

// Common English stop words that should not trigger false positive category/title matches
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'do', 'does', 'did', 'how', 'what',
  'when', 'where', 'who', 'why', 'can', 'could', 'you', 'your', 'i', 'my', 'me', 'our'
]);

/**
 * Checks if a user prompt attempts to probe secrets or private customer records.
 */
export function checkSecurityGuardrails(input: string): { isSafe: boolean; warning?: string } {
  const cleanInput = input.trim();
  for (const pattern of SECURITY_PATTERNS) {
    if (pattern.test(cleanInput)) {
      return {
        isSafe: false,
        warning: REFUSAL_MESSAGE,
      };
    }
  }
  return { isSafe: true };
}

/**
 * Normalizes input text into clean lowercase token array.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/**
 * Calculates a match score for a topic against user input.
 */
export function scoreTopic(query: string, tokens: string[], topic: KnowledgeTopic): { score: number; matchedWords: string[] } {
  let score = 0;
  const matchedWords: string[] = [];
  const lowerQuery = query.toLowerCase();
  const tokenSet = new Set(tokens);

  // 1. Keyword match (exact token for single word, phrase match for multi-word)
  for (const kw of topic.keywords) {
    const cleanKw = kw.toLowerCase().trim();
    if (cleanKw.includes(' ')) {
      if (lowerQuery.includes(cleanKw)) {
        score += 3.5;
        matchedWords.push(cleanKw);
      }
    } else {
      if (tokenSet.has(cleanKw)) {
        score += 2.5;
        matchedWords.push(cleanKw);
      }
    }
  }

  // 2. Telugu Keywords
  if (topic.teluguKeywords) {
    for (const tkw of topic.teluguKeywords) {
      const cleanTkw = tkw.toLowerCase().trim();
      if (cleanTkw.includes(' ')) {
        if (lowerQuery.includes(cleanTkw)) {
          score += 3.5;
          matchedWords.push(cleanTkw);
        }
      } else {
        if (tokenSet.has(cleanTkw) || lowerQuery.includes(cleanTkw)) {
          score += 3.0;
          matchedWords.push(cleanTkw);
        }
      }
    }
  }

  // 3. Token-level matching against topic title and category (ignoring common stop words)
  const titleTokens = tokenize(topic.title).filter((t) => !STOP_WORDS.has(t));
  const categoryTokens = tokenize(topic.category).filter((t) => !STOP_WORDS.has(t));

  for (const t of tokens) {
    if (STOP_WORDS.has(t)) continue;
    if (titleTokens.includes(t)) {
      score += 1.5;
      matchedWords.push(t);
    } else if (categoryTokens.includes(t)) {
      score += 1.0;
      matchedWords.push(t);
    }
  }

  // 4. Check Telugu Synonym expansion
  for (const [key, synonyms] of Object.entries(TELUGU_SYNONYM_MAP)) {
    for (const syn of synonyms) {
      if (lowerQuery.includes(syn)) {
        if (topic.id.includes(key) || topic.category.toLowerCase().includes(key)) {
          score += 2.5;
          matchedWords.push(syn);
        }
      }
    }
  }

  return { score, matchedWords: Array.from(new Set(matchedWords)) };
}

/**
 * Finds the best matching KnowledgeTopic for user query.
 */
export function matchIntent(query: string): MatchResult {
  const clean = query.trim();
  if (!clean) {
    return {
      topic: null,
      confidence: 0,
      isSecurityBlock: false,
      matchedKeywords: [],
    };
  }

  // Security guardrail check first
  const securityCheck = checkSecurityGuardrails(clean);
  if (!securityCheck.isSafe) {
    return {
      topic: null,
      confidence: 1.0,
      isSecurityBlock: true,
      securityMessage: securityCheck.warning,
      matchedKeywords: ['security_filter'],
    };
  }

  const tokens = tokenize(clean);
  let bestTopic: KnowledgeTopic | null = null;
  let highestScore = 0;
  let bestMatchedWords: string[] = [];

  for (const topic of KNOWLEDGE_BASE) {
    const { score, matchedWords } = scoreTopic(clean, tokens, topic);
    if (score > highestScore) {
      highestScore = score;
      bestTopic = topic;
      bestMatchedWords = matchedWords;
    }
  }

  // Confidence threshold: at least 1.5 score to count as a confident match
  if (highestScore >= 1.5 && bestTopic) {
    return {
      topic: bestTopic,
      confidence: Math.min(1.0, highestScore / 5.0),
      matchedCategory: bestTopic.category,
      isSecurityBlock: false,
      matchedKeywords: bestMatchedWords,
    };
  }

  return {
    topic: null,
    confidence: highestScore / 5.0,
    isSecurityBlock: false,
    matchedKeywords: bestMatchedWords,
  };
}
