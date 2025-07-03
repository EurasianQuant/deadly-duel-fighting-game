// Performance monitoring utilities

import { logger } from "./logger";
import type { PerformanceMetrics } from "@/types/game";

class PerformanceMonitor {
    private metrics: PerformanceMetrics = {
        fps: 60,
        frameTime: 16.67,
        renderTime: 0,
        physicsTime: 0,
    };

    private frameCount = 0;
    private lastFpsUpdate = 0;
    private isMonitoring = false;

    constructor() {
        if (process.env.NODE_ENV === 'development') {
            this.startMonitoring();
        }
    }

    startMonitoring(): void {
        if (this.isMonitoring) return;
        this.isMonitoring = true;

        const updateFPS = () => {
            if (!this.isMonitoring) return;

            this.frameCount++;
            const now = performance.now();

            if (now - this.lastFpsUpdate >= 1000) {
                this.metrics.fps = this.frameCount;
                this.metrics.frameTime = 1000 / this.frameCount;
                this.frameCount = 0;
                this.lastFpsUpdate = now;

                // Log performance issues
                if (this.metrics.fps < 30) {
                    logger.warn("Low FPS detected", { fps: this.metrics.fps });
                } else if (this.metrics.fps < 45) {
                    logger.debug("FPS below target", { fps: this.metrics.fps });
                }
            }

            requestAnimationFrame(updateFPS);
        };

        requestAnimationFrame(updateFPS);
    }

    stopMonitoring(): void {
        this.isMonitoring = false;
    }

    measureOperation<T>(operationName: string, operation: () => T): T {
        const start = performance.now();
        const result = operation();
        const duration = performance.now() - start;

        logger.performance(operationName, duration);

        // Warn about slow operations
        if (duration > 16.67) { // More than one frame at 60fps
            logger.warn(`Slow operation detected: ${operationName}`, { duration });
        }

        return result;
    }

    async measureAsyncOperation<T>(operationName: string, operation: () => Promise<T>): Promise<T> {
        const start = performance.now();
        const result = await operation();
        const duration = performance.now() - start;

        logger.performance(operationName, duration);
        return result;
    }

    updateRenderTime(time: number): void {
        this.metrics.renderTime = time;
    }

    updatePhysicsTime(time: number): void {
        this.metrics.physicsTime = time;
    }

    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    getMemoryUsage(): number | undefined {
        if ('memory' in performance) {
            return (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return undefined;
    }

    // Performance utilities for Phaser
    measureSceneUpdate(scene: Phaser.Scene, originalUpdate: (time: number, delta: number) => void): (time: number, delta: number) => void {
        return function(this: Phaser.Scene, time: number, delta: number) {
            const start = performance.now();
            originalUpdate.call(this, time, delta);
            const duration = performance.now() - start;

            if (duration > 5) { // More than 5ms
                logger.debug(`Scene update took ${duration.toFixed(2)}ms`, {
                    scene: scene.scene.key,
                    duration
                });
            }
        };
    }

    // Export performance data for debugging
    exportMetrics(): string {
        const fullMetrics = {
            ...this.metrics,
            memoryUsage: this.getMemoryUsage(),
            timestamp: Date.now(),
        };

        return JSON.stringify(fullMetrics, null, 2);
    }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Development helpers
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).performanceMonitor = performanceMonitor;
}