// src/config/gameConfig.ts
export const GAME_CONFIG = {
    MATCH: {
        ROUND_DURATION: 59, // 59-second rounds for fast-paced action
        MAX_ROUNDS: 2, // Best-of-3: first to win 2 rounds wins match
        COUNTDOWN_DURATION: 3,
    },
    CANVAS: {
        WIDTH: 1280,
        HEIGHT: 720,
        TARGET_FPS: 60,
    },
    PHYSICS: {
        GRAVITY: 2000,
        PLAYER_SPEED: 420, // Increased by 20% for faster gameplay (350 * 1.2)
        JUMP_VELOCITY: -960, // Increased by 20% for faster jumps (-800 * 1.2)
    },
    ARCADE: {
        AI_DIFFICULTY_SCALING: true,
        OFFLINE_FEATURES: true,
        TOURNAMENT_PROGRESSION: true,
    },
    // Fighter Physics Constants
    FIGHTER: {
        SCALE: 3.6, // Increased by 20% for better visibility (3.0 * 1.2)
        BODY_WIDTH: 50,
        BODY_HEIGHT_RATIO: 0.7,
        BODY_OFFSET_RATIO: 0.3,
        DRAG: 500,
        INVULNERABILITY_DURATION: 500, // ms
        KNOCKBACK_FORCE: 200,
        GROUND_OFFSET: 10,
        MIN_COLLISION_DISTANCE: 35, // px
    },
    // AI Behavior Constants
    AI: {
        BASE_AGGRESSION: 0.03,
        VETERAN_BRAWLER_AGGRESSION: 0.035,
        SWIFT_STRIKER_AGGRESSION: 0.04,
        LETHAL_BLADE_AGGRESSION: 0.025,
        ACROBATIC_TEMPEST_AGGRESSION: 0.03,
        MYSTIC_GUARDIAN_AGGRESSION: 0.028,
        SHADOW_ASSASSIN_AGGRESSION: 0.045,
        DIFFICULTY_SCALING_FACTOR: 0.6,
        REACTION_SCALING_FACTOR: 0.4,
        EVASION_HEALTH_THRESHOLD: 0.5,
        JUMP_CHANCE_BASE: 0.3,
        JUMP_CHANCE_COMBAT: 0.02,
    },
    // Attack System Constants
    ATTACK: {
        FRAMES: {
            LIGHT: 20,
            HEAVY: 40,
            SPECIAL: 30,
        },
        ACTIVE_FRAME_START: 5,
        ACTIVE_FRAME_END: 15,
        RANGES: {
            LIGHT: 40,
            HEAVY: 60,
            SPECIAL: 80,
        },
        HIT_CLEAR_DELAY: 600, // ms
    },
    DEBUG: {
        ENABLE_SYNC_LOGGING: true, // Set to false to disable verbose sync logs
        ENABLE_PHYSICS_LOGGING: false, // Set to true for detailed physics debug
        ENABLE_NETWORK_LOGGING: false, // Set to false to reduce network spam
        ENABLE_INPUT_LOGGING: false, // Set to true for input debugging
        LOG_INTERPOLATION: false, // Set to true for interpolation debugging
    },
    ANIMATION: {
        SPRITE_SIZE: 100, // 100x100 pixels per frame
        TOTAL_FRAMES: 32,
        GRID_WIDTH: 8,
        GRID_HEIGHT: 4,
        FRAMES: {
            IDLE: { start: 0, end: 3, frameRate: 8 },
            WALK: { start: 4, end: 11, frameRate: 12 },
            JUMP: { start: 12, end: 13, frameRate: 8 },
            FALL: { start: 14, end: 15, frameRate: 8 },
            ATTACK1: { start: 16, end: 19, frameRate: 12 },
            ATTACK2: { start: 20, end: 23, frameRate: 10 },
            HURT: { start: 24, end: 27, frameRate: 12 },
            DEATH: { start: 28, end: 31, frameRate: 8 },
        },
    },
    CONTROLS: {
        // Keyboard-only controls
        PLAYER_1: {
            LEFT: "A",
            RIGHT: "D",
            UP: "W",
            DOWN: "S",
            LIGHT: "J",
            HEAVY: "K",
            SPECIAL: "L",
        },
        MENU: {
            UP: ["W", "ARROW_UP"],
            DOWN: ["S", "ARROW_DOWN"],
            LEFT: ["A", "ARROW_LEFT"],
            RIGHT: ["D", "ARROW_RIGHT"],
            CONFIRM: ["ENTER", "SPACE"],
            CANCEL: ["ESCAPE", "BACKSPACE"],
        },
    },
    COMBAT: {
        MAX_HEALTH: 200, // Increased from 100 for longer fights
        LIGHT_DAMAGE: 15, // Reduced from 30 - fast but weak attacks
        HEAVY_DAMAGE: 25, // Reduced from 70 - strong but requires more hits
        SPECIAL_DAMAGE: 20, // Reduced from 50 - balanced special moves
        COMBO_WINDOW: 15, // frames
        HIT_PAUSE_DURATION: 3, // frames
    },
} as const;

// Environment configuration
export const ENV_CONFIG = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
    SOLANA_DEVNET_RPC: import.meta.env.VITE_SOLANA_DEVNET_RPC || "https://api.devnet.solana.com",
    SOLANA_MAINNET_RPC: import.meta.env.VITE_SOLANA_MAINNET_RPC || "https://api.mainnet-beta.solana.com",
} as const;

// Game states
export enum GameState {
    LOADING = "loading",
    MENU = "menu",
    FIGHTER_SELECT = "fighter_select",
    PLAYING = "playing",
    PAUSED = "paused",
    ROUND_END = "round_end",
    MATCH_END = "match_end",
    GAME_OVER = "game_over",
    CONNECTING = "connecting",
    WAITING_FOR_OPPONENT = "waiting_for_opponent",
    CONNECTION_LOST = "connection_lost",
}

export enum PlayerState {
    IDLE = "idle",
    WALKING = "walking",
    JUMPING = "jumping",
    FALLING = "falling",
    ATTACKING = "attacking",
    HURT = "hurt",
    BLOCKING = "blocking",
    DEAD = "dead",
}

export enum CollisionGroups {
    PLAYER = 1,
    ENEMIES = 2,
    PROJECTILES = 4,
    COLLECTIBLES = 8,
    WALLS = 16,
    GROUND = 32,
}

