const { LRUCache } = require('lru-cache');
const crypto = require('crypto');

/**
 * 缓存服务 - 使用 LRU 缓存策略优化性能
 * 支持内存缓存和数据库缓存两层策略
 */
class CacheService {
  constructor() {
    // 内存缓存 - LRU 策略
    this.memoryCache = new LRUCache({
      max: 100, // 最多缓存 100 个项目
      maxSize: 50 * 1024 * 1024, // 最大 50MB
      sizeCalculation: (value) => {
        return JSON.stringify(value).length;
      },
      ttl: 1000 * 60 * 15, // 15分钟过期
      updateAgeOnGet: true, // 访问时更新过期时间
      updateAgeOnHas: false,
    });

    // 请求去重 - 防止相同请求并发执行
    this.pendingRequests = new Map();
  }

  /**
   * 生成缓存键
   * @param {string} prefix - 缓存前缀
   * @param {number} projectId - 项目ID
   * @param {Object} filters - 筛选条件
   * @returns {string} 缓存键
   */
  generateCacheKey(prefix, projectId, filters = {}) {
    // 对 filters 进行排序和标准化，确保相同筛选条件生成相同的键
    const normalizedFilters = this._normalizeFilters(filters);
    const filtersStr = JSON.stringify(normalizedFilters);
    
    // 如果筛选条件为空，使用简单键
    if (filtersStr === '{}') {
      return `${prefix}:${projectId}`;
    }
    
    // 使用哈希避免键过长
    const hash = crypto.createHash('md5').update(filtersStr).digest('hex').substring(0, 16);
    return `${prefix}:${projectId}:${hash}`;
  }

  /**
   * 标准化筛选条件
   */
  _normalizeFilters(filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return {};
    }

    const normalized = {};
    const keys = Object.keys(filters).sort();
    
    for (const key of keys) {
      const value = filters[key];
      // 跳过空值
      if (value === null || value === undefined || value === '') {
        continue;
      }
      // 数组排序后存储
      if (Array.isArray(value)) {
        if (value.length > 0) {
          normalized[key] = [...value].sort();
        }
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  /**
   * 从内存缓存获取数据
   * @param {string} key - 缓存键
   * @returns {any} 缓存的数据，不存在返回 undefined
   */
  getFromMemory(key) {
    return this.memoryCache.get(key);
  }

  /**
   * 设置内存缓存
   * @param {string} key - 缓存键
   * @param {any} value - 要缓存的数据
   * @param {number} ttl - 过期时间（毫秒），可选
   */
  setToMemory(key, value, ttl) {
    const options = ttl ? { ttl } : {};
    this.memoryCache.set(key, value, options);
  }

  /**
   * 清除特定缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    this.memoryCache.delete(key);
  }

  /**
   * 清除项目相关的所有缓存
   * @param {number} projectId - 项目ID
   */
  clearProjectCache(projectId) {
    const keys = [...this.memoryCache.keys()];
    const projectPrefix = `:${projectId}`;
    
    for (const key of keys) {
      if (key.includes(projectPrefix)) {
        this.memoryCache.delete(key);
      }
    }
    
    console.log(`🗑️  Cleared cache for project ${projectId}`);
  }

  /**
   * 清除所有缓存
   */
  clearAll() {
    this.memoryCache.clear();
    console.log('🗑️  All cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      maxSize: this.memoryCache.maxSize,
      calculatedSize: this.memoryCache.calculatedSize,
      keys: [...this.memoryCache.keys()],
    };
  }

  /**
   * 请求去重 - 防止相同请求并发执行
   * @param {string} key - 请求键
   * @param {Function} fn - 异步函数
   * @returns {Promise} 函数执行结果
   */
  async deduplicate(key, fn) {
    // 如果已有相同请求在执行，返回该请求的 Promise
    if (this.pendingRequests.has(key)) {
      console.log(`⏳ Deduplicating request: ${key}`);
      return this.pendingRequests.get(key);
    }

    // 执行新请求
    const promise = fn()
      .finally(() => {
        // 请求完成后清除
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * 带缓存的数据获取
   * @param {string} cacheKey - 缓存键
   * @param {Function} fetchFn - 数据获取函数
   * @param {number} ttl - 缓存过期时间（毫秒）
   * @returns {Promise} 数据
   */
  async getOrFetch(cacheKey, fetchFn, ttl) {
    // 1. 尝试从内存缓存获取
    const cached = this.getFromMemory(cacheKey);
    if (cached !== undefined) {
      console.log(`💾 Cache hit (memory): ${cacheKey}`);
      return cached;
    }

    // 2. 使用请求去重执行数据获取
    const data = await this.deduplicate(cacheKey, fetchFn);

    // 3. 存入内存缓存
    this.setToMemory(cacheKey, data, ttl);

    return data;
  }
}

// 导出单例
const cacheService = new CacheService();

module.exports = cacheService;
