import React, { useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import DesignerDataBootstrap from './components/designer/DesignerDataBootstrap';
import { createAppRouter, type RuntimeConfig } from './endpoint';
import { AuthProvider } from './context/authContext';

const DEFAULT_CONFIG: RuntimeConfig = {
  backendUrl: 'https://pokecraft-staging-0.klys.dev'
}

const AUTH_HASHLESS_ROUTES = new Set([
  '/login',
  '/new-user',
  '/recover-password',
  '/recover-username',
  '/validate-email'
]);

const normalizePathname = (pathname: string) => (
  pathname === '/' ? pathname : pathname.replace(/\/+$/, '')
);

const getAppBasePath = () => {
  const publicUrl = process.env.PUBLIC_URL || '/';
  const publicPathname = new URL(publicUrl, window.location.origin).pathname;

  return normalizePathname(publicPathname);
};

const normalizeInitialAuthRoute = () => {
  if (window.location.hash && window.location.hash !== '#') {
    return;
  }

  const url = new URL(window.location.href);
  const appBasePath = getAppBasePath();
  const currentPathname = normalizePathname(url.pathname);

  if (
    currentPathname !== appBasePath &&
    !currentPathname.startsWith(`${appBasePath}/`)
  ) {
    return;
  }

  const relativePath = appBasePath === '/'
    ? currentPathname
    : currentPathname === appBasePath
      ? '/'
      : currentPathname.slice(appBasePath.length);

  const nextRoute = AUTH_HASHLESS_ROUTES.has(relativePath)
    ? relativePath
    : relativePath === '/' && url.searchParams.has('token')
      ? '/recover-password'
      : null;

  if (!nextRoute) {
    return;
  }

  const baseHref = appBasePath === '/' ? '/' : `${appBasePath}/`;
  const nextUrl = `${url.origin}${baseHref}#${nextRoute}${url.search}`;

  window.location.replace(nextUrl);
};

if (typeof window !== 'undefined') {
  normalizeInitialAuthRoute();
}

function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const router = useMemo(() => (
    config ? createAppRouter(config) : null
  ), [config]);

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      try {
        const response = await fetch('/config.json');
        if (!response.ok) {
          throw new Error(`Failed to load config: ${response.status}`);
        }

        const nextConfig = await response.json() as RuntimeConfig;
        if (mounted) {
          setConfig({
            backendUrl: nextConfig.backendUrl || DEFAULT_CONFIG.backendUrl
          });
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setConfig(DEFAULT_CONFIG);
        }
      }
    };

    loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  if (router === null || config === null) {
    return <>Loading...</>;
  }

  return (
    <AuthProvider socketUrl={config.backendUrl}>
      <DesignerDataBootstrap />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
