import { useEffect } from 'react';

/**
 * Custom hook to pre-warm the custom LLM on screen load
 * This reduces cold-start latency when the user actually needs the LLM
 */
export const useWarmLLM = () => {
  useEffect(() => {
    const warmupLLM = async () => {
      try {
        const userId = localStorage.getItem('userId');
        
        // Only warm up for authenticated users
        if (!userId) {
          console.log('[warmup] Skipping LLM warmup - user not authenticated');
          return;
        }

        // Use backend proxy for LLM warmup (avoids CORS issues)
        const backendBase = import.meta.env.DEV ? '' : (import.meta.env.VITE_TAVUS_BACKEND_URL || '');
        const LLM_URL = `${backendBase}/healthz`;
        const startTime = performance.now();
        
        console.log('[warmup] 🔥 Pre-warming custom LLM via backend...');
        
        const response = await fetch(LLM_URL, {
          method: 'GET',
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[warmup] ✅ LLM warmed up successfully (${duration}s)`, data);
        } else {
          console.warn(`[warmup] ⚠️ LLM warmup returned ${response.status} (${duration}s)`);
        }
      } catch (error) {
        // Non-fatal - just log and continue
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[warmup] ℹ️ LLM warmup failed (non-fatal): ${message}`);
      }
    };

    // Fire and forget - don't block the UI
    warmupLLM();
  }, []); // Run once on component mount
};

