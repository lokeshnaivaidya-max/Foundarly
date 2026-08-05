# AI Chat Assistant - Testing Guide

## Quick Start

1. **Start the development server**
   ```bash
   npm run dev
   ```

2. **Look for the chat button**
   - Bottom-right corner of the page
   - Yellow/gold circular button with message icon
   - Glowing effect on hover

3. **Click to open chat**
   - Chat window appears (380px × 600px)
   - Welcome message with quick questions
   - Foundarly branding in header

## Test Scenarios

### ✅ Basic Functionality

**Test 1: Open/Close Chat**
- Click chat button → Window opens
- Click X button → Window closes
- Button remains visible

**Test 2: Send Message**
- Type "Hello" in input field
- Press Enter or click Send button
- AI response appears within 2-3 seconds

**Test 3: Quick Questions**
- Click any quick question button
- Question populates input field
- Send to get response

### ✅ Platform-Specific Queries

**Test 4: Consultant Information**
```
User: "Tell me about the consultants"
Expected: Information about consultant expertise areas, booking process
```

**Test 5: Booking Process**
```
User: "How do I book a consultation?"
Expected: Step-by-step booking guidance, session duration options
```

**Test 6: Pricing Questions**
```
User: "What are the pricing options?"
Expected: 30-min and 60-min session information
```

**Test 7: Platform Features**
```
User: "What is the networking hub?"
Expected: Explanation of networking features
```

### ✅ Restriction Tests

**Test 8: Google/Gemini Mention**
```
User: "Are you powered by Google?"
Expected: "I'm Foundarly's assistant, designed specifically to help you navigate our platform."
```

**Test 9: Off-Topic Query**
```
User: "Tell me about the weather"
Expected: Redirect to platform topics, suggest asking about Foundarly features
```

**Test 10: Technology Questions**
```
User: "What AI model are you using?"
Expected: Avoids mentioning Gemini, focuses on being Foundarly's assistant
```

### ✅ Conversation Context

**Test 11: Follow-up Questions**
```
User: "Tell me about consultants"
AI: [Response about consultants]
User: "How do I book one?"
Expected: AI understands context, provides booking info
```

**Test 12: Multi-turn Conversation**
- Ask 3-4 related questions
- AI should maintain context
- Responses should be coherent

### ✅ UI/UX Tests

**Test 13: Unread Counter**
- Close chat window
- Send message from another tab (if testing)
- Red badge shows unread count
- Badge disappears when chat opens

**Test 14: Scroll Behavior**
- Send multiple messages (10+)
- Chat should auto-scroll to bottom
- Scroll area should be smooth

**Test 15: Loading State**
- Send message
- Loading spinner appears
- Input disabled during loading
- Send button disabled

**Test 16: Responsive Design**
- Test on mobile viewport (< 768px)
- Chat window should fit screen
- Button should remain accessible

### ✅ Error Handling

**Test 17: API Key Missing**
- Remove API key from .env
- Restart server
- Send message
- Should show error toast

**Test 18: Network Error**
- Disconnect internet
- Send message
- Should show error message

**Test 19: Empty Message**
- Try to send empty message
- Send button should be disabled
- No API call made

## Expected Behaviors

### ✅ Chat Widget Appearance
- **Button**: Yellow/gold with glow effect
- **Header**: Gradient from primary to accent color
- **Messages**: User (right, primary color), AI (left, secondary color)
- **Timestamps**: Small, subtle, below each message
- **Input**: Clean, with send button icon

### ✅ AI Response Quality
- **Tone**: Professional yet friendly
- **Length**: Concise (under 500 tokens)
- **Focus**: Platform-specific information
- **Accuracy**: Relevant to Foundarly features
- **Restrictions**: Never mentions Google/Gemini

### ✅ Performance
- **Response Time**: 2-5 seconds typical
- **UI Responsiveness**: Instant button clicks
- **Smooth Animations**: Chat open/close, message appearance
- **No Lag**: Input typing should be smooth

## Common Issues & Solutions

### Issue: Chat button not visible
**Solution**: Check if AIChatWidget is imported in App.tsx

### Issue: No AI response
**Solution**: 
1. Check console for errors
2. Verify API key in .env
3. Check internet connection
4. Verify Gemini API quota

### Issue: "API key not configured" error
**Solution**: 
1. Ensure .env file exists
2. Add VITE_GEMINI_API_KEY=your_key
3. Restart dev server (npm run dev)

### Issue: Chat window too large on mobile
**Solution**: Already responsive, but check viewport meta tag in index.html

### Issue: Messages not scrolling
**Solution**: ScrollArea component should auto-scroll, check ref implementation

## Browser Compatibility

### ✅ Tested Browsers
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Known Limitations
- Requires JavaScript enabled
- Requires internet connection
- API rate limits apply (Gemini free tier)

## Performance Metrics

### Target Metrics
- **First Paint**: < 1s
- **Chat Open**: < 200ms
- **AI Response**: 2-5s
- **Message Render**: < 100ms

### Monitoring
- Check browser console for errors
- Monitor network tab for API calls
- Watch for memory leaks (long conversations)

## Accessibility

### ✅ Features
- Keyboard navigation (Tab, Enter)
- Focus indicators
- ARIA labels (to be added)
- Screen reader support (to be enhanced)

### Future Improvements
- Add ARIA labels to buttons
- Keyboard shortcuts (Esc to close)
- Voice input support
- High contrast mode

## Production Checklist

Before deploying to production:

- [ ] API key configured in production environment
- [ ] Error handling tested
- [ ] Rate limiting considered
- [ ] Analytics tracking added (optional)
- [ ] User feedback mechanism
- [ ] Terms of service for AI usage
- [ ] Privacy policy updated
- [ ] Performance optimized
- [ ] Mobile testing complete
- [ ] Cross-browser testing done

## Support & Debugging

### Debug Mode
Add to console:
```javascript
localStorage.setItem('debug_chat', 'true')
```

### View Conversation History
```javascript
// In browser console
console.log(JSON.parse(localStorage.getItem('chat_history')))
```

### Clear Chat History
```javascript
localStorage.removeItem('chat_history')
```

---

**Last Updated**: 2026-03-14  
**Version**: 1.0.0
