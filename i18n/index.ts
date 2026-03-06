import en, { TranslationKeys } from './en';
import th from './th';

export type SupportedLanguage = 'en' | 'th';

export const translations: Record<SupportedLanguage, Record<string, string>> = {
    en,
    th,
};

export const LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'th', label: 'ไทย', flag: '🇹🇭' },
];

export type { TranslationKeys };
export default translations;
