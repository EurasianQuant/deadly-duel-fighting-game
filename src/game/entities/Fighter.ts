import {
    Physics,
    Scene,
} from "phaser";

import { GAME_CONFIG } from "@/config/gameConfig";
import { Character } from "@/data/characters";
import EventBus from "@/lib/EventBus";
import debug from "@/lib/debug";

export type FighterState =
    | "idle"
    | "walking"
    | "jumping"
    | "falling"
    | "attacking"
    | "hurt"
    | "defeated";
export type AttackType = "light" | "heavy" | "special";

export class Fighter extends Physics.Arcade.Sprite {
    public health: number;
    public maxHealth: number;
    public speed: number;
    public jumpVelocity: number;
    public isGrounded: boolean;
    public fighterName: string;
    public characterId: string; // Store character ID for AI system
    public currentState: FighterState;

    // Network interpolation properties
    public targetX?: number;
    public targetY?: number;

    // Character-specific stats
    private characterStats: Character["stats"];

    // Combat properties
    private isAttacking: boolean = false;
    private attackType: AttackType | null = null;
    private isInvulnerable: boolean = false;
    private attackFrame: number = 0;
    private maxAttackFrames: number = 0;
    private invulnerabilityTimer: number = 0;

    constructor(
        scene: Scene,
        x: number,
        y: number,
        texture: string,
        fighterName: string,
        characterData?: Character
    ) {
        super(scene, x, y, texture);

        // Add this sprite to the scene
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Store character ID for AI system
        this.characterId = characterData?.id || "unknown";
        
        // Use character-specific stats or fall back to defaults
        this.characterStats = characterData?.stats || {
            health: GAME_CONFIG.COMBAT.MAX_HEALTH,
            speed: GAME_CONFIG.PHYSICS.PLAYER_SPEED,
            jumpVelocity: GAME_CONFIG.PHYSICS.JUMP_VELOCITY,
            lightDamage: GAME_CONFIG.COMBAT.LIGHT_DAMAGE,
            heavyDamage: GAME_CONFIG.COMBAT.HEAVY_DAMAGE,
            specialDamage: GAME_CONFIG.COMBAT.SPECIAL_DAMAGE,
            attackSpeed: 1.0,
        };

        // Initialize fighter properties with character-specific stats
        this.health = this.characterStats.health;
        this.maxHealth = this.characterStats.health;
        this.speed = this.characterStats.speed;
        this.jumpVelocity = this.characterStats.jumpVelocity;
        this.isGrounded = true; // Start grounded to prevent initial jumping frame
        this.fighterName = fighterName;
        this.currentState = "idle";

        // Scale up for visibility - these sprites need to be larger
        this.setScale(GAME_CONFIG.FIGHTER.SCALE);
        this.setOrigin(0.5, 1); // Origin at bottom center for ground alignment

        // Configure physics body
        const body = this.body as Physics.Arcade.Body;
        body.setCollideWorldBounds(true);

        // Adjust body size to match scaled sprite - smaller to prevent sticking
        const bodyWidth = GAME_CONFIG.FIGHTER.BODY_WIDTH;
        const bodyHeight = this.height * GAME_CONFIG.FIGHTER.BODY_HEIGHT_RATIO;
        body.setSize(bodyWidth, bodyHeight);
        body.setOffset((this.width - bodyWidth) / 2, this.height * GAME_CONFIG.FIGHTER.BODY_OFFSET_RATIO);
        body.setDrag(GAME_CONFIG.FIGHTER.DRAG, 0);

        // Create basic animations
        this.createAnimations();
    }

    public update(delta: number): void {
        // Don't update defeated fighters or destroyed fighters
        if ((this.currentState as any) === "defeated" || !this.active || !this.anims) {
            return;
        }
        
        this.updateCombatTimers(delta);
        this.updateAnimationState();
    }

