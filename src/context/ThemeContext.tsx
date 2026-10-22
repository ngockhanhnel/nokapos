import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  applyTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ applyTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentShop } = useAuth();

  const applyTheme = () => {
    if (currentShop?.brandConfig) {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', currentShop.brandConfig.primaryColor);
      root.style.setProperty('--color-secondary', currentShop.brandConfig.secondaryColor);
      root.style.setProperty('--font-family', currentShop.brandConfig.fontFamily);
      // Logo URL logic would be handled in components
    }
  };

  useEffect(() => {
    applyTheme();
  }, [currentShop]);

  return <ThemeContext.Provider value={{ applyTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
