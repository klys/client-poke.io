import React, { useEffect, useMemo, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import DesignerDataBootstrap from './components/designer/DesignerDataBootstrap';
import { createAppRouter, type RuntimeConfig } from './endpoint';
import { AuthProvider } from './context/authContext';

const DEFAULT_CONFIG: RuntimeConfig = {
  backendUrl: 'https://pokecraft-staging-0.klys.dev'
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
