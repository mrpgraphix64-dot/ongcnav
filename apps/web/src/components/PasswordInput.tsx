'use client';

import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  iconLeft?: React.ReactNode;
  containerClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className = '',
      containerClassName = '',
      iconLeft,
      disabled,
      placeholder = '••••••••',
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setShowPassword((prev) => !prev);
      }
    };

    return (
      <div className={`relative flex items-center w-full ${containerClassName}`}>
        {iconLeft && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none flex items-center justify-center">
            {iconLeft}
          </div>
        )}

        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          disabled={disabled}
          placeholder={placeholder}
          className={`${className} ${iconLeft ? 'pl-10' : ''} pr-10`}
          {...props}
        />

        <button
          type="button"
          tabIndex={0}
          disabled={disabled}
          onClick={toggleVisibility}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 focus:outline-none focus:text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors rounded-md"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
export default PasswordInput;
