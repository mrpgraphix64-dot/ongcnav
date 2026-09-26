'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // If on /agent/login, bypass the agent layout entirely so the login page renders directly
  const isLoginPage = pathname === '/agent/login' || pathname.startsWith('/agent/login/');

  const [authChecking, setAuthChecking] = useState(!isLoginPage);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isLoginPage) {
      setAuthChecking(false);
      return;
    }

    let isMounted = true;

    async function checkAgentAuth() {
      try {
        const res = await fetchApi('/auth/me');
        if (!isMounted) return;

        if (res?.user) {
          const role = String(res.user.role || '').toUpperCase();
          const allowedRoles = [
            'COMMERCIAL_AGENT',
            'COMMERCIAL_SUB_AGENT',
            'SUPER_ADMIN',
            'COMMERCIAL_ADMIN',
          ];

          if (allowedRoles.includes(role)) {
            setAuthorized(true);
            setAuthChecking(false);
            try {
              localStorage.setItem('ongc_admin_user', JSON.stringify(res.user));
            } catch {}
            return;
          }
        }

        // If user is authenticated but not an allowed agent/admin role, redirect
        const redirectQuery = pathname && pathname !== '/agent' ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.replace(`/agent/login${redirectQuery}`);
      } catch {
        // Unauthenticated -> redirect to /agent/login
        if (isMounted) {
          try {
            localStorage.removeItem('ongc_admin_user');
          } catch {}
          const redirectQuery = pathname && pathname !== '/agent' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/agent/login${redirectQuery}`);
        }
      }
    }

    checkAgentAuth();

    return () => {
      isMounted = false;
    };
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-10 h-10 border-3 border-stone-200 border-t-maroon rounded-full animate-spin mb-4" />
        <div className="font-outfit font-extrabold text-xs tracking-widest uppercase text-maroon">
          ONGC E-Pass Agent Portal
        </div>
        <p className="text-xs text-ink-soft mt-1">Verifying agent session...</p>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
