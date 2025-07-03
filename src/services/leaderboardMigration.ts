import { LeaderboardService } from './leaderboardService';
import { hybridLeaderboardService } from './hybridLeaderboardService';
import { logger } from '@/lib/logger';

/**
 * Migration utility to transition from old localStorage-only LeaderboardService
 * to new HybridLeaderboardService with memory cache + remote sync
 */
export class LeaderboardMigration {
    private static migrationKey = 'deadly-duel-migration-v1';

    /**
     * Check if migration is needed and perform it
     */
    public static async performMigration(): Promise<void> {
        const migrationDone = localStorage.getItem(this.migrationKey);
        
        if (migrationDone) {
            logger.debug('Leaderboard migration already completed');
            return;
        }

        try {
            logger.debug('Starting leaderboard migration...');
            
            // Get existing data from old service
            const oldProfile = LeaderboardService.getPlayerProfile();
            const oldLeaderboard = LeaderboardService.getLeaderboardData();
            
            // The hybrid service will automatically initialize with localStorage data
            // So we just need to mark migration as complete
            
            // Verify the migration worked
            const newProfile = hybridLeaderboardService.getPlayerProfile();
            const newLeaderboard = hybridLeaderboardService.getLeaderboardData();
            
            const profileMigrated = newProfile.totalMatches >= oldProfile.totalMatches;
            const leaderboardMigrated = newLeaderboard.survival.allTime.length >= oldLeaderboard.survival.allTime.length;
            
            if (profileMigrated && leaderboardMigrated) {
                localStorage.setItem(this.migrationKey, Date.now().toString());
                logger.debug('Leaderboard migration completed successfully');
            } else {
                throw new Error('Migration verification failed');
            }
            
        } catch (error) {
            console.error('Leaderboard migration failed:', error);
            // Don't block the game if migration fails
            localStorage.setItem(this.migrationKey, Date.now().toString());
        }
    }

    /**
     * Force a fresh migration (for testing)
     */
    public static async forceMigration(): Promise<void> {
        localStorage.removeItem(this.migrationKey);
        await this.performMigration();
    }

    /**
     * Get migration status
     */
    public static getMigrationStatus(): { completed: boolean; timestamp?: number } {
        const migrationData = localStorage.getItem(this.migrationKey);
        
        if (migrationData) {
            return {
                completed: true,
                timestamp: parseInt(migrationData, 10)
            };
        }
        
        return { completed: false };
    }
}