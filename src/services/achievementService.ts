// Achievement Service for Deadly Duel - Wallet-Connected Players
import { solanaWalletService } from "@/services/solanaWalletService";
import { supabaseService } from "@/services/supabaseService";
import { hybridLeaderboardService } from "@/services/hybridLeaderboardService";
import { logger } from "@/lib/logger";
import debug from "@/lib/debug";
import EventBus from "@/lib/EventBus";
import { localStorageUtils } from "@/utils/localStorageUtils";

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'combat' | 'survival' | 'timeattack' | 'tournament' | 'global' | 'social';
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    walletOnly: boolean; // Only available to wallet-connected players
    requirements: {
        type: 'score' | 'wins' | 'playtime' | 'streak' | 'special';
        value?: number;
        gameMode?: string;
        character?: string;
        condition?: string;
    };
    reward?: {
        type: 'badge' | 'title' | 'cosmetic';
        value: string;
    };
    unlocked: boolean;
    unlockedAt?: number;
    progress?: number;
    maxProgress?: number;
}

export interface PlayerAchievements {
    playerId: string;
    walletAddress?: string;
    achievements: Achievement[];
    totalPoints: number;
    lastUpdated: number;
}

class AchievementService {
    private static instance: AchievementService;
    private achievements: Achievement[] = [];
    private playerAchievements: PlayerAchievements | null = null;

    static getInstance(): AchievementService {
        if (!AchievementService.instance) {
            AchievementService.instance = new AchievementService();
        }
        return AchievementService.instance;
    }

    private constructor() {
        this.initializeAchievements();
        this.setupEventListeners();
    }

