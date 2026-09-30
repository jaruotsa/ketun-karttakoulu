// Texts: i18next and the language files (js/locales/<language>.json). For now there is only
// Finnish.
import i18next from 'i18next';
import fi from './locales/fi.json';

i18next.init({
  lng: 'fi',
  fallbackLng: 'fi',
  resources: { fi: { translation: fi } },
  initAsync: false,
  interpolation: { escapeValue: false },
});

export const t = i18next.t.bind(i18next);

// Numbers shown to people use the format of the current language (Finnish: decimal comma, space
// between thousands). Numbers in SVG and other code must not use this, since they need a decimal
// point.
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(i18next.language, options).format(value);
}

// Fills the texts of the static HTML from the language file. Attributes on an element:
//   data-i18n="key"                      the text of the element
//   data-i18n-html="key"                 the same, with markup allowed (own strings only)
//   data-i18n-attr="attribute:key;..."   attributes such as aria-label and title
export function translatePage(root: ParentNode = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n')!);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.getAttribute('data-i18n-html')!);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.getAttribute('data-i18n-attr')!.split(';')) {
      const [attribute, key] = pair.split(':');
      el.setAttribute(attribute, t(key));
    }
  });
  document.documentElement.lang = i18next.language;
}

// Module scripts run after the page has been parsed, so the elements exist already.
if (typeof document !== 'undefined') translatePage();
