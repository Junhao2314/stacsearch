/**
 * @fileoverview JSDoc Type Definitions for STAC Search Viewer
 * STAC Search Viewer 的 JSDoc 类型定义
 * 
 * This file contains all shared type definitions used across the application.
 * 本文件包含应用程序中使用的所有共享类型定义。
 * 
 * Import types using: @typedef {import('./types.js').TypeName} TypeName
 * 导入类型使用：@typedef {import('./types.js').TypeName} TypeName
 */

// ============================================================================
// STAC API Types / STAC API 类型
// ============================================================================

/**
 * STAC Item - A single spatiotemporal asset
 * STAC 项目 - 单个时空资源
 * 
 * @typedef {Object} STACItem
 * @property {string} id - Unique item identifier / 唯一项目标识符
 * @property {string} type - Always "Feature" / 始终为 "Feature"
 * @property {string} collection - Parent collection ID / 父集合 ID
 * @property {GeoJSONGeometry} geometry - Item geometry / 项目几何图形
 * @property {number[]} bbox - Bounding box [west, south, east, north] / 边界框 [西, 南, 东, 北]
 * @property {STACItemProperties} properties - Item properties / 项目属性
 * @property {Object<string, STACAsset>} assets - Item assets / 项目资源
 * @property {STACLink[]} [links] - Related links / 相关链接
 */

/**
 * STAC Item Properties
 * STAC 项目属性
 * 
 * @typedef {Object} STACItemProperties
 * @property {string} [datetime] - Acquisition datetime (ISO 8601) / 采集日期时间（ISO 8601）
 * @property {string} [created] - Creation datetime / 创建日期时间
 * @property {string} [updated] - Last update datetime / 最后更新日期时间
 * @property {string} [platform] - Satellite/sensor platform / 卫星/传感器平台
 * @property {string} [instrument] - Instrument name / 仪器名称
 * @property {string[]} [instruments] - Instrument names array / 仪器名称数组
 * @property {number} [eo:cloud_cover] - Cloud cover percentage / 云量百分比
 * @property {number} [cloud_cover] - Cloud cover percentage (alt) / 云量百分比（备选）
 * @property {number} [gsd] - Ground sample distance in meters / 地面采样距离（米）
 * @property {number} [proj:epsg] - EPSG code / EPSG 代码
 * @property {string} [s2:mgrs_tile] - Sentinel-2 MGRS tile / Sentinel-2 MGRS 瓦片
 */

/**
 * STAC Asset
 * STAC 资源
 * 
 * @typedef {Object} STACAsset
 * @property {string} href - Asset URL / 资源 URL
 * @property {string} [type] - Media type (MIME) / 媒体类型（MIME）
 * @property {string} [title] - Human-readable title / 人类可读标题
 * @property {string} [description] - Asset description / 资源描述
 * @property {string[]} [roles] - Asset roles (e.g., "data", "thumbnail") / 资源角色（如 "data"、"thumbnail"）
 */

/**
 * STAC Link
 * STAC 链接
 * 
 * @typedef {Object} STACLink
 * @property {string} href - Link URL / 链接 URL
 * @property {string} rel - Relationship type / 关系类型
 * @property {string} [type] - Media type / 媒体类型
 * @property {string} [title] - Link title / 链接标题
 */

/**
 * STAC Collection
 * STAC 集合
 * 
 * @typedef {Object} STACCollection
 * @property {string} id - Collection identifier / 集合标识符
 * @property {string} type - Always "Collection" / 始终为 "Collection"
 * @property {string} [title] - Human-readable title / 人类可读标题
 * @property {string} [description] - Collection description / 集合描述
 * @property {string[]} [keywords] - Keywords for discovery / 用于发现的关键词
 * @property {STACExtent} [extent] - Spatial and temporal extent / 空间和时间范围
 * @property {STACProvider[]} [providers] - Data providers / 数据提供者
 * @property {Object<string, STACAsset>} [assets] - Collection-level assets / 集合级资源
 * @property {Object} [summaries] - Property summaries / 属性摘要
 * @property {STACLink[]} [links] - Related links / 相关链接
 */

