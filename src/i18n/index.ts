import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

/**
 * All user-visible texts come from the translation resources (requirement SC-05). English is the only language
 * for now. A Hungarian file (locales/hu.json) can be added here later without touching any component.
 */
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
})

export default i18n
