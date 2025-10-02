/**
 * STAC API Service Module
 * Handles all STAC API interactions with Microsoft Planetary Computer
 */

// STAC API endpoints for different providers
const STAC_PROVIDERS = {
    'planetary-computer': {
        url: 'https://planetarycomputer.microsoft.com/api/stac/v1',
        name: 'Microsoft Planetary Computer'
    },
    'earth-search': {
        url: 'https://earth-search.aws.element84.com/v1',
        name: 'AWS Earth Search'
    },
    'usgs': {
        url: 'https://landsatlook.usgs.gov/stac-server',
        name: 'USGS STAC'
    },
    'element84': {
        url: 'https://earth-search.aws.element84.com/v0',
        name: 'Element 84 Earth Search'
    }
};

let currentProvider = 'planetary-computer';

/**
 * Search STAC items based on provided parameters
 */
export async function searchStacItems(params) {
    const searchParams = buildSearchParams(params);
    const provider = params.provider || currentProvider;
    const apiUrl = STAC_PROVIDERS[provider].url;
    
    try {
        const response = await fetch(`${apiUrl}/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchParams)
        });

        if (!response.ok) {
            let reason = '';
            try {
                const errJson = await response.json();
                reason = errJson.detail || errJson.message || errJson.error || errJson.title || JSON.stringify(errJson);
            } catch (e) {
                try {
                    reason = await response.text();
                } catch (_) {
                    reason = '';
                }
            }
            const statusInfo = `${response.status} ${response.statusText}`;
            const message = reason ? `${statusInfo}: ${reason}` : statusInfo;
            throw new Error(message);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('STAC search error:', error);
        throw error;
    }
}

/**
 * Get available collections from the STAC catalog
 */
export async function getCollections(provider) {
    const apiUrl = STAC_PROVIDERS[provider || currentProvider].url;
    
    try {
        const response = await fetch(`${apiUrl}/collections`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch collections: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.collections;
    } catch (error) {
        console.error('Error fetching collections:', error);
        throw error;
    }
}

/**
 * Get a single collection by id
 */
export async function getCollection(provider, collectionId) {
    const apiUrl = STAC_PROVIDERS[provider || currentProvider].url;
    try {
        const resp = await fetch(`${apiUrl}/collections/${encodeURIComponent(collectionId)}`);
        if (!resp.ok) {
            let reason = '';
            try { reason = await resp.text(); } catch {}
            throw new Error(`Failed to fetch collection ${collectionId}: ${resp.status} ${resp.statusText}${reason ? ' - ' + reason : ''}`);
        }
        return await resp.json();
    } catch (e) {
        console.error('Error fetching collection detail:', e);
        throw e;
    }
}

/**
 * Set the current STAC provider
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
 */
export async function getItemDetails(collectionId, itemId) {
    try {
        const response = await fetch(`${STAC_API_URL}/collections/${collectionId}/items/${itemId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch item details: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching item details:', error);
        throw error;
    }
}

/**
 * Build search parameters from form inputs
 */
function buildSearchParams(params) {
    const searchParams = {
        limit: params.limit || 10
    };

    // Add collection filter if specified
    if (params.collection) {
        searchParams.collections = [params.collection];
    }

    // Add temporal filter if dates are provided
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
    if (params.intersects) {
        searchParams.intersects = params.intersects;
    } else if (params.bbox && params.bbox.length === 4) {
        // Ensure bbox values are numbers and in correct order
        const bbox = params.bbox.map(v => parseFloat(v));
        if (bbox.every(v => !isNaN(v))) {
            searchParams.bbox = bbox;
        }
    }

    // Add any additional query parameters
    if (params.query) {
        searchParams.query = params.query;
    }

    return searchParams;
}

/**
 * Format STAC item for display
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

// Utilities to convert s3:// URLs to HTTPS for browser usage
export function parseS3Url(s3url) {
    if (!s3url || typeof s3url !== 'string') return null;
    const m = /^s3:\/\/([^\/]+)\/(.+)$/.exec(s3url);
    if (!m) return null;
    return { bucket: m[1], key: m[2] };
}

export function resolveAssetHref(href) {
    if (!href || typeof href !== 'string') return href;
    if (!href.startsWith('s3://')) return href;
    const parsed = parseS3Url(href);
    if (!parsed) return href;
    const { bucket, key } = parsed;
    // Always use AWS virtual-hosted S3 URL for all buckets, including usgs-landsat
    return `https://${bucket}.s3.amazonaws.com/${encodeURI(key)}`;
}

/**
 * Get thumbnail URL from item assets
 */
export function getItemThumbnail(item) {
    const assets = item && item.assets ? item.assets : null;
    if (!assets) return null;

    // Prefer rendered_preview first, then thumbnail, preview, visual
    const preference = ['rendered_preview', 'thumbnail', 'preview', 'visual'];
    for (const key of preference) {
        const a = assets[key];
        if (a && a.href) {
            return resolveAssetHref(a.href);
        }
    }
    return null;
}

/**
 * Transform STAC bbox to OpenLayers extent
 */
export function bboxToExtent(bbox) {
    if (!bbox || bbox.length < 4) return null;
    
    // STAC bbox is [minX, minY, maxX, maxY]
    // OpenLayers extent is the same format
    return bbox.slice(0, 4);
}