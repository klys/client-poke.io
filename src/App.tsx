import React, { useEffect, useState } from 'react';
import Game from './components/game/Game'

type RuntimeConfig = {
  backendUrl: string
}

const DEFAULT_CONFIG: RuntimeConfig = {
  backendUrl: 'http://localhost:3001/'
}

function App() {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);

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

  if (config === null) {
    return <>Loading...</>;
  }

  return (
    <>
      <Game socketUrl={config.backendUrl} />
    </>
  );
}

export default App;
