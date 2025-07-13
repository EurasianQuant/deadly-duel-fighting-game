import { logger } from "@/lib/logger";
import { supabaseService } from "@/services/supabaseService";
import { solanaWalletService } from "@/services/solanaWalletService";
import EventBus from "@/lib/EventBus";
import { InputValidator } from "@/utils/inputValidation";

// Import existing interfaces from the original service
export interface SurvivalEntry {
    id: string;
    playerName: string;
    character: string;
    score: number;
    roundsCompleted: number;
    perfectRounds: number;
    enemiesDefeated: number;
    finalMultiplier: number;
    timestamp: number;
    playTime: number; // in seconds
}

export interface TimeAttackEntry {
    id: string;
    playerName: string;
    character: string;
    courseId: string;
    courseName: string;
    completionTime: number; // in seconds
    medal: 'Gold' | 'Silver' | 'Bronze' | 'None';
    bonusTime: number;
    perfectVictories: number;
    timestamp: number;
}

export interface TournamentEntry {
    id: string;
    playerName: string;
    character: string;
    completed: boolean;
    matchesWon: number;
    totalMatches: number;
    finalDifficulty: number;
    defeatedOpponents: string[];
    timestamp: number;
    playTime: number; // in seconds
}

export interface CharacterStats {
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    survivalBestRound: number;
    survivalBestScore: number;
    survivalTotalScore: number;
    timeAttackBestTimes: Record<string, number>; // courseId -> best time
    timeAttackCompletions: number;
    tournamentCompletions: number;
    perfectRounds: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalPlayTime: number; // in seconds
    winStreak: number;
    bestWinStreak: number;
    lastPlayed: number; // timestamp
}

export interface PlayerProfile {
    id: string;
    playerName: string;
    createdAt: number;
    lastActive: number;
    totalMatches: number;
    totalWins: number;
    totalLosses: number;
    totalPlayTime: number;
    favoriteCharacter: string;
    currentWinStreak: number;
    bestWinStreak: number;
    achievementIds: string[];
    characterStats: Record<string, CharacterStats>;
    preferredGameMode: 'normal' | 'tournament' | 'survival' | 'timeattack';
    settings: {
        showDebug: boolean;
        preferredDifficulty: string;
        soundEnabled: boolean;
        musicEnabled: boolean;
    };
}

export interface LeaderboardData {
    survival: {
        allTime: SurvivalEntry[];
        weekly: SurvivalEntry[];
        daily: SurvivalEntry[];
        perCharacter: Record<string, SurvivalEntry[]>;
    };
    timeAttack: {
        allTime: TimeAttackEntry[];
        weekly: TimeAttackEntry[];
        daily: TimeAttackEntry[];
        perCharacter: Record<string, TimeAttackEntry[]>;
        perCourse: Record<string, TimeAttackEntry[]>;
    };
    tournament: {
        allTime: TournamentEntry[];
        weekly: TournamentEntry[];
        daily: TournamentEntry[];
        perCharacter: Record<string, TournamentEntry[]>;
    };
    lastUpdated: number;
}

interface PendingSync {
    type: 'survival' | 'timeAttack' | 'tournament' | 'characterStats' | 'profile';
    data: any;
    timestamp: number;
    retryCount: number;
}

/**
 * Hybrid LeaderboardService - Memory-First + Smart Persistence
 * 
 * Architecture:
 * 1. All reads from memory cache (instant)
 * 2. Writes immediately to memory, async to storage
 * 3. Batched localStorage writes (performance)
 * 4. Background Supabase sync when authenticated
 * 5. Offline queue for failed syncs
 */
export class HybridLeaderboardService {
    private static instance: HybridLeaderboardService;
    
    // Memory cache for instant access
    private memoryCache: {
        leaderboardData: LeaderboardData | null;
        playerProfile: PlayerProfile | null;
        isLoaded: boolean;
    } = {
        leaderboardData: null,
        playerProfile: null,
        isLoaded: false
    };
    
    // Performance optimization
    private writeDebounceTimer: number | null = null;
    private readonly WRITE_DEBOUNCE_MS = 1000; // Batch writes every 1 second
    private readonly MAX_ENTRIES_PER_PERIOD = 50;
    
    // Sync management
    private pendingSyncs: PendingSync[] = [];
    private syncInProgress = false;
    private readonly MAX_RETRY_COUNT = 3;
    
    // Storage keys
    private readonly STORAGE_KEYS = {
        PLAYER_PROFILE: 'deadly-duel-player-profile',
        LEADERBOARD_DATA: 'deadly-duel-leaderboard-data',
        PENDING_SYNCS: 'deadly-duel-pending-syncs'
    };

