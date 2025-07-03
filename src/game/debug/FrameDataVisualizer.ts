import { GAME_CONFIG } from "@/config/gameConfig";
import { Fighter } from "@/game/entities/Fighter";

export class FrameDataVisualizer {
    private scene: Phaser.Scene;
    private graphics: Phaser.GameObjects.Graphics;
    private isVisible: boolean = false;
    private frameDataText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Create graphics object for drawing shapes
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(1000); // Render on top

        // Create text object for frame data display
        this.frameDataText = scene.add.text(10, 10, "", {
            fontSize: "14px",
            color: "#00ff00",
            backgroundColor: "#000000",
            padding: { x: 8, y: 4 },
        });
        this.frameDataText.setDepth(1001);

        this.hide(); // Start hidden - permanently disabled
    }

    update(fighters: Fighter[]): void {
        if (!this.isVisible) return;

        // Clear previous frame
        this.graphics.clear();

        let debugText = "FRAME DATA DEBUG\n\n";

        fighters.forEach((fighter, index) => {
            this.drawFighterDebugInfo(fighter);
            debugText += this.getFighterDebugText(fighter, index);
        });

        this.frameDataText.setText(debugText);
    }

    private drawFighterDebugInfo(fighter: Fighter): void {
        const x = fighter.x;
        const y = fighter.y;

        // Fighter bounds (hurtbox)
        const hurtboxWidth = 50;
        const hurtboxHeight = 100;
        const hurtboxX = x - hurtboxWidth / 2;
        const hurtboxY = y - hurtboxHeight;

        // Draw hurtbox (blue, semi-transparent)
        this.graphics.fillStyle(0x0066ff, 0.3);
        this.graphics.lineStyle(2, 0x0066ff, 1);
        this.graphics.fillRect(hurtboxX, hurtboxY, hurtboxWidth, hurtboxHeight);
        this.graphics.strokeRect(
            hurtboxX,
            hurtboxY,
            hurtboxWidth,
            hurtboxHeight
        );

        // Draw hitboxes if attacking
        if (this.isAttacking(fighter)) {
            this.drawAttackHitbox(fighter);
        }

        // Draw center point
        this.graphics.fillStyle(0xff00ff, 1);
        this.graphics.fillCircle(x, y, 3);

        // Draw ground line
        this.graphics.lineStyle(1, 0xffff00, 0.5);
        const groundY = GAME_CONFIG.CANVAS.HEIGHT - 160;
        this.graphics.strokePath();
        this.graphics.beginPath();
        this.graphics.moveTo(x - 50, groundY);
        this.graphics.lineTo(x + 50, groundY);
        this.graphics.strokePath();
    }

    private drawAttackHitbox(fighter: Fighter): void {
        const x = fighter.x;
        const y = fighter.y;

        // Get attack hitbox based on current animation
        const currentAnim = fighter.anims?.currentAnim?.key;
        const hitboxData = this.getHitboxData(currentAnim || "");

        if (!hitboxData) return;

        // Adjust hitbox position based on fighter facing direction
        const direction = fighter.flipX ? -1 : 1;
        const hitboxX =
            x + hitboxData.offsetX * direction - hitboxData.width / 2;
        const hitboxY = y + hitboxData.offsetY - hitboxData.height / 2;

        // Draw attack hitbox (red, semi-transparent)
        this.graphics.fillStyle(0xff0000, 0.4);
        this.graphics.lineStyle(3, 0xff0000, 1);
        this.graphics.fillRect(
            hitboxX,
            hitboxY,
            hitboxData.width,
            hitboxData.height
        );
        this.graphics.strokeRect(
            hitboxX,
            hitboxY,
            hitboxData.width,
            hitboxData.height
        );
    }

    private getHitboxData(animationKey: string) {
        // Define hitbox data for different attacks
        const hitboxes = {
            "attack-light": {
                width: 80,
                height: 40,
                offsetX: 50,
                offsetY: -40,
            },
            "attack-heavy": {
                width: 100,
                height: 60,
                offsetX: 60,
                offsetY: -30,
            },
            "attack-special": {
                width: 120,
                height: 80,
                offsetX: 70,
                offsetY: -20,
            },
        };

        return hitboxes[animationKey as keyof typeof hitboxes];
    }

    private isAttacking(fighter: Fighter): boolean {
        const currentAnim = fighter.anims?.currentAnim?.key;
        return currentAnim?.includes("attack") || false;
    }

    private getFighterDebugText(fighter: Fighter, index: number): string {
        const currentAnim = fighter.anims?.currentAnim?.key || "none";
        const frameIndex = fighter.anims?.currentFrame?.index || 0;

        return (
            `Fighter ${index + 1}:\n` +
            `  Position: (${Math.round(fighter.x)}, ${Math.round(
                fighter.y
            )})\n` +
            `  Health: ${fighter.health}/${fighter.maxHealth}\n` +
            `  Animation: ${currentAnim}\n` +
            `  Frame: ${frameIndex}\n` +
            `  Velocity: (${Math.round(
                fighter.body?.velocity.x || 0
            )}, ${Math.round(fighter.body?.velocity.y || 0)})\n` +
            `  Grounded: ${(fighter as unknown as Record<string, unknown>).isGrounded || false}\n\n`
        );
    }

    show(): void {
        // Permanently disabled for cleaner gameplay
        this.isVisible = false;
        this.graphics.setVisible(false);
        this.frameDataText.setVisible(false);
    }

    hide(): void {
        this.isVisible = false;
        this.graphics.setVisible(false);
        this.frameDataText.setVisible(false);
    }

    toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    destroy(): void {
        this.graphics.destroy();
        this.frameDataText.destroy();
    }
}

