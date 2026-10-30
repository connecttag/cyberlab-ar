import { createContext, useContext } from "react";
import type { Language, Report } from "@cyberlab/core/report";
import { translate, type MessageKey } from "./messages";
export interface LabContext {
  lang: Language;
  reports: Report[];
  addReport: (report: Report) => void;
  navigate: (page: string) => void;
  notify: (message: string) => void;
}
export const Context = createContext<LabContext>(null!);
export function useLab() {
  const context = useContext(Context);
  return {
    ...context,
    t: (key: MessageKey) => translate(key, context.lang),
    text: (ar: string, en: string) => (context.lang === "ar" ? ar : en)
  };
}
