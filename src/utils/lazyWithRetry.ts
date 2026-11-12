import { lazy, ComponentType } from "react";
import { trackClientError } from "@/services/errorTracker";

export interface LazyRetryOptions {
  retries?: number;
  interval?: number;
  pageName?: string;
}

/**
 * Checks whether an error is caused by a chunk/module loading failure.
 * Typical triggers:
 * - Vercel deployment with fresh chunk hashes while user has cached HTML
 * - Temporary mobile network disconnection / packet loss during script fetch
 * - CDN transient 404/504 timeouts
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  const name = error.name;
  return (
    name === "ChunkLoadError" ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("loading chunk") ||
    (msg.includes("failed to load resource") && (msg.includes(".js") || msg.includes("chunk") || msg.includes("assets/")))
  );
}

/**
 * Robust wrapper around React.lazy and dynamic import() that:
 * 1. Retries failed dynamic imports with exponential backoff to tolerate mobile network hiccups.
 * 2. Detects chunk loading failures (e.g. after Vercel deployment when chunk hashes change).
 * 3. Safely reloads the page ONCE if a chunk load fails due to a new deployment,
 *    using sessionStorage to strictly prevent infinite reload loops.
 * 4. Logs diagnostic telemetry via trackClientError before rejecting.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options: LazyRetryOptions = {}
) {
  const { retries = 2, interval = 800, pageName = "component" } = options;

  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (attemptsLeft: number) => {
        factory()
          .then(resolve)
          .catch((error: unknown) => {
            const isChunk = isChunkLoadError(error);

            // 1. Retry with backoff if attempts remain
            if (attemptsLeft > 0) {
              const delay = interval * (retries - attemptsLeft + 1);
              console.warn(
                `[lazyWithRetry] Retrying dynamic import for ${pageName} (${attemptsLeft} attempts remaining) in ${delay}ms...`
              );
              setTimeout(() => attempt(attemptsLeft - 1), delay);
              return;
            }

            // 2. If retries exhausted and this is a chunk load failure (new Vercel deployment):
            // Check sessionStorage to allow exactly ONE automatic page reload per session/route
            if (isChunk && typeof window !== "undefined") {
              const reloadKey = `foundarly_chunk_reload_${pageName}_${window.location.pathname}`;
              let hasReloaded = false;
              try {
                hasReloaded = Boolean(window.sessionStorage?.getItem(reloadKey));
              } catch {
                hasReloaded = false;
              }

              if (!hasReloaded) {
                try {
                  window.sessionStorage?.setItem(reloadKey, "true");
                } catch {
                  // ignore storage errors
                }
                console.warn(
                  `[lazyWithRetry] Chunk load failed for ${pageName} after retries. Reloading once to pick up fresh deployment assets...`
                );
                window.location.reload();
                return;
              }
            }

            // 3. Log structured error for diagnosis before bubbling to ErrorBoundary
            trackClientError(error, {
              component: `lazyWithRetry(${pageName})`,
              info: `Dynamic import failed after ${retries + 1} attempts on route ${typeof window !== "undefined" ? window.location.pathname : "unknown"}`,
            });

            console.error(
              `[lazyWithRetry] Permanent failure loading dynamic chunk for ${pageName}:`,
              error
            );
            reject(error);
          });
      };

      attempt(retries);
    })
  );
}

export default lazyWithRetry;