    private initializeAchievements(): void {
        this.achievements = [
            // Global Player Achievements (Wallet Only)
            {
                id: 'global_pioneer',
                name: 'Global Pioneer',
                description: 'Connect your wallet and join the global leaderboard',
                icon: '🌐',
                category: 'global',
                rarity: 'common',
                walletOnly: true,
                requirements: { type: 'special', condition: 'connect_wallet' },
                reward: { type: 'title', value: 'Pioneer' },
                unlocked: false,
                progress: 0,
                maxProgress: 1
            },
            {
                id: 'global_champion',
                name: 'Global Champion',
                description: 'Achieve #1 rank in any global leaderboard',
                icon: '👑',
                category: 'global',
                rarity: 'legendary',
                walletOnly: true,
                requirements: { type: 'special', condition: 'global_rank_1' },
                reward: { type: 'title', value: 'Champion' },
                unlocked: false,
                progress: 0,
                maxProgress: 1
            },
            {
                id: 'global_elite',
                name: 'Global Elite',
                description: 'Reach top 10 in any global leaderboard',
                icon: '⭐',
                category: 'global',
                rarity: 'epic',
                walletOnly: true,
                requirements: { type: 'special', condition: 'global_top_10' },
                reward: { type: 'title', value: 'Elite' },
                unlocked: false,
                progress: 0,
                maxProgress: 1
            },
            {
                id: 'world_warrior',
                name: 'World Warrior',
                description: 'Win 100 matches as a global player',
                icon: '🗡️',
                category: 'global',
                rarity: 'rare',
                walletOnly: true,
                requirements: { type: 'wins', value: 100 },
                reward: { type: 'title', value: 'World Warrior' },
                unlocked: false,
                progress: 0,
                maxProgress: 100
            },
            
            // Survival Mode Achievements (Enhanced for wallet players)
            {
                id: 'survival_legend',
                name: 'Survival Legend',
                description: 'Reach round 50 in survival mode as a global player',
                icon: '🏆',
                category: 'survival',
                rarity: 'legendary',
                walletOnly: true,
                requirements: { type: 'special', condition: 'survival_round_50', gameMode: 'survival' },
                reward: { type: 'title', value: 'Legend' },
                unlocked: false,
                progress: 0,
                maxProgress: 1
            },
            {
                id: 'perfect_survivor',
                name: 'Perfect Survivor',
                description: 'Complete 10 perfect rounds in survival mode',
                icon: '💎',
                category: 'survival',
                rarity: 'epic',
                walletOnly: true,
                requirements: { type: 'special', condition: 'perfect_rounds_10', gameMode: 'survival' },
                reward: { type: 'badge', value: 'Perfect Diamond' },
                unlocked: false,
                progress: 0,
                maxProgress: 10
            },

            // Tournament Achievements (Wallet Enhanced)
            {
                id: 'tournament_master',
                name: 'Tournament Master',
                description: 'Complete 10 tournaments as a global player',
                icon: '🎯',
                category: 'tournament',
                rarity: 'epic',
                walletOnly: true,
                requirements: { type: 'special', condition: 'tournaments_completed_10' },
                reward: { type: 'title', value: 'Master' },
                unlocked: false,
                progress: 0,
                maxProgress: 10
            },

            // Time Attack Achievements (Global Competition)
            {
                id: 'speed_demon',
                name: 'Speed Demon',
                description: 'Achieve gold medals in all time attack courses',
                icon: '⚡',
                category: 'timeattack',
                rarity: 'legendary',
                walletOnly: true,
                requirements: { type: 'special', condition: 'all_gold_medals' },
                reward: { type: 'title', value: 'Speed Demon' },
                unlocked: false,
                progress: 0,
                maxProgress: 4 // 4 courses
            },

            // Social Achievements (Wallet Community)
            {
                id: 'community_member',
                name: 'Community Member',
                description: 'Play alongside 10 different global players',
                icon: '🤝',
                category: 'social',
                rarity: 'rare',
                walletOnly: true,
                requirements: { type: 'special', condition: 'unique_opponents_10' },
                reward: { type: 'badge', value: 'Community Badge' },
                unlocked: false,
                progress: 0,
                maxProgress: 10
            },

            // Combat Achievements (Cross-Platform)
            {
                id: 'cross_platform_dominator',
                name: 'Cross-Platform Dominator',
                description: 'Defeat both local and global players in the same session',
                icon: '⚔️',
                category: 'combat',
                rarity: 'rare',
                walletOnly: false, // Available to all, but requires global participation
                requirements: { type: 'special', condition: 'defeat_both_types' },
                reward: { type: 'title', value: 'Dominator' },
                unlocked: false,
                progress: 0,
                maxProgress: 1
            }
        ];

        debug.general('📋 Achievement system initialized with', this.achievements.length, 'achievements');
    }

    private setupEventListeners(): void {
        // Listen for wallet connection
        EventBus.on('wallet-connected', this.onWalletConnected, this);
        EventBus.on('wallet-disconnected', this.onWalletDisconnected, this);

        // Listen for game events
        EventBus.on('survival-completed', this.onSurvivalCompleted, this);
        EventBus.on('tournament-completed', this.onTournamentCompleted, this);
        EventBus.on('timeattack-completed', this.onTimeAttackCompleted, this);
        EventBus.on('match-won', this.onMatchWon, this);
    }

    private async onWalletConnected(): Promise<void> {
        debug.general('🏆 Wallet connected - checking for Global Pioneer achievement');
        await this.checkAchievement('global_pioneer');
        await this.loadPlayerAchievements();
    }

    private onWalletDisconnected(): void {
        debug.general('🏆 Wallet disconnected - pausing achievement tracking');
        this.playerAchievements = null;
    }

    public async loadPlayerAchievements(): Promise<void> {
        const walletAddress = solanaWalletService.getPublicKey();
        if (!walletAddress) {
            return;
        }

        try {
            // Load from localStorage as backup/cache
            const localData = localStorageUtils.safeRead(`achievements_${walletAddress}`);
            if (localData) {
                this.playerAchievements = JSON.parse(localData);
                this.syncAchievementStates();
            }

            // TODO: Load from Supabase when available
            // const globalAchievements = await supabaseService.getPlayerAchievements(walletAddress);
            
        } catch (error) {
            debug.general('❌ Failed to load player achievements:', error);
        }
    }