    public move(direction: "left" | "right"): void {
        // Can't move while attacking or hurt
        if (
            this.isAttacking ||
            this.currentState === "hurt" ||
            this.currentState === "defeated"
        ) {
            debug.physics(`MOVEMENT BLOCKED: ${this.fighterName} ${direction} blocked - isAttacking=${this.isAttacking}, state=${this.currentState}`);
            return;
        }

        const body = this.body as Physics.Arcade.Body;
        const prevVelX = body.velocity.x;
        const prevState = this.currentState;

        if (direction === "left") {
            body.setVelocityX(-this.speed);
            this.setFlipX(true);
            debug.physics(`FIGHTER MOVE LEFT: ${this.fighterName} velocity ${prevVelX.toFixed(2)} -> ${-this.speed}`);
        } else {
            body.setVelocityX(this.speed);
            this.setFlipX(false);
            debug.physics(`FIGHTER MOVE RIGHT: ${this.fighterName} velocity ${prevVelX.toFixed(2)} -> ${this.speed}`);
        }

        if (this.isGrounded && this.currentState !== "attacking") {
            this.currentState = "walking";
            if (prevState !== "walking") {
                debug.physics(`FIGHTER WALKING: ${this.fighterName} state ${prevState} -> walking`);
            }
        }
    }

    public faceTarget(target: Fighter): void {
        // Face toward the target fighter regardless of movement direction
        if (target.x < this.x) {
            this.setFlipX(true);  // Face left toward target
        } else {
            this.setFlipX(false); // Face right toward target
        }
    }

    public moveWithoutTurning(direction: "left" | "right"): void {
        // Move without changing facing direction (for AI that should always face target)
        if (
            this.isAttacking ||
            this.currentState === "hurt" ||
            this.currentState === "defeated"
        ) {
            return;
        }

        const body = this.body as Physics.Arcade.Body;
        
        if (direction === "left") {
            body.setVelocityX(-this.speed);
        } else {
            body.setVelocityX(this.speed);
        }

        if (this.isGrounded && this.currentState !== "attacking") {
            this.currentState = "walking";
        }
    }

    public jump(): void {
        // Can't jump while attacking or hurt
        if (
            this.isAttacking ||
            this.currentState === "hurt" ||
            this.currentState === "defeated"
        ) {
            debug.physics(`JUMP BLOCKED: ${this.fighterName} jump blocked - isAttacking=${this.isAttacking}, state=${this.currentState}`);
            return;
        }

        const body = this.body as Physics.Arcade.Body;

        if (this.isGrounded) {
            const prevVelY = body.velocity.y;
            body.setVelocityY(this.jumpVelocity);
            this.isGrounded = false;
            this.currentState = "jumping";
            debug.physics(`FIGHTER JUMP: ${this.fighterName} velocityY ${prevVelY.toFixed(2)} -> ${this.jumpVelocity}, grounded=false, state -> jumping`);
        } else {
            debug.physics(`JUMP IGNORED: ${this.fighterName} not grounded (y=${this.y.toFixed(2)})`);
        }
    }

    public attack(type: AttackType): void {
        // Can't attack while already attacking, hurt, or defeated
        if (
            this.isAttacking ||
            this.currentState === "hurt" ||
            this.currentState === "defeated"
        ) {
            return;
        }

        // Start attack
        this.isAttacking = true;
        this.attackType = type;
        this.attackFrame = 0;
        this.currentState = "attacking";

        // Set attack duration based on type
        this.maxAttackFrames = this.getAttackFrames(type);

        // Stop movement during attack
        const body = this.body as Physics.Arcade.Body;
        body.setVelocityX(0);

        // Emit attack event for UI feedback
        EventBus.emit("fighter-attack", {
            fighter: this.fighterName,
            attackType: type,
            damage: this.getAttackDamage(type),
        });
    }

