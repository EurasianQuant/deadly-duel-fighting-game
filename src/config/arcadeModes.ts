/**
 * Arcade Mode Configuration
 * 
 * This file defines all arcade game modes and their exact specifications.
 * Each mode has detailed configuration for gameplay mechanics, progression,
 * scoring, and AI behavior.
 */

export interface ArcadeModeConfig {
    id: string;
    name: string;
    description: string;
    shortDescription: string;
    enabled: boolean;
    
    // Core gameplay settings
    gameplay: {
        type: "single_match" | "tournament" | "survival" | "time_attack";
        roundFormat: "best_of_3" | "single_round" | "endless" | "sequential";
        roundTimeLimit: number; // seconds, 0 = no limit
        totalMatches?: number;
        eliminationOnLoss: boolean;
    };
    
    // Opponent configuration
    opponents: {
        count: number | "unlimited" | "variable" | "course_based";
        selection: "random" | "ladder" | "all_characters" | "course_based";
        excludePlayerCharacter: boolean;
        simultaneousEnemies?: {
            startRound?: number;
            maxCount?: number;
        };
    };
    
    // Difficulty and AI settings
    difficulty: {
        baseLevel: number; // 1.0 = normal
        scaling: {
            enabled: boolean;
            type?: "linear" | "exponential" | "stepped";
            maxMultiplier?: number;
            progressionTrigger?: "round" | "match" | "time";
            milestones?: Array<{
                trigger: number;
                healthMultiplier: number;
                speedMultiplier: number;
                aggressionMultiplier: number;
            }>;
        };
    };
    
    // Progression and healing
    progression: {
        healingBetweenRounds: {
            enabled: boolean;
            percentage?: number; // 0.25 = 25%
            fullHeal?: boolean;
        };
        continuousPlay: boolean;
        saveProgress: boolean;
    };
    
    // Scoring system
    scoring: {
        enabled: boolean;
        basePoints?: number;
        bonuses?: {
            timeBonus?: {
                enabled: boolean;
                maxBonus: number;
                timeThreshold: number;
            };
            healthBonus?: {
                enabled: boolean;
                maxBonus: number;
            };
            perfectRoundBonus?: {
                enabled: boolean;
                points: number;
            };
            streakMultiplier?: {
                enabled: boolean;
                maxMultiplier: number;
                increment: number;
                resetOnDamage: boolean;
            };
            quickVictoryBonus?: {
                enabled: boolean;
                timeThreshold: number;
                bonus: number;
            };
        };
        persistence: {
            highScore: boolean;
            bestTimes: boolean;
            medals: boolean;
        };
    };
    
    // UI and flow configuration
    ui: {
        showRoundIndicators: boolean;
        showTimer: boolean;
        showScore: boolean;
        showProgress: boolean;
        customHUD?: boolean;
    };
    
    // Navigation flow
    flow: {
        characterSelection: boolean;
        courseSelection: boolean;
        immediateStart: boolean;
        returnTo: "arcade_select" | "main_menu" | "course_select";
    };
}

// Time Attack Course Configuration
export interface TimeAttackCourse {
    id: string;
    name: string;
    description: string;
    opponents: number;
    targetTime: number; // seconds
    difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    difficultyMultipliers: {
        health: number;
        speed: number;
        aggression: number;
    };
    medals: {
        gold: number; // percentage of target time (0.8 = 80%)
        silver: number;
        bronze: number;
    };
    enabled: boolean;
}

