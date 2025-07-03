/**
 * Debug utility for conditional logging
 * Only logs in development mode or when explicitly enabled
 */

interface DebugConfig {
    NETWORK: boolean;
    COMBAT: boolean;
    AI: boolean;
    PHYSICS: boolean;
    ANIMATIONS: boolean;
    PERFORMANCE: boolean;
    GENERAL: boolean;
}

// Get debug flags from environment or localStorage
const getDebugFlags = (): DebugConfig => {
    const isDev = process.env.NODE_ENV === "development";
    const debugParam = new URLSearchParams(window.location.search).get("debug");
    
    // Check localStorage for persistent debug settings
    const localDebug = typeof window !== "undefined" 
        ? localStorage.getItem("deadly-duel-debug") 
        : null;
    
    const defaultFlags: DebugConfig = {
        NETWORK: isDev || debugParam?.includes("network") || false,
        COMBAT: isDev || debugParam?.includes("combat") || false,
        AI: isDev || debugParam?.includes("ai") || false,
        PHYSICS: isDev || debugParam?.includes("physics") || false,
        ANIMATIONS: isDev || debugParam?.includes("animations") || false,
        PERFORMANCE: isDev || debugParam?.includes("performance") || false,
        GENERAL: isDev || debugParam?.includes("general") || false,
    };

    if (localDebug) {
        try {
            const parsed = JSON.parse(localDebug);
            return { ...defaultFlags, ...parsed };
        } catch {
            // Ignore invalid JSON
        }
    }

    return defaultFlags;
};

const DEBUG_FLAGS = getDebugFlags();

// Debug logging functions
export const debug = {
    network: (...args: unknown[]) => {
        if (DEBUG_FLAGS.NETWORK) {
            console.log("🌐 NETWORK:", ...args);
        }
    },
    
    combat: (...args: unknown[]) => {
        if (DEBUG_FLAGS.COMBAT) {
            console.log("⚔️ COMBAT:", ...args);
        }
    },
    
    ai: (...args: unknown[]) => {
        if (DEBUG_FLAGS.AI) {
            console.log("🤖 AI:", ...args);
        }
    },
    
    physics: (...args: unknown[]) => {
        if (DEBUG_FLAGS.PHYSICS) {
            console.log("🏐 PHYSICS:", ...args);
        }
    },
    
    animations: (...args: unknown[]) => {
        if (DEBUG_FLAGS.ANIMATIONS) {
            console.log("🎭 ANIMATIONS:", ...args);
        }
    },
    
    performance: (...args: unknown[]) => {
        if (DEBUG_FLAGS.PERFORMANCE) {
            console.log("⚡ PERFORMANCE:", ...args);
        }
    },
    
    general: (...args: unknown[]) => {
        if (DEBUG_FLAGS.GENERAL) {
            console.log("🔧 DEBUG:", ...args);
        }
    },
    
    // Always log errors and warnings
    error: (...args: unknown[]) => {
        console.error("❌ ERROR:", ...args);
    },
    
    warn: (...args: unknown[]) => {
        console.warn("⚠️ WARNING:", ...args);
    },
    
    // Utility functions
    isEnabled: (category: keyof DebugConfig) => DEBUG_FLAGS[category],
    
    setFlags: (flags: Partial<DebugConfig>) => {
        if (typeof window !== "undefined") {
            const newFlags = { ...DEBUG_FLAGS, ...flags };
            localStorage.setItem("deadly-duel-debug", JSON.stringify(newFlags));
            Object.assign(DEBUG_FLAGS, newFlags);
        }
    },
    
    getFlags: () => ({ ...DEBUG_FLAGS })
};

// Expose debug utility globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    (window as Window & { deadlyDuelDebug?: typeof debug }).deadlyDuelDebug = debug;
}

export default debug;