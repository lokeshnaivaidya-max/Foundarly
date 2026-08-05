import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { settingsService } from '@/services/settings';

interface CurrencyContextType {
  currency: string;
  currencySymbol: string;
  formatPrice: (amount: number) => string;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const currencySymbols: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'CNY': '¥',
  'INR': '₹',
  'AUD': 'A$',
  'CAD': 'C$',
  'CHF': 'Fr',
  'SEK': 'kr',
  'NZD': 'NZ$',
  'KRW': '₩',
  'SGD': 'S$',
  'HKD': 'HK$',
  'NOK': 'kr',
  'MXN': '$',
  'BRL': 'R$',
  'ZAR': 'R',
  'RUB': '₽',
  'TRY': '₺',
};

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState('INR');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  const loadCurrency = async () => {
    try {
      const settings = await settingsService.getAll();
      const currencySetting = settings.find(s => s.setting_key === 'currency');
      const currencyCode = currencySetting?.setting_value || 'INR';
      const effectiveCode = currencyCode === 'USD' ? 'INR' : currencyCode;
      setCurrency(effectiveCode);
      setCurrencySymbol(currencySymbols[effectiveCode] || '₹');
    } catch (error) {
      console.error('Error loading currency:', error);
      // Default to INR if error
      setCurrency('INR');
      setCurrencySymbol('₹');
    }
  };

  useEffect(() => {
    loadCurrency();
  }, []);

  const formatPrice = (amount: number): string => {
    // For currencies that typically show symbol after amount
    const symbolAfter = ['SEK', 'NOK', 'CHF'];
    
    if (symbolAfter.includes(currency)) {
      return `${amount}${currencySymbol}`;
    }
    
    return `${currencySymbol}${amount}`;
  };

  const refreshCurrency = async () => {
    await loadCurrency();
  };

  const value = {
    currency,
    currencySymbol,
    formatPrice,
    refreshCurrency,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
