import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, LangCode, Translations, LANGUAGES } from './translations';

const STORAGE_KEY = '@gp_language';

interface LanguageContextType {
  lang: LangCode;
  t: Translations;
  setLang: (code: LangCode) => Promise<void>;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  t: translations.en,
  setLang: async () => {},
  languages: LANGUAGES,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in translations) {
        setLangState(saved as LangCode);
      }
    });
  }, []);

  const setLang = async (code: LangCode) => {
    setLangState(code);
    await AsyncStorage.setItem(STORAGE_KEY, code);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useI18n = () => useContext(LanguageContext);
