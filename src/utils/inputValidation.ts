// Input validation and sanitization utilities for Deadly Duel
// Provides security validation for all user inputs

export class InputValidator {
  // Username validation
  static validateUsername(username: string): { isValid: boolean; error?: string } {
    if (!username || typeof username !== 'string') {
      return { isValid: false, error: 'Username is required' };
    }

    // Trim whitespace
    username = username.trim();

    // Length check
    if (username.length < 2) {
      return { isValid: false, error: 'Username must be at least 2 characters' };
    }

    if (username.length > 20) {
      return { isValid: false, error: 'Username must be less than 20 characters' };
    }

    // Character validation - only allow alphanumeric, spaces, hyphens, underscores
    const allowedPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!allowedPattern.test(username)) {
      return { isValid: false, error: 'Username can only contain letters, numbers, spaces, hyphens, and underscores' };
    }

    // Prevent XSS patterns
    const xssPatterns = [/<script/i, /javascript:/i, /on\w+=/i, /<iframe/i, /<object/i, /<embed/i];
    if (xssPatterns.some(pattern => pattern.test(username))) {
      return { isValid: false, error: 'Username contains invalid characters' };
    }

    return { isValid: true };
  }

  // Sanitize username for safe display
  static sanitizeUsername(username: string): string {
    if (!username || typeof username !== 'string') {
      return '';
    }

    return username
      .trim()
      .replace(/[<>'"&]/g, '') // Remove potential HTML/script characters
      .substring(0, 20); // Enforce max length
  }

  // Wallet address validation
  static validateWalletAddress(address: string): { isValid: boolean; error?: string } {
    if (!address || typeof address !== 'string') {
      return { isValid: false, error: 'Wallet address is required' };
    }

    // Solana address validation (base58, 32-44 characters typically)
    const solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaAddressPattern.test(address)) {
      return { isValid: false, error: 'Invalid Solana wallet address format' };
    }

    return { isValid: true };
  }

  // Score validation
  static validateScore(score: any): { isValid: boolean; sanitizedScore?: number; error?: string } {
    if (score === null || score === undefined) {
      return { isValid: false, error: 'Score is required' };
    }

    const numericScore = Number(score);

    if (isNaN(numericScore)) {
      return { isValid: false, error: 'Score must be a number' };
    }

    if (numericScore < 0) {
      return { isValid: false, error: 'Score cannot be negative' };
    }

    if (numericScore > 1000000) {
      return { isValid: false, error: 'Score is unreasonably high' };
    }

    if (!Number.isInteger(numericScore)) {
      return { isValid: false, error: 'Score must be a whole number' };
    }

    return { isValid: true, sanitizedScore: numericScore };
  }

  // Character ID validation
  static validateCharacterId(characterId: string): { isValid: boolean; error?: string } {
    if (!characterId || typeof characterId !== 'string') {
      return { isValid: false, error: 'Character ID is required' };
    }

    // Allow only specific character IDs
    const validCharacters = ['rocco', 'kai', 'kestrel', 'zadie', 'kael', 'nyx'];
    if (!validCharacters.includes(characterId.toLowerCase())) {
      return { isValid: false, error: 'Invalid character ID' };
    }

    return { isValid: true };
  }

  // Game mode validation
  static validateGameMode(gameMode: string): { isValid: boolean; error?: string } {
    if (!gameMode || typeof gameMode !== 'string') {
      return { isValid: false, error: 'Game mode is required' };
    }

    const validModes = ['survival', 'time_attack', 'tournament', 'normal'];
    if (!validModes.includes(gameMode.toLowerCase())) {
      return { isValid: false, error: 'Invalid game mode' };
    }

    return { isValid: true };
  }

  // Generic object sanitization for metadata
  static sanitizeMetadata(metadata: any): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const sanitized: Record<string, unknown> = {};

    // Limit to 10 properties
    const keys = Object.keys(metadata).slice(0, 10);

    for (const key of keys) {
      // Sanitize key name
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
      if (!sanitizedKey) continue;

      const value = metadata[key];

      // Only allow safe primitive types
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = value.substring(0, 200); // Limit string length
      } else if (typeof value === 'number' && Number.isFinite(value)) {
        sanitized[sanitizedKey] = value;
      } else if (typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      }
      // Ignore objects, arrays, functions, etc.
    }

    return sanitized;
  }

  // Time validation (in seconds)
  static validateTime(time: any): { isValid: boolean; sanitizedTime?: number; error?: string } {
    if (time === null || time === undefined) {
      return { isValid: false, error: 'Time is required' };
    }

    const numericTime = Number(time);

    if (isNaN(numericTime)) {
      return { isValid: false, error: 'Time must be a number' };
    }

    if (numericTime < 0) {
      return { isValid: false, error: 'Time cannot be negative' };
    }

    if (numericTime > 86400) { // 24 hours max
      return { isValid: false, error: 'Time is unreasonably long' };
    }

    return { isValid: true, sanitizedTime: numericTime };
  }

  // Rate limiting check (simple in-memory implementation)
  private static rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  static checkRateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const current = this.rateLimitMap.get(identifier);

    if (!current || now > current.resetTime) {
      // Reset or create new entry
      this.rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (current.count >= maxRequests) {
      return false; // Rate limit exceeded
    }

    current.count++;
    return true;
  }

  // Clean up rate limit map periodically
  static cleanupRateLimit(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitMap.entries()) {
      if (now > value.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    InputValidator.cleanupRateLimit();
  }, 5 * 60 * 1000);
}