/**
 * STAC Extent
 * STAC 范围
 * 
 * @typedef {Object} STACExtent
 * @property {Object} spatial - Spatial extent / 空间范围
 * @property {number[][]} spatial.bbox - Bounding boxes / 边界框
 * @property {Object} temporal - Temporal extent / 时间范围
 * @property {(string|null)[][]} temporal.interval - Time intervals / 时间间隔
 */

/**
 * STAC Provider
 * STAC 提供者
 * 
 * @typedef {Object} STACProvider
 * @property {string} name - Provider name / 提供者名称
 * @property {string[]} [roles] - Provider roles / 提供者角色
 * @property {string} [url] - Provider URL / 提供者 URL
 */

/**
 * STAC Search Response
 * STAC 搜索响应
 * 
 * @typedef {Object} STACSearchResponse
 * @property {string} type - Always "FeatureCollection" / 始终为 "FeatureCollection"
 * @property {STACItem[]} features - Search results / 搜索结果
 * @property {number} [numberMatched] - Total matching items / 匹配项目总数
 * @property {number} [numberReturned] - Items in this response / 本次响应中的项目数
 * @property {STACLink[]} [links] - Pagination links / 分页链接
 */

// ============================================================================
// GeoJSON Types / GeoJSON 类型
// ============================================================================

/**
 * GeoJSON Geometry
 * GeoJSON 几何图形
 * 
 * @typedef {Object} GeoJSONGeometry
 * @property {string} type - Geometry type (Point, Polygon, etc.) / 几何类型（Point、Polygon 等）
 * @property {number[]|number[][]|number[][][]} coordinates - Coordinates / 坐标
 */

/**
 * GeoJSON Polygon
 * GeoJSON 多边形
 * 
 * @typedef {Object} GeoJSONPolygon
 * @property {'Polygon'} type - Always "Polygon" / 始终为 "Polygon"
 * @property {number[][][]} coordinates - Polygon coordinates / 多边形坐标
 */

// ============================================================================
// Application Types / 应用程序类型
// ============================================================================

/**
 * Search Parameters
 * 搜索参数
 * 
 * @typedef {Object} SearchParams
 * @property {string} [provider] - STAC provider key / STAC 数据源键名
 * @property {string} [collection] - Collection ID to search / 要搜索的集合 ID
 * @property {string} [dateFrom] - Start date (YYYY-MM-DD) / 开始日期（YYYY-MM-DD）
 * @property {string} [dateTo] - End date (YYYY-MM-DD) / 结束日期（YYYY-MM-DD）
 * @property {number[]} [bbox] - Bounding box [west, south, east, north] / 边界框 [西, 南, 东, 北]
 * @property {GeoJSONGeometry} [intersects] - Polygon geometry for spatial filter / 用于空间过滤的多边形几何图形
 * @property {number} [limit] - Maximum results to return / 返回的最大结果数
 * @property {Object} [query] - Additional query parameters / 额外的查询参数
 */

/**
 * Search Validation Result
 * 搜索验证结果
 * 
 * @typedef {Object} SearchValidation
 * @property {boolean} valid - Whether parameters are valid / 参数是否有效
 * @property {string} [error] - Error message if invalid / 无效时的错误信息
 */

/**
 * Pagination Result
 * 分页结果
 * 
 * @typedef {Object} PaginationResult
 * @property {STACItem[]} items - Items for current page / 当前页的项目
 * @property {number} currentPage - Current page number / 当前页码
 * @property {number} totalPages - Total number of pages / 总页数
 * @property {number} totalItems - Total number of items / 项目总数
 */

/**
 * Paginate Options
 * 分页选项
 * 
 * @typedef {Object} PaginateOptions
 * @property {Array} items - Items to paginate / 要分页的项目
 * @property {number} page - Current page number / 当前页码
 * @property {number} perPage - Items per page / 每页项目数
 * @property {HTMLElement} [paginationEl] - Pagination container element / 分页容器元素
 * @property {string} [prevBtnId] - Previous button ID / 上一页按钮 ID
 * @property {string} [nextBtnId] - Next button ID / 下一页按钮 ID
 * @property {string} [extraClass] - Extra CSS class / 额外的 CSS 类
 * @property {function(number): void} [onPageChange] - Page change callback / 页面变更回调
 */

