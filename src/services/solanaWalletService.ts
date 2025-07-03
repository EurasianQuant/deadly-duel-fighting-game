// Solana Wallet Service for Deadly Duel
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import debug from '@/lib/debug';
import EventBus from '@/lib/EventBus';

// Wallet adapter interface
interface WalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signTransaction?(transaction: Transaction): Promise<Transaction>;
  signAllTransactions?(transactions: Transaction[]): Promise<Transaction[]>;
}

// Wallet state interface
export interface SolanaWalletState {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  walletType: string | null;
  balance: number | null;
  error: string | null;
}

export class SolanaWalletService {
  private static instance: SolanaWalletService;
  private connection: Connection;
  private wallet: WalletAdapter | null = null;
  private rpcEndpoints = [
    import.meta.env.VITE_SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com',
    import.meta.env.VITE_SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
  ];
  private currentEndpointIndex = 0;
  private state: SolanaWalletState = {
    connected: false,
    connecting: false,
    publicKey: null,
    walletType: null,
    balance: null,
    error: null
  };
  private listeners: Array<(state: SolanaWalletState) => void> = [];

  static getInstance(): SolanaWalletService {
    if (!SolanaWalletService.instance) {
      SolanaWalletService.instance = new SolanaWalletService();
    }
    return SolanaWalletService.instance;
  }

  private constructor() {
    this.connection = new Connection(
      this.rpcEndpoints[this.currentEndpointIndex],
      'confirmed'
    );
    this.detectWallets();
  }

  // State management
  public getState(): SolanaWalletState {
    return { ...this.state };
  }

