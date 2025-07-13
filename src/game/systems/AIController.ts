import { GAME_CONFIG } from "@/config/gameConfig";
import { Fighter } from "@/game/entities/Fighter";
import debug from "@/lib/debug";

export interface AIDifficultySettings {
    aggression: number;
    reaction: number;
    strategy: number;
    level: number;
}

export interface AIBehaviorConfig {
    baseAggression: number;
    preferredRange: number;
    retreatDistance?: number;
    jumpChance?: number;
    combatJumpChance?: number;
    attackDistribution: {
        heavy: number;
        special: number;
    };
}

/**
 * Handles AI behavior for all character types with difficulty scaling
 */
export class AIController {
    private characterBehaviors: Map<string, AIBehaviorConfig> = new Map();

    constructor() {
        this.initializeCharacterBehaviors();
    }

    private initializeCharacterBehaviors(): void {
        // Rocco - Veteran Brawler: Aggressive, prefers close combat
        this.characterBehaviors.set("rocco", {
            baseAggression: GAME_CONFIG.AI.VETERAN_BRAWLER_AGGRESSION,
            preferredRange: 100,
            attackDistribution: { heavy: 0.7, special: 0.3 }
        });

        // Kai - Swift Striker: Fast, hit-and-run tactics
        this.characterBehaviors.set("kai", {
            baseAggression: GAME_CONFIG.AI.SWIFT_STRIKER_AGGRESSION,
            preferredRange: 80,
            retreatDistance: 60,
            attackDistribution: { heavy: 0.7, special: 0.3 }
        });

        // Kestrel - Lethal Blade: Calculated, waits for openings
        this.characterBehaviors.set("kestrel", {
            baseAggression: GAME_CONFIG.AI.LETHAL_BLADE_AGGRESSION,
            preferredRange: 90,
            attackDistribution: { heavy: 0.6, special: 0.4 }
        });

        // Zadie - Acrobatic Tempest: Jumpy, unpredictable (reduced jump frequency)
        this.characterBehaviors.set("zadie", {
            baseAggression: GAME_CONFIG.AI.ACROBATIC_TEMPEST_AGGRESSION,
            preferredRange: 110,
            jumpChance: 0.1, // Reduced from 0.3 to 0.1 (10% vs 30%)
            combatJumpChance: 0.005, // Reduced from 0.02 to 0.005 (0.5% vs 2%)
            attackDistribution: { heavy: 0.6, special: 0.4 }
        });

        // Kael - Mystic Guardian: Defensive, uses specials
        this.characterBehaviors.set("kael", {
            baseAggression: GAME_CONFIG.AI.MYSTIC_GUARDIAN_AGGRESSION,
            preferredRange: 130,
            retreatDistance: 70,
            attackDistribution: { heavy: 0.4, special: 0.6 }
        });

        // Jin - Shadow Assassin: Evasive, precise strikes
        this.characterBehaviors.set("jin", {
            baseAggression: GAME_CONFIG.AI.SHADOW_ASSASSIN_AGGRESSION,
            preferredRange: 70,
            attackDistribution: { heavy: 0.6, special: 0.4 }
        });
    }

