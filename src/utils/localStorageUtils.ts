import { logger } from '@/lib/logger';

// Debounced localStorage operations to improve performance
class LocalStorageUtils {
    private writeTimers: Map<string, NodeJS.Timeout> = new Map();
    private readonly DEBOUNCE_DELAY = 1000; // 1 second

    /**
     * Debounced write to localStorage
     * Multiple calls with the same key within the debounce period will be batched
     */
    debouncedWrite(key: string, value: string, delay: number = this.DEBOUNCE_DELAY): void {
        // Clear existing timer for this key
        const existingTimer = this.writeTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.safeWrite(key, value);
            this.writeTimers.delete(key);
        }, delay);

        this.writeTimers.set(key, timer);
    }

    /**
     * Safe write to localStorage with error handling
     */
    safeWrite(key: string, value: string): boolean {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            logger.warn('Failed to write to localStorage:', {
                storageKey: key,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                storageQuota: this.getStorageInfo()
            });
            
            // Try to free up space by removing old entries
            this.cleanupOldEntries();
            
            // Retry once
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (retryError) {
                logger.warn('Failed to write to localStorage after cleanup:', {
                    storageKey: key,
                    errorMessage: retryError instanceof Error ? retryError.message : 'Unknown error'
                });
                return false;
            }
        }
    }

    /**
     * Safe read from localStorage with error handling
     */
    safeRead(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            logger.warn('Failed to read from localStorage:', {
                storageKey: key,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    /**
     * Safe remove from localStorage with error handling
     */
    safeRemove(key: string): boolean {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            logger.warn('Failed to remove from localStorage:', {
                storageKey: key,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Write object to localStorage with JSON serialization
     */
    writeObject<T>(key: string, obj: T): boolean {
        try {
            const serialized = JSON.stringify(obj);
            return this.safeWrite(key, serialized);
        } catch (error) {
            logger.warn('Failed to serialize object for localStorage:', {
                storageKey: key,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Read object from localStorage with JSON deserialization
     */
    readObject<T>(key: string, defaultValue?: T): T | null {
        try {
            const stored = this.safeRead(key);
            if (stored === null) {
                return defaultValue || null;
            }
            return JSON.parse(stored) as T;
        } catch (error) {
            logger.warn('Failed to deserialize object from localStorage:', {
                storageKey: key,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            return defaultValue || null;
        }
    }

    /**
     * Debounced object write
     */
    debouncedWriteObject<T>(key: string, obj: T, delay?: number): void {
        try {
            const serialized = JSON.stringify(obj);
            this.debouncedWrite(key, serialized, delay);
        } catch (error) {
            logger.warn('Failed to serialize object for debounced write:', {
                storageKey: key,
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get localStorage usage information
     */
    getStorageInfo(): { used: number; available: number; total: number } | null {
        try {
            // Estimate storage usage
            let used = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    const value = localStorage.getItem(key);
                    used += key.length + (value?.length || 0);
                }
            }

            // Most browsers have a 5-10MB limit for localStorage
            const estimatedTotal = 5 * 1024 * 1024; // 5MB
            const available = estimatedTotal - used;

            return { used, available, total: estimatedTotal };
        } catch (error) {
            return null;
        }
    }

    /**
     * Clean up old or large entries to free space
     */
    private cleanupOldEntries(): void {
        try {
            const entries: Array<{ key: string; size: number; timestamp?: number }> = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    const value = localStorage.getItem(key);
                    const size = key.length + (value?.length || 0);
                    
                    // Try to extract timestamp if it's stored
                    let timestamp: number | undefined;
                    try {
                        const parsed = JSON.parse(value || '{}');
                        if (parsed.timestamp || parsed.lastUpdated) {
                            timestamp = parsed.timestamp || parsed.lastUpdated;
                        }
                    } catch {
                        // Not JSON or no timestamp field
                    }
                    
                    entries.push({ key, size, timestamp });
                }
            }

            // Sort by timestamp (oldest first), then by size (largest first)
            entries.sort((a, b) => {
                if (a.timestamp && b.timestamp) {
                    return a.timestamp - b.timestamp;
                }
                if (a.timestamp && !b.timestamp) return -1;
                if (!a.timestamp && b.timestamp) return 1;
                return b.size - a.size;
            });

            // Remove up to 20% of entries or 1MB of data, whichever comes first
            let removedSize = 0;
            const maxRemoveSize = 1024 * 1024; // 1MB
            const maxRemoveCount = Math.ceil(entries.length * 0.2);
            let removedCount = 0;

            for (const entry of entries) {
                if (removedSize >= maxRemoveSize || removedCount >= maxRemoveCount) {
                    break;
                }
                
                localStorage.removeItem(entry.key);
                removedSize += entry.size;
                removedCount++;
                
                logger.debug('Cleaned up localStorage entry:', {
                    key: entry.key,
                    size: entry.size,
                    timestamp: entry.timestamp
                });
            }

            logger.info('localStorage cleanup completed:', {
                removedEntries: removedCount,
                freedBytes: removedSize
            });
        } catch (error) {
            logger.warn('Failed to cleanup localStorage:', {
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Force flush all pending debounced writes
     */
    flushAll(): void {
        for (const [, timer] of this.writeTimers) {
            clearTimeout(timer);
        }
        this.writeTimers.clear();
    }
}

// Export singleton instance
export const localStorageUtils = new LocalStorageUtils();
export default localStorageUtils;