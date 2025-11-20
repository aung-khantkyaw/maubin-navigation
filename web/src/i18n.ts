import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// We'll load static resources directly (bundled) for en and mm.
// Additional namespaces can be added later.
import enCommon from './locales/en/common.json';
import mmCommon from './locales/mm/common.json';
import enDetails from './locales/en/details.json';
import mmDetails from './locales/mm/details.json';
import enHome from './locales/en/home.json';
import mmHome from './locales/mm/home.json';

const STORAGE_KEY = 'app_language';

const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const fallbackLng = 'en';
const supportedLngs = ['en', 'mm'];
const initialLng = saved && supportedLngs.includes(saved) ? saved : fallbackLng;

i18n
  .use(initReactI18next)
  .init({
    lng: initialLng,
    fallbackLng,
    supportedLngs,
    defaultNS: 'common',
    ns: ['common', 'details', 'home'],
    resources: {
      en: { common: enCommon, details: enDetails, home: enHome },
      mm: { common: mmCommon, details: mmDetails, home: mmHome }
    },
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'] },
    load: 'currentOnly'
  });

export function setLanguage(lng: string) {
  if (!supportedLngs.includes(lng)) return;
  i18n.changeLanguage(lng);
  try { localStorage.setItem(STORAGE_KEY, lng); } catch { /* ignore persistence errors */ }
}

export default i18n;