    public static getInstance(): HybridLeaderboardService {
        if (!HybridLeaderboardService.instance) {
            HybridLeaderboardService.instance = new HybridLeaderboardService();
        }
        return HybridLeaderboardService.instance;
    }

    private constructor() {
        this.initializeCache();
        this.setupAuthListener();
        this.setupPeriodicSync();
    }

    /**
     * Initialize memory cache from localStorage
     * This happens once on service creation
     */
    private async initializeCache(): Promise<void> {
        try {
            // Load from localStorage into memory cache
            const profileData = localStorage.getItem(this.STORAGE_KEYS.PLAYER_PROFILE);
            const leaderboardData = localStorage.getItem(this.STORAGE_KEYS.LEADERBOARD_DATA);
            const pendingSyncs = localStorage.getItem(this.STORAGE_KEYS.PENDING_SYNCS);

            this.memoryCache.playerProfile = profileData ? JSON.parse(profileData) : this.createDefaultProfile();
            this.memoryCache.leaderboardData = leaderboardData ? JSON.parse(leaderboardData) : this.createDefaultLeaderboardData();
            this.pendingSyncs = pendingSyncs ? JSON.parse(pendingSyncs) : [];
            
            this.memoryCache.isLoaded = true;
            
            logger.debug('Hybrid LeaderboardService cache initialized');
        } catch (error) {
            console.error('Failed to initialize leaderboard cache:', error);
            // Fallback to defaults
            this.memoryCache.playerProfile = this.createDefaultProfile();
            this.memoryCache.leaderboardData = this.createDefaultLeaderboardData();
            this.memoryCache.isLoaded = true;
        }
    }

    /**
     * Listen for auth state changes to trigger sync
     */
    private setupAuthListener(): void {
        // Listen for wallet connection events to trigger sync
        if (typeof window !== 'undefined') {
            // Use EventBus to listen for wallet state changes
            EventBus.on('wallet-connected', async () => {
                logger.debug('🔄 Wallet connected - triggering leaderboard sync');
                await this.loadFromRemote();
                await this.syncWithRemote();
            });

            EventBus.on('wallet-disconnected', () => {
                logger.debug('🔄 Wallet disconnected - clearing global entries');
                this.clearGlobalEntries();
            });
        }
    }

    /**
     * Clear global entries when wallet disconnects
     */
    private clearGlobalEntries(): void {
        const data = this.getLeaderboardData();
        
        // Remove global entries from all arrays
        data.survival.allTime = data.survival.allTime.filter(entry => !entry.id.startsWith('global_'));
        data.survival.weekly = data.survival.weekly.filter(entry => !entry.id.startsWith('global_'));
        data.survival.daily = data.survival.daily.filter(entry => !entry.id.startsWith('global_'));
        
        data.timeAttack.allTime = data.timeAttack.allTime.filter(entry => !entry.id.startsWith('global_'));
        data.timeAttack.weekly = data.timeAttack.weekly.filter(entry => !entry.id.startsWith('global_'));
        data.timeAttack.daily = data.timeAttack.daily.filter(entry => !entry.id.startsWith('global_'));
        
        data.tournament.allTime = data.tournament.allTime.filter(entry => !entry.id.startsWith('global_'));
        data.tournament.weekly = data.tournament.weekly.filter(entry => !entry.id.startsWith('global_'));
        data.tournament.daily = data.tournament.daily.filter(entry => !entry.id.startsWith('global_'));

        // Clear character-specific arrays
        Object.keys(data.survival.perCharacter).forEach(char => {
            data.survival.perCharacter[char] = data.survival.perCharacter[char].filter(entry => !entry.id.startsWith('global_'));
        });
        
        Object.keys(data.timeAttack.perCharacter).forEach(char => {
            data.timeAttack.perCharacter[char] = data.timeAttack.perCharacter[char].filter(entry => !entry.id.startsWith('global_'));
        });
        
        Object.keys(data.tournament.perCharacter).forEach(char => {
            data.tournament.perCharacter[char] = data.tournament.perCharacter[char].filter(entry => !entry.id.startsWith('global_'));
        });

        this.scheduleWrite();
        logger.debug('🧹 Cleared global entries from leaderboards');
    }

