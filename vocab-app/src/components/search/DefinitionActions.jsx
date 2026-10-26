import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookmarkPlus, BookmarkMinus, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DefinitionActions({ children, isSaved, onToggle, disabled }) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(null);
  const timer = useRef(null);
  const origin = useRef(null);
  const trigger = useRef(null);
  const menuRef = useRef(null);
  const held = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  const open = (x, y) => {
    cancel();
    setMenu({ x: Math.max(8, Math.min(x, window.innerWidth - 248)), y: Math.max(8, Math.min(y, window.innerHeight - 64)) });
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector('button')?.focus();
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target) && !trigger.current?.contains(event.target)) setMenu(null);
    };
    const close = () => setMenu(null);
    const keydown = (event) => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') {
          event.preventDefault();
          trigger.current?.focus();
        }
        close();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', keydown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  return (
    <div className="relative" style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); open(event.clientX, event.clientY); }}
      onPointerDown={(event) => {
        held.current = false;
        if (event.pointerType === 'mouse' || event.target.closest('button, a, input')) return;
        origin.current = { x: event.clientX, y: event.clientY };
        cancel();
        timer.current = setTimeout(() => {
          held.current = true;
          open(event.clientX, event.clientY);
        }, 500);
      }}
      onPointerMove={(event) => {
        if (origin.current && Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 10) cancel();
      }}
      onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
      onClickCapture={(event) => {
        if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; }
      }}
    >
      {children}
      <button ref={trigger} type="button" aria-label={t('card.definitionActions')} aria-haspopup="menu" aria-expanded={Boolean(menu)}
        className="absolute bottom-2 right-2 p-1.5 rounded-full bg-white text-gray-400 hover:bg-blue-50 hover:text-blue-600"
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          if (menu) setMenu(null); else open(rect.right - 240, rect.bottom);
        }}>
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {menu && createPortal(
        <div ref={menuRef} role="menu" aria-label={t('card.definitionActions')}
          className="fixed z-[100] w-60 rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
          <button type="button" role="menuitem" disabled={disabled}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm text-gray-700 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none disabled:opacity-50"
            onClick={() => { setMenu(null); trigger.current?.focus(); onToggle(); }}>
            {isSaved ? <BookmarkMinus className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
            {t(isSaved ? 'card.removeSavedDefinition' : 'card.saveDefinition')}
          </button>
        </div>, document.body)}
    </div>
  );
}
