// Game type definitions for better type safety

export interface Player {
    id: string;
    name: string;
    characterId?: string;
    health: number;
    maxHealth: number;
    x: number;
    y: number;
    state: PlayerState;
    score: number;
    isLocal: boolean;
    isAlive: boolean;
}

export interface GameStateData {
    currentRound: number;
    maxRounds: number;
    timeLeft: number;
    players: Player[];
    winner?: string;
}

// Enums for better type safety
export type PlayerState = 'idle' | 'walking' | 'jumping' | 'attacking' | 'hurt' | 'defeated';
export type GameMode = 'arcade' | 'training' | 'tournament' | 'survival' | 'timeattack' | 'normal';
export type AttackType = 'heavy' | 'special';
export type VFXType = 'hit-spark' | 'special-attack' | 'combo-effect' | 'screen-flash';


export interface AttackData {
    attackerId: string;
    targetId: string;
    attackType: AttackType;
    damage: number;
    timestamp: number;
    hitPosition?: { x: number; y: number };
}

export interface VFXData {
    type: VFXType;
    x: number;
    y: number;
    facing?: -1 | 1;
    intensity?: number;
    duration?: number;
    color?: string;
}

// Fighter-specific types
export interface FighterStats {
    health: number;
    speed: number;
    jumpVelocity: number;
    heavyDamage: number;
    specialDamage: number;
    attackSpeed: number;
}

export interface HitboxData {
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
    damage: number;
    attackType: AttackType;
}

// Combat-related types
export interface CombatEvent {
    type: 'attack' | 'hit' | 'block' | 'dodge';
    timestamp: number;
    attacker?: string;
    target?: string;
    damage?: number;
    attackType?: AttackType;
}

export interface MatchResult {
    winner: string;
    loser: string;
    rounds: number;
    duration: number;
    finalScore: { [playerId: string]: number };
    combatEvents: CombatEvent[];
}

// Performance monitoring
export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    memoryUsage?: number;
    renderTime: number;
    physicsTime: number;
}

// Event Bus and Scene types
export interface SceneData {
    [key: string]: unknown;
}

export interface LeaderboardEntry {
    id: string;
    playerName: string;
    character: string;
    score: number;
    timestamp: number;
    isGlobal?: boolean;
    isLocal?: boolean;
}

export interface WalletState {
    connected: boolean;
    connecting: boolean;
    publicKey: string | null;
    walletType: string | null;
    balance: number | null;
    error: string | null;
}

export interface UserProfile {
    id?: string;
    wallet_address?: string;
    username?: string;
    created_at?: string;
    updated_at?: string;
}

export interface GameModeConfig {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    flow: {
        characterSelection: boolean;
        courseSelection?: boolean;
    };
}

export interface HealthUpdateData {
    player1: { health: number; maxHealth: number; name: string };
    player2: { health: number; maxHealth: number; name: string };
}