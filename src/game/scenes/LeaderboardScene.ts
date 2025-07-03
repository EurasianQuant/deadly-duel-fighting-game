import Phaser from "phaser";

import { getAllTimeAttackCourses } from "@/config/arcadeModes";
import { characterList } from "@/data/characters";
import {
    TEXT_STYLES,
    UI_COLORS,
} from "@/game/ui/UIConstants";
import debug from "@/lib/debug";
import EventBus from "@/lib/EventBus";
import { logger } from "@/lib/logger";
import {
    hybridLeaderboardService,
    SurvivalEntry,
    TimeAttackEntry,
    TournamentEntry,
} from "@/services/hybridLeaderboardService";
import { solanaWalletService } from "@/services/solanaWalletService";
import { supabaseService } from "@/services/supabaseService";

import { Boot } from "./Boot";

type LeaderboardMode = "survival" | "timeattack" | "tournament";
type TimePeriod = "allTime" | "weekly" | "daily";
type PlayerFilter = "all" | "global" | "local";

export class LeaderboardScene extends Phaser.Scene {
    private backgroundImage!: Phaser.GameObjects.Rectangle;
    private currentMode: LeaderboardMode = "survival";
    private currentPeriod: TimePeriod = "allTime";
    private selectedCharacter: string = "all";
    private selectedCourse: string = "all";
    private playerFilter: PlayerFilter = "all";

    // UI Elements
    private titleText!: Phaser.GameObjects.Text;
    private modeButtons: Phaser.GameObjects.Text[] = [];
    private periodButtons: Phaser.GameObjects.Text[] = [];
    private characterText!: Phaser.GameObjects.Text;
    private courseText!: Phaser.GameObjects.Text;
    private filterButtons: Phaser.GameObjects.Text[] = [];
    private leaderboardContainer!: Phaser.GameObjects.Container;
    private backButton!: Phaser.GameObjects.Text;
    private profileButton!: Phaser.GameObjects.Text;
    private walletButton!: Phaser.GameObjects.Text;
    private walletStatusText!: Phaser.GameObjects.Text;