    public takeDamage(amount: number): void {
        // Can't take damage if invulnerable or already defeated
        if (this.isInvulnerable || this.currentState === "defeated") {
            return;
        }

        this.health = Math.max(0, this.health - amount);

        // Set hurt state - but be smarter about preserving jump physics
        const wasJumpingOrFalling = this.currentState === "jumping" || this.currentState === "falling";
        const body = this.body as Physics.Arcade.Body;
        
        this.currentState = "hurt";
        this.isAttacking = false;
        this.attackType = null;

        // Add knockback - but preserve vertical velocity during jumps to avoid floating
        const knockbackForce = this.flipX ? GAME_CONFIG.FIGHTER.KNOCKBACK_FORCE : -GAME_CONFIG.FIGHTER.KNOCKBACK_FORCE;
        
        if (wasJumpingOrFalling && Math.abs(body.velocity.y) > 50) {
            // During active jumping/falling, only apply horizontal knockback
            // Preserve vertical velocity to maintain natural jump physics
            body.setVelocityX(knockbackForce);
            console.log(`💥 DAMAGE DURING JUMP: ${this.fighterName} preserving velY=${body.velocity.y.toFixed(2)}`);
        } else {
            // Normal knockback for grounded or minimal velocity situations
            body.setVelocityX(knockbackForce);
        }

        // Brief invulnerability
        this.isInvulnerable = true;
        this.invulnerabilityTimer = GAME_CONFIG.FIGHTER.INVULNERABILITY_DURATION;

        // Add screen shake effect based on damage amount
        this.triggerScreenShake(amount);

        // Play hit sound effect
        this.playHitSound(amount);

        // Emit damage event for UI updates
        EventBus.emit("fighter-damaged", {
            fighter: this.fighterName,
            damage: amount,
            currentHealth: this.health,
            maxHealth: this.maxHealth,
        });

        // Check if fighter is defeated
        if (this.health <= 0) {
            this.onDefeated();
        }
    }

    public updateGroundedState(isGrounded: boolean): void {
        // PHYSICS DEBUG: Log ground state changes
        if (this.isGrounded !== isGrounded) {
            const body = this.body as Physics.Arcade.Body;
            console.log(`🏠 FIGHTER GROUND STATE: ${this.fighterName} ${this.isGrounded} -> ${isGrounded}, y=${this.y.toFixed(2)}, bodyY=${body?.y.toFixed(2)}, velY=${body?.velocity.y.toFixed(2)}`);
        }
        this.isGrounded = isGrounded;
    }

    // Public getters for collision detection
    public getIsAttacking(): boolean {
        return this.isAttacking && this.isInActiveAttackFrames();
    }

    public getIsInvulnerable(): boolean {
        return this.isInvulnerable;
    }

    public getCurrentAttackType(): AttackType | null {
        return this.attackType;
    }

    public getAttackFrame(): number {
        return this.attackFrame;
    }

    public getCharacterStats(): Character["stats"] {
        return this.characterStats;
    }

    public getAttackHitbox(): {
        x: number;
        y: number;
        width: number;
        height: number;
    } {
        if (!this.isAttacking) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        // Attack hitbox extends in front of the fighter
        const hitboxWidth = this.getAttackRange();
        const hitboxHeight = 80;
        const hitboxX = this.flipX ? this.x - hitboxWidth : this.x;
        const hitboxY = this.y - hitboxHeight / 2;

        return {
            x: hitboxX,
            y: hitboxY,
            width: hitboxWidth,
            height: hitboxHeight,
        };
    }

    private updateCombatTimers(delta: number): void {
        // Update attack frames
        if (this.isAttacking) {
            this.attackFrame++;
            if (this.attackFrame >= this.maxAttackFrames) {
                this.isAttacking = false;
                this.attackType = null;
                this.currentState = "idle";
            }
        }

        // Update invulnerability
        if (this.isInvulnerable) {
            this.invulnerabilityTimer -= delta;
            if (this.invulnerabilityTimer <= 0) {
                this.isInvulnerable = false;
                this.setTint(0xffffff); // Remove hurt tint
            } else {
                // Flash during invulnerability
                const flash = Math.floor(this.invulnerabilityTimer / 100) % 2;
                this.setTint(flash ? 0xff9999 : 0xffffff);
            }
        }

        // Recovery from hurt state - check physics before setting new state
        if (this.currentState === "hurt" && !this.isInvulnerable) {
            // Don't immediately set to idle - let updateAnimationState handle the transition
            // based on current physics state (grounded, velocity, etc.)
            const body = this.body as Physics.Arcade.Body;
            
            // If player is clearly airborne with significant velocity, prioritize physics
            if (!this.isGrounded && Math.abs(body.velocity.y) > 10) {
                // Let the animation system determine jump/fall state based on velocity
                if (body.velocity.y < -5) {
                    this.currentState = "jumping";
                } else if (body.velocity.y > 5) {
                    this.currentState = "falling";
                } else {
                    this.currentState = "idle"; // Minimal velocity, treat as idle
                }
            } else if (this.isGrounded) {
                // Safe to return to normal ground-based state
                this.currentState = "idle";
            } else {
                // Edge case: not grounded but low velocity - force idle for safety
                this.currentState = "idle";
            }
            
            console.log(`💚 HURT RECOVERY: ${this.fighterName} hurt -> ${this.currentState} (grounded=${this.isGrounded}, velY=${body.velocity.y.toFixed(2)})`);
        }
    }

