import React, { useState } from 'react';
import { LeaderboardPerformanceTest } from '@/services/performanceTest';

export function PerformanceTest() {
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<string | null>(null);

    const runTest = async () => {
        setIsRunning(true);
        setResults(null);
        
        try {
            // Capture console output
            const originalLog = console.log;
            let output = '';
            console.log = (...args) => {
                output += args.join(' ') + '\n';
                originalLog(...args);
            };

            await LeaderboardPerformanceTest.runPerformanceComparison();
            await LeaderboardPerformanceTest.testGamingScenario();
            
            // Restore console.log
            console.log = originalLog;
            
            setResults(output);
        } catch (error) {
            setResults(`Error: ${error}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="fixed top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg max-w-md z-50">
            <h3 className="text-lg font-bold mb-2">🧪 Performance Test</h3>
            <button
                onClick={runTest}
                disabled={isRunning}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded mb-2"
            >
                {isRunning ? 'Running...' : 'Test Hybrid Service'}
            </button>
            
            {results && (
                <div className="mt-2 max-h-64 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap">{results}</pre>
                </div>
            )}
            
            <div className="text-xs text-gray-400 mt-2">
                This tests the performance difference between the old localStorage-only 
                service and the new memory-first hybrid service.
            </div>
        </div>
    );
}

export default PerformanceTest;