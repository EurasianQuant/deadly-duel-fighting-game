import {
    AUTO,
    WEBGL,
    CANVAS,
    Game,
} from "phaser";

import { GAME_CONFIG } from "@/config/gameConfig";

import { ArcadeModeSelectScene } from "./scenes/ArcadeModeSelectScene";
import { Boot } from "./scenes/Boot";
import { CharacterSelectScene } from "./scenes/CharacterSelectScene";
import { FightScene } from "./scenes/FightScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
// OnlineFightScene removed - offline game only
import { PlayerProfileScene } from "./scenes/PlayerProfileScene";
import { SurvivalScene } from "./scenes/SurvivalScene";
import { TimeAttackScene } from "./scenes/TimeAttackScene";
import { TimeAttackSelectScene } from "./scenes/TimeAttackSelectScene";
import { TitleScene } from "./scenes/TitleScene";

//  Deadly Duel Game Configuration
//  Optimized for 60 FPS fighting game performance
const config: Phaser.Types.Core.GameConfig = {
    type: WEBGL, // Explicit render type - fallback to CANVAS if WebGL fails
    width: GAME_CONFIG.CANVAS.WIDTH,
    height: GAME_CONFIG.CANVAS.HEIGHT,
    parent: "phaser-game",
    backgroundColor: "#1a1a1a",
    // Simplified canvas configuration
    dom: {
        createContainer: false,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: GAME_CONFIG.PHYSICS.GRAVITY },
            debug: false, // Disabled for clean gameplay
            fps: 60, // Fixed 60 FPS physics (Colyseus guide)
            fixedStep: true, // Enable fixed timestep for deterministic physics
        },
    },
    render: {
        pixelArt: false, // Disable harsh pixel mode for better text readability
        antialias: true, // Enable slight smoothing for readable text
        roundPixels: true, // Keep pixel alignment for crisp positioning
    },
    fps: {
        target: GAME_CONFIG.CANVAS.TARGET_FPS,
        forceSetTimeOut: true,
    },
    scene: [Boot, TitleScene, MainMenuScene, ArcadeModeSelectScene, FightScene, CharacterSelectScene, SurvivalScene, TimeAttackScene, TimeAttackSelectScene, LeaderboardScene, PlayerProfileScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 640,
            height: 360,
        },
        max: {
            width: 1920,
            height: 1080,
        },
    },
    // Disable right-click context menu
    disableContextMenu: true,
    // Optimize for performance
    banner: false,
};

const StartGame = (parent: string) => {
    // Ensure the parent container exists
    const container = document.getElementById(parent);
    if (!container) {
        throw new Error(`Container element '${parent}' not found`);
    }
    
    try {
        // Use the default configuration
        const gameConfig: Phaser.Types.Core.GameConfig = {
            ...config,
            parent,
        };
        
        const game = new Game(gameConfig);
        
        // Add event handlers
        game.events.once('ready', () => {
            console.log('Phaser game initialized successfully with Canvas renderer');
        });
        
        game.events.on('destroy', () => {
            console.log('Phaser game destroyed');
        });
        
        return game;
    } catch (error) {
        console.error('Failed to initialize Phaser game:', error);
        throw error;
    }
};

export default StartGame;
