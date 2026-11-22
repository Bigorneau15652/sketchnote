// Language of the plugin: French or English, following the language of Obsidian (or the choice made in the settings).
// The French text is the key: `t("French text")` returns the English translation when the language is English, and the
// text itself otherwise. Variable values are written {0}, {1}... and passed as arguments.
import { EN } from "./i18n-en";

export type Lang = `fr` | `en`;
export type LangSetting = `auto` | Lang;

let current: Lang = `fr`;

// Language of Obsidian. Several sources, from the most reliable to the least: the key "language" of the local storage (absent when
// the application is in English, and absent in some versions too), the language of the date library of the application
// (moment, set to the language of Obsidian), the lang attribute of the page, and last the language of the browser. Without any of
// this information, the language is English.
export function detectLang(): Lang {
  try {
    if (typeof window === `undefined`) return `en`;
    const host = window as unknown as { localStorage?: { getItem(key: string): string | null }; moment?: { locale?: () => string }; document?: { documentElement?: { lang?: string } }; navigator?: { language?: string } };
    const sources = [host.localStorage?.getItem(`language`), host.moment?.locale?.(), host.document?.documentElement?.lang, host.navigator?.language];
    for (const value of sources) {
      if (typeof value === `string` && value.trim() !== ``) return value.trim().toLowerCase().startsWith(`fr`) ? `fr` : `en`;
    }
    return `en`;
  } catch {
    return `en`;
  }
}

export function setLanguage(mode: LangSetting): void {
  current = mode === `auto` ? detectLang() : mode;
}

export function currentLang(): Lang {
  return current;
}

export function t(fr: string, ...args: (string | number)[]): string {
  let out = current === `en` ? EN[fr] ?? fr : fr;
  args.forEach((a, i) => {
    out = out.split(`{${i}}`).join(String(a));
  });
  return out;
}
