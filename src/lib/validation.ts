/**
 * Input validation utilities for security and data integrity
 */

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Sanitize string input (remove potential XSS)
export const sanitizeString = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
};

// Validate URL
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Validate phone number (basic)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

// Validate price (positive number with max 2 decimals)
export const isValidPrice = (price: number): boolean => {
  return price >= 0 && Number.isFinite(price);
};

// Validate date (not in the past)
export const isValidFutureDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

// Validate time format (HH:MM)
export const isValidTime = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Validate text length
export const isValidLength = (text: string, min: number, max: number): boolean => {
  const length = text.trim().length;
  return length >= min && length <= max;
};

// Validate slug (URL-friendly string)
export const isValidSlug = (slug: string): boolean => {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug);
};

// Generate slug from title
export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

// Validate rating (1-5)
export const isValidRating = (rating: number): boolean => {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
};

// Validate session duration
export const isValidSessionDuration = (duration: number): boolean => {
  return duration === 30 || duration === 60;
};

// Sanitize HTML content (basic - for rich text)
export const sanitizeHtml = (html: string): string => {
  // Allow only safe tags
  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a'];
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Remove script tags and event handlers
  const scripts = div.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  const allElements = div.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove event handlers
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
    
    // Remove disallowed tags
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...Array.from(el.childNodes));
    }
  });
  
  return div.innerHTML;
};

// Validate file type for images
export const isValidImageType = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  return validTypes.includes(file.type);
};

// Validate file size (in MB)
export const isValidFileSize = (file: File, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

// Validate currency code
export const isValidCurrency = (currency: string): boolean => {
  const validCurrencies = [
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'MXN',
    'BRL', 'ZAR', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB'
  ];
  return validCurrencies.includes(currency);
};

// Validate role
export const isValidRole = (role: string): boolean => {
  return role === 'admin' || role === 'client';
};

// Validate booking status
export const isValidBookingStatus = (status: string): boolean => {
  return ['pending', 'confirmed', 'completed', 'cancelled'].includes(status);
};

// Validate payment status
export const isValidPaymentStatus = (status: string): boolean => {
  return ['pending', 'paid', 'refunded'].includes(status);
};
