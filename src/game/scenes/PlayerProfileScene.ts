import Phaser from "phaser";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import debug from "@/lib/debug";
import { hybridLeaderboardService, PlayerProfile, CharacterStats } from "@/services/hybridLeaderboardService";
import { characterList } from "@/data/characters";
import { solanaWalletService } from "@/services/solanaWalletService";
import { supabaseService } from "@/services/supabaseService";
import { Boot } from "./Boot";
import { TEXT_STYLES, UI_COLORS } from "@/game/ui/UIConstants";

export class PlayerProfileScene extends Phaser.Scene {
    private backgroundImage!: Phaser.GameObjects.Rectangle;
    private playerProfile!: PlayerProfile;
    private selectedCharacter: string = 'all';
    
    // UI Containers
    private headerContainer!: Phaser.GameObjects.Container;
    private walletContainer!: Phaser.GameObjects.Container;
    private statsContainer!: Phaser.GameObjects.Container;
    private characterContainer!: Phaser.GameObjects.Container;
    private navigationContainer!: Phaser.GameObjects.Container;
    
    // Wallet UI elements
    private walletButton!: Phaser.GameObjects.Text;
    private walletStatusText!: Phaser.GameObjects.Text;
    private usernameText!: Phaser.GameObjects.Text;
    private editUsernameButton!: Phaser.GameObjects.Text;
    
    // Username editing
    private isEditingUsername = false;
    private currentUser: any = null;
    
    
    // Input handling
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private escKey!: Phaser.Input.Keyboard.Key;
    
    // Colors for better UI
    private readonly COLORS = {
        PRIMARY: 0x3B82F6,    // Blue
        SECONDARY: 0x1F2937,  // Dark gray
        SUCCESS: 0x10B981,    // Green
        WARNING: 0xF59E0B,    // Amber
        DANGER: 0xEF4444,     // Red
        TEXT_PRIMARY: "#FFFFFF",
        TEXT_SECONDARY: "#E5E7EB",  // Lighter gray for better readability
        TEXT_ACCENT: "#FCD34D",     // Brighter yellow
        TEXT_VALUE: "#F3F4F6"       // Very light gray for values
    };

    constructor() {
        super({ key: "PlayerProfileScene" });
    }

    preload(): void {
        // Background will be created as gradient rectangle - no image loading needed
    }

    create(): void {
        // Load player profile
        this.playerProfile = hybridLeaderboardService.getPlayerProfile();
        
        const { width, height } = this.cameras.main;

        // Create gradient background
        this.createBackground(width, height);
        
        // Create UI sections
        this.createHeader(width);
        this.createWalletSection(width);
        this.createStatsSection(width);
        this.createCharacterSection(width);
        this.createNavigation(width, height);
        
        // Setup input
        this.setupInputHandlers();
        
        // Fade in effect
        this.cameras.main.fadeIn(300, 0, 0, 0);
        
        // Listen for auth state changes
        EventBus.on('auth-state-changed', this.updateWalletDisplay, this);
        EventBus.on('user-logged-in', this.updateWalletDisplay, this);
        EventBus.on('user-logged-out', this.updateWalletDisplay, this);
        
        // Emit scene ready event
        EventBus.emit("current-scene-ready", this);
        
        logger.gameEvent("player-profile-opened", {
            scene: "PlayerProfileScene"
        });
    }

    private createBackground(width: number, height: number): void {
        // Use standardized atmospheric background with overlay for text readability
        Boot.createStandardBackground(this, true, 0.8);
    }

    private createHeader(width: number): void {
        this.headerContainer = this.add.container(0, 0);
        
        // Title using standardized styles
        const titleText = this.add.text(width / 2, 60, "PLAYER PROFILE", TEXT_STYLES.TITLE);
        titleText.setOrigin(0.5);
        
        this.headerContainer.add(titleText);
    }

    private createWalletSection(width: number): void {
        this.walletContainer = this.add.container(0, 0);
        
        // Listen for wallet state changes
        EventBus.on('wallet-state-changed', this.updateWalletDisplay, this);
        EventBus.on('wallet-connected', this.updateWalletDisplay, this);
        EventBus.on('wallet-disconnected', this.updateWalletDisplay, this);
        
        // Initial wallet display
        this.updateWalletDisplay();
    }

