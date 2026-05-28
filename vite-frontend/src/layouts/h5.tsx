import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Logo } from '@/components/icons';
import { LanguageSwitch } from '@/components/language-switch';
import { siteConfig } from '@/config/site';

interface TabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}



export default function H5Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabItems: TabItem[] = [
    {
      path: '/control-center',
      label: 'Overlord',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2h-3v2h2a1 1 0 110 2H6a1 1 0 110-2h2v-2H5a2 2 0 01-2-2V4zm2 0v5h10V4H5zm5 7v2h0v-2z" clipRule="evenodd" />
          <path d="M4 17a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
        </svg>
      )
    }
  ];

  const handleTabClick = (path: string) => {
    navigate(path);
  };

  const filteredTabItems = tabItems;

  // 路由切换时回到页面顶部，避免上一页的滚动位置遗留
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, [location.pathname]);

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

      {/* 主内容区域 */}
      <main className="flex-1 bg-gray-100 dark:bg-black">
        {children}
      </main>

      {/* 用于给固定 Tabbar 腾出空间的占位元素 */}
      <div aria-hidden className="h-16 safe-bottom" />

      {/* 底部Tabbar */}
      <nav className="bg-white dark:bg-black border-t border-gray-200 dark:border-gray-600 h-16 safe-bottom flex-shrink-0 flex items-center justify-around px-2 fixed bottom-0 left-0 right-0 z-30">
        {filteredTabItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleTabClick(item.path)}
              className={`
                flex flex-col items-center justify-center flex-1 h-full
                transition-colors duration-200 min-h-[44px]
                ${isActive 
                  ? 'text-primary-600 dark:text-primary-400' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }
              `}
            >
              <div className="flex-shrink-0 mb-1">
                {item.icon}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