    /**
     * Updates AI fighter behavior based on character type and difficulty
     */
    public updateAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings
    ): void {
        const characterId = aiFighter.characterId;
        const behavior = this.characterBehaviors.get(characterId);
        
        // Always ensure AI faces the target before any actions
        aiFighter.faceTarget(targetFighter);
        
        if (!behavior) {
            debug.ai(`Unknown character ID: ${characterId}, using balanced AI`);
            this.updateBalancedAI(aiFighter, targetFighter, distance, difficulty);
            return;
        }

        debug.ai(`Updating AI for ${characterId}, distance: ${distance.toFixed(1)}, difficulty: ${difficulty.level}`);

        switch (characterId) {
            case "rocco":
                this.updateVeteranBrawlerAI(aiFighter, targetFighter, distance, difficulty, behavior);
                break;
            case "kai":
                this.updateSwiftStrikerAI(aiFighter, targetFighter, distance, difficulty, behavior);
                break;
            case "kestrel":
                this.updateLethalBladeAI(aiFighter, targetFighter, distance, difficulty, behavior);
                break;
            case "zadie":
                this.updateAcrobaticTempestAI(aiFighter, targetFighter, distance, difficulty, behavior);
                break;
            case "kael":
                this.updateMysticGuardianAI(aiFighter, targetFighter, distance, difficulty, behavior);
                break;
            case "jin":
                this.updateShadowAssassinAI(aiFighter, targetFighter, distance, difficulty, behavior);
                break;
            default:
                this.updateBalancedAI(aiFighter, targetFighter, distance, difficulty);
                break;
        }
    }

    private updateVeteranBrawlerAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings,
        behavior: AIBehaviorConfig
    ): void {
        const aggression = behavior.baseAggression * difficulty.aggression;
        const preferredRange = difficulty.level >= 3 ? 80 : behavior.preferredRange;

        if (distance > preferredRange) {
            this.moveToward(aiFighter, targetFighter);
        }

        if (distance < 120 && Math.random() < aggression) {
            this.executeAttack(aiFighter, behavior.attackDistribution);
        }
    }

    private updateSwiftStrikerAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings,
        behavior: AIBehaviorConfig
    ): void {
        const aggression = behavior.baseAggression * difficulty.aggression;
        const enhancedAggression = aggression + (difficulty.level >= 4 ? 0.01 : 0);
        const retreatDistance = difficulty.level >= 3 ? 50 : (behavior.retreatDistance || 60);

        // Hit and run tactics
        if (distance > behavior.preferredRange) {
            this.moveToward(aiFighter, targetFighter);
        } else if (distance < retreatDistance) {
            this.moveAway(aiFighter, targetFighter);
        }

        if (distance < 100 && Math.random() < enhancedAggression) {
            this.executeAttack(aiFighter, behavior.attackDistribution);
        }
    }

    private updateLethalBladeAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings,
        behavior: AIBehaviorConfig
    ): void {
        const aggression = behavior.baseAggression * difficulty.aggression;

        if (distance > behavior.preferredRange + 20) {
            this.moveToward(aiFighter, targetFighter);
        }

        if (distance < 110 && Math.random() < aggression) {
            this.executeAttack(aiFighter, behavior.attackDistribution);
        }
    }

    private updateAcrobaticTempestAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings,
        behavior: AIBehaviorConfig
    ): void {
        const aggression = behavior.baseAggression * difficulty.aggression;
        const jumpChanceAdvance = (behavior.jumpChance || 0.1) + (difficulty.level >= 2 ? 0.05 : 0);
        const jumpChanceCombat = (behavior.combatJumpChance || 0.005) + (difficulty.level >= 3 ? 0.005 : 0);

        // Unpredictable movement with jumping (reduced frequency)
        if (distance > behavior.preferredRange) {
            if (Math.random() < jumpChanceAdvance && aiFighter.isGrounded) {
                aiFighter.jump();
            }
            this.moveToward(aiFighter, targetFighter);
        }

        // Random combat jumps (much less frequent)
        if (distance < 150 && Math.random() < jumpChanceCombat && aiFighter.isGrounded) {
            aiFighter.jump();
        }

        if (distance < 100 && Math.random() < aggression) {
            this.executeAttack(aiFighter, behavior.attackDistribution);
        }
    }

    private updateMysticGuardianAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings,
        behavior: AIBehaviorConfig
    ): void {
        const aggression = behavior.baseAggression * difficulty.aggression;
        const retreatDistance = behavior.retreatDistance || 70;

        // Maintains distance, defensive approach
        if (distance > behavior.preferredRange + 30) {
            this.moveToward(aiFighter, targetFighter);
        } else if (distance < retreatDistance) {
            this.moveAway(aiFighter, targetFighter);
        }

        if (distance < 140 && Math.random() < aggression) {
            this.executeAttack(aiFighter, behavior.attackDistribution);
        }
    }

    private updateShadowAssassinAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings,
        behavior: AIBehaviorConfig
    ): void {
        const aggression = behavior.baseAggression * difficulty.aggression;
        const evasionThreshold = difficulty.level >= 4 ? 0.6 : GAME_CONFIG.AI.EVASION_HEALTH_THRESHOLD;

        // Quick, evasive approach
        if (distance > behavior.preferredRange) {
            this.moveToward(aiFighter, targetFighter);
        } else if (distance < 50 && aiFighter.health < aiFighter.maxHealth * evasionThreshold) {
            this.moveAway(aiFighter, targetFighter);
        }

        if (distance < 90 && Math.random() < aggression) {
            this.executeAttack(aiFighter, behavior.attackDistribution);
        }
    }

    private updateBalancedAI(
        aiFighter: Fighter,
        targetFighter: Fighter,
        distance: number,
        difficulty: AIDifficultySettings
    ): void {
        const aggression = GAME_CONFIG.AI.BASE_AGGRESSION * difficulty.aggression;

        if (distance > 120) {
            this.moveToward(aiFighter, targetFighter);
        }

        if (distance < 100 && Math.random() < aggression) {
            const attackTypes = ["heavy", "special"] as const;
            const randomAttack = attackTypes[Math.floor(Math.random() * attackTypes.length)];
            aiFighter.attack(randomAttack);
        }
    }

    private moveToward(aiFighter: Fighter, targetFighter: Fighter): void {
        // Move toward target but always face the target
        if (targetFighter.x < aiFighter.x) {
            aiFighter.moveWithoutTurning("left");
        } else {
            aiFighter.moveWithoutTurning("right");
        }
        // Always face the target regardless of movement direction
        aiFighter.faceTarget(targetFighter);
    }

    private moveAway(aiFighter: Fighter, targetFighter: Fighter): void {
        // Move away from target but still face the target
        if (targetFighter.x < aiFighter.x) {
            aiFighter.moveWithoutTurning("right");
        } else {
            aiFighter.moveWithoutTurning("left");
        }
        // Always face the target even when retreating
        aiFighter.faceTarget(targetFighter);
    }

    private executeAttack(aiFighter: Fighter, distribution: { heavy: number; special: number }): void {
        const random = Math.random();
        
        if (random < distribution.heavy) {
            aiFighter.attack("heavy");
        } else {
            aiFighter.attack("special");
        }
    }

    private getCharacterIdFromStats(stats: any): string {
        // Identify character by their unique stat combination
        if (stats.health === 250 && stats.speed === 300) return "fighter_1"; // Rocco
        if (stats.health === 180 && stats.speed === 420) return "fighter_2"; // Kai
        if (stats.health === 190 && stats.heavyDamage === 28) return "fighter_3"; // Kestrel
        if (stats.health === 170 && stats.jumpVelocity === -950) return "fighter_4"; // Zadie
        if (stats.health === 220 && stats.specialDamage === 30) return "fighter_5"; // Kael
        if (stats.health === 160 && stats.speed === 450) return "fighter_6"; // Nyx
        return "balanced";
    }

    /**
     * Calculate difficulty settings for tournament mode
     */
    public static calculateDifficulty(gameMode: string, tournamentData?: any): AIDifficultySettings {
        const difficultyLevel = (gameMode === "tournament" && tournamentData) 
            ? tournamentData.difficultyLevel 
            : 1;
        
        return {
            aggression: 1 + (difficultyLevel - 1) * GAME_CONFIG.AI.DIFFICULTY_SCALING_FACTOR,
            reaction: 1 + (difficultyLevel - 1) * GAME_CONFIG.AI.REACTION_SCALING_FACTOR,
            strategy: Math.min(difficultyLevel / 5, 1.0),
            level: difficultyLevel
        };
    }
}