// Arcade Modes Configuration
export const ARCADE_MODES: Record<string, ArcadeModeConfig> = {
    normal: {
        id: "normal",
        name: "NORMAL MATCH",
        description: "Classic one-on-one battle\nBest of 3 rounds against random AI",
        shortDescription: "Classic 1v1 battle",
        enabled: true,
        
        gameplay: {
            type: "single_match",
            roundFormat: "best_of_3",
            roundTimeLimit: 59,
            totalMatches: 1,
            eliminationOnLoss: false,
        },
        
        opponents: {
            count: 1,
            selection: "random",
            excludePlayerCharacter: true,
        },
        
        difficulty: {
            baseLevel: 1.0,
            scaling: {
                enabled: false,
            },
        },
        
        progression: {
            healingBetweenRounds: {
                enabled: true,
                fullHeal: true,
            },
            continuousPlay: false,
            saveProgress: false,
        },
        
        scoring: {
            enabled: false,
            persistence: {
                highScore: false,
                bestTimes: false,
                medals: false,
            },
        },
        
        ui: {
            showRoundIndicators: true,
            showTimer: true,
            showScore: false,
            showProgress: false,
        },
        
        flow: {
            characterSelection: true,
            courseSelection: false,
            immediateStart: false,
            returnTo: "arcade_select",
        },
    },
    
    tournament: {
        id: "tournament",
        name: "TOURNAMENT MODE",
        description: "Fight all 5 opponents consecutively\nDifficulty increases with each match",
        shortDescription: "5 consecutive matches",
        enabled: true,
        
        gameplay: {
            type: "tournament",
            roundFormat: "best_of_3",
            roundTimeLimit: 59,
            totalMatches: 5,
            eliminationOnLoss: true,
        },
        
        opponents: {
            count: 5,
            selection: "ladder", // weakest to strongest progression
            excludePlayerCharacter: true,
        },
        
        difficulty: {
            baseLevel: 1.0,
            scaling: {
                enabled: true,
                type: "linear",
                maxMultiplier: 3.4,
                progressionTrigger: "match",
                milestones: [
                    { trigger: 1, healthMultiplier: 1.0, speedMultiplier: 1.0, aggressionMultiplier: 1.0 },
                    { trigger: 2, healthMultiplier: 1.1, speedMultiplier: 1.05, aggressionMultiplier: 1.5 },
                    { trigger: 3, healthMultiplier: 1.2, speedMultiplier: 1.1, aggressionMultiplier: 2.0 },
                    { trigger: 4, healthMultiplier: 1.3, speedMultiplier: 1.15, aggressionMultiplier: 2.7 },
                    { trigger: 5, healthMultiplier: 1.4, speedMultiplier: 1.2, aggressionMultiplier: 3.4 },
                ],
            },
        },
        
        progression: {
            healingBetweenRounds: {
                enabled: true,
                fullHeal: true,
            },
            continuousPlay: true,
            saveProgress: false,
        },
        
        scoring: {
            enabled: false,
            persistence: {
                highScore: false,
                bestTimes: false,
                medals: false,
            },
        },
        
        ui: {
            showRoundIndicators: true,
            showTimer: true,
            showScore: false,
            showProgress: true, // tournament progress
        },
        
        flow: {
            characterSelection: true,
            courseSelection: false,
            immediateStart: false,
            returnTo: "arcade_select",
        },
    },
    
    survival: {
        id: "survival",
        name: "SURVIVAL MODE",
        description: "Endless battle against waves of opponents\nHow long can you survive?",
        shortDescription: "Endless wave combat",
        enabled: true,
        
        /* SURVIVAL MODE MECHANICS:
         * 
         * ROUND END CONDITIONS:
         * - Round ends ONLY when all enemies are defeated (no timer)
         * - Game ends when player health reaches 0
         * 
         * ROUND FLOW:
         * 1. Fight all enemies until they're defeated
         * 2. Score calculation and popup display (2 seconds)
         * 3. Round indicator increments (shows completed rounds)
         * 4. 25% health recovery between rounds
         * 5. Next round starts with new enemies
         * 6. Difficulty scaling at specific milestones
         * 
         * ENEMY SCALING:
         * - Round 1: 1 enemy per round
         * - Round 2+: 2 enemies simultaneously  
         * - Round 10+: 1.5x health/speed multipliers
         * - Round 15+: 2.0x health/speed multipliers
         * 
         * SCORING:
         * - Base: 100 points per round
         * - Time Bonus: Up to 30 points (faster = more)
         * - Health Bonus: Up to 50 points (health preservation)
         * - Perfect Round: 500 points (no damage taken)
         * - Multi-Enemy: 50 points per extra enemy
         * - Streak Multiplier: Up to 5.0x (resets on damage)
         */
        
        gameplay: {
            type: "survival",
            roundFormat: "endless",
            roundTimeLimit: 0, // NO TIMER - rounds end when all enemies defeated
            eliminationOnLoss: true,
        },
        
        opponents: {
            count: "unlimited",
            selection: "random",
            excludePlayerCharacter: true,
            simultaneousEnemies: {
                startRound: 2,
                maxCount: 2,
            },
        },
        
        difficulty: {
            baseLevel: 1.0,
            scaling: {
                enabled: true,
                type: "stepped",
                maxMultiplier: 2.0,
                progressionTrigger: "round",
                milestones: [
                    { trigger: 6, healthMultiplier: 1.0, speedMultiplier: 1.0, aggressionMultiplier: 1.0 },
                    { trigger: 10, healthMultiplier: 1.5, speedMultiplier: 1.2, aggressionMultiplier: 1.3 },
                    { trigger: 15, healthMultiplier: 2.0, speedMultiplier: 1.4, aggressionMultiplier: 1.5 },
                ],
            },
        },
        
        progression: {
            healingBetweenRounds: {
                enabled: true,
                percentage: 0.25, // 25% healing between rounds
            },
            continuousPlay: true,
            saveProgress: false,
        },
        
        scoring: {
            enabled: true,
            basePoints: 100,
            bonuses: {
                timeBonus: {
                    enabled: true,
                    maxBonus: 30,
                    timeThreshold: 30000, // 30 seconds
                },
                healthBonus: {
                    enabled: true,
                    maxBonus: 50,
                },
                perfectRoundBonus: {
                    enabled: true,
                    points: 500,
                },
                streakMultiplier: {
                    enabled: true,
                    maxMultiplier: 5.0,
                    increment: 0.1,
                    resetOnDamage: true,
                },
            },
            persistence: {
                highScore: true,
                bestTimes: false,
                medals: false,
            },
        },
        
        ui: {
            showRoundIndicators: true, // shows completed rounds (only after player wins)
            showTimer: false, // NO TIMER - timer UI completely hidden
            showScore: true, // shows current score and high score
            showProgress: true, // shows round progression and streak
            customHUD: true, // uses survival-specific HUD elements
        },
        
        flow: {
            characterSelection: true,
            courseSelection: false,
            immediateStart: false,
            returnTo: "arcade_select",
        },
    },
    
    timeattack: {
        id: "timeattack",
        name: "TIME ATTACK",
        description: "Defeat opponents as fast as possible\n4 courses with medal rankings",
        shortDescription: "Speed-run challenges",
        enabled: true,
        
        gameplay: {
            type: "time_attack",
            roundFormat: "sequential",
            roundTimeLimit: 0, // no individual round limit
            eliminationOnLoss: true,
        },
        
        opponents: {
            count: "course_based",
            selection: "course_based",
            excludePlayerCharacter: true,
        },
        
        difficulty: {
            baseLevel: 1.0,
            scaling: {
                enabled: true,
                type: "stepped",
                progressionTrigger: "match",
            },
        },
        
        progression: {
            healingBetweenRounds: {
                enabled: false,
            },
            continuousPlay: true,
            saveProgress: false,
        },
        
        scoring: {
            enabled: true,
            bonuses: {
                timeBonus: {
                    enabled: true,
                    maxBonus: 5, // seconds off final time
                    timeThreshold: 0, // perfect round
                },
                healthBonus: {
                    enabled: true,
                    maxBonus: 3, // seconds off final time
                },
                quickVictoryBonus: {
                    enabled: true,
                    timeThreshold: 30, // seconds
                    bonus: 2, // seconds off final time
                },
            },
            persistence: {
                highScore: false,
                bestTimes: true,
                medals: true,
            },
        },
        
        ui: {
            showRoundIndicators: false,
            showTimer: true, // course timer
            showScore: false,
            showProgress: true, // course progress
            customHUD: true,
        },
        
        flow: {
            characterSelection: true,
            courseSelection: true,
            immediateStart: false,
            returnTo: "course_select",
        },
    },
};

