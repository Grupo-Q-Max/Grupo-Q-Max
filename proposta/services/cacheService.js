/**
 * Cache Service em Memória de Alta Performance
 * Reduz a latência de consultas frequentes e elimina viagens de rede desnecessárias ao banco remoto.
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Obtém um valor do cache se não expirado
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return item.value;
  }

  /**
   * Armazena um valor com TTL (tempo de vida em segundos)
   */
  set(key, value, ttlSeconds = 600) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Remove uma chave específica
   */
  del(key) {
    this.cache.delete(key);
  }

  /**
   * Remove todas as chaves que começam com um determinado prefixo
   */
  delPattern(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpa todo o cache
   */
  flush() {
    this.cache.clear();
  }

  /**
   * Helper conveniente: busca do cache ou executa fetchFn e armazena
   */
  async getOrSet(key, fetchFn, ttlSeconds = 600) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const freshValue = await fetchFn();
    this.set(key, freshValue, ttlSeconds);
    return freshValue;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      ratio: this.stats.hits + this.stats.misses > 0 
        ? `${((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1)}%` 
        : "0%"
    };
  }
}

const cacheService = new CacheService();
module.exports = cacheService;