    private updateAnimationState(): void {
        // Safety check: Don't update animations if the fighter or animation system is invalid
        if (!this.anims || !this.anims.animationManager || (this.currentState as any) === "defeated") {
            return;
        }
        
        const body = this.body as Physics.Arcade.Body;
        
        // Additional safety check for body
        if (!body) {
            return;
        }
        
        const prevAnim = this.anims.currentAnim?.key;

        // Priority: defeated > attacking > hurt > jumping/falling > walking > idle
        if ((this.currentState as any) === "defeated") {
            // Only play death animation once, don't restart it
            if (!this.anims.isPlaying || this.anims.currentAnim?.key !== "death") {
                this.safePlay("death", false);
            }
        } else if (this.currentState === "attacking") {
            const animKey = `${this.attackType}Attack`;
            this.safePlay(animKey, true);
        } else if (this.currentState === "hurt") {
            this.safePlay("hurt", true);
        } else {
            // Determine state based on physics - ALWAYS trust the physics system
            // Use a small buffer to prevent flickering between states
            const hasSignificantHorizontalVelocity = Math.abs(body.velocity.x) > 10;
            const hasSignificantVerticalVelocity = Math.abs(body.velocity.y) > 5;
            
            if (this.isGrounded && !hasSignificantVerticalVelocity) {
                // Player is definitively on the ground with no vertical movement
                if (hasSignificantHorizontalVelocity) {
                    // Moving horizontally - walking
                    this.safePlay("walk", true);
                    if (this.currentState !== "walking") {
                        console.log(`🚶 ANIM WALK: ${this.fighterName} ${this.currentState} -> walking (velX=${body.velocity.x.toFixed(2)}, grounded=${this.isGrounded})`);
                        this.currentState = "walking";
                    }
                } else {
                    // Not moving - idle
                    this.safePlay("idle", true);
                    if (this.currentState !== "idle") {
                        console.log(`🗘️ ANIM IDLE: ${this.fighterName} ${this.currentState} -> idle (grounded=${this.isGrounded}, velX=${body.velocity.x.toFixed(2)})`);
                        this.currentState = "idle";
                    }
                }
            } else if (!this.isGrounded || hasSignificantVerticalVelocity) {
                // Player is in the air OR has significant vertical velocity
                if (body.velocity.y < -5) {
                    // Going up - jumping
                    this.safePlay("jump", true);
                    if (this.currentState !== "jumping") {
                        console.log(`⬆️ ANIM JUMP: ${this.fighterName} ${this.currentState} -> jumping (velY=${body.velocity.y.toFixed(2)}, grounded=${this.isGrounded})`);
                        this.currentState = "jumping";
                    }
                } else if (body.velocity.y > 5) {
                    // Going down - falling
                    this.safePlay("fall", true);
                    if (this.currentState !== "falling") {
                        console.log(`⬇️ ANIM FALL: ${this.fighterName} ${this.currentState} -> falling (velY=${body.velocity.y.toFixed(2)}, grounded=${this.isGrounded})`);
                        this.currentState = "falling";
                    }
                } else {
                    // Minimal vertical velocity but not grounded - this is the edge case
                    // Prioritize grounded state if we're close to ground
                    if (this.isGrounded && hasSignificantHorizontalVelocity) {
                        this.safePlay("walk", true);
                        if (this.currentState !== "walking") {
                            console.log(`🚶 ANIM WALK (edge): ${this.fighterName} ${this.currentState} -> walking (velX=${body.velocity.x.toFixed(2)}, velY=${body.velocity.y.toFixed(2)})`);
                            this.currentState = "walking";
                        }
                    } else if (this.isGrounded) {
                        this.safePlay("idle", true);
                        if (this.currentState !== "idle") {
                            console.log(`🗘️ ANIM IDLE (edge): ${this.fighterName} ${this.currentState} -> idle (grounded=${this.isGrounded})`);
                            this.currentState = "idle";
                        }
                    } else {
                        // Floating edge case - force to falling
                        this.safePlay("fall", true);
                        if (this.currentState !== "falling") {
                            console.log(`⬇️ ANIM FALL (floating): ${this.fighterName} ${this.currentState} -> falling (velY=${body.velocity.y.toFixed(2)})`);
                            this.currentState = "falling";
                        }
                    }
                }
            }
        }
        
        // ANIMATION DEBUG: Log animation changes
        const currentAnim = this.anims.currentAnim?.key;
        if (currentAnim !== prevAnim) {
            console.log(`🎭 ANIM CHANGE: ${this.fighterName} ${prevAnim || 'none'} -> ${currentAnim || 'none'}`);
        }
    }