/**
 * Paginate Result
 * 分页结果
 * 
 * @typedef {Object} PaginateResult
 * @property {Array} pageItems - Items for current page / 当前页的项目
 * @property {number} totalPages - Total pages / 总页数
 * @property {number} clampedPage - Actual page number (clamped to valid range) / 实际页码（限制在有效范围内）
 */

// ============================================================================
// Configuration Types / 配置类型
// ============================================================================

/**
 * Map Configuration
 * 地图配置
 * 
 * @typedef {Object} MapConfig
 * @property {number[]} initialCenter - Initial center [lon, lat] / 初始中心点 [经度, 纬度]
 * @property {number} initialZoom - Initial zoom level / 初始缩放级别
 */

/**
 * Basemap Configuration
 * 底图配置
 * 
 * @typedef {Object} BasemapConfig
 * @property {string} defaultBasemap - Default basemap key / 默认底图键名
 * @property {GoogleConfig} google - Google Maps configuration / Google 地图配置
 */

/**
 * Google Maps Configuration
 * Google 地图配置
 * 
 * @typedef {Object} GoogleConfig
 * @property {string} tileUrl - Custom tile URL template / 自定义瓦片 URL 模板
 * @property {string[]} subdomains - Tile server subdomains / 瓦片服务器子域名
 */

/**
 * STAC Provider Configuration
 * STAC 数据源配置
 * 
 * @typedef {Object} STACProviderConfig
 * @property {string} url - API base URL / API 基础 URL
 * @property {string} name - Display name / 显示名称
 */

// ============================================================================
// Download Types / 下载类型
// ============================================================================

/**
 * Download Selection
 * 下载选择
 * 
 * @typedef {Object} DownloadSelection
 * @property {string} key - Asset key / 资源键名
 * @property {STACAsset} asset - Asset object / 资源对象
 * @property {string} filename - Derived filename / 推导出的文件名
 */

/**
 * Download Progress
 * 下载进度
 * 
 * @typedef {Object} DownloadProgress
 * @property {number} [loaded] - Bytes loaded / 已加载字节数
 * @property {number} [total] - Total bytes / 总字节数
 * @property {number} [percent] - Percentage complete / 完成百分比
 */

/**
 * Download Options
 * 下载选项
 * 
 * @typedef {Object} DownloadOptions
 * @property {string} [provider] - STAC provider key / STAC 数据源键名
 * @property {FileSystemDirectoryHandle} [directoryHandle] - Directory to save files / 保存文件的目录
 * @property {function(string, DownloadProgress): void} [onProgress] - Progress callback / 进度回调
 * @property {AbortSignal} [abortSignal] - Abort signal / 中止信号
 */

// Export empty object to make this a module
// 导出空对象以使其成为模块
export {};

// ============================================================================
// Copernicus Download Types / Copernicus 下载类型
// ============================================================================

/**
 * Copernicus OAuth2 Token
 * Copernicus OAuth2 令牌
 * 
 * @typedef {Object} CopernicusToken
 * @property {string} access_token - OAuth2 access token / OAuth2 访问令牌
 * @property {number} expires_in - Token expiry in seconds / 令牌过期时间（秒）
 * @property {number} obtainedAt - Timestamp when token was obtained / 获取令牌的时间戳
 */

/**
 * Copernicus Download Options
 * Copernicus 下载选项
 * 
 * @typedef {Object} CopernicusDownloadOptions
 * @property {function(DownloadProgress): void} [onProgress] - Progress callback / 进度回调
 * @property {function(string): void} [onStatus] - Status message callback / 状态消息回调
 * @property {AbortSignal} [abortSignal] - Abort signal / 中止信号
 */

/**
 * Copernicus Download Result
 * Copernicus 下载结果
 * 
 * @typedef {Object} CopernicusDownloadResult
 * @property {boolean} success - Whether download succeeded / 下载是否成功
 * @property {string} [error] - Error message if failed / 失败时的错误消息
 * @property {string} [filename] - Downloaded filename / 下载的文件名
 * @property {number} [size] - File size in bytes / 文件大小（字节）
 */
