'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  headerBorder?: boolean;
}

const MAX_WIDTH_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-5xl',
};

export default function AdminModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  maxWidth = 'lg',
  showCloseButton = true,
  closeOnBackdrop = true,
  className = '',
  headerBorder = true,
}: AdminModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  const maxWidthClass = MAX_WIDTH_MAP[maxWidth] || 'max-w-lg';

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] overflow-y-auto bg-stone-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-2xl w-full ${maxWidthClass} shadow-2xl border border-stone-200/90 my-auto overflow-hidden animate-in zoom-in-95 duration-150 relative ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div
            className={`px-5 sm:px-6 py-4 flex items-center justify-between gap-3 ${
              headerBorder ? 'border-b border-stone-100 bg-stone-50/60' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {icon && <div className="shrink-0">{icon}</div>}
              <div className="min-w-0">
                {title && (
                  <h3 className="font-outfit font-bold text-base sm:text-lg text-ink truncate leading-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-xs text-ink-soft truncate mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-ink hover:bg-stone-100 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export { AdminModal };
