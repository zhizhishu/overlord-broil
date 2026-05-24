import { useLanguage } from "@/i18n";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useLanguage();

  const itemClass = (active: boolean) =>
    [
      "h-8 min-w-10 rounded-[6px] px-2 text-xs font-semibold transition-colors",
      active
        ? "bg-primary text-white shadow-sm"
        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
    ].join(" ");

  return (
    <div
      aria-label={t("语言")}
      className="flex items-center gap-1 rounded-small border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-black"
      role="group"
      title={t("语言")}
    >
      <button className={itemClass(locale === "zh-CN")} onClick={() => setLocale("zh-CN")} type="button">
        中
      </button>
      <button className={itemClass(locale === "en-US")} onClick={() => setLocale("en-US")} type="button">
        EN
      </button>
    </div>
  );
}
