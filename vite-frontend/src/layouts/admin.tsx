import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@heroui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Input } from "@heroui/input";
import { toast } from 'react-hot-toast';

import { Logo } from '@/components/icons';
import { LanguageSwitch } from '@/components/language-switch';
import { updatePassword } from '@/api';
import { safeLogout } from '@/utils/logout';
import { siteConfig } from '@/config/site';
import { useLanguage } from '@/i18n';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface PasswordForm {
  newUsername: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const controlCenterSections = [
  { id: 'dashboard', label: '仪表盘' },
  { id: 'servers', label: '服务器' },
  { id: 'inbounds', label: '入站节点' },
  { id: 'routes', label: '出站与路由' },
  { id: 'tunnels', label: '转发/隧道' },
  { id: 'traffic', label: '流量' },
  { id: 'certificates', label: '证书' },
  { id: 'settings', label: '设置' }
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { t } = useLanguage();

  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    newUsername: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const menuItems: MenuItem[] = [
    {
      path: '/control-center',
      label: 'Overlord Broil',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v2a2 2 0 002 2h4v2H6a2 2 0 00-2 2v2a2 2 0 002 2h8a2 2 0 002-2v-2a2 2 0 00-2-2h-2V9h4a2 2 0 002-2V5a2 2 0 00-2-2H4zm0 2h12v2H4V5zm4 8h4v2H8v-2z" clipRule="evenodd" />
        </svg>
      ),
      adminOnly: true
    }
  ];

  // 检查移动端
  const checkMobile = () => {
    setIsMobile(window.innerWidth <= 768);
    if (window.innerWidth > 768) {
      setMobileMenuVisible(false);
    }
  };

  useEffect(() => {
    // 获取用户信息
    const name = localStorage.getItem('name') || 'Admin';
    
    setUsername(name);

    // 响应式检查
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 退出登录
  const handleLogout = () => {
    safeLogout();
    navigate('/');
  };

  // 切换移动端菜单
  const toggleMobileMenu = () => {
    setMobileMenuVisible(!mobileMenuVisible);
  };

  // 隐藏移动端菜单
  const hideMobileMenu = () => {
    setMobileMenuVisible(false);
  };

  // 菜单点击处理
  const handleMenuClick = (path: string) => {
    navigate(path);
    if (isMobile) {
      hideMobileMenu();
    }
  };

  const scrollToSection = (id: string) => {
    const run = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(run));
  };

  const handleSectionClick = (id: string) => {
    navigate(`/control-center#${id}`);
    scrollToSection(id);
    if (isMobile) {
      hideMobileMenu();
    }
  };

  // 密码表单验证
  const validatePasswordForm = (): boolean => {
    if (!passwordForm.newUsername.trim()) {
      toast.error(t('请输入新用户名'));
      return false;
    }
    if (passwordForm.newUsername.length < 3) {
      toast.error(t('用户名长度至少3位'));
      return false;
    }
    if (!passwordForm.currentPassword) {
      toast.error(t('请输入当前密码'));
      return false;
    }
    if (!passwordForm.newPassword) {
      toast.error(t('请输入新密码'));
      return false;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(t('新密码长度不能少于6位'));
      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('两次输入密码不一致'));
      return false;
    }
    return true;
  };

  // 提交密码修改
  const handlePasswordSubmit = async () => {
    if (!validatePasswordForm()) return;

    setPasswordLoading(true);
    try {
      const response = await updatePassword(passwordForm);
      if (response.code === 0) {
        toast.success(t('密码修改成功，请重新登录'));
        onOpenChange();
        handleLogout();
      } else {
        toast.error(response.msg || t('密码修改失败'));
      }
    } catch (error) {
      toast.error(t('修改密码时发生错误'));
      console.error('修改密码错误:', error);
    } finally {
      setPasswordLoading(false);
    }
  };

  // 重置密码表单
  const resetPasswordForm = () => {
    setPasswordForm({
      newUsername: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const filteredMenuItems = menuItems;

  return (
          <div className={`flex ${isMobile ? 'min-h-screen' : 'h-screen'} bg-gray-100 dark:bg-black`}>
      {/* 移动端遮罩层 */}
      {isMobile && mobileMenuVisible && (
        <div 
          className="fixed inset-0 backdrop-blur-sm bg-white/50 dark:bg-black/30 z-40"
          onClick={hideMobileMenu}
        />
      )}

      {/* 左侧菜单栏 */}
      <aside className={`
        ${isMobile ? 'fixed' : 'relative'} 
        ${isMobile && !mobileMenuVisible ? '-translate-x-full' : 'translate-x-0'}
        ${isMobile ? 'w-64' : 'w-72'} 
        bg-white dark:bg-black 
        shadow-lg 
        border-r border-gray-200 dark:border-gray-600
        z-50 
        transition-transform duration-300 ease-in-out
        flex flex-col
        ${isMobile ? 'h-screen' : 'h-full'}
        ${isMobile ? 'top-0 left-0' : ''}
      `}>
                 {/* Logo 区域 */}
         <div className="px-3 py-3 h-14 flex items-center">
           <div className="flex items-center gap-2 w-full">
             <Logo size={24} />
             <div className="flex-1 min-w-0">
               <h1 className="text-sm font-bold text-foreground overflow-hidden whitespace-nowrap">{siteConfig.name}</h1>
               <p className="text-xs text-default-500">v{siteConfig.version}</p>
             </div>
           </div>
         </div>

                 {/* 菜单导航 */}
         <nav className="flex-1 px-4 py-6 overflow-y-auto">
           <ul className="space-y-1">
            {filteredMenuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                 <li key={item.path}>
                                      <button
                      onClick={() => handleMenuClick(item.path)}
                      className={`
                       w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left
                       transition-colors duration-200 min-h-[44px]
                       ${isActive 
                         ? 'bg-primary-100 dark:bg-primary-600/20 text-primary-600 dark:text-primary-300' 
                         : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900'
                       }
                     `}
                   >
                     <div className="flex-shrink-0">
                       {item.icon}
                     </div>
                      <span className="font-medium text-sm">{item.label}</span>
                    </button>
                    {item.path === '/control-center' && isActive && (
                      <div className="mt-2 ml-8 space-y-1 border-l border-default-200 pl-3 dark:border-default-100/20">
                        {controlCenterSections.map(section => {
                          const sectionActive = location.hash === `#${section.id}`;
                          return (
                            <button
                              key={section.id}
                              onClick={() => handleSectionClick(section.id)}
                              className={`
                                w-full rounded-small px-3 py-2 text-left text-xs font-medium transition-colors
                                ${sectionActive
                                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
                                }
                              `}
                            >
                              {t(section.label)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                 </li>
               );
             })}
          </ul>
        </nav>
      </aside>

      {/* 主内容区域 */}
      <div className={`flex flex-col flex-1 ${isMobile ? 'min-h-0' : 'h-full overflow-hidden'}`}>
                 {/* 顶部导航栏 */}
         <header className="bg-white dark:bg-black shadow-md border-b border-gray-200 dark:border-gray-600 h-14 flex items-center justify-between px-4 lg:px-6 relative z-10">
          <div className="flex items-center gap-4">
            {/* 移动端菜单按钮 */}
            {isMobile && (
              <Button
                isIconOnly
                variant="light"
                onPress={toggleMobileMenu}
                className="lg:hidden"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitch />
            {/* 用户菜单 */}
             <Dropdown placement="bottom-end">
               <DropdownTrigger>
                 <Button variant="light" className="text-sm font-medium text-foreground">
                   {username}
                   <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                   </svg>
                 </Button>
               </DropdownTrigger>
              <DropdownMenu aria-label={t("用户菜单")}>
                <DropdownItem
                  key="change-password"
                  startContent={
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                  }
                  onPress={onOpen}
                >
                  {t("修改密码")}
                </DropdownItem>
                <DropdownItem
                  key="logout"
                  startContent={
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                    </svg>
                  }
                  className="text-danger"
                  color="danger"
                  onPress={handleLogout}
                >
                  {t("退出登录")}
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </header>

        {/* 主内容 */}
        <main className={`flex-1 bg-gray-100 dark:bg-black ${isMobile ? '' : 'overflow-y-auto'}`}>
          {children}
        </main>
      </div>

      {/* 修改密码弹窗 */}
      <Modal 
        isOpen={isOpen} 
        onOpenChange={() => {
          onOpenChange();
          resetPasswordForm();
        }}
        size="2xl"
        scrollBehavior="outside"
        backdrop="blur"
        placement="center"
      >
                 <ModalContent>
           {(onClose: () => void) => (
            <>
              <ModalHeader className="flex flex-col gap-1">{t("修改密码")}</ModalHeader>
              <ModalBody>
                                 <div className="space-y-4">
                   <Input
                     label={t("新用户名")}
                     placeholder={t("请输入新用户名（至少3位）")}
                     value={passwordForm.newUsername}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, newUsername: e.target.value }))}
                     variant="bordered"
                   />
                   <Input
                     label={t("当前密码")}
                     type="password"
                     placeholder={t("请输入当前密码")}
                     value={passwordForm.currentPassword}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                     variant="bordered"
                   />
                   <Input
                     label={t("新密码")}
                     type="password"
                     placeholder={t("请输入新密码（至少6位）")}
                     value={passwordForm.newPassword}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                     variant="bordered"
                   />
                   <Input
                     label={t("确认密码")}
                     type="password"
                     placeholder={t("请再次输入新密码")}
                     value={passwordForm.confirmPassword}
                     onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                     variant="bordered"
                   />
                 </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  {t("取消")}
                </Button>
                <Button 
                  color="primary" 
                  onPress={handlePasswordSubmit}
                  isLoading={passwordLoading}
                >
                  {t("确定")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
} 
