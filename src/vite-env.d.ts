/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface Window {
  updateHomecareServiceWorker?: () => Promise<void>;
}
