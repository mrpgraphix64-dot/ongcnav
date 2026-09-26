'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import {
  setStoredAuthUser,
  clearStoredAuth,
  subscribeToAuthSync,
  isAgentRole,
  getPortalForRole,
} from '@/lib/auth-session';

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

          if (isAgentRole(role)) {
            setAuthorized(true);
            setAuthChecking(false);
            setStoredAuthUser(res.user);
            return;
          }

          // User is authenticated but NOT an agent (e.g. SUPER_ADMIN, COMMERCIAL_ADMIN, SCANNER_STAFF)
          // Administrative sessions must not operate inside the Agent portal
          const targetPortal = getPortalForRole(role);
          router.replace(targetPortal);
          return;
        }

        // No user returned -> redirect to agent login
        clearStoredAuth();
        const redirectQuery = pathname && pathname !== '/agent' ? `?redirect=${encodeURIComponent(pathname)}` : '';
        router.replace(`/agent/login${redirectQuery}`);
      } catch {
        // Unauthenticated -> redirect to /agent/login
        if (isMounted) {
          clearStoredAuth();
          const redirectQuery = pathname && pathname !== '/agent' ? `?redirect=${encodeURIComponent(pathname)}` : '';
          router.replace(`/agent/login${redirectQuery}`);
        }
      }
    }

    checkAgentAuth();

    // Cross-tab real-time auth synchronization
    const unsubscribe = subscribeToAuthSync((event) => {
      if (!isMounted) return;

      if (event.type === 'LOGOUT' || event.type === 'SESSION_EXPIRED') {
        setAuthorized(false);
        setAuthChecking(false);
        router.replace('/agent/login');
      } else if (event.type === 'LOGIN' && event.user) {
        if (isAgentRole(event.user.role)) {
          setAuthorized(true);
          setAuthChecking(false);
        } else {
          // Another tab logged in as non-agent (e.g. SUPER_ADMIN)
          setAuthorized(false);
          const targetPortal = getPortalForRole(event.user.role);
          router.replace(targetPortal);
        }
      }
    });

    // Re-verify session when tab becomes visible or gains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isLoginPage) {
        checkAgentAuth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      isMounted = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
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
