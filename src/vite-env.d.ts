/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_SOLANA_DEVNET_RPC: string;
    readonly VITE_SOLANA_MAINNET_RPC: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