    private syncAchievementStates(): void {
        if (!this.playerAchievements) return;

        // Sync unlocked states from player data to achievement definitions
        this.achievements.forEach(achievement => {
            const playerAchievement = this.playerAchievements!.achievements.find(
                a => a.id === achievement.id
            );
            if (playerAchievement) {
                achievement.unlocked = playerAchievement.unlocked;
                achievement.unlockedAt = playerAchievement.unlockedAt;
                achievement.progress = playerAchievement.progress;
            }
        });
    }

    public async checkAchievement(achievementId: string, progress?: number): Promise<boolean> {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (!achievement || achievement.unlocked) {
            return false;
        }

        // Check if wallet is required
        if (achievement.walletOnly && !solanaWalletService.isConnected()) {
            return false;
        }

        let shouldUnlock = false;

        // Update progress
        if (progress !== undefined && achievement.maxProgress) {
            achievement.progress = Math.min(progress, achievement.maxProgress);
            shouldUnlock = achievement.progress >= achievement.maxProgress;
        } else {
            // Check specific conditions
            shouldUnlock = await this.checkAchievementCondition(achievement);
        }

        if (shouldUnlock) {
            await this.unlockAchievement(achievement);
            return true;
        }

        return false;
    }

    private async checkAchievementCondition(achievement: Achievement): Promise<boolean> {
        const { requirements } = achievement;

        switch (requirements.condition) {
            case 'connect_wallet':
                return solanaWalletService.isConnected();
            
            case 'global_rank_1':
                return await this.checkGlobalRank(1);
                
            case 'global_top_10':
                return await this.checkGlobalRank(10);
                
            default:
                return false;
        }
    }

    private async checkGlobalRank(targetRank: number): Promise<boolean> {
        if (!solanaWalletService.isConnected()) return false;

        try {
            // Check all leaderboard modes for top rank
            const modes = ['survival', 'timeattack', 'tournament'] as const;
            
            for (const mode of modes) {
                const entries = hybridLeaderboardService.getMixedLeaderboard(mode === 'timeattack' ? 'timeAttack' : mode, 'allTime');
                const globalEntries = entries.filter(entry => entry.isGlobal);
                const walletKey = solanaWalletService.getPublicKey();
                if (!walletKey) continue;
                
                const playerEntry = globalEntries.find(entry => 
                    entry.playerName.includes(walletKey.slice(-4))
                );
                
                if (playerEntry) {
                    const rank = globalEntries.indexOf(playerEntry) + 1;
                    if (rank <= targetRank) {
                        return true;
                    }
                }
            }
        } catch (error) {
            debug.general('❌ Error checking global rank:', error);
        }

        return false;
    }

    private async unlockAchievement(achievement: Achievement): Promise<void> {
        achievement.unlocked = true;
        achievement.unlockedAt = Date.now();

        // Initialize player achievements if needed
        if (!this.playerAchievements) {
            const walletAddress = solanaWalletService.getPublicKey();
            this.playerAchievements = {
                playerId: walletAddress || 'local',
                walletAddress: walletAddress || undefined,
                achievements: [],
                totalPoints: 0,
                lastUpdated: Date.now()
            };
        }

        // Add to player achievements
        const existingIndex = this.playerAchievements.achievements.findIndex(a => a.id === achievement.id);
        if (existingIndex >= 0) {
            this.playerAchievements.achievements[existingIndex] = { ...achievement };
        } else {
            this.playerAchievements.achievements.push({ ...achievement });
        }

        // Calculate points
        const points = this.getAchievementPoints(achievement);
        this.playerAchievements.totalPoints += points;
        this.playerAchievements.lastUpdated = Date.now();

        // Save to localStorage
        if (this.playerAchievements.walletAddress) {
            localStorageUtils.debouncedWriteObject(
                `achievements_${this.playerAchievements.walletAddress}`,
                this.playerAchievements
            );
        }

        // Emit achievement unlocked event
        EventBus.emit('achievement-unlocked', {
            achievement,
            points,
            totalPoints: this.playerAchievements.totalPoints
        });

        debug.general('🏆 Achievement unlocked:', achievement.name, `(+${points} points)`);
        logger.gameEvent('achievement-unlocked', {
            achievementId: achievement.id,
            name: achievement.name,
            category: achievement.category,
            rarity: achievement.rarity,
            points
        });
    }

