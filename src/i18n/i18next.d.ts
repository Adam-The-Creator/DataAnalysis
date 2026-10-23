import 'i18next'
import type en from './locales/en.json'

/** Typed translation keys: a missing or misspelled key is a compile error. */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
