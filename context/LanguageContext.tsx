import translations, { SupportedLanguage, TranslationKeys } from '@/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const LANGUAGE_STORAGE_KEY = 'app_language';

interface LanguageContextType {
    language: SupportedLanguage;
    languageCode: string;
    setLanguage: (lang: SupportedLanguage) => void;
    t: (key: TranslationKeys) => string;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'en',
    languageCode: 'en-US',
    setLanguage: () => { },
    t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<SupportedLanguage>('en');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved language on mount
    useEffect(() => {
        const load = async () => {
            try {
                const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
                if (saved === 'en' || saved === 'th') {
                    setLanguageState(saved);
                }
            } catch (e) {
                console.error('Error loading language preference', e);
            } finally {
                setIsLoaded(true);
            }
        };
        load();
    }, []);

    const setLanguage = useCallback(async (lang: SupportedLanguage) => {
        setLanguageState(lang);
        try {
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        } catch (e) {
            console.error('Error saving language preference', e);
        }
    }, []);

    const t = useCallback((key: TranslationKeys): string => {
        return translations[language]?.[key] || translations['en']?.[key] || key;
    }, [language]);

    const languageCode = language === 'th' ? 'th-TH' : 'en-US';

    // Don't render children until language is loaded to avoid flicker
    if (!isLoaded) return null;

    return (
        <LanguageContext.Provider value={{ language, languageCode, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;