    private async updateWalletDisplay(): Promise<void> {
        // Check if scene essentials are available (less restrictive)
        if (!this.cameras || !this.cameras.main || !this.walletContainer) {
            return;
        }

        // Remove existing wallet elements
        this.walletContainer.list.forEach(child => {
            if ((child as any).isWalletElement) {
                child.destroy();
            }
        });

        const { width } = this.cameras.main;
        const y = 140;
        
        const walletState = solanaWalletService.getState();

        if (walletState.connected && walletState.publicKey) {
            // Connected state - clean layout without boxes with proper spacing
            const connectedLabel = this.add.text(width / 2, y, "🔗 Wallet Connected", {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: UI_COLORS.SUCCESS
            });
            connectedLabel.setOrigin(0.5);
            (connectedLabel as any).isWalletElement = true;

            // Wallet address
            const shortAddress = walletState.publicKey.slice(0, 8) + '...' + walletState.publicKey.slice(-6);
            this.walletStatusText = this.add.text(width / 2, y + 30, shortAddress, {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: UI_COLORS.GRAY
            });
            this.walletStatusText.setOrigin(0.5);
            (this.walletStatusText as any).isWalletElement = true;

            // Username section
            await this.createUsernameSection(width, y + 60);

            // Disconnect button
            this.walletButton = this.add.text(width / 2, y + 120, "Disconnect Wallet", {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: UI_COLORS.WARNING
            });
            this.walletButton.setOrigin(0.5);
            this.walletButton.setInteractive({ useHandCursor: true });
            this.walletButton.on('pointerdown', () => this.handleWalletDisconnect());
            this.walletButton.on('pointerover', () => this.walletButton.setColor("#FFFFFF"));
            this.walletButton.on('pointerout', () => this.walletButton.setColor(UI_COLORS.WARNING));
            (this.walletButton as any).isWalletElement = true;
            
            this.walletContainer.add([connectedLabel, this.walletStatusText, this.walletButton]);
        } else if (walletState.connecting) {
            // Connecting state
            this.walletStatusText = this.add.text(width / 2, y, "Connecting to wallet...", {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: UI_COLORS.WARNING
            });
            this.walletStatusText.setOrigin(0.5);
            (this.walletStatusText as any).isWalletElement = true;
            this.walletContainer.add(this.walletStatusText);
        } else {
            // Disconnected state - clean layout with better spacing
            this.walletStatusText = this.add.text(width / 2, y, "Connect wallet to save progress globally", {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: UI_COLORS.GRAY
            });
            this.walletStatusText.setOrigin(0.5);
            (this.walletStatusText as any).isWalletElement = true;

            this.walletButton = this.add.text(width / 2, y + 40, "🔗 Connect Wallet", {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: UI_COLORS.PRIMARY
            });
            this.walletButton.setOrigin(0.5);
            this.walletButton.setInteractive({ useHandCursor: true });
            this.walletButton.on('pointerdown', () => this.handleWalletConnect());
            this.walletButton.on('pointerover', () => this.walletButton.setColor("#FFFFFF"));
            this.walletButton.on('pointerout', () => this.walletButton.setColor(UI_COLORS.PRIMARY));
            (this.walletButton as any).isWalletElement = true;
            
            if (walletState.error) {
                const errorText = this.add.text(width / 2, y + 80, "Connection Failed - Try Again", {
                    fontFamily: "Press Start 2P",
                    fontSize: "8px",
                    color: UI_COLORS.DANGER
                });
                errorText.setOrigin(0.5);
                (errorText as any).isWalletElement = true;
                this.walletContainer.add([this.walletStatusText, this.walletButton, errorText]);
            } else {
                this.walletContainer.add([this.walletStatusText, this.walletButton]);
            }
        }
    }

    private async createUsernameSection(width: number, y: number): Promise<void> {
        // Get current user info
        const walletAddress = solanaWalletService.getPublicKey();
        if (walletAddress) {
            this.currentUser = await supabaseService.getUserByWallet(walletAddress);
        }

        const username = this.currentUser?.username || `Player_${walletAddress?.slice(-4) || '????'}`;

        // Username display
        this.usernameText = this.add.text(width / 2, y, username, {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: UI_COLORS.WHITE
        });
        this.usernameText.setOrigin(0.5);
        (this.usernameText as any).isWalletElement = true;

        // Edit button
        this.editUsernameButton = this.add.text(width / 2, y + 25, "✏️ Edit Username", {
            fontFamily: "Press Start 2P",
            fontSize: "8px",
            color: UI_COLORS.PRIMARY
        });
        this.editUsernameButton.setOrigin(0.5);
        this.editUsernameButton.setInteractive({ useHandCursor: true });
        this.editUsernameButton.on('pointerdown', () => this.startUsernameEdit());
        this.editUsernameButton.on('pointerover', () => this.editUsernameButton.setColor("#FFFFFF"));
        this.editUsernameButton.on('pointerout', () => this.editUsernameButton.setColor(UI_COLORS.PRIMARY));
        (this.editUsernameButton as any).isWalletElement = true;

        this.walletContainer.add([this.usernameText, this.editUsernameButton]);
    }

