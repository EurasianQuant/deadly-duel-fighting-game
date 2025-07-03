/**
 * Standardized UI constants for consistent styling across all Phaser scenes
 * This ensures visual consistency as outlined in the design requirements
 */

// Standard Colors (matching CSS variables)
export const UI_COLORS = {
    PRIMARY: "#fbbf24",      // Arcade yellow
    SECONDARY: "#ef4444",    // Arcade red  
    SUCCESS: "#22c55e",      // Arcade green
    WARNING: "#f59e0b",      // Warning orange
    DANGER: "#ef4444",       // Danger red
    WHITE: "#ffffff",
    BLACK: "#000000",
    GRAY: "#6b7280",
    DARK_GRAY: "#4b5563",
    PANEL_BG: "rgba(0, 0, 0, 0.75)"
} as const;

// Standard Font Sizes
export const UI_FONTS = {
    TITLE: "42px",
    HEADER: "32px", 
    SUBHEADER: "24px",
    BODY: "16px",
    SMALL: "12px"
} as const;

// Standard Font Family
export const UI_FONT_FAMILY = "Press Start 2P";

// Standard Text Styles for common UI elements
export const TEXT_STYLES = {
    TITLE: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: UI_FONTS.TITLE,
        color: UI_COLORS.PRIMARY,
        align: "center" as const,
        stroke: UI_COLORS.BLACK,
        strokeThickness: 6,
        shadow: {
            offsetX: 4,
            offsetY: 4,
            color: UI_COLORS.BLACK,
            blur: 0,
            fill: true,
        },
    },
    
    HEADER: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: UI_FONTS.HEADER,
        color: UI_COLORS.WHITE,
        align: "center" as const,
        stroke: UI_COLORS.BLACK,
        strokeThickness: 4,
    },
    
    SUBHEADER: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: UI_FONTS.SUBHEADER,
        color: UI_COLORS.PRIMARY,
        align: "center" as const,
        stroke: UI_COLORS.BLACK,
        strokeThickness: 2,
    },
    
    BODY: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: UI_FONTS.BODY,
        color: UI_COLORS.WHITE,
        align: "center" as const,
    },
    
    BUTTON: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: UI_FONTS.BODY,
        color: UI_COLORS.WHITE,
        align: "center" as const,
    },
    
    BUTTON_ACTIVE: {
        fontFamily: UI_FONT_FAMILY,
        fontSize: UI_FONTS.BODY,
        color: UI_COLORS.PRIMARY,
        align: "center" as const,
    }
} as const;

// Standard Panel/Container Utilities
export class UIPanel {
    /**
     * Creates a standardized game panel with yellow border
     */
    static createPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, transparent: boolean = false): Phaser.GameObjects.Graphics {
        const panel = scene.add.graphics();
        
        // Background
        panel.fillStyle(transparent ? 0x000000 : 0x000000, transparent ? 0.85 : 0.75);
        panel.fillRect(x - width/2, y - height/2, width, height);
        
        // Border
        panel.lineStyle(4, 0xfbbf24, 1);
        panel.strokeRect(x - width/2, y - height/2, width, height);
        
        return panel;
    }
    
    /**
     * Creates a button with hover effects
     */
    static createButton(scene: Phaser.Scene, x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Text {
        const button = scene.add.text(x, y, text, TEXT_STYLES.BUTTON);
        button.setOrigin(0.5);
        button.setInteractive({ cursor: 'pointer' });
        
        // Hover effects
        button.on('pointerover', () => {
            button.setStyle({ color: UI_COLORS.PRIMARY });
            button.setScale(1.1);
        });
        
        button.on('pointerout', () => {
            button.setStyle({ color: UI_COLORS.WHITE });
            button.setScale(1.0);
        });
        
        button.on('pointerdown', callback);
        
        return button;
    }
    
    /**
     * Creates a selection indicator (arrow)
     */
    static createSelector(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Text {
        const selector = scene.add.text(x, y, "►", {
            fontFamily: UI_FONT_FAMILY,
            fontSize: UI_FONTS.BODY,
            color: UI_COLORS.PRIMARY,
        });
        selector.setOrigin(0.5);
        
        // Animate selector
        scene.tweens.add({
            targets: selector,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Power2'
        });
        
        return selector;
    }
}

// Export for easy access
export default {
    UI_COLORS,
    UI_FONTS,
    UI_FONT_FAMILY,
    TEXT_STYLES,
    UIPanel
};