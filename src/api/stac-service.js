/**
 * @fileoverview STAC API Service Module
 * STAC API 服务模块
 * 
 * Handles all STAC API interactions with Microsoft Planetary Computer
 * 处理与 Microsoft Planetary Computer 的所有 STAC API 交互
 */

/** @typedef {import('../types/index.js').STACItem} STACItem */
/** @typedef {import('../types/index.js').STACCollection} STACCollection */
/** @typedef {import('../types/index.js').STACSearchResponse} STACSearchResponse */
/** @typedef {import('../types/index.js').SearchParams} SearchParams */

import { STAC_PROVIDERS, DEFAULT_PROVIDER, SEARCH_CONFIG } from '../config/index.js';

/** @type {string} */
let currentProvider = DEFAULT_PROVIDER;

/**
 * Extract error message from response
 * 从响应中提取错误信息
 * 
 * @param {Response} response - Fetch response / Fetch 响应
 * @returns {Promise<string>} Error message / 错误信息
 */
async function extractErrorMessage(response) {
    try {
        const errJson = await response.json();
        return errJson.detail || errJson.message || errJson.error || errJson.title || JSON.stringify(errJson);
    } catch {
        try {
            return await response.text();
        } catch {
            return '';
        }
    }
}

/**
 * Build error message from response
 * 从响应构建错误信息
 * 
 * @param {Response} response - Fetch response / Fetch 响应
 * @param {string} [prefix='Request failed'] - Error message prefix / 错误信息前缀
 * @returns {Promise<string>} Formatted error message / 格式化的错误信息
 */
async function buildErrorMessage(response, prefix = 'Request failed') {
    const reason = await extractErrorMessage(response);
    const statusInfo = `${response.status} ${response.statusText}`;
    return reason ? `${prefix}: ${statusInfo} - ${reason}` : `${prefix}: ${statusInfo}`;
}

/**
 * Search STAC items based on provided parameters
 * 根据提供的参数搜索 STAC 项目
 * 
 * @param {SearchParams} params - Search parameters / 搜索参数
 * @returns {Promise<STACSearchResponse>} Search results / 搜索结果
 */