    private startUsernameEdit(): void {
        if (this.isEditingUsername) return;
        
        this.isEditingUsername = true;
        
        // Create a simple prompt for username (since we can't use HTML input in Phaser)
        const newUsername = prompt('Enter new username (3-20 characters):');
        
        if (newUsername && newUsername.length >= 3 && newUsername.length <= 20) {
            this.updateUsername(newUsername);
        }
        
        this.isEditingUsername = false;
    }

    private async updateUsername(newUsername: string): Promise<void> {
        const walletAddress = solanaWalletService.getPublicKey();
        if (!walletAddress || !this.currentUser) return;

        try {
            const updatedUser = await supabaseService.updateUserByWallet(walletAddress, {
                username: newUsername
            });

            if (updatedUser) {
                this.currentUser = updatedUser;
                this.updateWalletDisplay();
                logger.debug('✅ Username updated successfully');
                
                // Show success message
                const successText = this.add.text(this.cameras.main.width / 2, 300, "Username updated!", {
                    fontFamily: "Press Start 2P",
                    fontSize: "12px",
                    color: UI_COLORS.SUCCESS
                });
                successText.setOrigin(0.5);
                
                // Fade out success message after 2 seconds
                this.tweens.add({
                    targets: successText,
                    alpha: 0,
                    duration: 2000,
                    onComplete: () => successText.destroy()
                });
            }
        } catch (error) {
            logger.debug('❌ Failed to update username:', { error });
        }
    }

    private async handleWalletConnect(): Promise<void> {
        try {
            await solanaWalletService.connect();
            
            // Authenticate with Supabase after successful wallet connection
            const walletAddress = solanaWalletService.getPublicKey();
            if (walletAddress) {
                const user = await supabaseService.authenticateWithWallet(walletAddress);
                if (user) {
                    this.currentUser = user;
                    logger.debug('✅ User authenticated with Supabase');
                }
            }
        } catch (error) {
            logger.debug('❌ Wallet connection failed:', { error });
        }
    }

    private async handleWalletDisconnect(): Promise<void> {
        try {
            // Ensure the scene is still active before attempting disconnect
            if (!this.scene.isActive()) {
                return;
            }
            
            await solanaWalletService.disconnect();
            this.currentUser = null;
            
            // Clear any error state after successful disconnect
            debug.general('✅ Wallet disconnected successfully from profile');
        } catch (error) {
            debug.general('❌ Wallet disconnect failed:', error);
            logger.debug('❌ Wallet disconnect failed:', { error });
        }
    }

    private createStatsSection(width: number): void {
        this.statsContainer = this.add.container(0, 0);
        
        // Stats title
        const statsTitle = this.add.text(width / 2, 300, "PLAYER STATISTICS", TEXT_STYLES.HEADER);
        statsTitle.setOrigin(0.5);
        
        this.statsContainer.add(statsTitle);
        
        // Create stats grid
        this.createStatsGrid(width);
    }

    private createStatsGrid(width: number): void {
        const startY = 350;
        const colWidth = (width - 200) / 4;
        
        // Calculate win rate
        const winRate = this.playerProfile.totalMatches > 0 
            ? (this.playerProfile.totalWins / this.playerProfile.totalMatches) * 100 
            : 0;

        // Stats data with better colors
        const stats = [
            { label: "Total Matches", value: this.playerProfile.totalMatches.toString(), color: "#FFFFFF" },
            { label: "Win Rate", value: `${Math.round(winRate)}%`, color: "#10B981" },
            { label: "Play Time", value: this.formatPlayTime(this.playerProfile.totalPlayTime * 1000), color: "#3B82F6" },
            { label: "Best Streak", value: this.playerProfile.bestWinStreak.toString(), color: "#F59E0B" }
        ];
        
        stats.forEach((stat, index) => {
            const x = 100 + (index * colWidth) + (colWidth / 2);
            
            // Stat value (large and prominent)
            const valueText = this.add.text(x, startY, stat.value, {
                fontFamily: "Press Start 2P",
                fontSize: "20px",
                color: stat.color,
                align: "center"
            });
            valueText.setOrigin(0.5);
            
            // Stat label (smaller, below the value)
            const labelText = this.add.text(x, startY + 35, stat.label, {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: this.COLORS.TEXT_SECONDARY,
                align: "center"
            });
            labelText.setOrigin(0.5);
            
            this.statsContainer.add([valueText, labelText]);
        });
    }

