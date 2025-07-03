// Supabase Service for Deadly Duel
import { supabase } from '@/config/supabase';
import debug from '@/lib/debug';

// Database table interfaces
export interface UserProfile {
  id: string;
  wallet_address?: string;
  email?: string;
  username?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  game_mode: 'survival' | 'time_attack' | 'tournament';
  character_id: string;
  score: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserCharacterStats {
  id: string;
  user_id: string;
  character_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  survival_best_round: number;
  survival_best_score: number;
  tournament_wins: number;
  total_play_time: number;
  created_at: string;
  updated_at: string;
}

export class SupabaseService {
  private static instance: SupabaseService;
  private currentWalletAddress: string | null = null;
  
  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private constructor() {
    // Initialize any auth listeners or other setup
    this.setupAuthListener();
  }

  private setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
      debug.general('Supabase auth state changed:', event, session?.user?.id);
    });
  }

  // Security: Set wallet context for RLS policies
  async setWalletContext(walletAddress: string): Promise<void> {
    try {
      this.currentWalletAddress = walletAddress;
      
      // Call the set_wallet_context function to establish security context
      const { error } = await supabase.rpc('set_wallet_context', {
        wallet_addr: walletAddress
      });

      if (error) {
        debug.general('❌ Failed to set wallet context:', error);
        throw new Error(`Failed to set security context: ${error.message}`);
      }

      debug.general('✅ Wallet security context set for:', walletAddress);
    } catch (error) {
      debug.general('❌ Error setting wallet context:', error);
      throw error;
    }
  }

  // Clear wallet context when disconnecting
  clearWalletContext(): void {
    this.currentWalletAddress = null;
    debug.general('🔄 Wallet context cleared');
  }

  // Get current wallet address
  getCurrentWalletAddress(): string | null {
    return this.currentWalletAddress;
  }

  // User Profile Management
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        debug.general('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      debug.general('Error in getUserProfile:', error);
      return null;
    }
  }

  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([profile])
        .select()
        .single();

      if (error) {
        debug.general('Error creating user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      debug.general('Error in createUserProfile:', error);
      return null;
    }
  }

  // Authenticate or create user with wallet address
  async authenticateWithWallet(walletAddress: string, username?: string): Promise<UserProfile | null> {
    try {
      debug.general('🔄 Attempting to authenticate wallet:', walletAddress);
      console.log('🔍 SUPABASE: Starting authentication for wallet:', walletAddress);
      
      // First, try to find existing user in Supabase
      console.log('🔍 SUPABASE: Querying for existing user...');
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no rows found

      console.log('🔍 SUPABASE: Query result:', { existingUser, fetchError });

      if (existingUser && !fetchError) {
        debug.general('✅ Found existing user in Supabase:', walletAddress);
        console.log('✅ SUPABASE: Found existing user:', existingUser);
        return existingUser;
      }

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows found"
        debug.general('❌ Error fetching user from Supabase:', fetchError);
        console.log('❌ SUPABASE: Error fetching user:', fetchError);
        // Fall back to localStorage
        return this.getLocalUser(walletAddress, username);
      }

      // User doesn't exist, create new one
      const newUser = {
        wallet_address: walletAddress,
        username: username || `Player_${walletAddress.slice(-4)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      debug.general('🔄 Creating new user in Supabase...');
      console.log('🔄 SUPABASE: Creating new user:', newUser);
      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      console.log('🔍 SUPABASE: Create result:', { createdUser, createError });

      if (createError) {
        debug.general('❌ Error creating user in Supabase:', createError);
        console.log('❌ SUPABASE: Error creating user:', createError);
        // Fall back to localStorage
        return this.getLocalUser(walletAddress, username);
      }

      debug.general('✅ Created new user in Supabase:', walletAddress);
      console.log('✅ SUPABASE: Created new user successfully:', createdUser);
      
      // Also save to localStorage as backup
      this.saveLocalUser(createdUser);
      
      return createdUser;
    } catch (error) {
      debug.general('❌ Error in authenticateWithWallet:', error);
      // Fall back to localStorage
      return this.getLocalUser(walletAddress, username);
    }
  }

  // Backup localStorage methods
  private getLocalUser(walletAddress: string, username?: string): UserProfile {
    try {
      const existingUsers = JSON.parse(localStorage.getItem('wallet_users') || '[]');
      const existingUser = existingUsers.find((u: any) => u.wallet_address === walletAddress);
      
      if (existingUser) {
        debug.general('✅ Found existing local user for wallet:', walletAddress);
        return existingUser;
      }

      // Create new local user
      const localUser: UserProfile = {
        id: `wallet_${walletAddress}`,
        wallet_address: walletAddress,
        username: username || `Player_${walletAddress.slice(-4)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      existingUsers.push(localUser);
      localStorage.setItem('wallet_users', JSON.stringify(existingUsers));
      debug.general('✅ Created new local user for wallet:', walletAddress);
      return localUser;
    } catch (error) {
      debug.general('⚠️ localStorage error, using session user');
      return {
        id: `wallet_${walletAddress}`,
        wallet_address: walletAddress,
        username: username || `Player_${walletAddress.slice(-4)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  }

  private saveLocalUser(user: UserProfile): void {
    try {
      const existingUsers = JSON.parse(localStorage.getItem('wallet_users') || '[]');
      const userIndex = existingUsers.findIndex((u: any) => u.wallet_address === user.wallet_address);
      
      if (userIndex >= 0) {
        existingUsers[userIndex] = user;
      } else {
        existingUsers.push(user);
      }
      
      localStorage.setItem('wallet_users', JSON.stringify(existingUsers));
    } catch (error) {
      debug.general('⚠️ Could not save to localStorage:', error);
    }
  }

  // Get user by wallet address
  async getUserByWallet(walletAddress: string): Promise<UserProfile | null> {
    try {
      // Try Supabase first
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (user && !error) {
        return user;
      }

      // Fall back to localStorage
      const existingUsers = JSON.parse(localStorage.getItem('wallet_users') || '[]');
      const localUser = existingUsers.find((u: any) => u.wallet_address === walletAddress);
      return localUser || null;
    } catch (error) {
      debug.general('Error in getUserByWallet:', error);
      return null;
    }
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      // Use localStorage for now due to Supabase RLS issues
      const existingUsers = JSON.parse(localStorage.getItem('wallet_users') || '[]');
      const userIndex = existingUsers.findIndex((u: any) => u.id === userId);
      
      if (userIndex >= 0) {
        existingUsers[userIndex] = {
          ...existingUsers[userIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('wallet_users', JSON.stringify(existingUsers));
        debug.general('✅ Updated user profile locally');
        return existingUsers[userIndex];
      }
      
      return null;
    } catch (error) {
      debug.general('Error in updateUserProfile:', error);
      return null;
    }
  }

  // Update user by wallet address
  async updateUserByWallet(walletAddress: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      // Try updating in Supabase first
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .select()
        .single();

      if (updatedUser && !error) {
        debug.general('✅ Updated user in Supabase');
        // Also update localStorage
        this.saveLocalUser(updatedUser);
        return updatedUser;
      }

      // Fall back to localStorage
      const existingUsers = JSON.parse(localStorage.getItem('wallet_users') || '[]');
      const userIndex = existingUsers.findIndex((u: any) => u.wallet_address === walletAddress);
      
      if (userIndex >= 0) {
        existingUsers[userIndex] = {
          ...existingUsers[userIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem('wallet_users', JSON.stringify(existingUsers));
        debug.general('✅ Updated user in localStorage');
        return existingUsers[userIndex];
      }
      
      return null;
    } catch (error) {
      debug.general('Error in updateUserByWallet:', error);
      return null;
    }
  }

  // Leaderboard Management
  async addLeaderboardEntry(entry: Omit<LeaderboardEntry, 'id' | 'created_at'>): Promise<LeaderboardEntry | null> {
    try {
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .insert([entry])
        .select()
        .single();

      if (error) {
        debug.general('Error adding leaderboard entry:', error);
        return null;
      }

      return data;
    } catch (error) {
      debug.general('Error in addLeaderboardEntry:', error);
      return null;
    }
  }

  async getLeaderboard(gameMode: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await supabase
        .from('leaderboard_entries')
        .select(`
          *,
          users(username, wallet_address)
        `)
        .eq('game_mode', gameMode)
        .order('score', { ascending: false })
        .limit(limit);

      if (error) {
        debug.general('Error fetching leaderboard:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      debug.general('Error in getLeaderboard:', error);
      return [];
    }
  }

  // Character Stats Management
  async getUserCharacterStats(userId: string, characterId?: string): Promise<UserCharacterStats[]> {
    try {
      let query = supabase
        .from('user_character_stats')
        .select('*')
        .eq('user_id', userId);

      if (characterId) {
        query = query.eq('character_id', characterId);
      }

      const { data, error } = await query;

      if (error) {
        debug.general('Error fetching character stats:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      debug.general('Error in getUserCharacterStats:', error);
      return [];
    }
  }

  async updateCharacterStats(
    userId: string, 
    characterId: string, 
    stats: Partial<UserCharacterStats>
  ): Promise<UserCharacterStats | null> {
    try {
      // First try to update existing record
      const { data: existing } = await supabase
        .from('user_character_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('character_id', characterId)
        .single();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('user_character_stats')
          .update({ ...stats, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('character_id', characterId)
          .select()
          .single();

        if (error) {
          debug.general('Error updating character stats:', error);
          return null;
        }

        return data;
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('user_character_stats')
          .insert([{ user_id: userId, character_id: characterId, ...stats }])
          .select()
          .single();

        if (error) {
          debug.general('Error creating character stats:', error);
          return null;
        }

        return data;
      }
    } catch (error) {
      debug.general('Error in updateCharacterStats:', error);
      return null;
    }
  }

  // Real-time subscriptions
  subscribeToLeaderboard(gameMode: string, callback: (entries: LeaderboardEntry[]) => void) {
    const subscription = supabase
      .channel('leaderboard_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard_entries',
          filter: `game_mode=eq.${gameMode}`,
        },
        async () => {
          // Fetch updated leaderboard
          const entries = await this.getLeaderboard(gameMode);
          callback(entries);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      return !error;
    } catch (error) {
      debug.general('Supabase health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const supabaseService = SupabaseService.getInstance();
export default supabaseService;