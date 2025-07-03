import Phaser from "phaser";
import type { Player, GameStateData, AttackData, VFXData } from "@/types/game";

// Define typed events for the EventBus
interface GameEvents {
    // Game state events
    "game-started": { mode: string; players: number };
    "game-paused": { timestamp: number };
    "game-resumed": { timestamp: number };
    "game-over": { winner: string; finalScore: number };
    "round-started": { round: number };
    "round-ended": { round: number; winner: string; score?: string };
    "round-timer": { timeLeft: number };
    "round-update": { player1Score: number; player2Score: number };
    "match-ended": { winner: string; score: string };

    // Player events
    "player-added": { player: Player; sessionId: string };
    "player-removed": { sessionId: string };
    "player-hit": { playerId: string; damage: number; source: string };
    "player-defeated": { playerId: string };
    "player-health-changed": {
        playerId: string;
        health: number;
        maxHealth: number;
    };

    // Network events (simplified for offline game)
    "network-connected": { roomId: string };
    "network-disconnected": { reason: string };
    "state-changed": { state: GameStateData };
    "initial-state": { state: GameStateData };

    // UI events
    "scene-ready": { sceneName: string };
    "current-scene-ready": Phaser.Scene;
    "menu-navigate": { from: string; to: string };
    "ui-action": { action: string; data?: Record<string, unknown> };
    "health-update": {
        player1: { health: number; maxHealth: number; name: string };
        player2: { health: number; maxHealth: number; name: string };
    };

    // Score and progression
    "score-updated": { playerId: string; score: number; multiplier: number };
    "level-complete": { level: number; time: number };
    "powerup-collected": { type: string; duration: number };

    // Combat events
    "attack-started": { attackerId: string; attackType: string };
    "attack-hit": AttackData;
    "combo-started": { playerId: string; comboCount: number };
    "combo-ended": { playerId: string; finalCount: number };
    "fighter-attack": { fighter: string; attackType: string; damage: number };
    "fighter-damaged": {
        fighter: string;
        damage: number;
        currentHealth: number;
        maxHealth: number;
    };
    "fighter-defeated": { fighter: string };

    // Visual effects
    "spawn-vfx": VFXData;
    "screen-shake": { intensity: number; duration: number };
    "hit-pause": { duration: number };
    
    // Online multiplayer events
    "show-online-menu": Record<string, never>;
    "hide-online-menu": Record<string, never>;
    "start-online-fight": Record<string, never>;
    "remote-player-update": { player: unknown; sessionId: string };
    "remote-combat-action": unknown;
    "player_input_confirmed": { sessionId: string; input: unknown };
    "combat_hit": unknown;
    "round_ended": unknown;
    "match_ended": unknown;
    "game-phase-changed": { phase: string };
    "match-score-update": { playerId: string; score: number };
    "remote-game-event": unknown;
    "reset-match-score": Record<string, never>;
    "immediate-player-update": { sessionId: string; player: unknown };
    "match-started": { round: number; timeLeft: number };
    "tournament-progress": { currentMatch: number; totalMatches: number };
    
    // Authentication events
    "auth-state-changed": { isAuthenticated: boolean; user: unknown | null; isLoading: boolean; error: string | null };
    "user-logged-in": unknown;
    "user-logged-out": Record<string, never>;
    "auth-error": { error: string };
    
    // Wallet events
    "wallet-state-changed": { connected: boolean; connecting: boolean; publicKey: string | null; walletType: string | null; balance: number | null; error: string | null };
    "wallet-connected": { connected: boolean; connecting: boolean; publicKey: string | null; walletType: string | null; balance: number | null; error: string | null };
    "wallet-disconnected": Record<string, never>;
    "show-wallet-connection": Record<string, never>;
    
    // Online-specific events
    "online-player-added": { player: unknown; sessionId: string };
    "online-remote-player-update": { player: unknown; sessionId: string };
    "online-immediate-player-update": { sessionId: string; player: unknown };
    "online-combat-action": unknown;
    "online-input-confirmed": { sessionId: string; input: unknown };
    "online-network-state-update": { players: unknown; state: unknown };
    "online-attempt-player-setup": Record<string, never>;
    "online-clear-hit-targets": Record<string, never>;
    "online-players-setup-complete": Record<string, never>;
}

class TypedEventBus extends Phaser.Events.EventEmitter {
    emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): boolean {
        return super.emit(event, data);
    }

    on<K extends keyof GameEvents>(
        event: K,
        fn: (data: GameEvents[K]) => void,
        context?: object
    ): this {
        return super.on(event, fn, context);
    }

    once<K extends keyof GameEvents>(
        event: K,
        fn: (data: GameEvents[K]) => void,
        context?: object
    ): this {
        return super.once(event, fn, context);
    }

    off<K extends keyof GameEvents>(
        event: K,
        fn?: (data: GameEvents[K]) => void,
        context?: object,
        once?: boolean
    ): this {
        return super.off(event, fn, context, once);
    }
}

// Create singleton instance
const EventBus = new TypedEventBus();

// Export both the instance and types
export default EventBus;
export type { GameEvents };

// For debugging
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    (window as unknown as Record<string, unknown>).EventBus = EventBus;
}

