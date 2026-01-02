/**
 * @fileoverview Application Configuration / 应用配置
 * 
 * Centralized configuration for STAC Search Viewer
 * STAC Search Viewer 的集中配置文件
 * 
 * Configuration values can be overridden via (priority high to low):
 * 配置值可通过以下方式覆盖（优先级从高到低）：
 * 1. Vite env variables / Vite 环境变量 (import.meta.env.VITE_*)
 * 2. Window globals / Window 全局变量 (window.*)
 * 3. Default values in this file / 本文件中的默认值
 * 
 * Example / 示例：Set VITE_PC_SUBSCRIPTION_KEY=your-key in .env file
 */

/** @typedef {import('./types.js').MapConfig} MapConfig */
/** @typedef {import('./types.js').BasemapConfig} BasemapConfig */
/** @typedef {import('./types.js').STACProviderConfig} STACProviderConfig */

/**
 * Get config value from env or window global
 * 从环境变量或 window 全局变量获取配置值
 * 
 * @template T
 * @param {string} envKey - Vite env variable name / Vite 环境变量名
 * @param {string} windowKey - Window global name / Window 全局变量名
 * @param {T} defaultValue - Default value / 默认值
 * @returns {T} Config value / 配置值
 */
const getEnvOrWindow = (envKey, windowKey, defaultValue) => {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envKey]) {
        return import.meta.env[envKey];
    }
    if (typeof window !== 'undefined' && window[windowKey] !== undefined) {
        return window[windowKey];
    }
    return defaultValue;
};

/* ============================================================================
 * Map Configuration / 地图配置
 * ============================================================================ */

/** @type {MapConfig} */
export const MAP_CONFIG = {
    /**
     * Initial map center [longitude, latitude] in EPSG:4326 (WGS84)
     * 地图初始中心点坐标 [经度, 纬度]，使用 EPSG:4326 坐标系
     * 
     * Examples / 示例：Beijing 北京 [116.4, 39.9], New York 纽约 [-74.0, 40.7]
     */
    initialCenter: [0, 0],

    /**
     * Initial zoom level (1-20, higher = more detailed)
     * 初始缩放级别（1-20，数值越大越详细）
     * 
     * 1: World view / 世界视图
     * 10: City level / 城市级别
     * 18: Street level / 街道级别
     */
    initialZoom: 2,
};

/* ============================================================================
 * Pagination Configuration / 分页配置
 * ============================================================================ */

export const PAGINATION_CONFIG = {
    /**
     * Number of search results per page
     * 搜索结果列表每页显示的条目数
     */
    itemsPerPage: 10,

    /**
     * Number of collections per page in collection picker modal
     * 集合选择器弹窗中每页显示的集合数
     */
    collectionsPerPage: 5,
};

/* ============================================================================
 * STAC Provider Configuration / STAC 数据源配置
 * ============================================================================ */

/**
 * STAC API provider endpoints
 * STAC API 提供商端点配置
 * 
 * Keys must match <select id="provider"> option values in index.html
 * 键名必须与 index.html 中 provider 下拉框的 option value 一致
 * 
 * To add a new provider / 添加新数据源：
 * 1. Add entry here / 在此添加条目
 * 2. Add <option> in index.html provider dropdown / 在 index.html 的 provider 下拉框添加 option
 * 3. Optionally add priority collections in PRIORITY_COLLECTIONS / 可选：在 PRIORITY_COLLECTIONS 添加优先集合
 * @type {Object<string, STACProviderConfig>}
 */
export const STAC_PROVIDERS = {
    'planetary-computer': {
        url: 'https://planetarycomputer.microsoft.com/api/stac/v1',
        name: 'Microsoft Planetary Computer',
    },
    'earth-search': {
        url: 'https://earth-search.aws.element84.com/v1',
        name: 'AWS Earth Search',
    },
    // Add more providers here / 在此添加更多数据源：
    // 'usgs': {
    //     url: 'https://landsatlook.usgs.gov/stac-server',
    //     name: 'USGS STAC',
    // },
};

/**
 * Default STAC provider (must be a valid key in STAC_PROVIDERS)
 * 默认 STAC 数据提供商（必须是 STAC_PROVIDERS 中的有效键名）
 */
export const DEFAULT_PROVIDER = 'planetary-computer';

/* ============================================================================
 * Search Configuration / 搜索配置
 * ============================================================================ */

export const SEARCH_CONFIG = {
    /**
     * Default search result limit (corresponds to "Max Results" input)
     * 默认搜索结果数量限制（对应界面上的 "Max Results" 输入框）
     */
    defaultLimit: 10,

    /**
     * Fallback bbox when map extent is invalid [west, south, east, north]
     * 当地图范围无效时使用的后备边界框 [西经, 南纬, 东经, 北纬]
     * 
     * Current setting: near-global extent excluding polar regions for Web Mercator compatibility
     * 当前设置：接近全球范围，排除极地区域以兼容 Web Mercator 投影
     */
    fallbackBbox: [-179.9, -80, 179.9, 80],
};

/* ============================================================================
 * Collection Priority Configuration / 集合优先级配置
 * ============================================================================ */

