/**
 * Cache and Firestore Listener Lifecycle Manager
 * Ensures smooth performance on low-end hardware (Sunmi POS, budget tablets, Android phones)
 * Cleans up listeners and local storage when navigating between complex views.
 */

export interface CacheCleanupResult {
  cleanedKeysCount: number;
  freedBytes: number;
  totalStorageKb: number;
  timestamp: string;
}

type UnsubscribeFn = () => void;

class ListenerRegistry {
  private viewListeners: Map<string, Set<UnsubscribeFn>> = new Map();
  private globalListeners: Set<UnsubscribeFn> = new Set();

  /**
   * Register a Firestore listener attached to a specific view
   */
  register(viewName: string, unsubscribe: UnsubscribeFn): UnsubscribeFn {
    if (!this.viewListeners.has(viewName)) {
      this.viewListeners.set(viewName, new Set());
    }
    this.viewListeners.get(viewName)!.add(unsubscribe);

    // Return a wrapped unsubscribe that also removes it from our registry
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn(`[CacheManager] Error unsubscribing listener for view ${viewName}:`, err);
      }
      this.viewListeners.get(viewName)?.delete(unsubscribe);
    };
  }

  /**
   * Register a global background listener
   */
  registerGlobal(unsubscribe: UnsubscribeFn): UnsubscribeFn {
    this.globalListeners.add(unsubscribe);
    return () => {
      try {
        unsubscribe();
      } catch (err) {
        console.warn('[CacheManager] Error unsubscribing global listener:', err);
      }
      this.globalListeners.delete(unsubscribe);
    };
  }

  /**
   * Unsubscribe and clean up all listeners for a given view
   */
  cleanupView(viewName: string): number {
    const listeners = this.viewListeners.get(viewName);
    if (!listeners || listeners.size === 0) return 0;

    let count = 0;
    listeners.forEach((unsub) => {
      try {
        unsub();
        count++;
      } catch (err) {
        console.warn(`[CacheManager] Error during cleanup for view ${viewName}:`, err);
      }
    });

    listeners.clear();
    this.viewListeners.delete(viewName);
    console.log(`[CacheManager] Cleaned up ${count} listeners for view: ${viewName}`);
    return count;
  }

  /**
   * Clean up all view listeners except specified active views
   */
  cleanupOtherViews(activeViewName: string): number {
    let totalCleaned = 0;
    for (const [viewName] of this.viewListeners.entries()) {
      if (viewName !== activeViewName) {
        totalCleaned += this.cleanupView(viewName);
      }
    }
    return totalCleaned;
  }

  /**
   * Clean up everything (e.g. on user logout)
   */
  cleanupAll(): void {
    for (const viewName of this.viewListeners.keys()) {
      this.cleanupView(viewName);
    }
    this.globalListeners.forEach((unsub) => {
      try {
        unsub();
      } catch (err) {
        console.warn('[CacheManager] Error during global cleanup:', err);
      }
    });
    this.globalListeners.clear();
  }

  getActiveListenerCount(): number {
    let count = this.globalListeners.size;
    for (const set of this.viewListeners.values()) {
      count += set.size;
    }
    return count;
  }
}

export const listenerRegistry = new ListenerRegistry();

/**
 * Scan and clean stale entries from LocalStorage
 */
export function cleanupStaleLocalStorage(): CacheCleanupResult {
  let cleanedCount = 0;
  let freedBytes = 0;

  try {
    const keysToRemove: string[] = [];
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // 1. Temporary print preview/states older than 12 hours
      if (key.startsWith('duckpos_temp_') || key.startsWith('duckpos_print_temp_')) {
        keysToRemove.push(key);
      }

      // 2. Clean temporary view search filters or transient UI states
      if (key.includes('_temp_filter') || key.includes('_draft_cache')) {
        keysToRemove.push(key);
      }

      // 3. Trim notifications if excessively large
      if (key === 'duckpos_notifications_store') {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list) && list.length > 40) {
              const trimmed = list.slice(0, 40);
              const diffSize = raw.length - JSON.stringify(trimmed).length;
              localStorage.setItem(key, JSON.stringify(trimmed));
              freedBytes += Math.max(0, diffSize);
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      // 4. Stale alert dismissed timestamps older than 7 days
      if (key.startsWith('duckpos_alert_dismissed_')) {
        const val = localStorage.getItem(key);
        if (val) {
          const timestamp = parseInt(val, 10);
          if (!isNaN(timestamp) && now - timestamp > 7 * 24 * 60 * 60 * 1000) {
            keysToRemove.push(key);
          }
        }
      }
    }

    // Execute removals
    keysToRemove.forEach((key) => {
      const val = localStorage.getItem(key) || '';
      freedBytes += key.length + val.length;
      localStorage.removeItem(key);
      cleanedCount++;
    });
  } catch (err) {
    console.error('[CacheManager] Error cleaning local storage:', err);
  }

  // Calculate remaining storage size
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalBytes += key.length + (localStorage.getItem(key) || '').length;
      }
    }
  } catch {
    totalBytes = 0;
  }

  const result: CacheCleanupResult = {
    cleanedKeysCount: cleanedCount,
    freedBytes,
    totalStorageKb: Math.round((totalBytes / 1024) * 10) / 10,
    timestamp: new Date().toISOString(),
  };

  return result;
}

/**
 * Complete memory and cache cleanup triggered on view navigation or manual button click
 */
export function performFullMemoryCleanup(currentView?: string): CacheCleanupResult {
  if (currentView) {
    listenerRegistry.cleanupOtherViews(currentView);
  }
  const result = cleanupStaleLocalStorage();

  // Dispatch custom event for UI updates
  window.dispatchEvent(new CustomEvent('duckpos_memory_cleaned', { detail: result }));
  return result;
}

/**
 * Get current memory and storage diagnostics
 */
export function getStorageDiagnostics() {
  let totalBytes = 0;
  let itemsCount = 0;

  try {
    itemsCount = localStorage.length;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalBytes += key.length + (localStorage.getItem(key) || '').length;
      }
    }
  } catch {
    totalBytes = 0;
  }

  return {
    totalStorageKb: Math.round((totalBytes / 1024) * 10) / 10,
    itemsCount,
    activeListeners: listenerRegistry.getActiveListenerCount(),
  };
}
