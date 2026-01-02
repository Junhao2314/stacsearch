/**
 * @fileoverview SearchManager - Search management module
 * SearchManager - 搜索管理模块
 * 
 * Responsible for STAC search, result storage, pagination
 * 负责 STAC 搜索、结果存储、分页
 */

/** @typedef {import('../types.js').STACItem} STACItem */
/** @typedef {import('../types.js').STACSearchResponse} STACSearchResponse */
/** @typedef {import('../types.js').SearchParams} SearchParams */
/** @typedef {import('../types.js').SearchValidation} SearchValidation */
/** @typedef {import('../types.js').PaginationResult} PaginationResult */
/** @typedef {import('../types.js').GeoJSONGeometry} GeoJSONGeometry */
/** @typedef {import('./MapManager.js').MapManager} MapManager */
/** @typedef {import('./DrawingManager.js').DrawingManager} DrawingManager */

import { GeoJSON } from 'ol/format';
import { searchStacItems, setProvider } from '../stac-service.js';
import { PAGINATION_CONFIG, SEARCH_CONFIG } from '../config.js';

export class SearchManager {
    constructor() {
        /** @type {STACItem[]} */
        this.currentItems = [];
        /** @type {number} */
        this.currentPage = 1;
    }

    /**
     * Perform STAC search with error recovery
     * 执行带错误恢复的 STAC 搜索
     * 
     * @param {SearchParams} params - Search parameters / 搜索参数
     * @returns {Promise<STACSearchResponse>} Search results / 搜索结果
     */
    async search(params) {
        const maxRetries = 2;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const results = await searchStacItems(params);
                
                // Filter out AWS Earth Search Landsat items
                // 过滤掉 AWS Earth Search 的 Landsat 项目
                const provider = params.provider || 'planetary-computer';
                const rawFeatures = (results && Array.isArray(results.features)) ? results.features : [];
                
                const filteredFeatures = (provider === 'earth-search')
                    ? rawFeatures.filter(f => f && f.collection !== 'landsat-c2-l2')
                    : rawFeatures;

                // Store and reset pagination / 存储并重置分页
                this.currentItems = filteredFeatures;
                this.currentPage = 1;

                return { ...results, features: filteredFeatures };
            } catch (error) {
                lastError = error;
                
                // Don't retry on client errors (4xx) or abort
                // 客户端错误（4xx）或中止时不重试
                if (error.name === 'AbortError' || 
                    (error.message && /\b4\d{2}\b/.test(error.message))) {
                    break;
                }
                
                // Wait before retry (exponential backoff)
                // 重试前等待（指数退避）
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
        }

        // Reset state on failure / 失败时重置状态
        this.currentItems = [];
        this.currentPage = 1;
        
