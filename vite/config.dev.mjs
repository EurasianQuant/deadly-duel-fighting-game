import path from "path";
import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "../src"),
        },
    },
    server: {
        port: 8080,
    },
    define: {
        global: 'globalThis',
        'process.env': {},
    },
    optimizeDeps: {
        include: [
            '@solana/web3.js',
            '@solana/spl-token'
        ]
    }
});