    private getAchievementPoints(achievement: Achievement): number {
        const rarityPoints = {
            common: 10,
            rare: 25,
            epic: 50,
            legendary: 100
        };
        
        const basePoints = rarityPoints[achievement.rarity];
        const walletBonus = achievement.walletOnly ? 10 : 0;
        
        return basePoints + walletBonus;
    }

    // Event handlers for game completion
    private async onSurvivalCompleted(data: any): Promise<void> {
        if (!solanaWalletService.isConnected()) return;

        const { roundsCompleted, perfectRounds } = data;

        // Check various survival achievements
        if (roundsCompleted >= 50) {
            await this.checkAchievement('survival_legend');
        }

        if (perfectRounds >= 10) {
            await this.checkAchievement('perfect_survivor', perfectRounds);
        }
    }

    private async onTournamentCompleted(data: any): Promise<void> {
        if (!solanaWalletService.isConnected()) return;

        const { completed } = data;
        
        if (completed) {
            const currentProgress = this.getAchievementProgress('tournament_master') + 1;
            await this.checkAchievement('tournament_master', currentProgress);
        }
    }

    private async onTimeAttackCompleted(data: any): Promise<void> {
        if (!solanaWalletService.isConnected()) return;

        const { medal, courseId } = data;
        
        if (medal === 'Gold') {
            // Check if all courses now have gold medals
            const goldMedals = this.getGoldMedalCount();
            await this.checkAchievement('speed_demon', goldMedals);
        }
    }

    private async onMatchWon(data: any): Promise<void> {
        if (!solanaWalletService.isConnected()) return;

        // Track wins for World Warrior achievement
        const currentWins = this.getAchievementProgress('world_warrior') + 1;
        await this.checkAchievement('world_warrior', currentWins);
    }

    // Utility methods
    public getAchievements(): Achievement[] {
        return [...this.achievements];
    }

    public getWalletOnlyAchievements(): Achievement[] {
        return this.achievements.filter(a => a.walletOnly);
    }

    public getUnlockedAchievements(): Achievement[] {
        return this.achievements.filter(a => a.unlocked);
    }

    public getPlayerAchievements(): PlayerAchievements | null {
        return this.playerAchievements;
    }

    public getTotalPoints(): number {
        return this.playerAchievements?.totalPoints || 0;
    }

    private getAchievementProgress(achievementId: string): number {
        const achievement = this.achievements.find(a => a.id === achievementId);
        return achievement?.progress || 0;
    }

    private getGoldMedalCount(): number {
        // TODO: Implement based on time attack data
        return 0;
    }

    public cleanup(): void {
        EventBus.off('wallet-connected', this.onWalletConnected, this);
        EventBus.off('wallet-disconnected', this.onWalletDisconnected, this);
        EventBus.off('survival-completed', this.onSurvivalCompleted, this);
        EventBus.off('tournament-completed', this.onTournamentCompleted, this);
        EventBus.off('timeattack-completed', this.onTimeAttackCompleted, this);
        EventBus.off('match-won', this.onMatchWon, this);
    }
}

// Export singleton instance
export const achievementService = AchievementService.getInstance();
export default achievementService;