    private createAnimations(): void {
        // Create animations using the 32-frame spritesheet layout
        // Frame layout: 8x4 grid (0-31 frames)
        // IDLE: frames 0-3, RUN: frames 4-11, JUMP: frames 12-13, FALL: frames 14-15
        // ATTACK1: frames 16-19, ATTACK2: frames 20-23, HURT: frames 24-27, DEATH: frames 28-31

        const textureKey = this.texture.key;

        if (!this.anims.exists("idle")) {
            this.anims.create({
                key: "idle",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 0,
                    end: 3,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        if (!this.anims.exists("walk")) {
            this.anims.create({
                key: "walk",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 4,
                    end: 11,
                }),
                frameRate: 12,
                repeat: -1,
            });
        }

        if (!this.anims.exists("jump")) {
            this.anims.create({
                key: "jump",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 12,
                    end: 13,
                }),
                frameRate: 8,
                repeat: 0,
            });
        }

        if (!this.anims.exists("fall")) {
            this.anims.create({
                key: "fall",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 14,
                    end: 15,
                }),
                frameRate: 8,
                repeat: -1,
            });
        }

        if (!this.anims.exists("lightAttack")) {
            this.anims.create({
                key: "lightAttack",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 16,
                    end: 17,
                }), // First 2 frames of ATTACK1
                frameRate: 16,
                repeat: 0,
            });
        }

        if (!this.anims.exists("heavyAttack")) {
            this.anims.create({
                key: "heavyAttack",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 16,
                    end: 19,
                }), // Full ATTACK1
                frameRate: 12,
                repeat: 0,
            });
        }

        if (!this.anims.exists("specialAttack")) {
            this.anims.create({
                key: "specialAttack",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 20,
                    end: 23,
                }), // ATTACK2
                frameRate: 10,
                repeat: 0,
            });
        }

        if (!this.anims.exists("hurt")) {
            this.anims.create({
                key: "hurt",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 24,
                    end: 27,
                }),
                frameRate: 12,
                repeat: 0,
            });
        }

        if (!this.anims.exists("death")) {
            this.anims.create({
                key: "death",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 28,
                    end: 31,
                }),
                frameRate: 8,
                repeat: 0,
            });
        }

        // Start with idle animation and lock it
        this.safePlay("idle");
        this.setFrame(0); // Ensure we start on the first idle frame
    }

    private safePlay(animationKey: string, ignoreIfPlaying?: boolean): void {
        try {
            // Check if animation system is valid
            if (!this.anims || !this.anims.animationManager || (this.currentState as any) === "defeated") {
                return;
            }
            
            // Check if the animation exists
            if (!this.anims.exists(animationKey)) {
                console.warn(`Animation '${animationKey}' does not exist for fighter ${this.fighterName}`);
                return;
            }
            
            // Play the animation safely
            this.play(animationKey, ignoreIfPlaying);
        } catch (error) {
            console.error(`Failed to play animation '${animationKey}' for fighter ${this.fighterName}:`, error);
        }
    }

    private getAttackFrames(type: AttackType): number {
        const baseFrames = (() => {
            switch (type) {
                case "light":
                    return GAME_CONFIG.ATTACK.FRAMES.LIGHT;
                case "heavy":
                    return GAME_CONFIG.ATTACK.FRAMES.HEAVY;
                case "special":
                    return GAME_CONFIG.ATTACK.FRAMES.SPECIAL;
                default:
                    return GAME_CONFIG.ATTACK.FRAMES.LIGHT;
            }
        })();

        // Apply character-specific attack speed modifier
        // attackSpeed > 1.0 = faster attacks (fewer frames)
        // attackSpeed < 1.0 = slower attacks (more frames)
        return Math.round(baseFrames / this.characterStats.attackSpeed);
    }

    private getAttackRange(): number {
        if (!this.attackType) return 0;

        switch (this.attackType) {
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

    private getAttackDamage(type: AttackType): number {
        switch (type) {
            case "light":
                return this.characterStats.lightDamage;
            case "heavy":
                return this.characterStats.heavyDamage;
            case "special":
                return this.characterStats.specialDamage;
            default:
                return 0;
        }
    }

    private onDefeated(): void {
        this.currentState = "defeated";
        this.isAttacking = false;
        this.attackType = null;
        this.health = 0; // Ensure health stays at 0

        // Stop all movement and disable physics
        const body = this.body as Physics.Arcade.Body;
        body.setVelocity(0);
        body.setAcceleration(0);

        // Emit defeat event
        EventBus.emit("fighter-defeated", {
            fighter: this.fighterName,
        });

        // Visual feedback
        this.setTint(0x666666);
        
        debug.general(`Fighter defeated: ${this.fighterName}`);
    }

    private isInActiveAttackFrames(): boolean {
        // Attack hitboxes are only active during specific frames
        return this.attackFrame >= GAME_CONFIG.ATTACK.ACTIVE_FRAME_START && this.attackFrame <= GAME_CONFIG.ATTACK.ACTIVE_FRAME_END;
    }

    private triggerScreenShake(damage: number): void {
        // Scale screen shake intensity based on damage amount (reduced for subtlety)
        const baseIntensity = 0.005;
        const intensity = Math.min(baseIntensity + (damage * 0.001), 0.015); // Much more subtle (0.005-0.015)
        const duration = Math.min(100 + (damage * 8), 250); // Shorter duration (100-250ms)
        
        try {
            // Get the current scene's camera
            const camera = this.scene.cameras.main;
            
            // Phaser camera.shake expects (duration, intensity) where intensity is 0-1
            camera.shake(duration, intensity);
            
            debug.general(`Screen shake triggered: intensity=${intensity.toFixed(3)}, duration=${duration}ms, damage=${damage}`);
            
            // Also add a brief red tint to the fighter for immediate feedback
            this.setTint(0xFF6666);
            this.scene.time.delayedCall(150, () => {
                if (this.active) {
                    this.clearTint();
                }
            });
            
        } catch (error) {
            console.warn('Could not trigger screen shake:', error);
            // Fallback: just show red tint
            this.setTint(0xFF6666);
            this.scene.time.delayedCall(150, () => {
                if (this.active) {
                    this.clearTint();
                }
            });
        }
    }

    private playHitSound(damage: number): void {
        // Determine hit sound based on damage amount
        let soundKey = 'hit-light';
        
        if (damage >= GAME_CONFIG.COMBAT.HEAVY_DAMAGE) {
            soundKey = 'hit-heavy';
        } else if (damage >= GAME_CONFIG.COMBAT.SPECIAL_DAMAGE) {
            soundKey = 'hit-special';
        }
        
        // Try to play the sound if it exists, otherwise create a basic hit sound
        try {
            if (this.scene.sound.get(soundKey)) {
                this.scene.sound.play(soundKey, { volume: 0.7 });
            } else {
                // Fallback: create a basic hit sound using Phaser's Web Audio API
                this.createHitSound(damage);
            }
        } catch (error) {
            // Fallback to basic hit sound creation
            this.createHitSound(damage);
        }
        
        debug.general(`Hit sound played: ${soundKey} for ${damage} damage`);
    }

    private createHitSound(damage: number): void {
        // Create a basic hit sound effect using Web Audio API
        try {
            const audioContext = (this.scene.sound as any).context;
            if (!audioContext) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            // Configure sound based on damage
            const frequency = damage >= GAME_CONFIG.COMBAT.HEAVY_DAMAGE ? 150 : 
                            damage >= GAME_CONFIG.COMBAT.SPECIAL_DAMAGE ? 200 : 250;
            const duration = damage >= GAME_CONFIG.COMBAT.HEAVY_DAMAGE ? 0.15 : 0.1;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.5, audioContext.currentTime + duration);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
            
        } catch (error) {
            console.warn('Could not create hit sound effect:', error);
        }
    }

}