    private createCharacterSection(width: number): void {
        this.characterContainer = this.add.container(0, 0);
        
        // Character title
        const charTitle = this.add.text(width / 2, 440, "CHARACTER PERFORMANCE", TEXT_STYLES.HEADER);
        charTitle.setOrigin(0.5);
        
        this.characterContainer.add(charTitle);
        
        // Character stats
        this.createCharacterStats(width);
    }

    private createCharacterStats(width: number): void {
        const startY = 490;
        
        // For overall stats, calculate from profile data
        let selectedStats;
        if (this.selectedCharacter === 'all') {
            selectedStats = {
                wins: this.playerProfile.totalWins,
                losses: this.playerProfile.totalLosses
            };
        } else {
            const charStats = this.playerProfile.characterStats[this.selectedCharacter];
            selectedStats = charStats ? {
                wins: charStats.matchesWon,
                losses: charStats.matchesLost
            } : null;
        }
        
        if (!selectedStats) return;
        
        // Character selector (simple text, no box)
        const selectorText = this.add.text(width / 2, startY, 
            this.selectedCharacter === 'all' ? 'All Characters' : this.selectedCharacter, {
            fontFamily: "Press Start 2P",
            fontSize: "14px",
            color: this.COLORS.TEXT_ACCENT,
            align: "center"
        });
        selectorText.setOrigin(0.5);
        
        // Performance metrics in a clean row
        const metrics = [
            { label: "Wins", value: selectedStats.wins.toString(), color: "#10B981" },
            { label: "Losses", value: selectedStats.losses.toString(), color: "#EF4444" },
            { label: "Win Rate", value: `${Math.round((selectedStats.wins / Math.max(selectedStats.wins + selectedStats.losses, 1)) * 100)}%`, color: "#3B82F6" }
        ];
        
        metrics.forEach((metric, index) => {
            const x = (width / 2) - 120 + (index * 120);
            const y = startY + 50;
            
            // Metric value
            const metricText = this.add.text(x, y, metric.value, {
                fontFamily: "Press Start 2P",
                fontSize: "18px",
                color: metric.color,
                align: "center"
            });
            metricText.setOrigin(0.5);
            
            // Metric label
            const labelText = this.add.text(x, y + 30, metric.label, {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: this.COLORS.TEXT_SECONDARY,
                align: "center"
            });
            labelText.setOrigin(0.5);
            
            this.characterContainer.add([metricText, labelText]);
        });
        
        this.characterContainer.add(selectorText);
    }

    private createNavigation(width: number, height: number): void {
        this.navigationContainer = this.add.container(0, 0);
        
        // Simple back button without box
        const backText = this.add.text(120, height - 40, "← BACK TO LEADERBOARD", {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: this.COLORS.TEXT_PRIMARY,
            align: "center"
        });
        backText.setOrigin(0.5);
        backText.setInteractive({ cursor: 'pointer' });
        
        // Hover effects on text only
        backText.on('pointerover', () => {
            backText.setColor(this.COLORS.TEXT_ACCENT);
        });
        
        backText.on('pointerout', () => {
            backText.setColor(this.COLORS.TEXT_PRIMARY);
        });
        
        backText.on('pointerdown', () => {
            this.goBackToLeaderboard();
        });
        
        this.navigationContainer.add(backText);
    }

    private setupInputHandlers(): void {
        // Keyboard input
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        
        // Handle ESC key
        this.escKey.on('down', () => {
            this.goBackToLeaderboard();
        });
    }

    private goBackToLeaderboard(): void {
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start("LeaderboardScene");
        });
    }

    private formatPlayTime(milliseconds: number): string {
        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    shutdown(): void {
        // Clean up input listeners
        this.input.keyboard!.removeAllListeners();
        
        // Clean up ESC key listener
        if (this.escKey) {
            this.escKey.removeAllListeners();
        }
        
        // Clean up EventBus listeners
        EventBus.off('auth-state-changed', this.updateWalletDisplay, this);
        EventBus.off('user-logged-in', this.updateWalletDisplay, this);  
        EventBus.off('user-logged-out', this.updateWalletDisplay, this);
        
        // Clean up tweens
        this.tweens.killAll();
        
        // Clean up timers
        this.time.removeAllEvents();
        
        // Clear event listeners
        EventBus.off('wallet-state-changed', this.updateWalletDisplay, this);
        EventBus.off('wallet-connected', this.updateWalletDisplay, this);
        EventBus.off('wallet-disconnected', this.updateWalletDisplay, this);
        
        // Clear containers to prevent stale references
        this.headerContainer?.destroy();
        this.walletContainer?.destroy();
        this.statsContainer?.destroy();
        this.characterContainer?.destroy();
        this.navigationContainer?.destroy();
        
        logger.gameEvent("player-profile-scene-shutdown", {
            scene: "PlayerProfileScene"
        });
    }
}