/**
 * @fileoverview JSDoc Type Definitions for STAC Search Viewer
 * 
 * This file contains all shared type definitions used across the application.
 * Import types using: @typedef {import('./types.js').TypeName} TypeName
 */

// ============================================================================
// STAC API Types
// ============================================================================

/**
 * STAC Item - A single spatiotemporal asset
 * @typedef {Object} STACItem
 * @property {string} id - Unique item identifier
 * @property {string} type - Always "Feature"
 * @property {string} collection - Parent collection ID
 * @property {GeoJSONGeometry} geometry - Item geometry
 * @property {number[]} bbox - Bounding box [west, south, east, north]
 * @property {STACItemProperties} properties - Item properties
 * @property {Object<string, STACAsset>} assets - Item assets
 * @property {STACLink[]} [links] - Related links
 */

/**
 * STAC Item Properties
 * @typedef {Object} STACItemProperties
 * @property {string} [datetime] - Acquisition datetime (ISO 8601)
 * @property {string} [created] - Creation datetime
 * @property {string} [updated] - Last update datetime
 * @property {string} [platform] - Satellite/sensor platform
 * @property {string} [instrument] - Instrument name
 * @property {string[]} [instruments] - Instrument names array
 * @property {number} [eo:cloud_cover] - Cloud cover percentage
 * @property {number} [cloud_cover] - Cloud cover percentage (alt)
 * @property {number} [gsd] - Ground sample distance in meters
 * @property {number} [proj:epsg] - EPSG code
 * @property {string} [s2:mgrs_tile] - Sentinel-2 MGRS tile
 */

/**
 * STAC Asset
 * @typedef {Object} STACAsset
 * @property {string} href - Asset URL
 * @property {string} [type] - Media type (MIME)
 * @property {string} [title] - Human-readable title
 * @property {string} [description] - Asset description
 * @property {string[]} [roles] - Asset roles (e.g., "data", "thumbnail")
 */

/**
 * STAC Link
 * @typedef {Object} STACLink
 * @property {string} href - Link URL
 * @property {string} rel - Relationship type
 * @property {string} [type] - Media type
 * @property {string} [title] - Link title
 */

/**
 * STAC Collection
 * @typedef {Object} STACCollection
 * @property {string} id - Collection identifier
 * @property {string} type - Always "Collection"
 * @property {string} [title] - Human-readable title
 * @property {string} [description] - Collection description
 * @property {string[]} [keywords] - Keywords for discovery
 * @property {STACExtent} [extent] - Spatial and temporal extent
 * @property {STACProvider[]} [providers] - Data providers
 * @property {Object<string, STACAsset>} [assets] - Collection-level assets
 * @property {Object} [summaries] - Property summaries
 * @property {STACLink[]} [links] - Related links
 */

/**
 * STAC Extent
 * @typedef {Object} STACExtent
 * @property {Object} spatial - Spatial extent
 * @property {number[][]} spatial.bbox - Bounding boxes
 * @property {Object} temporal - Temporal extent
 * @property {(string|null)[][]} temporal.interval - Time intervals
 */

/**
 * STAC Provider
 * @typedef {Object} STACProvider
 * @property {string} name - Provider name
 * @property {string[]} [roles] - Provider roles
 * @property {string} [url] - Provider URL
 */

/**
 * STAC Search Response
 * @typedef {Object} STACSearchResponse
 * @property {string} type - Always "FeatureCollection"
 * @property {STACItem[]} features - Search results
 * @property {number} [numberMatched] - Total matching items
 * @property {number} [numberReturned] - Items in this response
 * @property {STACLink[]} [links] - Pagination links
 */

// ============================================================================
// GeoJSON Types
// ============================================================================

/**
 * GeoJSON Geometry
 * @typedef {Object} GeoJSONGeometry
 * @property {string} type - Geometry type (Point, Polygon, etc.)
 * @property {number[]|number[][]|number[][][]} coordinates - Coordinates
 */

/**
 * GeoJSON Polygon
 * @typedef {Object} GeoJSONPolygon
 * @property {'Polygon'} type - Always "Polygon"
 * @property {number[][][]} coordinates - Polygon coordinates
 */

// ============================================================================
// Application Types
// ============================================================================

/**
 * Search Parameters
 * @typedef {Object} SearchParams
 * @property {string} [provider] - STAC provider key
 * @property {string} [collection] - Collection ID to search
 * @property {string} [dateFrom] - Start date (YYYY-MM-DD)
 * @property {string} [dateTo] - End date (YYYY-MM-DD)
 * @property {number[]} [bbox] - Bounding box [west, south, east, north]
 * @property {GeoJSONGeometry} [intersects] - Polygon geometry for spatial filter
 * @property {number} [limit] - Maximum results to return
 * @property {Object} [query] - Additional query parameters
 */

/**
 * Search Validation Result
 * @typedef {Object} SearchValidation
 * @property {boolean} valid - Whether parameters are valid
 * @property {string} [error] - Error message if invalid
 */

/**
 * Pagination Result
 * @typedef {Object} PaginationResult
 * @property {STACItem[]} items - Items for current page
 * @property {number} currentPage - Current page number
 * @property {number} totalPages - Total number of pages
 * @property {number} totalItems - Total number of items
 */

/**
 * Paginate Options
 * @typedef {Object} PaginateOptions
 * @property {Array} items - Items to paginate
 * @property {number} page - Current page number
 * @property {number} perPage - Items per page
 * @property {HTMLElement} [paginationEl] - Pagination container element
 * @property {string} [prevBtnId] - Previous button ID
 * @property {string} [nextBtnId] - Next button ID
 * @property {string} [extraClass] - Extra CSS class
 * @property {function(number): void} [onPageChange] - Page change callback
 */

/**
 * Paginate Result
 * @typedef {Object} PaginateResult
 * @property {Array} pageItems - Items for current page
 * @property {number} totalPages - Total pages
 * @property {number} clampedPage - Actual page number (clamped to valid range)
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Map Configuration
 * @typedef {Object} MapConfig
 * @property {number[]} initialCenter - Initial center [lon, lat]
 * @property {number} initialZoom - Initial zoom level
 */

/**
 * Basemap Configuration
 * @typedef {Object} BasemapConfig
 * @property {string} defaultBasemap - Default basemap key
 * @property {GoogleConfig} google - Google Maps configuration
 */

/**
 * Google Maps Configuration
 * @typedef {Object} GoogleConfig
 * @property {string} tileUrl - Custom tile URL template
 * @property {string[]} subdomains - Tile server subdomains
 */

/**
 * STAC Provider Configuration
 * @typedef {Object} STACProviderConfig
 * @property {string} url - API base URL
 * @property {string} name - Display name
 */

// ============================================================================
// Download Types
// ============================================================================

/**
 * Download Selection
 * @typedef {Object} DownloadSelection
 * @property {string} key - Asset key
 * @property {STACAsset} asset - Asset object
 * @property {string} filename - Derived filename
 */

/**
 * Download Progress
 * @typedef {Object} DownloadProgress
 * @property {number} [loaded] - Bytes loaded
 * @property {number} [total] - Total bytes
 * @property {number} [percent] - Percentage complete
 */

/**
 * Download Options
 * @typedef {Object} DownloadOptions
 * @property {string} [provider] - STAC provider key
 * @property {FileSystemDirectoryHandle} [directoryHandle] - Directory to save files
 * @property {function(string, DownloadProgress): void} [onProgress] - Progress callback
 * @property {AbortSignal} [abortSignal] - Abort signal
 */

// Export empty object to make this a module
export {};
