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
export type AttackType = "heavy" | "special";

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
    
    // Debug visual elements
    private hitboxDebugGraphics?: Phaser.GameObjects.Graphics;
    private hurtboxDebugGraphics?: Phaser.GameObjects.Graphics;

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
        
        // Create debug graphics (initially hidden)
        this.createDebugGraphics();
    }

    public update(delta: number): void {
        // Don't update defeated fighters or destroyed fighters
        if ((this.currentState as any) === "defeated" || !this.active || !this.anims) {
            return;
        }
        
        this.updateCombatTimers(delta);
        this.updateAnimationState();
        this.updateDebugVisuals();
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
        
        // Ensure health is exactly 0 when it should be defeated (prevent floating point issues)
        if (this.health < 0.01) {
            this.health = 0;
        }

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
            console.log(`💀 HEALTH ZERO: ${this.fighterName} health reached ${this.health}, calling onDefeated()`);
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
        if (!this.anims || !this.anims.animationManager) {
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
            console.log(`💀 CREATING DEATH ANIM: ${this.fighterName} creating death animation frames 28-31`);
            this.anims.create({
                key: "death",
                frames: this.anims.generateFrameNumbers(textureKey, {
                    start: 28,
                    end: 31,
                }),
                frameRate: 8,
                repeat: 0,
            });
            console.log(`💀 DEATH ANIM CREATED: ${this.fighterName} death animation created successfully`);
        }

        // Start with idle animation and lock it
        this.safePlay("idle");
        this.setFrame(0); // Ensure we start on the first idle frame
    }

    private safePlay(animationKey: string, ignoreIfPlaying?: boolean): void {
        try {
            // Check if animation system is valid
            if (!this.anims || !this.anims.animationManager) {
                console.warn(`Animation system invalid for ${this.fighterName} when trying to play ${animationKey}`);
                return;
            }
            
            // Check if the animation exists
            if (!this.anims.exists(animationKey)) {
                console.warn(`Animation '${animationKey}' does not exist for fighter ${this.fighterName}`);
                return;
            }
            
            // Special handling for death animation
            if (animationKey === "death") {
                console.log(`💀 PLAYING DEATH: ${this.fighterName} attempting to play death animation`);
            }
            
            // Play the animation safely
            this.play(animationKey, ignoreIfPlaying);
            
            if (animationKey === "death") {
                console.log(`💀 DEATH STARTED: ${this.fighterName} death animation should now be playing`);
            }
        } catch (error) {
            console.error(`Failed to play animation '${animationKey}' for fighter ${this.fighterName}:`, error);
        }
    }

    private getAttackFrames(type: AttackType): number {
        const baseFrames = (() => {
            switch (type) {
                case "heavy":
                    return GAME_CONFIG.ATTACK.FRAMES.HEAVY;
                case "special":
                    return GAME_CONFIG.ATTACK.FRAMES.SPECIAL;
                default:
                    return GAME_CONFIG.ATTACK.FRAMES.HEAVY;
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

        // Immediately play death animation
        console.log(`💀 DEATH: ${this.fighterName} playing death animation`);
        this.safePlay("death", false);
        
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
        // Use actual sound files for combat sounds - simplified to just punch for now
        const soundKey = 'punch'; // Use punch sound for all attacks until we get it working
        
        console.log(`🔊 COMBAT SOUND: Attempting to play ${soundKey} for ${damage} damage`);
        
        // Try to play the preloaded sound file - MULTIPLE ATTEMPTS
        try {
            const soundManager = this.scene.sound;
            
            // Method 1: Try direct play first (most reliable)
            try {
                console.log(`🔊 METHOD 1: Direct play attempt for '${soundKey}'`);
                soundManager.play(soundKey, { volume: 0.8 });
                console.log(`✅ SUCCESS: Sound played directly - ${soundKey}`);
                return; // SUCCESS - exit without procedural sound
            } catch (directError) {
                console.warn(`❌ METHOD 1 FAILED:`, directError);
            }
            
            // Method 2: Check if sound exists in cache
            const sound = soundManager.get(soundKey);
            console.log(`🔊 METHOD 2: Cache check. Sound found:`, !!sound);
            
            const soundExists = !!sound;
            
            if (sound || soundExists) {
                console.log(`🔊 METHOD 2: Found in cache, attempting play...`);
                soundManager.play(soundKey, { volume: 0.8 });
                console.log(`✅ SUCCESS: Sound played from cache - ${soundKey}`);
                return; // SUCCESS - exit without procedural sound
            }
            
            console.warn(`❌ METHOD 2: Sound '${soundKey}' not in cache`);
            
        } catch (error) {
            console.error(`❌ All sound methods failed for '${soundKey}':`, error);
        }
        
        // Only create procedural sound if file sound failed
        console.log(`🔊 FALLBACK: Creating procedural ${damage >= GAME_CONFIG.COMBAT.SPECIAL_DAMAGE ? 'special' : 'heavy'} sound`);
        this.createCombatSound(damage);
    }

    private createCombatSound(damage: number): void {
        // Create retro fighting game sounds based on damage type
        try {
            const audioContext = (this.scene.sound as any).context;
            if (!audioContext) return;
            
            const isSpecialAttack = damage >= GAME_CONFIG.COMBAT.SPECIAL_DAMAGE;
            
            if (isSpecialAttack) {
                // Special attack = Street Fighter style "Hadouken" energy sound
                this.createRetroSpecialSound(audioContext);
            } else {
                // Heavy attack = Classic arcade punch sound
                this.createRetroPunchSound(audioContext);
            }
            
        } catch (error) {
            console.warn('Could not create retro combat sound effect:', error);
        }
    }

    private createRetroPunchSound(audioContext: AudioContext): void {
        // Create classic arcade punch sound like Street Fighter
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        // Classic arcade punch - dual tone with quick frequency drop
        oscillator1.frequency.setValueAtTime(220, audioContext.currentTime); // Low punch thud
        oscillator1.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.08);
        oscillator1.type = 'square'; // Retro square wave
        
        // High frequency click for impact
        oscillator2.frequency.setValueAtTime(1200, audioContext.currentTime);
        oscillator2.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.04);
        oscillator2.type = 'triangle';
        
        // Slight low-pass for arcade character
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.08);
        
        // Connect retro punch graph
        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Classic arcade envelope - sharp attack, quick decay
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.005); // Very sharp attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08); // Quick fade
        
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.08);
        oscillator2.stop(audioContext.currentTime + 0.04);
    }

    private createRetroSpecialSound(audioContext: AudioContext): void {
        // Create classic "Hadouken" style energy projectile sound
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const oscillator3 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        // Main energy frequency - sweeping upward like charging energy
        oscillator1.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator1.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.15);
        oscillator1.type = 'sawtooth'; // Classic retro wave
        
        // Harmonic frequency for richness
        oscillator2.frequency.setValueAtTime(300, audioContext.currentTime);
        oscillator2.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.15);
        oscillator2.type = 'square';
        
        // High frequency sparkle for energy effect
        oscillator3.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator3.frequency.exponentialRampToValueAtTime(2000, audioContext.currentTime + 0.1);
        oscillator3.type = 'triangle';
        
        // Band-pass filter for that classic arcade energy sound
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(500, audioContext.currentTime);
        filter.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.15);
        filter.Q.setValueAtTime(8, audioContext.currentTime); // Resonant for energy effect
        
        // Connect energy sound graph
        oscillator1.connect(filter);
        oscillator2.connect(filter);
        oscillator3.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Energy charge envelope - builds up then releases
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.02); // Initial charge
        gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.08); // Build energy
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.18); // Release
        
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator3.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.18);
        oscillator2.stop(audioContext.currentTime + 0.18);
        oscillator3.stop(audioContext.currentTime + 0.12);
    }

    private createDebugGraphics(): void {
        // Create graphics objects for debug visualization
        this.hitboxDebugGraphics = this.scene.add.graphics();
        this.hurtboxDebugGraphics = this.scene.add.graphics();
        
        // Set high depth so they appear on top
        this.hitboxDebugGraphics.setDepth(1000);
        this.hurtboxDebugGraphics.setDepth(1000);
        
        // Initially hidden
        this.hitboxDebugGraphics.setVisible(false);
        this.hurtboxDebugGraphics.setVisible(false);
    }

    private updateDebugVisuals(): void {
        if (!this.hitboxDebugGraphics || !this.hurtboxDebugGraphics) return;
        
        // Check if debug mode is enabled (you can control this via game config or key press)
        const debugEnabled = GAME_CONFIG.DEBUG.ENABLE_HITBOX_DEBUG || false;
        
        if (!debugEnabled) {
            this.hitboxDebugGraphics.setVisible(false);
            this.hurtboxDebugGraphics.setVisible(false);
            return;
        }
        
        // Clear previous drawings
        this.hitboxDebugGraphics.clear();
        this.hurtboxDebugGraphics.clear();
        
        // Draw hurtbox (fighter's body collision area) - Purple
        const fighterBounds = this.getBounds();
        this.hurtboxDebugGraphics.lineStyle(2, 0x8A2BE2, 1); // Purple
        this.hurtboxDebugGraphics.strokeRect(
            fighterBounds.x, 
            fighterBounds.y, 
            fighterBounds.width, 
            fighterBounds.height
        );
        
        // Draw attack hitbox when attacking - Red
        if (this.isAttacking) {
            const hitbox = this.getAttackHitbox();
            if (hitbox.width > 0 && hitbox.height > 0) {
                this.hitboxDebugGraphics.lineStyle(3, 0xFF0000, 0.8); // Red, semi-transparent
                this.hitboxDebugGraphics.fillStyle(0xFF0000, 0.2); // Red fill, very transparent
                this.hitboxDebugGraphics.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
                this.hitboxDebugGraphics.strokeRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
                
                // Add text label for attack type and range
                const labelText = `${this.attackType?.toUpperCase()} (${hitbox.width}px)`;
                const textStyle = {
                    fontSize: '16px',
                    fill: '#FFFFFF',
                    backgroundColor: '#000000',
                    padding: { x: 4, y: 2 }
                };
                
                // Remove old text if exists
                const existingText = this.scene.children.getByName(`${this.fighterName}_hitbox_label`);
                if (existingText) {
                    existingText.destroy();
                }
                
                const debugText = this.scene.add.text(
                    hitbox.x, 
                    hitbox.y - 25, 
                    labelText, 
                    textStyle
                );
                debugText.setName(`${this.fighterName}_hitbox_label`);
                debugText.setDepth(1001);
                
                // Auto-remove text after a short delay
                this.scene.time.delayedCall(200, () => {
                    if (debugText && debugText.active) {
                        debugText.destroy();
                    }
                });
            }
        }
        
        this.hitboxDebugGraphics.setVisible(true);
        this.hurtboxDebugGraphics.setVisible(true);
    }

    public toggleHitboxDebug(): void {
        // Method to toggle debug visuals (can be called externally)
        if (this.hitboxDebugGraphics && this.hurtboxDebugGraphics) {
            const currentlyVisible = this.hitboxDebugGraphics.visible;
            this.hitboxDebugGraphics.setVisible(!currentlyVisible);
            this.hurtboxDebugGraphics.setVisible(!currentlyVisible);
        }
    }

}

