import { Scene } from "phaser";

import { GAME_CONFIG } from "@/config/gameConfig";

export class InputManager {
    private scene: Scene;

    // Movement keys
    public left: Phaser.Input.Keyboard.Key;
    public right: Phaser.Input.Keyboard.Key;
    public up: Phaser.Input.Keyboard.Key;
    public down: Phaser.Input.Keyboard.Key;

    // Attack keys
    public heavyAttack: Phaser.Input.Keyboard.Key;
    public specialAttack: Phaser.Input.Keyboard.Key;

    constructor(scene: Scene) {
        this.scene = scene;

        // Create keyboard keys based on game config
        if (!this.scene.input.keyboard) {
            throw new Error("Keyboard input not available");
        }
        
        this.left = this.scene.input.keyboard.addKey(
            GAME_CONFIG.CONTROLS.PLAYER_1.LEFT
        );
        this.right = this.scene.input.keyboard.addKey(
            GAME_CONFIG.CONTROLS.PLAYER_1.RIGHT
        );
        this.up = this.scene.input.keyboard.addKey(
            GAME_CONFIG.CONTROLS.PLAYER_1.UP
        );
        this.down = this.scene.input.keyboard.addKey(
            GAME_CONFIG.CONTROLS.PLAYER_1.DOWN
        );

        this.heavyAttack = this.scene.input.keyboard.addKey(
            GAME_CONFIG.CONTROLS.PLAYER_1.HEAVY
        );
        this.specialAttack = this.scene.input.keyboard.addKey(
            GAME_CONFIG.CONTROLS.PLAYER_1.SPECIAL
        );
    }

    // Helper methods to check input states
    public isLeftPressed(): boolean {
        return this.left.isDown;
    }

    public isRightPressed(): boolean {
        return this.right.isDown;
    }

    public isUpPressed(): boolean {
        return this.up.isDown;
    }

    public isDownPressed(): boolean {
        return this.down.isDown;
    }


    public isHeavyAttackPressed(): boolean {
        return Phaser.Input.Keyboard.JustDown(this.heavyAttack);
    }

    public isSpecialAttackPressed(): boolean {
        return Phaser.Input.Keyboard.JustDown(this.specialAttack);
    }

    // Combined input state for network synchronization
    public getInput(): any {
        const hasMovement = this.isLeftPressed() || this.isRightPressed() || this.isUpPressed() || this.isDownPressed();
        const hasAttack = this.isHeavyAttackPressed() || this.isSpecialAttackPressed();
        
        // Only return input state if there's actual input to avoid spam
        if (!hasMovement && !hasAttack) {
            return null;
        }

        return {
            // Movement
            left: this.isLeftPressed(),
            right: this.isRightPressed(),
            up: this.isUpPressed(),
            down: this.isDownPressed(),
            
            // Attacks
            heavy: this.isHeavyAttackPressed(),
            special: this.isSpecialAttackPressed(),
        };
    }
}
