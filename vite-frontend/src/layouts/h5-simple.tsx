import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Logo } from '@/components/icons';
import { LanguageSwitch } from '@/components/language-switch';
import { siteConfig } from '@/config/site';
import { controlCenterSections } from '@/config/control-center';
import { useLanguage } from '@/i18n';

export default function H5SimpleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  
  // 路由切换时回到顶部，避免上一页滚动位置保留
  React.useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [location.pathname]);

  const activeSection = location.hash.replace('#', '') || 'dashboard';

  const handleSectionClick = (id: string) => {
    navigate(`/control-center#${id}`);
    window.dispatchEvent(new CustomEvent('ob-control-section', { detail: id }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-black">
      {/* 顶部导航栏 */}
      <header className="bg-white dark:bg-black shadow-sm border-b border-gray-200 dark:border-gray-600 h-14 safe-top flex-shrink-0 flex items-center justify-between px-4 relative z-10">
        <div className="flex items-center gap-2">
          <Logo size={20} />
          <h1 className="text-sm font-bold text-foreground">{siteConfig.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitch />
        </div>
      </header>

      {location.pathname === '/control-center' && (
        <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-black/90">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {controlCenterSections.map(section => {
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section.id)}
                  className={`h-9 flex-shrink-0 rounded-small px-3 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200'
                  }`}
                >
                  {t(section.label)}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* 主内容区域 */}
      <main className="flex-1 bg-gray-100 dark:bg-black pb-0">
        {children}
      </main>
    </div>
  );
}