// Time Attack Courses Configuration
export const TIME_ATTACK_COURSES: Record<string, TimeAttackCourse> = {
    rookie: {
        id: "rookie",
        name: "ROOKIE CIRCUIT",
        description: "3 opponents • Normal AI",
        opponents: 3,
        targetTime: 180, // 3 minutes
        difficulty: "Beginner",
        difficultyMultipliers: {
            health: 1.0,
            speed: 1.0,
            aggression: 1.0,
        },
        medals: {
            gold: 0.8,   // 144 seconds (2:24)
            silver: 0.9, // 162 seconds (2:42)
            bronze: 1.0, // 180 seconds (3:00)
        },
        enabled: true,
    },
    
    fighter: {
        id: "fighter",
        name: "FIGHTER'S GAUNTLET",
        description: "5 opponents • Enhanced AI",
        opponents: 5,
        targetTime: 300, // 5 minutes
        difficulty: "Intermediate",
        difficultyMultipliers: {
            health: 1.2,
            speed: 1.1,
            aggression: 1.5,
        },
        medals: {
            gold: 0.8,   // 240 seconds (4:00)
            silver: 0.9, // 270 seconds (4:30)
            bronze: 1.0, // 300 seconds (5:00)
        },
        enabled: true,
    },
    
    warrior: {
        id: "warrior",
        name: "WARRIOR'S TRIAL",
        description: "7 opponents • Hard AI",
        opponents: 7,
        targetTime: 420, // 7 minutes
        difficulty: "Advanced",
        difficultyMultipliers: {
            health: 1.4,
            speed: 1.2,
            aggression: 2.0,
        },
        medals: {
            gold: 0.8,   // 336 seconds (5:36)
            silver: 0.9, // 378 seconds (6:18)
            bronze: 1.0, // 420 seconds (7:00)
        },
        enabled: true,
    },
    
    champion: {
        id: "champion",
        name: "CHAMPION'S CRUCIBLE",
        description: "10 opponents • Maximum AI",
        opponents: 10,
        targetTime: 600, // 10 minutes
        difficulty: "Expert",
        difficultyMultipliers: {
            health: 1.6,
            speed: 1.3,
            aggression: 2.5,
        },
        medals: {
            gold: 0.8,   // 480 seconds (8:00)
            silver: 0.9, // 540 seconds (9:00)
            bronze: 1.0, // 600 seconds (10:00)
        },
        enabled: true,
    },
};

// Helper functions for accessing configuration
export const getArcadeMode = (modeId: string): ArcadeModeConfig | null => {
    return ARCADE_MODES[modeId] || null;
};

export const getTimeAttackCourse = (courseId: string): TimeAttackCourse | null => {
    return TIME_ATTACK_COURSES[courseId] || null;
};

export const getAllArcadeModes = (): ArcadeModeConfig[] => {
    return Object.values(ARCADE_MODES).filter(mode => mode.enabled);
};

export const getAllTimeAttackCourses = (): TimeAttackCourse[] => {
    return Object.values(TIME_ATTACK_COURSES).filter(course => course.enabled);
};

// Validation functions
export const validateArcadeModeConfig = (config: ArcadeModeConfig): boolean => {
    // Basic validation - ensure required fields exist
    return !!(config.id && config.name && config.gameplay && config.opponents && config.difficulty);
};

export const validateTimeAttackCourse = (course: TimeAttackCourse): boolean => {
    // Basic validation - ensure required fields exist and values are valid
    return !!(course.id && course.name && course.opponents > 0 && course.targetTime > 0);
};