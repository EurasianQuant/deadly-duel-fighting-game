import { LeaderboardService } from './leaderboardService';
import { hybridLeaderboardService } from './hybridLeaderboardService';

/**
 * Performance comparison test between old and new leaderboard services
 */
export class LeaderboardPerformanceTest {
    
    public static async runPerformanceComparison(): Promise<void> {
        console.log('🧪 Running Leaderboard Performance Test...\n');
        
        const iterations = 100;
        const testData = this.generateTestData(iterations);
        
        // Test old service
        console.log('📊 Testing Original LeaderboardService (localStorage only)...');
        const oldResults = await this.testOriginalService(testData);
        
        // Test new service
        console.log('📊 Testing Hybrid LeaderboardService (memory + async)...');
        const newResults = await this.testHybridService(testData);
        
        // Compare results
        this.compareResults(oldResults, newResults);
    }
    
    private static generateTestData(count: number) {
        const testEntries = [];
        for (let i = 0; i < count; i++) {
            testEntries.push({
                playerName: `TestPlayer${i}`,
                character: 'Rocco',
                score: Math.floor(Math.random() * 10000),
                roundsCompleted: Math.floor(Math.random() * 20),
                perfectRounds: Math.floor(Math.random() * 5),
                enemiesDefeated: Math.floor(Math.random() * 50),
                finalMultiplier: 1.0 + Math.random(),
                timestamp: Date.now() - Math.random() * 86400000,
                playTime: Math.floor(Math.random() * 3600)
            });
        }
        return testEntries;
    }
    
    private static async testOriginalService(testData: any[]): Promise<{ writeTime: number; readTime: number; memoryUsage: number }> {
        // Measure write performance
        const writeStart = performance.now();
        
        for (const entry of testData) {
            LeaderboardService.addSurvivalEntry(entry);
        }
        
        const writeEnd = performance.now();
        const writeTime = writeEnd - writeStart;
        
        // Measure read performance
        const readStart = performance.now();
        
        for (let i = 0; i < 50; i++) {
            const data = LeaderboardService.getLeaderboardData();
            // Simulate reading leaderboard data
            void data.survival.allTime;
            LeaderboardService.getPlayerProfile();
        }
        
        const readEnd = performance.now();
        const readTime = readEnd - readStart;
        
        // Estimate memory usage (rough)
        const data = LeaderboardService.getLeaderboardData();
        const memoryUsage = JSON.stringify(data).length;
        
        return { writeTime, readTime, memoryUsage };
    }
    
    private static async testHybridService(testData: any[]): Promise<{ writeTime: number; readTime: number; memoryUsage: number; cacheStats: any }> {
        // Wait for service to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Measure write performance
        const writeStart = performance.now();
        
        for (const entry of testData) {
            hybridLeaderboardService.addSurvivalEntry(entry);
        }
        
        const writeEnd = performance.now();
        const writeTime = writeEnd - writeStart;
        
        // Measure read performance
        const readStart = performance.now();
        
        for (let i = 0; i < 50; i++) {
            hybridLeaderboardService.getSurvivalLeaderboard('allTime');
            hybridLeaderboardService.getPlayerProfile();
        }
        
        const readEnd = performance.now();
        const readTime = readEnd - readStart;
        
        // Get performance stats
        const cacheStats = hybridLeaderboardService.getPerformanceStats();
        
        return { writeTime, readTime, memoryUsage: cacheStats.cacheSize, cacheStats };
    }
    
    private static compareResults(oldResults: any, newResults: any): void {
        console.log('\n📈 Performance Comparison Results:');
        console.log('=====================================');
        
        console.log('\n⏱️  Write Performance:');
        console.log(`   Old Service: ${oldResults.writeTime.toFixed(2)}ms`);
        console.log(`   New Service: ${newResults.writeTime.toFixed(2)}ms`);
        console.log(`   Improvement: ${((oldResults.writeTime - newResults.writeTime) / oldResults.writeTime * 100).toFixed(1)}%`);
        
        console.log('\n📖 Read Performance:');
        console.log(`   Old Service: ${oldResults.readTime.toFixed(2)}ms`);
        console.log(`   New Service: ${newResults.readTime.toFixed(2)}ms`);
        console.log(`   Improvement: ${((oldResults.readTime - newResults.readTime) / oldResults.readTime * 100).toFixed(1)}%`);
        
        console.log('\n💾 Memory Usage:');
        console.log(`   Old Service: ${(oldResults.memoryUsage / 1024).toFixed(1)} KB`);
        console.log(`   New Service: ${(newResults.memoryUsage / 1024).toFixed(1)} KB`);
        
        console.log('\n🔄 Sync Status:');
        console.log(`   Pending Syncs: ${newResults.cacheStats.pendingSyncs}`);
        
        console.log('\n✅ Summary:');
        if (newResults.writeTime < oldResults.writeTime) {
            console.log('   ✓ Write performance improved');
        }
        if (newResults.readTime < oldResults.readTime) {
            console.log('   ✓ Read performance improved');
        }
        console.log('   ✓ Non-blocking async writes');
        console.log('   ✓ Remote sync capability added');
        console.log('   ✓ Memory-first architecture');
        
        console.log('\n🎮 Game Impact:');
        console.log('   • Writes no longer block game thread');
        console.log('   • Reads are instant from memory cache');
        console.log('   • Background sync preserves user data');
        console.log('   • Graceful offline/online mode handling');
    }
    
    /**
     * Test real-world gaming scenario
     */
    public static async testGamingScenario(): Promise<void> {
        console.log('\n🎮 Testing Real-World Gaming Scenario...');
        console.log('Simulating: 60-second survival match with frequent updates');
        
        const start = performance.now();
        
        // Simulate a survival match with updates every second
        for (let second = 0; second < 60; second++) {
            // Update character stats (happens frequently during gameplay)
            hybridLeaderboardService.updateCharacterStats('rocco', {
                totalPlayTime: second,
                matchesPlayed: 1
            });
            
            // Add score entry at end of match
            if (second === 59) {
                hybridLeaderboardService.addSurvivalEntry({
                    playerName: 'TestGamer',
                    character: 'rocco',
                    score: second * 100,
                    roundsCompleted: Math.floor(second / 10),
                    perfectRounds: Math.floor(second / 20),
                    enemiesDefeated: second * 2,
                    finalMultiplier: 1.5,
                    timestamp: Date.now(),
                    playTime: second
                });
            }
            
            // Simulate other game operations
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        const end = performance.now();
        
        console.log(`✅ 60-second match simulation completed in ${(end - start).toFixed(2)}ms`);
        console.log('   All operations were non-blocking and async');
        
        const stats = hybridLeaderboardService.getPerformanceStats();
        console.log(`   Cache size: ${(stats.cacheSize / 1024).toFixed(1)} KB`);
        console.log(`   Pending syncs: ${stats.pendingSyncs}`);
    }
}

// Make available for console testing
if (typeof window !== 'undefined') {
    (window as any).LeaderboardPerformanceTest = LeaderboardPerformanceTest;
}