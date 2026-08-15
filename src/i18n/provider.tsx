'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import en from './locales/en.json';
import zh from './locales/zh.json';

type Locale = 'en' | 'zh';
type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, zh };

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en'); // Default to English

  useEffect(() => {
    // This effect runs only on the client side
    const browserLang = navigator.language;
    if (browserLang.toLowerCase().startsWith('zh')) {
        setLocale('zh');
    }
    // No 'else' needed, as the default state is 'en'.
  }, []);

  const t = useCallback((key: string, replacements?: { [key: string]: string | number }) => {
    const keys = key.split('.');
    let value: any = translations[locale];
    for (const k of keys) {
      if (value === undefined) break;
      value = value[k];
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key "${key}" not found for locale "${locale}".`);
      return key;
    }

    if (replacements) {
        Object.keys(replacements).forEach(rKey => {
            value = value.replace(`{{${rKey}}}`, String(replacements[rKey]));
        });
    }

    return value;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
