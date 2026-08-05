import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { settingsService } from '@/services/settings';
import { secureLog } from '@/utils/security';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const settings = await settingsService.getAll();
      const themeSetting = settings.find(s => s.setting_key === 'site_theme');
      if (themeSetting?.setting_value) {
        const savedTheme = themeSetting.setting_value as Theme;
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      } else {
        applyTheme('light');
      }
    } catch (error) {
      secureLog.error('Error loading theme:', error);
      applyTheme('light');
    } finally {
      setLoading(false);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    
    try {
      await settingsService.upsert('site_theme', newTheme);
    } catch (error) {
      secureLog.error('Error saving theme:', error);
    }
  };

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      // Dark theme with gold accents
      root.style.setProperty('--background', '240 6% 7%');
      root.style.setProperty('--foreground', '40 20% 92%');
      root.style.setProperty('--card', '240 5% 10%');
      root.style.setProperty('--card-foreground', '40 20% 92%');
      root.style.setProperty('--popover', '240 5% 10%');
      root.style.setProperty('--popover-foreground', '40 20% 92%');
      root.style.setProperty('--primary', '45 100% 58%');
      root.style.setProperty('--primary-foreground', '240 6% 7%');
      root.style.setProperty('--secondary', '240 4% 16%');
      root.style.setProperty('--secondary-foreground', '40 15% 80%');
      root.style.setProperty('--muted', '240 4% 14%');
      root.style.setProperty('--muted-foreground', '240 5% 55%');
      root.style.setProperty('--accent', '45 80% 50%');
      root.style.setProperty('--accent-foreground', '240 6% 7%');
      root.style.setProperty('--border', '240 4% 18%');
      root.style.setProperty('--input', '240 4% 18%');
      root.style.setProperty('--ring', '45 100% 58%');
      root.style.setProperty('--surface-elevated', '240 5% 12%');
      
      // Sidebar colors for dark theme
      root.style.setProperty('--sidebar-background', '240 6% 7%');
      root.style.setProperty('--sidebar-foreground', '40 20% 92%');
      root.style.setProperty('--sidebar-primary', '45 100% 58%');
      root.style.setProperty('--sidebar-primary-foreground', '240 6% 7%');
      root.style.setProperty('--sidebar-accent', '240 4% 14%');
      root.style.setProperty('--sidebar-accent-foreground', '40 20% 92%');
      root.style.setProperty('--sidebar-border', '240 4% 18%');
      root.style.setProperty('--sidebar-ring', '45 100% 58%');
    } else {
      // Light theme with yellow accents
      root.style.setProperty('--background', '48 100% 98%');
      root.style.setProperty('--foreground', '40 10% 15%');
      root.style.setProperty('--card', '0 0% 100%');
      root.style.setProperty('--card-foreground', '40 10% 15%');
      root.style.setProperty('--popover', '0 0% 100%');
      root.style.setProperty('--popover-foreground', '40 10% 15%');
      root.style.setProperty('--primary', '45 100% 50%');
      root.style.setProperty('--primary-foreground', '0 0% 100%');
      root.style.setProperty('--secondary', '48 100% 95%');
      root.style.setProperty('--secondary-foreground', '40 10% 15%');
      root.style.setProperty('--muted', '48 50% 92%');
      root.style.setProperty('--muted-foreground', '40 10% 45%');
      root.style.setProperty('--accent', '45 100% 55%');
      root.style.setProperty('--accent-foreground', '0 0% 100%');
      root.style.setProperty('--border', '45 30% 85%');
      root.style.setProperty('--input', '45 30% 85%');
      root.style.setProperty('--ring', '45 100% 50%');
      root.style.setProperty('--surface-elevated', '48 100% 96%');
      
      // Sidebar colors for light theme
      root.style.setProperty('--sidebar-background', '0 0% 100%');
      root.style.setProperty('--sidebar-foreground', '40 10% 15%');
      root.style.setProperty('--sidebar-primary', '45 100% 50%');
      root.style.setProperty('--sidebar-primary-foreground', '0 0% 100%');
      root.style.setProperty('--sidebar-accent', '48 100% 95%');
      root.style.setProperty('--sidebar-accent-foreground', '40 10% 15%');
      root.style.setProperty('--sidebar-border', '45 30% 85%');
      root.style.setProperty('--sidebar-ring', '45 100% 50%');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
