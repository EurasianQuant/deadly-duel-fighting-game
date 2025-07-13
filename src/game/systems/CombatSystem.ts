import { GAME_CONFIG } from "@/config/gameConfig";
import { Fighter, AttackType } from "@/game/entities/Fighter";
import debug from "@/lib/debug";

/**
 * Handles combat mechanics, collision detection, and damage calculations
 */
export class CombatSystem {
    private hitTargets: Set<string> = new Set();
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * Handle combat collision between two fighters
     */
    public handleCombatCollision(fighter1: Fighter, fighter2: Fighter): void {
        // Check if fighter1 is attacking and can hit fighter2
        if (fighter1.getIsAttacking() && !fighter2.getIsInvulnerable()) {
            this.processAttack(fighter1, fighter2);
        }

        // Check if fighter2 is attacking and can hit fighter1
        if (fighter2.getIsAttacking() && !fighter1.getIsInvulnerable()) {
            this.processAttack(fighter2, fighter1);
        }
    }

    private processAttack(attacker: Fighter, defender: Fighter): void {
        const hitbox = attacker.getAttackHitbox();
        if (!hitbox || hitbox.width <= 0) return;

        // Check distance between fighters first (additional safety check)
        const distance = this.getDistanceBetweenFighters(attacker, defender);
        const maxDistance = this.getMaxAttackDistance(attacker.getCurrentAttackType());

        if (distance > maxDistance) return;

        // Check if defender's body intersects with attacker's attack hitbox
        const defenderBounds = defender.getBounds();

        if (this.rectanglesIntersect(hitbox, defenderBounds)) {
            this.executeHit(attacker, defender, distance);
        }
    }

    private executeHit(attacker: Fighter, defender: Fighter, distance: number): void {
        // Create unique hit identifier to prevent multiple hits
        const attackStartTime = Date.now();
        const hitId = `${attacker.fighterName}-${attacker.getCurrentAttackType()}-${Math.floor(attackStartTime / 1000)}`;

        if (this.hitTargets.has(hitId)) return;

        this.hitTargets.add(hitId);

        // Deal damage based on attack type
        const damage = this.getAttackDamageForType(attacker);
        defender.takeDamage(damage);

        debug.combat(
            `${attacker.fighterName} hit ${defender.fighterName} for ${damage} damage! (distance: ${Math.round(distance)}px, frame: ${attacker.getAttackFrame()})`
        );

        // Clear hit after attack duration
        this.scene.time.delayedCall(GAME_CONFIG.ATTACK.HIT_CLEAR_DELAY, () => {
            this.hitTargets.delete(hitId);
        });
    }

    private getAttackDamageForType(fighter: Fighter): number {
        const attackType = fighter.getCurrentAttackType();
        const stats = fighter.getCharacterStats();

        switch (attackType) {
            case "heavy":
                return stats.heavyDamage || GAME_CONFIG.COMBAT.HEAVY_DAMAGE;
            case "special":
                return stats.specialDamage || GAME_CONFIG.COMBAT.SPECIAL_DAMAGE;
            default:
                return GAME_CONFIG.COMBAT.HEAVY_DAMAGE;
        }
    }

    private getMaxAttackDistance(attackType: string | null): number {
        switch (attackType) {
            case "light":
                return GAME_CONFIG.ATTACK.RANGES.LIGHT;
            case "heavy":
                return GAME_CONFIG.ATTACK.RANGES.HEAVY;
            case "special":
                return GAME_CONFIG.ATTACK.RANGES.SPECIAL;
            default:
                return 0;
        }
    }

    private rectanglesIntersect(
        rect1: { x: number; y: number; width: number; height: number },
        rect2: { x: number; y: number; width: number; height: number }
    ): boolean {
        return !(
            rect1.x + rect1.width < rect2.x ||
            rect2.x + rect2.width < rect1.x ||
            rect1.y + rect1.height < rect2.y ||
            rect2.y + rect2.height < rect1.y
        );
    }

    private getDistanceBetweenFighters(fighter1: Fighter, fighter2: Fighter): number {
        return Phaser.Math.Distance.Between(
            fighter1.x,
            fighter1.y,
            fighter2.x,
            fighter2.y
        );
    }

    /**
     * Set up physics collision detection between fighters
     */
    public setupCombatPhysics(fighter1: Fighter, fighter2: Fighter): void {
        // Use dynamic camera dimensions for ground physics
        const { width, height } = this.scene.cameras.main;
        
        // Create invisible ground physics body for collision detection
        const groundBody = this.scene.physics.add.staticGroup();
        const invisibleGround = groundBody.create(
            width / 2,
            height - 10, // Adjusted to match new ground position
            undefined
        );
        invisibleGround.setSize(width, 20); // Match visual ground size using dynamic width
        invisibleGround.setVisible(false);

        // Fighter-ground collisions
        this.scene.physics.add.collider(fighter1, groundBody);
        this.scene.physics.add.collider(fighter2, groundBody);

        // Fighter-fighter collision barrier (prevent complete overlap)
        this.scene.physics.add.collider(
            fighter1,
            fighter2,
            undefined,
            (obj1, obj2) => {
                const f1 = obj1 as Fighter;
                const f2 = obj2 as Fighter;
                const distance = this.getDistanceBetweenFighters(f1, f2);
                // Only prevent overlap if they're too close
                return distance < GAME_CONFIG.FIGHTER.MIN_COLLISION_DISTANCE;
            },
            this.scene
        );

        // Combat collision detection
        this.scene.physics.add.overlap(
            fighter1,
            fighter2,
            () => this.handleCombatCollision(fighter1, fighter2),
            undefined,
            this.scene
        );
    }

    /**
     * Update grounded states for fighters
     */
    public updateGroundedStates(fighter1: Fighter, fighter2: Fighter): void {
        // Use dynamic camera height for ground detection
        const { height } = this.scene.cameras.main;
        const groundY = height - 20; // Updated to match new ground height
        
        fighter1.updateGroundedState(fighter1.y >= groundY - GAME_CONFIG.FIGHTER.GROUND_OFFSET);
        fighter2.updateGroundedState(fighter2.y >= groundY - GAME_CONFIG.FIGHTER.GROUND_OFFSET);
    }

    /**
     * Clean up hit tracking (called when round ends)
     */
    public cleanup(): void {
        this.hitTargets.clear();
    }
}