export async function searchStacItems(params) {
    const searchParams = buildSearchParams(params);
    const provider = params.provider || currentProvider;
    const apiUrl = STAC_PROVIDERS[provider].url;

    const response = await fetch(`${apiUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchParams)
    });

    if (!response.ok) {
        throw new Error(await buildErrorMessage(response, 'STAC search failed'));
    }

    return await response.json();
}

/**
 * Get available collections from the STAC catalog
 * 从 STAC 目录获取可用集合
 * 
 * @param {string} [provider] - STAC provider key / STAC 数据源键名
 * @returns {Promise<STACCollection[]>} Collections array / 集合数组
 */
export async function getCollections(provider) {
    const apiUrl = STAC_PROVIDERS[provider || currentProvider].url;

    const response = await fetch(`${apiUrl}/collections`);

    if (!response.ok) {
        throw new Error(await buildErrorMessage(response, 'Failed to fetch collections'));
    }

    const data = await response.json();
    return data.collections;
}

/**
 * Get a single collection by id
 * 根据 ID 获取单个集合
 * 
 * @param {string} provider - STAC provider key / STAC 数据源键名
 * @param {string} collectionId - Collection ID / 集合 ID
 * @returns {Promise<STACCollection>} Collection details / 集合详情
 */
export async function getCollection(provider, collectionId) {
    const apiUrl = STAC_PROVIDERS[provider || currentProvider].url;

    const response = await fetch(`${apiUrl}/collections/${encodeURIComponent(collectionId)}`);

    if (!response.ok) {
        throw new Error(await buildErrorMessage(response, `Failed to fetch collection ${collectionId}`));
    }

    return await response.json();
}

/**
 * Set the current STAC provider
 * 设置当前 STAC 数据源
 * 
 * @param {string} provider - Provider key from STAC_PROVIDERS / STAC_PROVIDERS 中的数据源键名
 * @returns {boolean} Whether the provider was set successfully / 是否设置成功
 */
export function setProvider(provider) {
    if (STAC_PROVIDERS[provider]) {
        currentProvider = provider;
        return true;
    }
    return false;
}

/**
 * Get details of a specific STAC item
 * 获取特定 STAC 项目的详情
 * 
 * @param {string} provider - STAC provider key (optional, defaults to currentProvider) / STAC 数据源键名（可选，默认为 currentProvider）
 * @param {string} collectionId - Collection ID / 集合 ID
 * @param {string} itemId - Item ID / 项目 ID
 * @returns {Promise<STACItem>} Item details / 项目详情
 */
export async function getItemDetails(provider, collectionId, itemId) {
    const resolvedProvider = provider || currentProvider;
    const apiUrl = STAC_PROVIDERS[resolvedProvider]?.url;
    
    console.debug('[STAC] getItemDetails called:', { provider: resolvedProvider, collectionId, itemId });
    
    if (!apiUrl) {
        console.error('[STAC] Invalid provider:', resolvedProvider);
        throw new Error(`Invalid provider: ${resolvedProvider}`);
    }

    const url = `${apiUrl}/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(itemId)}`;
    console.debug('[STAC] Fetching item details from:', url);
    
    const response = await fetch(url);

    if (!response.ok) {
        const errorMsg = await buildErrorMessage(response, 'Failed to fetch item details');
        console.error('[STAC] getItemDetails failed:', errorMsg);
        throw new Error(errorMsg);
    }

    const data = await response.json();
    console.debug('[STAC] getItemDetails success:', { itemId: data.id, collection: data.collection });
    
    return data;
}

/**
 * Build search parameters from form inputs
 * 从表单输入构建搜索参数
 * 
 * @param {SearchParams} params - Input parameters / 输入参数
 * @returns {Object} STAC API search parameters / STAC API 搜索参数
 */
function buildSearchParams(params) {
    const searchParams = {
        limit: params.limit || SEARCH_CONFIG.defaultLimit
    };

    // Add collection filter if specified
    // 如果指定了集合则添加集合过滤器
    if (params.collection) {
        searchParams.collections = [params.collection];
    }

    // Add temporal filter if dates are provided
    // 如果提供了日期则添加时间过滤器
    if (params.dateFrom || params.dateTo) {
        let datetime = '';
        if (params.dateFrom && params.dateTo) {
            datetime = `${params.dateFrom}T00:00:00Z/${params.dateTo}T23:59:59Z`;
        } else if (params.dateFrom) {
            datetime = `${params.dateFrom}T00:00:00Z/..`;
        } else if (params.dateTo) {
            datetime = `../${params.dateTo}T23:59:59Z`;
        }
        searchParams.datetime = datetime;
    }

    // Add spatial filter: prefer intersects (polygon), otherwise bbox
    // 添加空间过滤器：优先使用 intersects（多边形），否则使用 bbox
    if (params.intersects) {
        searchParams.intersects = params.intersects;
    } else if (params.bbox && params.bbox.length === 4) {
        const bbox = params.bbox.map(v => parseFloat(v));
        if (bbox.every(v => !isNaN(v))) {
            searchParams.bbox = bbox;
        }
    }

    // Add any additional query parameters
    // 添加任何额外的查询参数
    if (params.query) {
        searchParams.query = params.query;
    }

    return searchParams;
}

/**
 * Format STAC item for display
 * 格式化 STAC 项目以供显示
 * 
 * @param {STACItem} item - Raw STAC item / 原始 STAC 项目
 * @returns {STACItem} Formatted item / 格式化后的项目
 */
export function formatItemForDisplay(item) {
    return {
        id: item.id,
        collection: item.collection,
        datetime: formatDatetime(item.properties.datetime || item.properties.created),
        geometry: item.geometry,
        bbox: item.bbox,
        properties: item.properties,
        assets: item.assets,
        links: item.links
    };
}

/**
 * Format datetime string for display
 * 格式化日期时间字符串以供显示
 * 
 * @param {string|null|undefined} datetime - ISO datetime string / ISO 日期时间字符串
 * @returns {string} Formatted datetime or 'N/A' / 格式化后的日期时间或 'N/A'
 */
function formatDatetime(datetime) {
    if (!datetime) return 'N/A';

    try {
        const date = new Date(datetime);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch {
        return datetime;
    }
}

/**
 * Parse S3 URL to bucket and key
 * 解析 S3 URL 为 bucket 和 key
 * 
 * @param {string} s3url - S3 URL (s3://bucket/key)
 * @returns {{bucket: string, key: string}|null} Parsed result or null / 解析结果或 null
 */
export function parseS3Url(s3url) {
    if (!s3url || typeof s3url !== 'string') return null;
    const m = /^s3:\/\/([^\/]+)\/(.+)$/.exec(s3url);
    if (!m) return null;
    return { bucket: m[1], key: m[2] };
}

/**
 * Resolve asset href (convert s3:// to https://)
 * 解析资源 href（将 s3:// 转换为 https://）
 * 
 * @param {string} href - Asset URL (may be s3:// or https://) / 资源 URL（可能是 s3:// 或 https://）
 * @returns {string} Resolved HTTPS URL / 解析后的 HTTPS URL
 */
export function resolveAssetHref(href) {
    if (!href || typeof href !== 'string') return href;
    if (!href.startsWith('s3://')) return href;
    const parsed = parseS3Url(href);
    if (!parsed) return href;
    const { bucket, key } = parsed;
    return `https://${bucket}.s3.amazonaws.com/${encodeURI(key)}`;
}

/**
 * Get thumbnail URL from item assets
 * 从项目资源中获取缩略图 URL
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @returns {string|null} Thumbnail URL or null / 缩略图 URL 或 null
 */
export function getItemThumbnail(item) {
    const assets = item?.assets;
    if (!assets) return null;

    const preference = ['rendered_preview', 'thumbnail', 'preview', 'visual'];
    for (const key of preference) {
        const a = assets[key];
        if (a?.href) {
            return resolveAssetHref(a.href);
        }
    }
    return null;
}

/**
 * Transform STAC bbox to OpenLayers extent
 * 将 STAC bbox 转换为 OpenLayers extent
 * 
 * @param {number[]} bbox - STAC bbox [west, south, east, north]
 * @returns {number[]|null} OpenLayers extent or null / OpenLayers extent 或 null
 */
export function bboxToExtent(bbox) {
    if (!bbox || bbox.length < 4) return null;
    return bbox.slice(0, 4);
}