  public subscribe(listener: (state: SolanaWalletState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private setState(updates: Partial<SolanaWalletState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
    
    // Emit EventBus events for global state synchronization
    EventBus.emit('wallet-state-changed', this.state);
    
    if (updates.connected !== undefined) {
      if (updates.connected) {
        EventBus.emit('wallet-connected', this.state);
      } else {
        EventBus.emit('wallet-disconnected', {});
      }
    }
  }

  // Wallet detection
  private detectWallets(): void {
    const phantom = ('phantom' in window) ? (window as any).phantom?.solana : null;
    
    if (phantom?.isPhantom) {
      debug.general('✅ Phantom wallet detected');
    } else {
      debug.general('❌ No Phantom wallet detected');
    }
  }

  // Get available wallets
  public getAvailableWallets(): Array<{name: string, detected: boolean}> {
    const phantom = ('phantom' in window) ? (window as any).phantom?.solana : null;
    
    return [
      { name: 'Phantom', detected: !!phantom?.isPhantom }
    ];
  }

  // Connect to Phantom wallet
  public async connect(): Promise<void> {
    this.setState({ connecting: true, error: null });

    try {
      const walletAdapter = await this.connectPhantom();

      if (walletAdapter && walletAdapter.publicKey) {
        this.wallet = walletAdapter;
        const publicKeyString = walletAdapter.publicKey.toString();
        
        this.setState({
          connected: true,
          connecting: false,
          publicKey: publicKeyString,
          walletType: 'Phantom',
          balance: null,
          error: null
        });

        debug.general(`✅ Connected to Phantom:`, publicKeyString);
        
        // Authenticate with Supabase immediately after connection
        try {
          const { supabaseService } = await import('@/services/supabaseService');
          debug.general('🔄 Attempting to authenticate wallet with Supabase...');
          const user = await supabaseService.authenticateWithWallet(publicKeyString);
          if (user) {
            debug.general('✅ Wallet authenticated with Supabase successfully');
          } else {
            debug.general('❌ Failed to authenticate wallet with Supabase');
          }
        } catch (error) {
          debug.general('❌ Error during Supabase authentication:', error);
        }
        
        // Try to fetch balance, but don't fail if it doesn't work
        try {
          await this.refreshBalance();
        } catch (error) {
          debug.general('⚠️ Could not fetch balance, but wallet connected successfully');
          // Balance will remain null, which is fine
        }
      } else {
        throw new Error('Failed to connect to wallet');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      debug.general('❌ Wallet connection error:', errorMessage);
      this.setState({
        connecting: false,
        error: errorMessage
      });
      throw error;
    }
  }

  // Disconnect wallet
  public async disconnect(): Promise<void> {
    try {
      if (this.wallet) {
        await this.wallet.disconnect();
      }
      
      this.wallet = null;
      this.setState({
        connected: false,
        connecting: false,
        publicKey: null,
        walletType: null,
        balance: null,
        error: null
      });

      debug.general('✅ Wallet disconnected');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      debug.general('❌ Wallet disconnect error:', errorMessage);
      this.setState({ error: errorMessage });
    }
  }

  // Phantom wallet connection
  private async connectPhantom(): Promise<WalletAdapter | null> {
    if (!('phantom' in window)) {
      throw new Error('Phantom wallet not found. Please install Phantom.');
    }

    const phantom = (window as any).phantom?.solana;
    
    if (!phantom?.isPhantom) {
      throw new Error('Phantom wallet not found. Please install Phantom.');
    }

    try {
      const response = await phantom.connect();
      
      if (!response.publicKey) {
        throw new Error('Phantom wallet connection failed. Please try again.');
      }

      const publicKeyString = response.publicKey.toString();
      if (!publicKeyString || publicKeyString.length < 20) {
        throw new Error('Invalid wallet response. Please try again.');
      }

      debug.general('✅ Connected to Phantom:', publicKeyString);
      
      return {
        publicKey: response.publicKey,
        connected: true,
        connect: () => phantom.connect(),
        disconnect: () => phantom.disconnect(),
        signTransaction: phantom.signTransaction,
        signAllTransactions: phantom.signAllTransactions
      };
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('User rejected Phantom connection');
      } else if (error.code === -32002) {
        throw new Error('Phantom connection request already pending');
      }
      throw new Error(`Phantom connection failed: ${error.message || 'Unknown error'}`);
    }
  }

  // Utility methods
  public isConnected(): boolean {
    return this.state.connected;
  }

  public getPublicKey(): string | null {
    return this.state.publicKey;
  }

  public getBalance(): number | null {
    return this.state.balance;
  }

  public getWalletType(): string | null {
    return this.state.walletType;
  }

  public getShortAddress(): string | null {
    if (!this.state.publicKey) return null;
    return `${this.state.publicKey.slice(0, 4)}...${this.state.publicKey.slice(-4)}`;
  }

  // Refresh balance with simple retry
  public async refreshBalance(): Promise<void> {
    if (!this.wallet?.publicKey) return;

    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      this.setState({
        balance: balance / 1000000000 // Convert lamports to SOL
      });
      debug.general(`✅ Balance updated: ${balance / 1000000000} SOL`);
    } catch (error: any) {
      debug.general('⚠️ Could not fetch balance:', error.message);
      // Don't retry aggressively, just set balance to null
      this.setState({ balance: null });
    }
  }

  // Clear error state
  public clearError(): void {
    if (this.state.error && !this.state.connected && !this.state.connecting) {
      this.setState({ error: null });
      debug.general('🧹 Cleared stale wallet error state');
    }
  }

  // Try next RPC endpoint on failure
  private async tryNextEndpoint(): Promise<boolean> {
    const nextIndex = (this.currentEndpointIndex + 1) % this.rpcEndpoints.length;
    
    if (nextIndex === this.currentEndpointIndex) {
      return false;
    }
    
    this.currentEndpointIndex = nextIndex;
    const newEndpoint = this.rpcEndpoints[this.currentEndpointIndex];
    this.connection = new Connection(newEndpoint, 'confirmed');
    
    debug.general(`🔄 Switching to RPC endpoint: ${newEndpoint}`);
    return true;
  }

  // Sign transaction (for future use)
  public async signTransaction(transaction: Transaction): Promise<Transaction> {
    if (!this.wallet?.signTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }
    
    return await this.wallet.signTransaction(transaction);
  }
}

// Export singleton instance
export const solanaWalletService = SolanaWalletService.getInstance();
export default solanaWalletService;