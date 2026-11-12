import { Capacitor } from '@capacitor/core';

// Default cloud backend (can be overridden by VITE_API_URL or localStorage)
export const DEFAULT_CLOUD_BACKEND =
  (import.meta as any).env?.VITE_API_URL || '';

// Candidate addresses to reach the host PC's Express backend from Android
const ANDROID_CANDIDATE_HOSTS = [
  'http://10.0.2.2:3001',        // Android Studio Emulator loopback to host PC
  'http://10.138.178.252:3001',  // Local Wi-Fi network IP
  'http://localhost:3001'        // Localhost fallback
];

let activeBackendHost: string | null = null;
try {
  activeBackendHost =
    localStorage.getItem('squadly_cloud_backend') ||
    localStorage.getItem('squadly_backend_host') ||
    DEFAULT_CLOUD_BACKEND ||
    null;
} catch {
  // Ignore storage errors
}

export function setCloudBackendUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  activeBackendHost = clean;
  try {
    localStorage.setItem('squadly_cloud_backend', clean);
    localStorage.setItem('squadly_backend_host', clean);
  } catch {
    // Ignore
  }
}

if (typeof window !== 'undefined') {
  (window as any).setSquadlyBackend = setCloudBackendUrl;
}

export function getActiveBackendUrl(): string | null {
  return activeBackendHost;
}

/**
 * Initializes transparent API routing for both native Android (Capacitor)
 * and hosted Web deployments (Firebase Hosting / Cloud).
 */
export function setupApiBridge() {
  const isNative =
    Capacitor.isNativePlatform() ||
    (typeof window !== 'undefined' &&
      (window.location.protocol === 'capacitor:' ||
        (window.location.hostname === 'localhost' && !window.location.port)));

  const isHostedWeb =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.startsWith('192.168.') &&
    !window.location.hostname.startsWith('10.');

  if (!isNative && !isHostedWeb) {
    // Standard local dev in Vite browser (Vite dev server proxy handles /api)
    return;
  }

  console.log(`[Squadly Bridge] Initializing API bridge (${isNative ? 'Android' : 'Hosted Web'})...`);

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    // Only rewrite relative backend endpoints
    if (url.startsWith('/api') || url.startsWith('/bootstrap')) {
      // 1. If running on Hosted Web (e.g. squadly-33afc.web.app):
      if (isHostedWeb) {
        const cloudHost =
          activeBackendHost ||
          (typeof window !== 'undefined' && localStorage.getItem('squadly_cloud_backend')) ||
          DEFAULT_CLOUD_BACKEND;

        if (cloudHost) {
          const targetUrl = `${cloudHost}${url}`;
          return await originalFetch(targetUrl, init);
        } else {
          console.warn('[Squadly Bridge] Hosted on web without cloud backend URL configured.');
        }
      }

      // 2. If running on Native Android:
      if (isNative) {
        if (activeBackendHost) {
          const targetUrl = `${activeBackendHost}${url}`;
          try {
            return await originalFetch(targetUrl, init);
          } catch (err) {
            console.warn(`[Squadly Bridge] Saved host ${activeBackendHost} failed, discovering...`, err);
            activeBackendHost = null;
          }
        }

        // Discover available backend host from candidates
        let lastError: any = null;
        for (const host of ANDROID_CANDIDATE_HOSTS) {
          try {
            const targetUrl = `${host}${url}`;
            const probeSignal =
              init?.signal ||
              (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
                ? AbortSignal.timeout(4000)
                : undefined);
            const res = await originalFetch(targetUrl, { ...init, signal: probeSignal });
            activeBackendHost = host;
            try {
              localStorage.setItem('squadly_backend_host', host);
            } catch {
              // Ignore
            }
            console.log(`[Squadly Bridge] Connected to backend at: ${host}`);
            return res;
          } catch (err) {
            lastError = err;
          }
        }

        console.error('[Squadly Bridge] All backend candidate hosts failed', lastError);
        throw lastError || new Error('Could not connect to Squadly backend server.');
      }
    }

    return originalFetch(input, init);
  };
}
