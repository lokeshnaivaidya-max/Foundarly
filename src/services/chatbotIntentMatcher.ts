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

// Patterns that attempt to extract confidential credentials or system bypasses
const SECURITY_PATTERNS = [
  /(api[_\s-]?key|apikey|secret|token|password|credential|passwd|dotenv|\.env)/i,
  /(gemini|supabase|jwt|bearer|smtp|database|db)[_\s-]*(key|secret|token|pass|password|dump|drop)/i,
  /(system[_\s-]?prompt|ignore\s+(all\s+)?previous\s+instructions|reveal\s+(your\s+)?instructions|jailbreak)/i,
  /(dump\s+(the\s+)?database|select\s+\*\s+from|drop\s+table|union\s+select|sql\s+injection)/i,
  /(show\s+(me\s+)?(all\s+)?(user|customer)\s+(emails|passwords|data|phone\s+numbers|credit\s+cards|tokens))/i,
  /(admin\s+password|developer\s+secret|customer\s+credit\s+card|private\s+token|service[_\s-]?role)/i,
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
        warning:
          'I am Foundarly’s support assistant. For privacy and platform security, system credentials, internal environment variables, operational access keys, and private customer records are strictly confidential and protected. How may I assist you with public consultation services, pricing, or booking?',
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
