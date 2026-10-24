import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, BookOpen, Layers, Sparkles } from 'lucide-react';

const QuickScrollNav = ({ hasMnemonic = true, hasRelations = true }) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('top');
  const [hoveredSection, setHoveredSection] = useState(null);
  const isClickScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  const navItems = useMemo(() => [
    {
      id: 'top',
      targetId: 'search-section-header',
      icon: ArrowUp,
      labelKey: 'card.navTop',
      fallbackLabel: '回到頂部'
    },
    {
      id: 'definitions',
      targetId: 'search-section-definitions',
      icon: BookOpen,
      labelKey: 'card.navDefinitions',
      fallbackLabel: '單字釋義'
    },
    ...(hasMnemonic
      ? [
          {
            id: 'mnemonic',
            targetId: 'search-section-mnemonic',
            icon: Sparkles,
            labelKey: 'card.navMnemonic',
            fallbackLabel: 'AI 記憶助手'
          }
        ]
      : []),
    ...(hasRelations
      ? [
          {
            id: 'relations',
            targetId: 'search-section-relations',
            icon: Layers,
            labelKey: 'card.navRelations',
            fallbackLabel: '詞性與關聯'
          }
        ]
      : [])
  ], [hasMnemonic, hasRelations]);

  // 滾動監聽 (Scrollspy) - 視線焦點線 (視窗上方 35%) + 頂部/底部保護
  useEffect(() => {
    const handleScroll = () => {
      if (isClickScrollingRef.current) return;

      const mainEl = document.querySelector('main');
      const scrollY = Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        document.documentElement?.scrollTop || 0,
        document.body?.scrollTop || 0,
        mainEl?.scrollTop || 0
      );

      // 1. 回到頂部保護：滾動高度小於 80px 直接高亮 top
      if (scrollY < 80) {
        setActiveSection('top');
        return;
      }

      // 2. 滾到底部保護：僅在容器確實有超出高度可滾動且已滑到底部時觸發
      const docHeight = Math.max(
        document.documentElement?.scrollHeight || 0,
        document.body?.scrollHeight || 0
      );
      const canWindowScroll = docHeight > (window.innerHeight + 80);
      const isWindowBottom = canWindowScroll && ((window.innerHeight + window.scrollY) >= docHeight - 60);

      const canMainScroll = mainEl && (mainEl.scrollHeight > mainEl.clientHeight + 80);
      const isMainBottom = canMainScroll && (mainEl.scrollTop + mainEl.clientHeight >= mainEl.scrollHeight - 60);

      if (isWindowBottom || isMainBottom) {
        const lastItem = navItems[navItems.length - 1];
        if (lastItem) {
          setActiveSection(lastItem.id);
          return;
        }
      }

      // 3. 視線焦點線 (視窗頂部 35% 處)：循序掃描最後一個頂部越過焦點線的區塊
      const focusLine = window.innerHeight * 0.35;
      const contentItems = navItems.filter((item) => item.id !== 'top');

      let currentId = 'top';
      for (const item of contentItems) {
        const el = document.getElementById(item.targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= focusLine) {
            currentId = item.id;
          }
        }
      }

      setActiveSection(currentId);
    };

    const mainEl = document.querySelector('main');
    window.addEventListener('scroll', handleScroll, { passive: true });
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [navItems]);

  const scrollToSection = useCallback((item) => {
    setActiveSection(item.id);
    isClickScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    if (item.id === 'top') {
      // 同時滾動 window、document 與 main 容器，確保各種佈局下均能返回最頂端
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (document.documentElement) {
        document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (document.body) {
        document.body.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      const topTarget = document.querySelector('header') || document.getElementById('search-section-header');
      if (topTarget) {
        topTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      const el = document.getElementById(item.targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 800);
  }, []);

  // 鍵盤上下快捷鍵切換區塊 (ArrowUp / ArrowDown, 支援 J/K)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 若正在輸入欄位中，不搶佔按鍵
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase();
      const isTyping =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable;
      if (isTyping) return;

      const isUp = event.key === 'ArrowUp' || event.key === 'k';
      const isDown = event.key === 'ArrowDown' || event.key === 'j';

      if (!isUp && !isDown) return;

      event.preventDefault();

      const currentIndex = navItems.findIndex((item) => item.id === activeSection);
      let targetIndex = currentIndex;

      if (isUp) {
        targetIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      } else if (isDown) {
        targetIndex = currentIndex < navItems.length - 1 ? currentIndex + 1 : navItems.length - 1;
      }

      if (targetIndex !== currentIndex && navItems[targetIndex]) {
        scrollToSection(navItems[targetIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, navItems, scrollToSection]);

  const handleMouseEnter = (itemId) => {
    // 觸控螢幕或不支援 hover 的裝置不顯示氣泡
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none)').matches) {
      return;
    }
    setHoveredSection(itemId);
  };

  const handleMouseLeave = () => {
    setHoveredSection(null);
  };

  return (
    <aside
      aria-label={t('card.jumpTo', '快速跳轉導航')}
      className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 select-none animate-in fade-in duration-300"
    >
      {/* iOS 18 控制中心風格極簡毛玻璃滑動切換列 (固定深色毛玻璃 + 白色圖標) */}
      <div className="bg-black/30 backdrop-blur-2xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.12)] rounded-full px-1.5 py-3 flex flex-col items-center gap-3 transition-all">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          const isHovered = hoveredSection === item.id;
          const Icon = item.icon;
          const label = t(item.labelKey, item.fallbackLabel);

          return (
            <div key={item.id} className="relative flex items-center">
              {/* iOS 浮出標籤預覽 Tooltip (左側彈出，手機與觸控螢幕隱藏，僅電腦版顯示) */}
              {isHovered && (
                <div className="hidden md:flex absolute right-full mr-2.5 px-2.5 py-1 bg-slate-900/90 text-white text-[11px] font-medium rounded-lg shadow-lg backdrop-blur-md whitespace-nowrap pointer-events-none transition-all animate-in fade-in slide-in-from-right-1 duration-150 items-center">
                  <span>{label}</span>
                  <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900/90" />
                </div>
              )}

              {/* 切換按鈕：Active 為實心白圓點 (iOS 18 風格)，Inactive 為半透明 Icon */}
              <button
                type="button"
                data-target={item.targetId}
                onClick={() => scrollToSection(item)}
                onMouseEnter={() => handleMouseEnter(item.id)}
                onMouseLeave={handleMouseLeave}
                title={label}
                aria-label={label}
                className="relative w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer group"
              >
                {isActive ? (
                  <span
                    data-testid="active-indicator"
                    className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.85)] transition-all transform scale-105"
                  />
                ) : (
                  <Icon className="w-4 h-4 text-white/45 group-hover:text-white group-hover:scale-110 transition-all" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default QuickScrollNav;
