# AI Chat Widget - UI Preview

## Visual Structure

```
┌─────────────────────────────────────┐
│  🌟 Foundarly Assistant              │ ← Yellow/Gold Gradient Header
│     Always here to help         [X] │
├─────────────────────────────────────┤
│                                     │
│  Welcome to Foundarly!               │
│  I'm here to help you with...      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ How do I book a consultation?│  │ ← Quick Questions
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ What services do you offer? │   │
│  └─────────────────────────────┘   │
│                                     │
│                    ┌──────────────┐ │
│                    │ User Message │ │ ← User (Right, Yellow)
│                    │ 2:30 PM      │ │
│                    └──────────────┘ │
│                                     │
│  ┌──────────────┐                  │
│  │ AI Response  │                  │ ← AI (Left, Light)
│  │ 2:30 PM      │                  │
│  └──────────────┘                  │
│                                     │
├─────────────────────────────────────┤
│  [Type message...        ] [Send]  │ ← Input Area
│  ✨ Powered by Foundarly AI          │
└─────────────────────────────────────┘
```

## Floating Button (Closed State)

```
                                    ┌─────────────────┐
                                    │ Chat with us 👋 │ ← Tooltip
                                    └────────┬────────┘
                                             │
                                        ┌────┴────┐
                                        │    💬   │ ← Yellow Button
                                        │    2    │    with Badge
                                        └─────────┘
```

## Color Scheme

### Header
- Background: Gradient from `primary` (yellow) to `accent` (gold)
- Text: White
- Icon: White with sparkles ✨

### Messages
- **User Messages**: 
  - Background: Primary (yellow)
  - Text: White
  - Position: Right-aligned
  
- **AI Messages**:
  - Background: Secondary (light yellow/cream)
  - Text: Foreground (dark)
  - Position: Left-aligned

### Button
- Background: Primary (yellow)
- Glow: Gold shadow effect
- Icon: Message circle 💬
- Badge: Red with white text

### Input Area
- Background: Card background
- Border: Border color
- Button: Primary color
- Footer: Muted text with sparkle icon

## Dimensions

- **Chat Window**: 380px × 600px
- **Button**: 56px × 56px (rounded)
- **Position**: Fixed bottom-right (24px from edges)
- **Max Message Width**: 80% of chat width

## Typography

- **Header Title**: Playfair Display (font-display), semibold
- **Header Subtitle**: Inter, small
- **Messages**: Inter, small
- **Timestamps**: Inter, extra small, opacity 70%
- **Input**: Inter, regular

## Animations

- **Chat Open**: Slide in from bottom (300ms)
- **Button Hover**: Shadow expansion
- **Badge**: Pulse animation
- **Loading**: Spinner rotation
- **Messages**: Fade in

## States

### Empty State
- Welcome message
- Sparkle icon (large)
- 4 quick question buttons
- Friendly greeting

### Active Chat
- Message history
- Auto-scroll to bottom
- Timestamps on messages
- User/AI distinction clear

### Loading State
- Spinner in AI message position
- Input disabled
- Send button disabled
- Gray overlay on input

### Error State
- Toast notification
- Error message in chat
- Retry option
- Input remains enabled

## Responsive Behavior

### Desktop (> 768px)
- Full 380px width
- Fixed position bottom-right
- Hover tooltips visible

### Mobile (< 768px)
- Adapts to screen width
- Maintains aspect ratio
- Touch-friendly buttons
- No hover tooltips

## Accessibility

- Keyboard navigation (Tab, Enter, Esc)
- Focus indicators on interactive elements
- Semantic HTML structure
- ARIA labels (to be enhanced)

## Theme Integration

Matches Foundarly's design system:
- ✅ Yellow/gold primary colors
- ✅ Playfair Display for headings
- ✅ Inter for body text
- ✅ Consistent border radius
- ✅ Glow effects
- ✅ Gradient backgrounds
- ✅ Professional spacing

---

**Design System**: Foundarly Theme  
**Colors**: Yellow/Gold/Cream  
**Fonts**: Playfair Display + Inter  
**Style**: Professional, Modern, Friendly
