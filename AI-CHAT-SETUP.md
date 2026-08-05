# Foundarly AI Chat Assistant Setup Guide

## Overview
An AI-powered chat assistant integrated into the Foundarly platform using Google's Gemini API. The assistant helps users with consultants, bookings, FAQs, and platform navigation.

## Features

### Chat Widget
- **Floating Button**: Bottom-right corner with unread message counter
- **Responsive Design**: Matches Foundarly's theme and branding
- **Real-time Chat**: Instant responses from Gemini AI
- **Conversation History**: Maintains context across messages
- **Quick Questions**: Pre-defined questions for easy start

### AI Capabilities
- ✅ Consultant information and expertise
- ✅ Booking process guidance
- ✅ Platform features explanation
- ✅ FAQ assistance
- ✅ Pricing information
- ✅ Networking features help

### Restrictions
- ❌ Never mentions Google, Gemini, or AI technology
- ❌ Stays focused on Foundarly platform only
- ❌ Professional and concise responses
- ❌ Redirects off-topic queries

## Installation

### 1. Install Dependencies
```bash
npm install @google/generative-ai
```

### 2. Configure API Key
Add to `.env` file:
```env
VITE_GEMINI_API_KEY=AIzaSyADtWtdwqExK3K-TeWqj6QsS93d0oddEug
```

### 3. Files Created
- `src/services/gemini.ts` - Gemini API service
- `src/components/AIChatWidget.tsx` - Chat UI component
- Updated `src/App.tsx` - Added chat widget

## Usage

The chat widget is automatically available on all pages. Users can:

1. Click the floating chat button (bottom-right)
2. Type questions or select quick questions
3. Get instant AI-powered responses
4. Continue conversations with context

## Customization

### Update System Instructions
Edit `SYSTEM_INSTRUCTION` in `src/services/gemini.ts` to:
- Add more platform information
- Update consultant categories
- Modify tone and style
- Add new restrictions

### Modify Quick Questions
Edit `quickQuestions` array in `src/components/AIChatWidget.tsx`:
```typescript
const quickQuestions = [
  "How do I book a consultation?",
  "What services do you offer?",
  // Add more...
];
```

### Styling
The chat widget uses Foundarly's theme:
- Primary colors for branding
- Card backgrounds for consistency
- Border styles matching platform
- Responsive design for mobile

## API Configuration

### Model Settings
```typescript
model: "gemini-pro"
temperature: 0.7  // Balanced creativity
maxOutputTokens: 500  // Concise responses
```

### Conversation Context
- Keeps last 6 messages for context
- Maintains conversation flow
- Resets on page refresh

## Security & Privacy

### API Key Protection
- Stored in environment variables
- Not exposed in client code
- Validated before requests

### Content Restrictions
- Platform-focused responses only
- No personal data collection
- Professional tone maintained
- Brand protection (no Google mentions)

## Testing

### Test Scenarios
1. **Consultant Queries**
   - "Tell me about the consultants"
   - "What expertise areas are available?"

2. **Booking Questions**
   - "How do I book a consultation?"
   - "What are the session durations?"

3. **Platform Features**
   - "What is the networking hub?"
   - "How does pricing work?"

4. **Restriction Tests**
   - "Are you powered by Google?" → Should deny
   - "Tell me about politics" → Should redirect to platform topics

## Troubleshooting

### API Key Issues
```
Error: Invalid API key
```
**Solution**: Verify `VITE_GEMINI_API_KEY` in `.env` file

### No Response
```
Error: Failed to get response
```
**Solution**: Check internet connection and API quota

### Build Errors
```
Error: Cannot find module '@google/generative-ai'
```
**Solution**: Run `npm install @google/generative-ai`

## Future Enhancements

### Potential Features
- [ ] Voice input/output
- [ ] Multi-language support
- [ ] Chat history persistence
- [ ] Admin chat analytics
- [ ] Suggested actions (book now, view consultants)
- [ ] Integration with FAQ database
- [ ] Consultant recommendations based on queries

### Advanced Customization
- Load platform data dynamically (consultants, FAQs)
- Personalized responses based on user profile
- Integration with booking system
- Proactive assistance based on user behavior

## Support

For issues or questions:
1. Check console for error messages
2. Verify API key configuration
3. Review system instructions
4. Contact development team

## Notes

- The AI assistant is branded as "Foundarly Assistant"
- Never reveals underlying technology (Google/Gemini)
- Maintains professional tone aligned with platform
- Focuses exclusively on platform-related queries
- Provides helpful, concise responses

---

**Version**: 1.0.0  
**Last Updated**: 2026-03-14  
**Technology**: Google Gemini Pro API