        throw lastError;
    }

    /**
     * Get current page items
     * 获取当前页项目
     * 
     * @returns {PaginationResult} Pagination result with items / 包含项目的分页结果
     */
    getPageItems() {
        const perPage = PAGINATION_CONFIG.itemsPerPage;
        const totalPages = Math.max(1, Math.ceil(this.currentItems.length / perPage));
        const clampedPage = Math.min(Math.max(1, this.currentPage), totalPages);
        
        this.currentPage = clampedPage;
        
        const start = (clampedPage - 1) * perPage;
        const end = Math.min(start + perPage, this.currentItems.length);
        
        return {
            items: this.currentItems.slice(start, end),
            currentPage: clampedPage,
            totalPages,
            totalItems: this.currentItems.length
        };
    }

    /**
     * Set current page
     * 设置当前页
     * 
     * @param {number} page - Page number / 页码
     */
    setPage(page) {
        this.currentPage = page;
    }

    /**
     * Get page number for a specific item
     * 获取特定项目的页码
     * 
     * @param {string} itemId - Item ID / 项目 ID
     * @returns {number|null} Page number or null if not found / 页码或 null（如果未找到）
     */
    getPageForItem(itemId) {
        const idx = this.currentItems.findIndex(f => f.id === itemId);
        if (idx === -1) return null;
        return Math.floor(idx / PAGINATION_CONFIG.itemsPerPage) + 1;
    }

    /**
     * Find item by ID
     * 根据 ID 查找项目
     * 
     * @param {string} itemId - Item ID / 项目 ID
     * @returns {STACItem|undefined} Found item or undefined / 找到的项目或 undefined
     */
    findItem(itemId) {
        return this.currentItems.find(f => f.id === itemId);
    }

    /**
     * Get all items
     * 获取所有项目
     * 
     * @returns {STACItem[]} All current items / 所有当前项目
     */
    getAllItems() {
        return this.currentItems;
    }

    /**
     * Display items on map
     * 在地图上显示项目
     * 
     * @param {MapManager} mapManager - Map manager instance / 地图管理器实例
     */
    displayItemsOnMap(mapManager) {
        const itemsSource = mapManager.getItemsSource();
        itemsSource.clear();

        const geojsonFormat = new GeoJSON();

        this.currentItems.forEach(item => {
            if (item.geometry) {
                const feature = geojsonFormat.readFeature(item, {
                    featureProjection: 'EPSG:3857'
                });
                if (feature && feature.setId) feature.setId(item.id);
                itemsSource.addFeature(feature);
            }
        });

        // Fit map to show all items / 适配地图以显示所有项目
        const extent = itemsSource.getExtent();
        mapManager.fitToExtent(extent);
    }

    /**
     * Collect search parameters from form and map state
     * 从表单和地图状态收集搜索参数
     * 
     * @param {DrawingManager} drawingManager - Drawing manager instance / 绘制管理器实例
     * @param {MapManager} mapManager - Map manager instance / 地图管理器实例
     * @returns {SearchParams} Collected search parameters / 收集的搜索参数
     */
    collectSearchParameters(drawingManager, mapManager) {
        const params = {
            provider: document.getElementById('provider').value,
            collection: document.getElementById('collection').value,
            dateFrom: document.getElementById('date-from-display')?.value || document.getElementById('date-from').value,
            dateTo: document.getElementById('date-to-display')?.value || document.getElementById('date-to').value,
            limit: parseInt(document.getElementById('limit').value) || 10
        };

        // Priority: drawn polygon > current viewport
        // 优先级：绘制的多边形 > 当前视口
        if (drawingManager.hasDrawnShape()) {
            params.intersects = drawingManager.getDrawnGeometry();
        } else {
            const rawBbox = mapManager.getExtent4326();
            const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
            let [minX, minY, maxX, maxY] = rawBbox.map(v => Number(v));
            
            if ([minX, minY, maxX, maxY].every(Number.isFinite)) {
                minX = clamp(minX, -180, 180);
                maxX = clamp(maxX, -180, 180);
                minY = clamp(minY, -85, 85);
                maxY = clamp(maxY, -85, 85);
                
                if (minX < maxX && minY < maxY) {
                    params.bbox = [minX, minY, maxX, maxY];
                } else {
                    params.bbox = SEARCH_CONFIG.fallbackBbox;
                }
            } else {
                params.bbox = SEARCH_CONFIG.fallbackBbox;
            }
        }

        return params;
    }

    /**
     * Validate search parameters
     * 验证搜索参数
     * 
     * @param {SearchParams} params - Parameters to validate / 要验证的参数
     * @returns {SearchValidation} Validation result / 验证结果
     */
    validateSearchParams(params) {
        if (!params.collection && !params.dateFrom && !params.dateTo && !params.bbox && !params.intersects) {
            return { valid: false, error: 'Please provide at least one search parameter' };
        }

        if (params.bbox) {
            if (!params.bbox.every(Number.isFinite)) {
                return { valid: false, error: 'Invalid bounding box values' };
            }
            if (params.bbox[0] >= params.bbox[2] || params.bbox[1] >= params.bbox[3]) {
                return { valid: false, error: 'Invalid bounding box: West must be less than East, South must be less than North' };
            }
            const [minX, minY, maxX, maxY] = params.bbox;
            if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) {
                return { valid: false, error: 'Invalid bounding box range' };
            }
        }

        if (params.intersects) {
            if (!params.intersects.type || !params.intersects.coordinates) {
                return { valid: false, error: 'Invalid polygon geometry' };
            }
        }

        return { valid: true };
    }

    /**
     * Change provider
     * 更改数据源
     * 
     * @param {string} provider - Provider key / 数据源键名
     */
    changeProvider(provider) {
        setProvider(provider);
    }
}
