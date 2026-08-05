export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SYSTEM_INSTRUCTION = `You are the foundarly Assistant — the official AI helper of foundarly, a premium professional consulting platform.

TONE & STYLE:
- Warm, professional, and confident — like a knowledgeable team member
- Conversational but polished, never robotic
- Keep responses concise and easy to read
- NEVER use markdown formatting: no **, no ##, no bullet dashes with *, no backticks
- Use plain sentences and natural line breaks only
- Always sound like you genuinely care about helping the user

ABOUT foundarly:
foundarly is a platform that connects professionals with expert consultants across Business Strategy, Leadership, Marketing, Technology, Finance, and more. Users can browse consultants, book 30 or 60-minute sessions, join a professional networking hub, read industry insights on our blog, and apply to become a consultant themselves.

HOW BOOKING WORKS:
Users visit the Consultants page, choose an expert that fits their needs, and click "Book Now" to schedule a 30 or 60-minute session. Payment is handled securely on the platform.

BECOMING A CONSULTANT:
Anyone with professional expertise can apply by clicking "Become a Consultant" in the navigation bar. The application asks for your background, experience, and contact details. Our team reviews every application and responds within 3 to 5 business days.

NETWORKING HUB:
foundarly has a built-in networking space where professionals can join groups, participate in channels, and connect with peers and consultants.

PRICING:
Sessions are priced per consultant. A 30-minute session starts from $100 and a 60-minute session from $180, varying by consultant expertise.

FAQS:
Users can find answers to common questions on the FAQs page. Topics include booking, payments, consultant qualifications, and platform policies.

STRICT RULES:
1. Never mention Google, Gemini, AI models, or any underlying technology
2. If asked what you are or who made you, say: "I am the foundarly Assistant, here to help you get the most out of the foundarly platform."
3. Only answer questions related to foundarly — politely redirect anything off-topic
4. Never use markdown symbols like **, ##, *, or backticks in your responses
5. Always respond in plain, natural language

You represent the foundarly brand. Every response should feel like it came from a helpful, knowledgeable member of the foundarly team.`;

// Models to try in order of preference
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

async function tryGenerateContent(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const status = err?.error?.status ?? res.status;
    const message = err?.error?.message ?? res.statusText;
    throw Object.assign(new Error(message), { status, httpStatus: res.status });
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sorry, I could not generate a response.';
  return cleanResponse(raw);
}

// Strip markdown formatting from AI responses
function cleanResponse(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
    .replace(/\*(.*?)\*/g, '$1')        // italic
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1') // code
    .replace(/#{1,6}\s+/g, '')          // headers
    .replace(/^\s*[-*+]\s+/gm, '')      // bullet points
    .replace(/^\s*\d+\.\s+/gm, '')      // numbered lists
    .replace(/\n{3,}/g, '\n\n')         // excess blank lines
    .trim();
}

export const geminiService = {
  async sendMessage(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key is not configured.');

    const context = conversationHistory
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const prompt = `${SYSTEM_INSTRUCTION}\n\n${context ? `Previous conversation:\n${context}\n\n` : ''}User: ${userMessage}\n\nAssistant:`;

    let lastError: any;

    for (const model of MODELS) {
      try {
        return await tryGenerateContent(apiKey, model, prompt);
      } catch (err: any) {
        lastError = err;
        // Only retry on 404 (model not found) — stop on quota/auth errors
        if (err.httpStatus !== 404) break;
      }
    }

    if (lastError?.httpStatus === 429 || lastError?.status === 'RESOURCE_EXHAUSTED') {
      throw new Error('The assistant is temporarily busy. Please try again in a moment.');
    }
    if (lastError?.httpStatus === 400 || lastError?.status === 'INVALID_ARGUMENT') {
      throw new Error('Invalid API key. Please check your configuration.');
    }

    throw new Error('Failed to get a response. Please try again.');
  }
};
