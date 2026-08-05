// Suppress third-party console logs in development
// This removes noisy logs from React DevTools, Agora SDK, etc.

export function suppressThirdPartyLogs() {
  if (import.meta.env.DEV) {
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;

    // List of messages to suppress
    const suppressPatterns = [
      'Download the React DevTools',
      'react-devtools',
      'Agora',
      'agora-rtc-sdk',
    ];

    // Override console.log
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      const shouldSuppress = suppressPatterns.some(pattern => 
        message.includes(pattern)
      );
      
      if (!shouldSuppress) {
        originalConsoleLog.apply(console, args);
      }
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      const shouldSuppress = suppressPatterns.some(pattern => 
        message.includes(pattern)
      );
      
      if (!shouldSuppress) {
        originalConsoleWarn.apply(console, args);
      }
    };
  }
}

// For production, all console logs are removed by Vite build config