    // Navigation
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>;
    private enterKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: "LeaderboardScene" });
    }

    preload(): void {
        // Background will be created as plain black rectangle - no image loading needed
    }

    create(): void {
        const { width, height } = this.cameras.main;

        // Use standardized atmospheric background with overlay for text readability
        Boot.createStandardBackground(this, true, 0.8);

        // Title - stays outside panel for prominence
        this.titleText = this.add.text(
            width / 2,
            60,
            "LEADERBOARD",
            TEXT_STYLES.TITLE
        );
        this.titleText.setOrigin(0.5);

        // Mode selection buttons
        this.createModeButtons();

        // Period selection buttons
        this.createPeriodButtons();

        // Player filter buttons (Global vs Local)
        this.createPlayerFilterButtons();

        // Filter controls
        this.createFilterControls();

        // Leaderboard display area
        this.createLeaderboardDisplay();

        // Navigation buttons
        this.createNavigationButtons();

        // Setup input
        this.setupInputHandlers();

        // Initial leaderboard load
        this.updateLeaderboardDisplay();

        // Fade in effect
        this.cameras.main.fadeIn(300, 0, 0, 0);

        // Emit scene ready event
        EventBus.emit("current-scene-ready", this);

        logger.gameEvent("leaderboard-opened", {
            scene: "LeaderboardScene",
        });
    }

    private createModeButtons(): void {
        const { width } = this.cameras.main;
        const modes: { id: LeaderboardMode; label: string; color: string }[] = [
            { id: "survival", label: "SURVIVAL", color: UI_COLORS.SECONDARY },
            { id: "timeattack", label: "TIME ATTACK", color: "#3B82F6" },
            { id: "tournament", label: "TOURNAMENT", color: "#8B5CF6" },
        ];

        modes.forEach((mode, index) => {
            const x = width / 2 + (index - 1) * 220;
            const y = 130;

            const button = this.add.text(x, y, mode.label, {
                fontFamily: "Press Start 2P",
                fontSize: "18px",
                color: this.currentMode === mode.id ? mode.color : "#9CA3AF",
                align: "center",
                stroke: "#000000",
                strokeThickness: 2,
            });
            button.setOrigin(0.5);
            button.setInteractive({ useHandCursor: true });

            button.on("pointerdown", () => this.selectMode(mode.id));
            button.on("pointerover", () => {
                if (this.currentMode !== mode.id) {
                    button.setColor(mode.color);
                }
            });
            button.on("pointerout", () => {
                if (this.currentMode !== mode.id) {
                    button.setColor("#9CA3AF");
                }
            });

            this.modeButtons.push(button);
        });
    }

    private createPeriodButtons(): void {
        const { width } = this.cameras.main;
        const periods: { id: TimePeriod; label: string }[] = [
            { id: "allTime", label: "ALL TIME" },
            { id: "weekly", label: "THIS WEEK" },
            { id: "daily", label: "TODAY" },
        ];

        periods.forEach((period, index) => {
            const x = width / 2 + (index - 1) * 180;
            const y = 180;

            const button = this.add.text(x, y, period.label, {
                fontFamily: "Press Start 2P",
                fontSize: "14px",
                color: this.currentPeriod === period.id ? "#FBBF24" : "#9CA3AF",
                align: "center",
                stroke: "#000000",
                strokeThickness: 2,
            });
            button.setOrigin(0.5);
            button.setInteractive({ useHandCursor: true });

            button.on("pointerdown", () => this.selectPeriod(period.id));
            button.on("pointerover", () => {
                if (this.currentPeriod !== period.id) {
                    button.setColor("#FBBF24");
                }
            });
            button.on("pointerout", () => {
                if (this.currentPeriod !== period.id) {
                    button.setColor("#9CA3AF");
                }
            });

            this.periodButtons.push(button);
        });
    }

    private createPlayerFilterButtons(): void {
        const { width } = this.cameras.main;
        const walletState = solanaWalletService.getState();
        
        // Only show filter buttons if wallet is connected (to have global data)
        if (!walletState.connected) {
            return;
        }

        const filters: { id: PlayerFilter; label: string; color: string }[] = [
            { id: "all", label: "ALL PLAYERS", color: "#9CA3AF" },
            { id: "global", label: "🌐 GLOBAL", color: "#3B82F6" },
            { id: "local", label: "⭐ LOCAL", color: "#FBBF24" },
        ];

        filters.forEach((filter, index) => {
            const x = width / 2 + (index - 1) * 150;
            const y = 210;

            const button = this.add.text(x, y, filter.label, {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: this.playerFilter === filter.id ? filter.color : "#6B7280",
                align: "center",
                stroke: "#000000",
                strokeThickness: 2,
            });
            button.setOrigin(0.5);
            button.setInteractive({ useHandCursor: true });

            button.on("pointerdown", () => this.selectPlayerFilter(filter.id));
            button.on("pointerover", () => {
                if (this.playerFilter !== filter.id) {
                    button.setColor(filter.color);
                }
            });
            button.on("pointerout", () => {
                if (this.playerFilter !== filter.id) {
                    button.setColor("#6B7280");
                }
            });

            this.filterButtons.push(button);
        });
    }

    private selectPlayerFilter(filter: PlayerFilter): void {
        if (this.playerFilter === filter) return;

        this.playerFilter = filter;

        // Update button colors
        this.filterButtons.forEach((button, index) => {
            const filters = ["all", "global", "local"] as PlayerFilter[];
            const colors = ["#9CA3AF", "#3B82F6", "#FBBF24"];
            const isSelected = filters[index] === filter;

            button.setColor(isSelected ? colors[index] : "#6B7280");
        });

        // Update leaderboard display
        this.updateLeaderboardDisplay();

        logger.gameEvent("leaderboard-filter-changed", { filter });
    }

    private createFilterControls(): void {
        const { width } = this.cameras.main;

        // Character filter
        this.characterText = this.add.text(
            width / 2 - 250,
            250,
            "Character: All Characters",
            {
                fontFamily: "Press Start 2P",
                fontSize: "16px",
                color: "#D1D5DB",
                align: "center",
            }
        );
        this.characterText.setOrigin(0.5);
        this.characterText.setInteractive({ useHandCursor: true });
        this.characterText.on("pointerdown", () => this.cycleCharacterFilter());
        this.characterText.on("pointerover", () =>
            this.characterText.setColor("#FFFFFF")
        );
        this.characterText.on("pointerout", () =>
            this.characterText.setColor("#D1D5DB")
        );

        // Course filter (for Time Attack)
        this.courseText = this.add.text(
            width / 2 + 250,
            250,
            "Course: All Courses",
            {
                fontFamily: "Press Start 2P",
                fontSize: "16px",
                color: "#D1D5DB",
                align: "center",
            }
        );
        this.courseText.setOrigin(0.5);
        this.courseText.setInteractive({ useHandCursor: true });
        this.courseText.on("pointerdown", () => this.cycleCourseFilter());
        this.courseText.on("pointerover", () =>
            this.courseText.setColor("#FFFFFF")
        );
        this.courseText.on("pointerout", () =>
            this.courseText.setColor("#D1D5DB")
        );
        this.courseText.setVisible(this.currentMode === "timeattack");
    }

    private createLeaderboardDisplay(): void {
        const { width } = this.cameras.main;

        this.leaderboardContainer = this.add.container(width / 2, 340);

        // Add column headers
        this.createColumnHeaders();
    }

    private createColumnHeaders(): void {
        const headerY = -20;

        // Rank header
        const rankHeader = this.add.text(-320, headerY, "RANK", {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: "#FBBF24",
            align: "center",
        });
        this.leaderboardContainer.add(rankHeader);

        // Player header
        const playerHeader = this.add.text(-220, headerY, "PLAYER", {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: "#FBBF24",
            align: "center",
        });
        this.leaderboardContainer.add(playerHeader);

        // Character header
        const characterHeader = this.add.text(-80, headerY, "CHARACTER", {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: "#FBBF24",
            align: "center",
        });
        this.leaderboardContainer.add(characterHeader);

        // Score/Time header (dynamic based on mode)
        const scoreHeaderText =
            this.currentMode === "timeattack" ? "TIME" : "SCORE";
        const scoreHeader = this.add.text(80, headerY, scoreHeaderText, {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: "#FBBF24",
            align: "center",
        });
        this.leaderboardContainer.add(scoreHeader);

        // Date header
        const dateHeader = this.add.text(250, headerY, "DATE", {
            fontFamily: "Press Start 2P",
            fontSize: "12px",
            color: "#FBBF24",
            align: "center",
        });
        this.leaderboardContainer.add(dateHeader);

        // Separator line
        const line = this.add.graphics();
        line.lineStyle(2, 0xfbbf24, 0.5);
        line.moveTo(-350, 0);
        line.lineTo(350, 0);
        this.leaderboardContainer.add(line);
    }

    private createGlobalLocalLegend(): void {
        const walletState = solanaWalletService.getState();
        
        if (walletState.connected) {
            // Show legend for global vs local players
            const legendY = -50;
            
            // Global players legend
            const globalLegend = this.add.text(-100, legendY, "🌐 Global Players", {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: "#60A5FA",
                align: "center",
            });
            globalLegend.setOrigin(0.5);
            this.leaderboardContainer.add(globalLegend);

            // Local players legend
            const localLegend = this.add.text(100, legendY, "⭐ Local Players", {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: "#FBBF24",
                align: "center",
            });
            localLegend.setOrigin(0.5);
            this.leaderboardContainer.add(localLegend);

            // Sync button for refreshing global data
            const syncButton = this.add.text(250, legendY, "🔄 Sync", {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: "#10B981",
                align: "center",
            });
            syncButton.setOrigin(0.5);
            syncButton.setInteractive({ useHandCursor: true });
            syncButton.on("pointerdown", () => this.syncGlobalData());
            syncButton.on("pointerover", () => syncButton.setColor("#FFFFFF"));
            syncButton.on("pointerout", () => syncButton.setColor("#10B981"));
            this.leaderboardContainer.add(syncButton);
        }
    }

    private async syncGlobalData(): Promise<void> {
        if (!solanaWalletService.isConnected()) {
            return;
        }

        try {
            // Show syncing indicator
            const syncingText = this.add.text(0, -30, "Syncing global data...", {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: "#FBBF24",
                align: "center",
            });
            syncingText.setOrigin(0.5);
            this.leaderboardContainer.add(syncingText);

            // Trigger sync
            await hybridLeaderboardService.loadFromRemote();
            
            // Remove syncing text and refresh display
            syncingText.destroy();
            this.updateLeaderboardDisplay();
            
            logger.debug('✅ Manual global data sync completed');
        } catch (error) {
            logger.debug('❌ Manual sync failed:', { error });
        }
    }

    private createNavigationButtons(): void {
        const { width, height } = this.cameras.main;

        // Back button
        this.backButton = this.add.text(100, height - 60, "BACK TO MENU", {
            fontFamily: "Press Start 2P",
            fontSize: "20px",
            color: "#9CA3AF",
            align: "center",
        });
        this.backButton.setOrigin(0.5);
        this.backButton.setInteractive({ useHandCursor: true });
        this.backButton.on("pointerdown", () => this.goBack());
        this.backButton.on("pointerover", () =>
            this.backButton.setColor("#FFFFFF")
        );
        this.backButton.on("pointerout", () =>
            this.backButton.setColor("#9CA3AF")
        );

        // Profile button
        this.profileButton = this.add.text(
            width - 100,
            height - 60,
            "MY PROFILE",
            {
                fontFamily: "Press Start 2P",
                fontSize: "20px",
                color: "#3B82F6",
                align: "center",
            }
        );
        this.profileButton.setOrigin(0.5);
        this.profileButton.setInteractive({ useHandCursor: true });
        this.profileButton.on("pointerdown", () => this.showProfile());
        this.profileButton.on("pointerover", () =>
            this.profileButton.setColor("#60A5FA")
        );
        this.profileButton.on("pointerout", () =>
            this.profileButton.setColor("#3B82F6")
        );

        // Wallet connection status (top-right)
        this.createWalletStatus();
    }

    private createWalletStatus(): void {
        const { width } = this.cameras.main;

        // Listen for wallet state changes
        EventBus.on(
            "wallet-state-changed",
            () => {
                debug.general(
                    "📡 Leaderboard: Received wallet-state-changed event"
                );
                this.updateWalletStatus();
            },
            this
        );
        EventBus.on(
            "wallet-connected",
            () => {
                debug.general(
                    "📡 Leaderboard: Received wallet-connected event"
                );
                this.updateWalletStatus();
            },
            this
        );
        EventBus.on(
            "wallet-disconnected",
            () => {
                debug.general(
                    "📡 Leaderboard: Received wallet-disconnected event"
                );
                this.updateWalletStatus();
            },
            this
        );

        // Create initial wallet display (delayed to ensure scene is fully ready)
        this.time.delayedCall(100, () => {
            this.updateWalletStatus();
        });
    }

    private updateWalletStatus(): void {
        // Check if cameras are available (less restrictive than scene.isActive())
        if (!this.cameras?.main) {
            debug.general("🚫 Leaderboard: Cameras not available yet");
            return;
        }

        debug.general(
            "✅ Leaderboard: Scene and cameras ready, updating wallet status"
        );

        // Remove existing wallet elements
        if (this.walletButton) {
            this.walletButton.destroy();
        }
        if (this.walletStatusText) {
            this.walletStatusText.destroy();
        }

        const { width, height } = this.cameras.main;
        const walletState = solanaWalletService.getState();
        debug.general("🔍 Leaderboard: Updating wallet status:", {
            connected: walletState.connected,
            connecting: walletState.connecting,
            error: walletState.error,
            publicKey: walletState.publicKey ? "present" : "null",
        });

        if (walletState.connected && walletState.publicKey) {
            // Connected state - show wallet info and disconnect option
            debug.general("✅ Leaderboard: Showing connected state");
            const shortAddress =
                walletState.publicKey.slice(0, 4) +
                "..." +
                walletState.publicKey.slice(-4);

            this.walletStatusText = this.add.text(
                width - 100,
                45,
                `🔗 ${shortAddress}`,
                {
                    fontFamily: "Press Start 2P",
                    fontSize: "12px",
                    color: UI_COLORS.SUCCESS,
                    align: "center",
                }
            );
            this.walletStatusText.setOrigin(0.5);

            this.walletButton = this.add.text(width - 100, 65, "Disconnect", {
                fontFamily: "Press Start 2P",
                fontSize: "10px",
                color: UI_COLORS.WARNING,
                align: "center",
            });
            this.walletButton.setOrigin(0.5);
            this.walletButton.setInteractive({ useHandCursor: true });
            this.walletButton.on("pointerdown", () =>
                this.handleWalletDisconnect()
            );
            this.walletButton.on("pointerover", () =>
                this.walletButton.setColor("#FFFFFF")
            );
            this.walletButton.on("pointerout", () =>
                this.walletButton.setColor(UI_COLORS.WARNING)
            );
        } else if (walletState.connecting) {
            // Connecting state
            debug.general("🟡 Leaderboard: Showing connecting state");
            this.walletStatusText = this.add.text(
                width - 100,
                40,
                "Connecting...",
                {
                    fontFamily: "Press Start 2P",
                    fontSize: "12px",
                    color: UI_COLORS.WARNING,
                    align: "center",
                }
            );
            this.walletStatusText.setOrigin(0.5);
        } else {
            // Disconnected state - show connect button
            debug.general(
                "🔴 Leaderboard: Showing disconnected state with connect button"
            );
            debug.general(
                `🔴 Leaderboard: Creating button at position (${
                    width - 100
                }, 20) with width=${width}`
            );

            this.walletButton = this.add.text(
                width - 100,
                40,
                "🔗 Connect Wallet",
                {
                    fontFamily: "Press Start 2P",
                    fontSize: "12px",
                    color: UI_COLORS.PRIMARY,
                    align: "center",
                }
            );
            this.walletButton.setOrigin(0.5);
            this.walletButton.setInteractive({ useHandCursor: true });
            this.walletButton.on("pointerdown", () =>
                this.handleWalletConnect()
            );
            this.walletButton.on("pointerover", () =>
                this.walletButton.setColor("#FFFFFF")
            );
            this.walletButton.on("pointerout", () =>
                this.walletButton.setColor(UI_COLORS.PRIMARY)
            );

            debug.general(
                "✅ Leaderboard: Connect wallet button created successfully"
            );

            if (walletState.error) {
                this.walletStatusText = this.add.text(
                    width - 100,
                    45,
                    "Connection Failed",
                    {
                        fontFamily: "Press Start 2P",
                        fontSize: "8px",
                        color: UI_COLORS.DANGER,
                        align: "center",
                    }
                );
                this.walletStatusText.setOrigin(0.5);

                debug.general(
                    "⚠️ Leaderboard: Showing connection failed error"
                );
            }
        }
    }

    private async handleWalletConnect(): Promise<void> {
        try {
            await solanaWalletService.connect();

            // Authenticate with Supabase after successful wallet connection
            const walletAddress = solanaWalletService.getPublicKey();
            if (walletAddress) {
                const user = await supabaseService.authenticateWithWallet(
                    walletAddress
                );
                if (user) {
                    logger.debug("✅ User authenticated with Supabase:", {
                        username: user.username,
                    });
                    // Refresh leaderboard to show updated data
                    this.updateLeaderboardDisplay();
                } else {
                    logger.debug(
                        "❌ Failed to authenticate user with Supabase"
                    );
                }
            }
        } catch (error) {
            logger.debug("❌ Wallet connection failed:", { error });
        }
    }

    private async handleWalletDisconnect(): Promise<void> {
        try {
            await solanaWalletService.disconnect();
            // Refresh leaderboard to show updated data
            this.updateLeaderboardDisplay();
        } catch (error) {
            logger.debug("❌ Wallet disconnect failed:", { error });
        }
    }

    private setupInputHandlers(): void {
        // Clear any existing listeners first
        this.input.keyboard!.removeAllListeners();

        // Cursor keys and WASD
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasdKeys = this.input.keyboard!.addKeys(
            "W,S,A,D,ENTER,SPACE,ESC"
        ) as Record<string, Phaser.Input.Keyboard.Key>;
        this.enterKey = this.input.keyboard!.addKey(
            Phaser.Input.Keyboard.KeyCodes.ENTER
        );
        this.escKey = this.input.keyboard!.addKey(
            Phaser.Input.Keyboard.KeyCodes.ESC
        );

        // ESC to go back
        this.escKey.on("down", () => this.goBack());
    }

    private selectMode(mode: LeaderboardMode): void {
        if (this.currentMode === mode) return;

        this.currentMode = mode;
        this.selectedCharacter = "all";
        this.selectedCourse = "all";

        // Update button colors
        this.modeButtons.forEach((button, index) => {
            const modes = ["survival", "timeattack", "tournament"];
            const colors = [UI_COLORS.SECONDARY, "#3B82F6", "#8B5CF6"];
            const isSelected = modes[index] === mode;

            button.setColor(isSelected ? colors[index] : "#9CA3AF");
        });

        // Show/hide course filter
        this.courseText.setVisible(mode === "timeattack");

        // Update filter text
        this.updateFilterText();

        // Update leaderboard
        this.updateLeaderboardDisplay();

        logger.gameEvent("leaderboard-mode-changed", { mode });
    }

    private selectPeriod(period: TimePeriod): void {
        if (this.currentPeriod === period) return;

        this.currentPeriod = period;

        // Update button colors
        this.periodButtons.forEach((button, index) => {
            const periods = ["allTime", "weekly", "daily"];
            const isSelected = periods[index] === period;

            button.setColor(isSelected ? "#FBBF24" : "#9CA3AF");
        });

        // Update leaderboard
        this.updateLeaderboardDisplay();

        logger.gameEvent("leaderboard-period-changed", { period });
    }

    private cycleCharacterFilter(): void {
        const characters = ["all", ...characterList.map((c) => c.id)];
        const currentIndex = characters.indexOf(this.selectedCharacter);
        const nextIndex = (currentIndex + 1) % characters.length;

        this.selectedCharacter = characters[nextIndex];
        this.updateFilterText();
        this.updateLeaderboardDisplay();
    }

    private cycleCourseFilter(): void {
        const courses = ["all", ...getAllTimeAttackCourses().map((c) => c.id)];
        const currentIndex = courses.indexOf(this.selectedCourse);
        const nextIndex = (currentIndex + 1) % courses.length;

        this.selectedCourse = courses[nextIndex];
        this.updateFilterText();
        this.updateLeaderboardDisplay();
    }

    private updateFilterText(): void {
        // Update character filter text
        const characterName =
            this.selectedCharacter === "all"
                ? "All Characters"
                : characterList.find((c) => c.id === this.selectedCharacter)
                      ?.name || this.selectedCharacter;
        this.characterText.setText(`Character: ${characterName}`);

        // Update course filter text
        if (this.currentMode === "timeattack") {
            const courseName =
                this.selectedCourse === "all"
                    ? "All Courses"
                    : getAllTimeAttackCourses().find(
                          (c) => c.id === this.selectedCourse
                      )?.name || this.selectedCourse;
            this.courseText.setText(`Course: ${courseName}`);
        }
    }

    private updateLeaderboardDisplay(): void {
        // Clear existing leaderboard
        this.leaderboardContainer.removeAll(true);

        // Recreate headers with correct mode
        this.createColumnHeaders();
        
        // Add legend for global/local indicators if wallet is connected
        this.createGlobalLocalLegend();

        let entries: any[] = [];
        let emptyMessage = "No entries found.";

        // Get mixed entries (global + local) with indicators
        switch (this.currentMode) {
            case "survival":
                entries = hybridLeaderboardService.getMixedLeaderboard('survival', this.currentPeriod, 
                    this.selectedCharacter === 'all' ? undefined : this.selectedCharacter);
                emptyMessage =
                    "No survival scores yet. Play Survival mode to appear here!";
                break;
            case "timeattack":
                entries = hybridLeaderboardService.getMixedLeaderboard('timeAttack', this.currentPeriod, 
                    this.selectedCharacter === 'all' ? undefined : this.selectedCharacter);
                emptyMessage =
                    "No time attack records yet. Complete courses to appear here!";
                break;
            case "tournament":
                entries = hybridLeaderboardService.getMixedLeaderboard('tournament', this.currentPeriod, 
                    this.selectedCharacter === 'all' ? undefined : this.selectedCharacter);
                emptyMessage =
                    "No tournament records yet. Complete tournaments to appear here!";
                break;
        }

        if (entries.length === 0) {
            // Show empty message
            const emptyText = this.add.text(0, 100, emptyMessage, {
                fontFamily: "Press Start 2P",
                fontSize: "20px",
                color: "#6B7280",
                align: "center",
                wordWrap: { width: 600 },
            });
            emptyText.setOrigin(0.5);
            this.leaderboardContainer.add(emptyText);
        } else {
            // Apply player filter before displaying
            const filteredEntries = this.applyPlayerFilter(entries);
            
            // Display entries (top 8 to fit better)
            this.displayEntries(filteredEntries.slice(0, 8));
        }
    }

    private applyPlayerFilter(entries: any[]): any[] {
        switch (this.playerFilter) {
            case "global":
                return entries.filter(entry => entry.isGlobal);
            case "local":
                return entries.filter(entry => entry.isLocal);
            case "all":
            default:
                return entries;
        }
    }

    private getSurvivalEntries(leaderboardData: any): SurvivalEntry[] {
        if (this.selectedCharacter === "all") {
            return leaderboardData.survival[this.currentPeriod] || [];
        } else {
            return (
                leaderboardData.survival.perCharacter[this.selectedCharacter] ||
                []
            );
        }
    }

    private getTimeAttackEntries(leaderboardData: any): TimeAttackEntry[] {
        let entries: TimeAttackEntry[] = [];

        if (this.selectedCharacter === "all") {
            if (this.selectedCourse === "all") {
                // Combine all courses
                entries = Object.values(
                    leaderboardData.timeAttack[this.currentPeriod]
                ).flat() as TimeAttackEntry[];
            } else {
                entries =
                    leaderboardData.timeAttack[this.currentPeriod][
                        this.selectedCourse
                    ] || [];
            }
        } else {
            entries = (
                leaderboardData.timeAttack.perCharacter[
                    this.selectedCharacter
                ] || []
            ).filter(
                (entry: TimeAttackEntry) =>
                    this.selectedCourse === "all" ||
                    entry.courseId === this.selectedCourse
            );
        }

        return entries.sort((a, b) => a.completionTime - b.completionTime);
    }

    private getTournamentEntries(leaderboardData: any): TournamentEntry[] {
        if (this.selectedCharacter === "all") {
            return leaderboardData.tournament[this.currentPeriod] || [];
        } else {
            return (
                leaderboardData.tournament.perCharacter[
                    this.selectedCharacter
                ] || []
            );
        }
    }

    private displayEntries(entries: any[]): void {
        entries.forEach((entry, index) => {
            const y = 20 + index * 40; // Better spacing starting below header

            // Add background row for better readability
            if (index % 2 === 0) {
                const rowBg = this.add.rectangle(0, y, 700, 35, 0x000000, 0.2);
                this.leaderboardContainer.add(rowBg);
            }

            // Rank
            const rank = this.getRankEmoji(index);
            const rankText = this.add.text(-320, y, rank, {
                fontFamily: "Press Start 2P",
                fontSize: "18px",
                color: "#FBBF24",
                align: "center",
            });
            rankText.setOrigin(0.5);
            this.leaderboardContainer.add(rankText);

            // Player name with global/local indicator (truncate if too long)
            let playerName = entry.playerName;
            let nameColor = "#FFFFFF";
            
            // Add visual indicators for global vs local players
            if (entry.isGlobal) {
                // Global players get a special icon and color
                nameColor = "#60A5FA"; // Blue for global players
                if (!playerName.startsWith("🌐")) {
                    playerName = "🌐 " + playerName;
                }
            } else if (entry.isLocal) {
                // Local players get a different color and icon
                nameColor = "#FBBF24"; // Gold for local players
                if (!playerName.startsWith("⭐")) {
                    playerName = "⭐ " + playerName;
                }
            }
            
            // Truncate if too long
            if (playerName.length > 15) {
                playerName = playerName.substring(0, 15) + "...";
            }
            
            const nameText = this.add.text(-220, y, playerName, {
                fontFamily: "Press Start 2P",
                fontSize: "14px",
                color: nameColor,
                align: "center",
            });
            nameText.setOrigin(0.5);
            this.leaderboardContainer.add(nameText);

            // Character
            const characterName =
                characterList.find((c) => c.id === entry.character)?.name ||
                entry.character;
            const charText = this.add.text(-80, y, characterName, {
                fontFamily: "Press Start 2P",
                fontSize: "14px",
                color: "#9CA3AF",
                align: "center",
            });
            charText.setOrigin(0.5);
            this.leaderboardContainer.add(charText);

            // Mode-specific data
            const valueText = this.getModeSpecificText(entry);
            const dataText = this.add.text(80, y, valueText, {
                fontFamily: "Press Start 2P",
                fontSize: "16px",
                color: this.getModeColor(),
                align: "center",
            });
            dataText.setOrigin(0.5);
            this.leaderboardContainer.add(dataText);

            // Date (show only month/day for space)
            const date = new Date(entry.timestamp);
            const shortDate = `${date.getMonth() + 1}/${date.getDate()}`;
            const dateText = this.add.text(250, y, shortDate, {
                fontFamily: "Press Start 2P",
                fontSize: "12px",
                color: "#6B7280",
                align: "center",
            });
            dateText.setOrigin(0.5);
            this.leaderboardContainer.add(dateText);
        });
    }

    private getRankEmoji(index: number): string {
        if (index === 0) return "🥇";
        if (index === 1) return "🥈";
        if (index === 2) return "🥉";
        return `${index + 1}.`;
    }

    private getModeSpecificText(entry: any): string {
        switch (this.currentMode) {
            case "survival":
                return `${hybridLeaderboardService.formatScore(
                    entry.score
                )} (R${entry.roundsCompleted})`;
            case "timeattack": {
                const medal = this.getMedalEmoji(entry.medal);
                return `${medal} ${hybridLeaderboardService.formatTime(
                    entry.completionTime
                )}`;
            }
            case "tournament":
                return entry.completed
                    ? "👑 CHAMPION"
                    : `${entry.matchesWon}/${entry.totalMatches} wins`;
            default:
                return "";
        }
    }

    private getMedalEmoji(medal: string): string {
        switch (medal) {
            case "Gold":
                return "🏆";
            case "Silver":
                return "🥈";
            case "Bronze":
                return "🥉";
            default:
                return "⚪";
        }
    }

    private getModeColor(): string {
        switch (this.currentMode) {
            case "survival":
                return "#EF4444";
            case "timeattack":
                return "#3B82F6";
            case "tournament":
                return "#8B5CF6";
            default:
                return "#FFFFFF";
        }
    }

    private showProfile(): void {
        logger.gameEvent("profile-requested", { from: "leaderboard" });

        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("PlayerProfileScene");
        });
    }

    private goBack(): void {
        logger.gameEvent("leaderboard-back", {
            mode: this.currentMode,
            period: this.currentPeriod,
        });

        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("MainMenuScene");
        });
    }

    shutdown(): void {
        // Clean up event listeners
        this.input.keyboard!.removeAllListeners();
        this.tweens.killAll();

        // Clean up EventBus listeners
        EventBus.off("wallet-state-changed", this.updateWalletStatus, this);
        EventBus.off("wallet-connected", this.updateWalletStatus, this);
        EventBus.off("wallet-disconnected", this.updateWalletStatus, this);

        // Clear arrays to prevent stale references
        this.modeButtons = [];
        this.periodButtons = [];
        this.filterButtons = [];
    }
}