    /**
     * Setup periodic background sync
     */
    private setupPeriodicSync(): void {
        // Sync every 5 minutes when wallet connected and online
        setInterval(() => {
            if (solanaWalletService.isConnected() && navigator.onLine) {
                this.syncPendingToRemote();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * INSTANT READ METHODS - Memory Only
     */
    
    public getPlayerProfile(): PlayerProfile {
        if (!this.memoryCache.isLoaded) {
            throw new Error('Leaderboard service not initialized');
        }
        return this.memoryCache.playerProfile!;
    }

    public getLeaderboardData(): LeaderboardData {
        if (!this.memoryCache.isLoaded) {
            throw new Error('Leaderboard service not initialized');
        }
        return this.memoryCache.leaderboardData!;
    }

    public getSurvivalLeaderboard(period: 'allTime' | 'weekly' | 'daily' = 'allTime', character?: string): SurvivalEntry[] {
        const data = this.getLeaderboardData();
        if (character) {
            return data.survival.perCharacter[character] || [];
        }
        return data.survival[period] || [];
    }

    public getTimeAttackLeaderboard(period: 'allTime' | 'weekly' | 'daily' = 'allTime', courseId?: string, character?: string): TimeAttackEntry[] {
        const data = this.getLeaderboardData();
        
        if (courseId) {
            return data.timeAttack.perCourse[courseId] || [];
        }
        if (character) {
            return data.timeAttack.perCharacter[character] || [];
        }
        return data.timeAttack[period] || [];
    }

    /**
     * WRITE METHODS - Memory + Async Persistence
     */

    public async addSurvivalEntry(entry: Omit<SurvivalEntry, 'id'>): Promise<void> {
        // Input validation and rate limiting
        const playerNameValidation = InputValidator.validateUsername(entry.playerName);
        if (!playerNameValidation.isValid) {
            throw new Error(`Invalid player name: ${playerNameValidation.error}`);
        }

        const characterValidation = InputValidator.validateCharacterId(entry.character);
        if (!characterValidation.isValid) {
            throw new Error(`Invalid character: ${characterValidation.error}`);
        }

        const scoreValidation = InputValidator.validateScore(entry.score);
        if (!scoreValidation.isValid) {
            throw new Error(`Invalid score: ${scoreValidation.error}`);
        }

        // Rate limiting check
        const rateLimitKey = `survival_${entry.playerName}_${Date.now() - (Date.now() % 60000)}`; // Per minute
        if (!InputValidator.checkRateLimit(rateLimitKey, 5, 60000)) {
            throw new Error('Too many survival entries submitted. Please wait before submitting again.');
        }

        // Get wallet info if connected
        const walletAddress = solanaWalletService.getPublicKey();
        const isWalletConnected = solanaWalletService.isConnected();
        
        let playerName = InputValidator.sanitizeUsername(entry.playerName);
        
        // If wallet is connected, use the username from the wallet user profile
        if (isWalletConnected && walletAddress) {
            try {
                const user = await supabaseService.getUserByWallet(walletAddress);
                if (user?.username) {
                    playerName = `${user.username} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
                } else {
                    playerName = `${entry.playerName} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
                }
            } catch (error) {
                // Fallback to original name with wallet address
                playerName = `${entry.playerName} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
            }
        }
        
        const fullEntry: SurvivalEntry = {
            ...entry,
            id: this.generateId(),
            playerName
        };

        // 1. Immediately update memory cache
        const data = this.getLeaderboardData();
        this.addToSortedArray(data.survival.allTime, fullEntry, 'score', this.MAX_ENTRIES_PER_PERIOD);
        this.addToPeriodArrays(data.survival, fullEntry, 'score');
        this.addToCharacterArray(data.survival.perCharacter, fullEntry, fullEntry.character, 'score');

        // 2. Schedule async persistence
        this.scheduleWrite();

        // 3. Queue for remote sync (only if wallet connected)
        if (isWalletConnected) {
            this.queueForSync('survival', fullEntry);
        }

        logger.debug('Survival entry added to memory cache');
    }

    public async addTimeAttackEntry(entry: Omit<TimeAttackEntry, 'id'>): Promise<void> {
        // Get wallet info if connected
        const walletAddress = solanaWalletService.getPublicKey();
        const isWalletConnected = solanaWalletService.isConnected();
        
        let playerName = entry.playerName;
        
        // If wallet is connected, use the username from the wallet user profile
        if (isWalletConnected && walletAddress) {
            try {
                const user = await supabaseService.getUserByWallet(walletAddress);
                if (user?.username) {
                    playerName = `${user.username} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
                } else {
                    playerName = `${entry.playerName} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
                }
            } catch (error) {
                // Fallback to original name with wallet address
                playerName = `${entry.playerName} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
            }
        }
        
        const fullEntry: TimeAttackEntry = {
            ...entry,
            id: this.generateId(),
            playerName
        };

        // 1. Immediately update memory cache
        const data = this.getLeaderboardData();
        this.addToSortedArray(data.timeAttack.allTime, fullEntry, 'completionTime', this.MAX_ENTRIES_PER_PERIOD, false);
        this.addToPeriodArrays(data.timeAttack, fullEntry, 'completionTime', false);
        this.addToCharacterArray(data.timeAttack.perCharacter, fullEntry, fullEntry.character, 'completionTime', false);
        this.addToCourseArray(data.timeAttack.perCourse, fullEntry, fullEntry.courseId, 'completionTime');

        // 2. Schedule async persistence
        this.scheduleWrite();

        // 3. Queue for remote sync (only if wallet connected)
        if (isWalletConnected) {
            this.queueForSync('timeAttack', fullEntry);
        }

        logger.debug('Time attack entry added to memory cache');
    }

    public async addTournamentEntry(entry: Omit<TournamentEntry, 'id'>): Promise<void> {
        // Get wallet info if connected
        const walletAddress = solanaWalletService.getPublicKey();
        const isWalletConnected = solanaWalletService.isConnected();
        
        let playerName = entry.playerName;
        
        // If wallet is connected, use the username from the wallet user profile
        if (isWalletConnected && walletAddress) {
            try {
                const user = await supabaseService.getUserByWallet(walletAddress);
                if (user?.username) {
                    playerName = `${user.username} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
                } else {
                    playerName = `${entry.playerName} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
                }
            } catch (error) {
                // Fallback to original name with wallet address
                playerName = `${entry.playerName} (${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)})`;
            }
        }
        
        const fullEntry: TournamentEntry = {
            ...entry,
            id: this.generateId(),
            playerName
        };

        // 1. Immediately update memory cache
        const data = this.getLeaderboardData();
        this.addToSortedArray(data.tournament.allTime, fullEntry, 'timestamp', 1000);
        this.addToPeriodArrays(data.tournament, fullEntry, 'timestamp');
        this.addToCharacterArray(data.tournament.perCharacter, fullEntry, fullEntry.character, 'timestamp');

        // 2. Schedule async persistence
        this.scheduleWrite();

        // 3. Queue for remote sync (only if wallet connected)
        if (isWalletConnected) {
            this.queueForSync('tournament', fullEntry);
        }

        logger.debug('Tournament entry added to memory cache');
    }

    public updateCharacterStats(characterId: string, updates: Partial<CharacterStats>): void {
        const profile = this.getPlayerProfile();
        
        if (!profile.characterStats[characterId]) {
            profile.characterStats[characterId] = this.createDefaultCharacterStats();
        }

        // Merge updates
        Object.assign(profile.characterStats[characterId], updates);
        profile.characterStats[characterId].lastPlayed = Date.now();

        // Update profile metadata
        profile.lastActive = Date.now();
        profile.totalMatches = Object.values(profile.characterStats).reduce((sum, stats) => sum + stats.matchesPlayed, 0);
        profile.totalWins = Object.values(profile.characterStats).reduce((sum, stats) => sum + stats.matchesWon, 0);
        profile.totalLosses = Object.values(profile.characterStats).reduce((sum, stats) => sum + stats.matchesLost, 0);

        // Schedule async persistence
        this.scheduleWrite();

        // Queue for remote sync
        this.queueForSync('characterStats', { characterId, updates });

        logger.debug('Character stats updated in memory cache');
    }

    /**
     * ASYNC PERSISTENCE - Debounced localStorage writes
     */
    private scheduleWrite(): void {
        // Debounce writes to avoid blocking the game thread
        if (this.writeDebounceTimer) {
            clearTimeout(this.writeDebounceTimer);
        }

        this.writeDebounceTimer = window.setTimeout(() => {
            this.writeToLocalStorage();
            this.writeDebounceTimer = null;
        }, this.WRITE_DEBOUNCE_MS);
    }

    private async writeToLocalStorage(): Promise<void> {
        try {
            // Use setTimeout to make it truly async and non-blocking
            setTimeout(() => {
                try {
                    localStorage.setItem(this.STORAGE_KEYS.PLAYER_PROFILE, JSON.stringify(this.memoryCache.playerProfile));
                    localStorage.setItem(this.STORAGE_KEYS.LEADERBOARD_DATA, JSON.stringify(this.memoryCache.leaderboardData));
                    localStorage.setItem(this.STORAGE_KEYS.PENDING_SYNCS, JSON.stringify(this.pendingSyncs));
                    logger.debug('Data written to localStorage');
                } catch (error) {
                    console.error('Failed to write to localStorage:', error);
                }
            }, 0);
        } catch (error) {
            console.error('Failed to schedule localStorage write:', error);
        }
    }

    /**
     * REMOTE SYNC - Supabase integration
     */
    private queueForSync(type: PendingSync['type'], data: any): void {
        // Only queue if wallet is connected
        if (!solanaWalletService.isConnected()) {
            return;
        }

        this.pendingSyncs.push({
            type,
            data,
            timestamp: Date.now(),
            retryCount: 0
        });

        // Try immediate sync if online
        if (navigator.onLine && !this.syncInProgress) {
            this.syncPendingToRemote();
        }
    }

    private async syncPendingToRemote(): Promise<void> {
        if (this.syncInProgress || this.pendingSyncs.length === 0) {
            return;
        }

        this.syncInProgress = true;

        try {
            // Check if wallet is connected
            if (!solanaWalletService.isConnected()) {
                return;
            }

            // Use wallet address as user ID
            const walletAddress = solanaWalletService.getPublicKey();
            if (!walletAddress) {
                return;
            }

            // Authenticate user with Supabase
            const user = await supabaseService.authenticateWithWallet(walletAddress);
            if (!user) {
                logger.debug('Failed to authenticate user with Supabase');
                return;
            }
            const batchSize = 10; // Process in small batches to avoid blocking
            const batch = this.pendingSyncs.splice(0, batchSize);

            for (const sync of batch) {
                try {
                    await this.syncSingleItem(user.id, sync);
                    logger.debug(`Synced ${sync.type} to remote`);
                } catch (error) {
                    console.error(`Failed to sync ${sync.type}:`, error);
                    
                    // Retry logic
                    sync.retryCount++;
                    if (sync.retryCount < this.MAX_RETRY_COUNT) {
                        this.pendingSyncs.push({ ...sync }); // Re-queue for retry
                    } else {
                        logger.warn(`Dropping sync item after ${this.MAX_RETRY_COUNT} retries:`, { type: sync.type, retryCount: sync.retryCount });
                    }
                }
            }
        } finally {
            this.syncInProgress = false;
        }
    }

    private async syncSingleItem(userId: string, sync: PendingSync): Promise<void> {
        switch (sync.type) {
            case 'survival':
                await supabaseService.addLeaderboardEntry({
                    user_id: userId,
                    game_mode: 'survival',
                    character_id: sync.data.character,
                    score: sync.data.score,
                    metadata: {
                        roundsCompleted: sync.data.roundsCompleted,
                        perfectRounds: sync.data.perfectRounds,
                        enemiesDefeated: sync.data.enemiesDefeated,
                        finalMultiplier: sync.data.finalMultiplier,
                        playTime: sync.data.playTime
                    }
                });
                break;

            case 'timeAttack':
                await supabaseService.addLeaderboardEntry({
                    user_id: userId,
                    game_mode: 'time_attack',
                    character_id: sync.data.character,
                    score: Math.round(sync.data.completionTime * 100), // Convert to centiseconds for scoring
                    metadata: {
                        courseId: sync.data.courseId,
                        courseName: sync.data.courseName,
                        completionTime: sync.data.completionTime,
                        medal: sync.data.medal,
                        bonusTime: sync.data.bonusTime,
                        perfectVictories: sync.data.perfectVictories
                    }
                });
                break;

            case 'tournament':
                await supabaseService.addLeaderboardEntry({
                    user_id: userId,
                    game_mode: 'tournament',
                    character_id: sync.data.character,
                    score: sync.data.completed ? 1000 : sync.data.matchesWon * 100, // Scoring system for tournaments
                    metadata: {
                        completed: sync.data.completed,
                        matchesWon: sync.data.matchesWon,
                        totalMatches: sync.data.totalMatches,
                        finalDifficulty: sync.data.finalDifficulty,
                        defeatedOpponents: sync.data.defeatedOpponents,
                        playTime: sync.data.playTime
                    }
                });
                break;

            case 'characterStats':
                await supabaseService.updateCharacterStats(userId, sync.data.characterId, {
                    matches_played: sync.data.updates.matchesPlayed,
                    wins: sync.data.updates.matchesWon,
                    losses: sync.data.updates.matchesLost,
                    survival_best_round: sync.data.updates.survivalBestRound,
                    survival_best_score: sync.data.updates.survivalBestScore,
                    tournament_wins: sync.data.updates.tournamentCompletions,
                    total_play_time: sync.data.updates.totalPlayTime
                });
                break;
        }
    }

    /**
     * PUBLIC SYNC METHODS
     */
    public async syncWithRemote(): Promise<void> {
        await this.syncPendingToRemote();
    }

    public async loadFromRemote(): Promise<void> {
        if (!solanaWalletService.isConnected()) {
            logger.debug('❌ Cannot load from remote - wallet not connected');
            return;
        }

        try {
            await this.loadAndMergeGlobalLeaderboards();
            logger.debug('✅ Successfully loaded and merged global leaderboards');
        } catch (error) {
            console.error('❌ Failed to load from remote:', error);
        }
    }

    /**
     * CROSS-PLATFORM LEADERBOARD SYNC
     */
    private async loadAndMergeGlobalLeaderboards(): Promise<void> {
        const walletAddress = solanaWalletService.getPublicKey();
        if (!walletAddress) return;

        try {
            // Load global leaderboards from Supabase
            const [survivalEntries, timeAttackEntries, tournamentEntries] = await Promise.all([
                supabaseService.getLeaderboard('survival', 100),
                supabaseService.getLeaderboard('time_attack', 100),
                supabaseService.getLeaderboard('tournament', 100)
            ]);

            // Convert and merge with local data
            await this.mergeGlobalWithLocal(survivalEntries, timeAttackEntries, tournamentEntries);
            
            // Save merged data to localStorage
            this.scheduleWrite();
            
        } catch (error) {
            console.error('Failed to load global leaderboards:', error);
        }
    }

    private async mergeGlobalWithLocal(
        globalSurvival: any[],
        globalTimeAttack: any[],
        globalTournament: any[]
    ): Promise<void> {
        const data = this.getLeaderboardData();

        // Convert Supabase entries to local format and merge
        const convertedSurvival = globalSurvival.map(entry => this.convertSupabaseToSurvival(entry));
        const convertedTimeAttack = globalTimeAttack.map(entry => this.convertSupabaseToTimeAttack(entry));
        const convertedTournament = globalTournament.map(entry => this.convertSupabaseToTournament(entry));

        // Merge survival leaderboards
        this.mergeLeaderboardArrays(data.survival.allTime, convertedSurvival, 'score');
        this.redistributeToPeriods(data.survival, 'score');

        // Merge time attack leaderboards  
        this.mergeLeaderboardArrays(data.timeAttack.allTime, convertedTimeAttack, 'completionTime', false);
        this.redistributeToPeriods(data.timeAttack, 'completionTime', false);

        // Merge tournament leaderboards
        this.mergeLeaderboardArrays(data.tournament.allTime, convertedTournament, 'timestamp');
        this.redistributeToPeriods(data.tournament, 'timestamp');

        // Update character-specific leaderboards
        this.redistributeToCharacters(data);

        data.lastUpdated = Date.now();
        logger.debug('🔄 Merged global and local leaderboard data');
    }

    private convertSupabaseToSurvival(entry: any): SurvivalEntry {
        return {
            id: `global_${entry.id}`,
            playerName: `🌐 ${entry.users?.username || 'Global Player'} (${entry.users?.wallet_address?.slice(-4) || '????'})`,
            character: entry.character_id,
            score: entry.score,
            roundsCompleted: entry.metadata?.roundsCompleted || 0,
            perfectRounds: entry.metadata?.perfectRounds || 0,
            enemiesDefeated: entry.metadata?.enemiesDefeated || 0,
            finalMultiplier: entry.metadata?.finalMultiplier || 1,
            timestamp: new Date(entry.created_at).getTime(),
            playTime: entry.metadata?.playTime || 0
        };
    }

    private convertSupabaseToTimeAttack(entry: any): TimeAttackEntry {
        return {
            id: `global_${entry.id}`,
            playerName: `🌐 ${entry.users?.username || 'Global Player'} (${entry.users?.wallet_address?.slice(-4) || '????'})`,
            character: entry.character_id,
            courseId: entry.metadata?.courseId || 'unknown',
            courseName: entry.metadata?.courseName || 'Unknown Course',
            completionTime: entry.metadata?.completionTime || (entry.score / 100), // Convert from centiseconds
            medal: entry.metadata?.medal || 'None',
            bonusTime: entry.metadata?.bonusTime || 0,
            perfectVictories: entry.metadata?.perfectVictories || 0,
            timestamp: new Date(entry.created_at).getTime()
        };
    }

    private convertSupabaseToTournament(entry: any): TournamentEntry {
        return {
            id: `global_${entry.id}`,
            playerName: `🌐 ${entry.users?.username || 'Global Player'} (${entry.users?.wallet_address?.slice(-4) || '????'})`,
            character: entry.character_id,
            completed: entry.metadata?.completed || false,
            matchesWon: entry.metadata?.matchesWon || 0,
            totalMatches: entry.metadata?.totalMatches || 5,
            finalDifficulty: entry.metadata?.finalDifficulty || 1,
            defeatedOpponents: entry.metadata?.defeatedOpponents || [],
            timestamp: new Date(entry.created_at).getTime(),
            playTime: entry.metadata?.playTime || 0
        };
    }

    private mergeLeaderboardArrays<T>(
        localArray: T[],
        globalArray: T[],
        sortKey: keyof T,
        descending = true
    ): void {
        // Remove any existing global entries to avoid duplicates
        const filteredLocal = localArray.filter(entry => !(entry as any).id.startsWith('global_'));
        
        // Combine local and global
        const combined = [...filteredLocal, ...globalArray];
        
        // Sort combined array
        combined.sort((a, b) => {
            const aVal = a[sortKey] as number;
            const bVal = b[sortKey] as number;
            return descending ? bVal - aVal : aVal - bVal;
        });

        // Update the original array with top entries
        localArray.length = 0;
        localArray.push(...combined.slice(0, this.MAX_ENTRIES_PER_PERIOD));
    }

    private redistributeToPeriods<T extends { timestamp: number }>(
        periodData: { weekly: T[]; daily: T[]; allTime: T[] },
        sortKey: keyof T,
        descending = true
    ): void {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        // Clear existing period arrays
        periodData.weekly = [];
        periodData.daily = [];

        // Redistribute from allTime based on timestamps
        periodData.allTime.forEach(item => {
            if (now - item.timestamp < dayMs) {
                periodData.daily.push(item);
            }
            if (now - item.timestamp < weekMs) {
                periodData.weekly.push(item);
            }
        });

        // Sort period arrays
        const sortFn = (a: T, b: T) => {
            const aVal = a[sortKey] as number;
            const bVal = b[sortKey] as number;
            return descending ? bVal - aVal : aVal - bVal;
        };

        periodData.daily.sort(sortFn);
        periodData.weekly.sort(sortFn);

        // Limit sizes
        periodData.daily = periodData.daily.slice(0, this.MAX_ENTRIES_PER_PERIOD);
        periodData.weekly = periodData.weekly.slice(0, this.MAX_ENTRIES_PER_PERIOD);
    }

    private redistributeToCharacters(data: LeaderboardData): void {
        // Clear existing character arrays
        data.survival.perCharacter = {};
        data.timeAttack.perCharacter = {};
        data.tournament.perCharacter = {};

        // Redistribute survival entries by character
        data.survival.allTime.forEach(entry => {
            if (!data.survival.perCharacter[entry.character]) {
                data.survival.perCharacter[entry.character] = [];
            }
            data.survival.perCharacter[entry.character].push(entry);
        });

        // Redistribute time attack entries by character
        data.timeAttack.allTime.forEach(entry => {
            if (!data.timeAttack.perCharacter[entry.character]) {
                data.timeAttack.perCharacter[entry.character] = [];
            }
            data.timeAttack.perCharacter[entry.character].push(entry);
        });

        // Redistribute tournament entries by character
        data.tournament.allTime.forEach(entry => {
            if (!data.tournament.perCharacter[entry.character]) {
                data.tournament.perCharacter[entry.character] = [];
            }
            data.tournament.perCharacter[entry.character].push(entry);
        });

        // Sort character arrays and limit sizes
        Object.keys(data.survival.perCharacter).forEach(char => {
            data.survival.perCharacter[char].sort((a, b) => b.score - a.score);
            data.survival.perCharacter[char] = data.survival.perCharacter[char].slice(0, this.MAX_ENTRIES_PER_PERIOD);
        });

        Object.keys(data.timeAttack.perCharacter).forEach(char => {
            data.timeAttack.perCharacter[char].sort((a, b) => a.completionTime - b.completionTime);
            data.timeAttack.perCharacter[char] = data.timeAttack.perCharacter[char].slice(0, this.MAX_ENTRIES_PER_PERIOD);
        });

        Object.keys(data.tournament.perCharacter).forEach(char => {
            data.tournament.perCharacter[char].sort((a, b) => b.timestamp - a.timestamp);
            data.tournament.perCharacter[char] = data.tournament.perCharacter[char].slice(0, this.MAX_ENTRIES_PER_PERIOD);
        });
    }

    /**
     * Get mixed global/local leaderboard with indicators
     */
    public getMixedLeaderboard(
        mode: 'survival' | 'timeAttack' | 'tournament',
        period: 'allTime' | 'weekly' | 'daily' = 'allTime',
        character?: string
    ): any[] {
        let entries: any[] = [];

        switch (mode) {
            case 'survival':
                entries = this.getSurvivalLeaderboard(period, character);
                break;
            case 'timeAttack':
                entries = this.getTimeAttackLeaderboard(period, undefined, character);
                break;
            case 'tournament': {
                const data = this.getLeaderboardData();
                if (character) {
                    entries = data.tournament.perCharacter[character] || [];
                } else {
                    entries = data.tournament[period] || [];
                }
            }
                break;
        }

        // Add type indicators to entries
        return entries.map(entry => ({
            ...entry,
            isGlobal: entry.id.startsWith('global_'),
            isLocal: !entry.id.startsWith('global_')
        }));
    }

    /**
     * UTILITY METHODS
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private addToSortedArray<T>(array: T[], item: T, sortKey: keyof T, maxLength: number, descending = true): void {
        array.push(item);
        array.sort((a, b) => {
            const aVal = a[sortKey] as number;
            const bVal = b[sortKey] as number;
            return descending ? bVal - aVal : aVal - bVal;
        });
        if (array.length > maxLength) {
            array.splice(maxLength);
        }
    }

    private addToPeriodArrays<T extends { timestamp: number }>(
        periodData: { weekly: T[]; daily: T[] },
        item: T,
        sortKey: keyof T,
        descending = true
    ): void {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekMs = 7 * dayMs;

        if (now - item.timestamp < dayMs) {
            this.addToSortedArray(periodData.daily, item, sortKey, this.MAX_ENTRIES_PER_PERIOD, descending);
        }
        if (now - item.timestamp < weekMs) {
            this.addToSortedArray(periodData.weekly, item, sortKey, this.MAX_ENTRIES_PER_PERIOD, descending);
        }
    }

    private addToCharacterArray<T>(
        characterData: Record<string, T[]>,
        item: T,
        character: string,
        sortKey: keyof T,
        descending = true
    ): void {
        if (!characterData[character]) {
            characterData[character] = [];
        }
        this.addToSortedArray(characterData[character], item, sortKey, this.MAX_ENTRIES_PER_PERIOD, descending);
    }

    private addToCourseArray(
        courseData: Record<string, TimeAttackEntry[]>,
        item: TimeAttackEntry,
        courseId: string,
        sortKey: keyof TimeAttackEntry
    ): void {
        if (!courseData[courseId]) {
            courseData[courseId] = [];
        }
        this.addToSortedArray(courseData[courseId], item, sortKey, this.MAX_ENTRIES_PER_PERIOD, false);
    }

    private createDefaultProfile(): PlayerProfile {
        return {
            id: this.generateId(),
            playerName: 'Anonymous',
            createdAt: Date.now(),
            lastActive: Date.now(),
            totalMatches: 0,
            totalWins: 0,
            totalLosses: 0,
            totalPlayTime: 0,
            favoriteCharacter: 'Rocco',
            currentWinStreak: 0,
            bestWinStreak: 0,
            achievementIds: [],
            characterStats: {},
            preferredGameMode: 'normal',
            settings: {
                showDebug: false,
                preferredDifficulty: 'normal',
                soundEnabled: true,
                musicEnabled: true
            }
        };
    }

    private createDefaultCharacterStats(): CharacterStats {
        return {
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            survivalBestRound: 0,
            survivalBestScore: 0,
            survivalTotalScore: 0,
            timeAttackBestTimes: {},
            timeAttackCompletions: 0,
            tournamentCompletions: 0,
            perfectRounds: 0,
            totalDamageDealt: 0,
            totalDamageTaken: 0,
            totalPlayTime: 0,
            winStreak: 0,
            bestWinStreak: 0,
            lastPlayed: Date.now()
        };
    }

    private createDefaultLeaderboardData(): LeaderboardData {
        return {
            survival: {
                allTime: [],
                weekly: [],
                daily: [],
                perCharacter: {}
            },
            timeAttack: {
                allTime: [],
                weekly: [],
                daily: [],
                perCharacter: {},
                perCourse: {}
            },
            tournament: {
                allTime: [],
                weekly: [],
                daily: [],
                perCharacter: {}
            },
            lastUpdated: Date.now()
        };
    }

    /**
     * Performance monitoring
     */
    public getPerformanceStats(): { cacheSize: number; pendingSyncs: number } {
        const cacheSize = JSON.stringify(this.memoryCache).length;
        return {
            cacheSize,
            pendingSyncs: this.pendingSyncs.length
        };
    }

    /**
     * UTILITY METHODS
     */
    public formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        if (minutes > 0) {
            return `${minutes}:${secs.padStart(5, '0')}`;
        }
        return `${secs}s`;
    }

    public formatScore(score: number): string {
        return score.toLocaleString();
    }

    /**
     * Manual cleanup for testing
     */
    public clearCache(): void {
        this.memoryCache.leaderboardData = this.createDefaultLeaderboardData();
        this.memoryCache.playerProfile = this.createDefaultProfile();
        this.pendingSyncs = [];
        this.scheduleWrite();
    }
}

// Export singleton instance
export const hybridLeaderboardService = HybridLeaderboardService.getInstance();
export default hybridLeaderboardService;