/**
 * Priority collections for each provider
 * 各数据源的优先显示集合
 * 
 * - Displayed first in collection picker / 在集合选择器中排在最前面
 * - Marked with "Tested" badge / 显示 "Tested" 标签
 * 
 * Keys must match STAC_PROVIDERS keys; values are collection ID arrays in display order
 * 键名必须与 STAC_PROVIDERS 键名一致；值为集合 ID 数组，按显示顺序排列
 * @type {Object<string, string[]>}
 */
export const PRIORITY_COLLECTIONS = {
    'planetary-computer': [
        'landsat-c2-l2',      // Landsat Collection 2 Level-2
        'sentinel-2-l2a',     // Sentinel-2 Level-2A
        'sentinel-1-rtc',     // Sentinel-1 RTC
        'sentinel-1-grd',     // Sentinel-1 GRD
    ],
    'earth-search': [
        'sentinel-2-l2a',     // Sentinel-2 Level-2A
        'sentinel-1-grd',     // Sentinel-1 GRD
    ],
};

/**
 * Predefined collection list (fallback for legacy SELECT dropdown)
 * 预定义集合列表（旧版 SELECT 下拉框的后备方案）
 */
export const MPC_COLLECTIONS = [
    { id: 'landsat-c2-l2', title: 'Landsat Collection 2 Level-2' },
    { id: 'sentinel-1-rtc', title: 'Sentinel 1 Radiometrically Terrain Corrected (RTC)' },
    { id: 'sentinel-1-grd', title: 'Sentinel 1 Level-1 Ground Range Detected (GRD)' },
    { id: 'sentinel-2-l2a', title: 'Sentinel-2 Level-2A' },
];

/* ============================================================================
 * Download Configuration / 下载配置
 * ============================================================================ */

export const DOWNLOAD_CONFIG = {
    /**
     * Microsoft Planetary Computer SAS signing API endpoint
     * Microsoft Planetary Computer SAS 签名 API 端点
     * 
     * Used to generate temporary access URLs for Azure Blob Storage resources
     * 用于为 Azure Blob 存储的资源生成临时访问 URL
     */
    pcSignEndpoint: 'https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=',

    /**
     * Planetary Computer API subscription key (optional, for higher rate limits)
     * Planetary Computer API 订阅密钥（可选，可获得更高的 API 速率限制）
     * 
     * Set via / 设置方式：
     * - Env / 环境变量：VITE_PC_SUBSCRIPTION_KEY=your-key
     * - Window：window.PC_SUBSCRIPTION_KEY = 'your-key'
     */
    pcSubscriptionKey: getEnvOrWindow('VITE_PC_SUBSCRIPTION_KEY', 'PC_SUBSCRIPTION_KEY', ''),

    /**
     * AWS S3 requester-pays mode
     * AWS S3 请求者付费模式
     * 
     * When true, adds x-amz-request-payer: requester header to download requests
     * 设为 true 时，下载请求会包含 x-amz-request-payer: requester 头
     * 
     * Some public datasets (e.g., Landsat) may require this setting
     * 某些公开数据集（如 Landsat）可能需要此设置
     * 
     * Set via / 设置方式：
     * - Env / 环境变量：VITE_S3_REQUESTER_PAYS=true
     * - Window：window.S3_REQUESTER_PAYS = 'true'
     */
    s3RequesterPays: getEnvOrWindow('VITE_S3_REQUESTER_PAYS', 'S3_REQUESTER_PAYS', 'false')
        .toString().toLowerCase() === 'true',
};

/* ============================================================================
 * Basemap Configuration / 底图配置
 * ============================================================================ */

/** @type {BasemapConfig} */
export const BASEMAP_CONFIG = {
    /**
     * Default basemap key (must match basemapRegistry keys in main.js)
     * 默认底图键名（必须与 main.js 中 basemapRegistry 的键名一致）
     * 
     * Options / 可选值：'osm', 'esri_img', 'google_sat', 'google_hyb', 'google_road'
     */
    defaultBasemap: 'osm',

    /**
     * Google Maps tile configuration
     * Google Maps 瓦片配置
     * 
     * Note: Usage must comply with Google Terms of Service
     * 注意：使用需遵守 Google 服务条款
     */
    google: {
        /**
         * Custom Google tile URL template (leave empty for default mt*.google.com)
         * 自定义 Google 瓦片 URL 模板（留空则使用默认的 mt*.google.com）
         * 
         * Supports {s} placeholder for subdomain substitution
         * 支持 {s} 占位符用于子域名替换
         * 
         * Set via / 设置方式：VITE_GOOGLE_TILE_URL=https://your-proxy/{s}/...
         */
        tileUrl: getEnvOrWindow('VITE_GOOGLE_TILE_URL', 'GOOGLE_TILE_URL', ''),

        /**
         * Google tile service subdomains (for load balancing, replaces {s} in URL)
         * Google 瓦片服务子域名列表（用于负载均衡，替换 URL 中的 {s}）
         */
        subdomains: getEnvOrWindow('VITE_GOOGLE_SUBDOMAINS', 'GOOGLE_SUBDOMAINS', 'mt0,mt1,mt2,mt3').split(','),
    },
};
