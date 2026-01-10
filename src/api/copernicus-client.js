/**
 * @fileoverview Copernicus Data Space Ecosystem Client
 * Copernicus Data Space Ecosystem 客户端
 * 
 * Handles authentication and product download from Copernicus Data Space
 * 处理 Copernicus Data Space 的认证和产品下载
 * 
 * Reference: https://documentation.dataspace.copernicus.eu/
 */

/** @typedef {import('../types/index.js').STACItem} STACItem */
/** @typedef {import('../types/index.js').DownloadProgress} DownloadProgress */

import { DOWNLOAD_CONFIG, STAC_PROVIDERS } from '../config/index.js';

/**
 * @typedef {Object} CopernicusToken
 * @property {string} access_token - OAuth2 access token / OAuth2 访问令牌
 * @property {number} expires_in - Token expiry in seconds / 令牌过期时间（秒）
 * @property {number} obtainedAt - Timestamp when token was obtained / 获取令牌的时间戳
 */

/** @type {CopernicusToken|null} */
let cachedToken = null;

/**
 * Check if Copernicus credentials are configured
 * 检查 Copernicus 凭证是否已配置
 * 
 * @returns {boolean} Whether credentials are available / 凭证是否可用
 */
export function hasCopernicusCredentials() {
    const hasCredentials = !!(DOWNLOAD_CONFIG.copernicusUsername && DOWNLOAD_CONFIG.copernicusPassword);
    console.debug('[Copernicus] Credentials configured:', hasCredentials, 
        'Username:', DOWNLOAD_CONFIG.copernicusUsername ? '***' + DOWNLOAD_CONFIG.copernicusUsername.slice(-4) : '(empty)');
    return hasCredentials;
}

/**
 * Get Copernicus OAuth2 access token
 * 获取 Copernicus OAuth2 访问令牌
 * 
 * @returns {Promise<string>} Access token / 访问令牌
 * @throws {Error} If authentication fails / 如果认证失败
 */
export async function getCopernicusToken() {
    // Check if we have a valid cached token (with 60s buffer)
    // 检查是否有有效的缓存令牌（预留 60 秒缓冲）
    if (cachedToken) {
        const elapsed = (Date.now() - cachedToken.obtainedAt) / 1000;
        if (elapsed < cachedToken.expires_in - 60) {
            return cachedToken.access_token;
        }
    }

    if (!hasCopernicusCredentials()) {
        throw new Error('Copernicus credentials not configured. Please set window.COPERNICUS_USERNAME and window.COPERNICUS_PASSWORD in browser console.');
    }

    const tokenUrl = STAC_PROVIDERS['copernicus-dataspace'].tokenUrl;
    
    // URLSearchParams automatically handles URL encoding for special characters
    // URLSearchParams 会自动处理特殊字符的 URL 编码
    const formData = new URLSearchParams();
    formData.append('client_id', 'cdse-public');
    formData.append('grant_type', 'password');
    formData.append('username', DOWNLOAD_CONFIG.copernicusUsername);
    formData.append('password', DOWNLOAD_CONFIG.copernicusPassword);

    console.debug('[Copernicus] Attempting authentication for user:', DOWNLOAD_CONFIG.copernicusUsername);
    console.debug('[Copernicus] Token URL:', tokenUrl);

    let response;
    try {
        response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });
    } catch (fetchError) {
        console.error('[Copernicus] Fetch error (possibly CORS):', fetchError);
        throw new Error(`Network error during authentication: ${fetchError.message}. This may be a CORS issue.`);
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Copernicus authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    cachedToken = {
        access_token: data.access_token,
        expires_in: data.expires_in || 600,
        obtainedAt: Date.now(),
    };

    return cachedToken.access_token;
}

/**
 * Clear cached token (useful for logout or error recovery)
 * 清除缓存的令牌（用于登出或错误恢复）
 */
export function clearCopernicusToken() {
    cachedToken = null;
}

/**
 * Check if a collection is Sentinel-1 related
 * 检查集合是否与 Sentinel-1 相关
 * 
 * @param {string} collectionId - Collection ID / 集合 ID
 * @returns {boolean} Whether it's a Sentinel-1 collection / 是否为 Sentinel-1 集合
 */
export function isSentinel1Collection(collectionId) {
    if (!collectionId) return false;
    const id = collectionId.toLowerCase();
    return id.includes('sentinel-1') || id.includes('sentinel1') || id === 'sentinel-1';
}

/**
 * Extract Copernicus product ID from STAC item
 * 从 STAC 项目中提取 Copernicus 产品 ID
 * 
 * For Copernicus Data Space, the item ID is typically the product UUID
 * 对于 Copernicus Data Space，项目 ID 通常是产品 UUID
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @returns {string|null} Product ID or null / 产品 ID 或 null
 */
export function extractCopernicusProductId(item) {
    if (!item) return null;
    
    // Try to get product ID from various sources
    // 尝试从各种来源获取产品 ID
    
    // 1. Check if item ID is a UUID (Copernicus format)
    // 1. 检查项目 ID 是否为 UUID（Copernicus 格式）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(item.id)) {
        return item.id;
    }
    
    // 2. Check properties for product ID
    // 2. 检查属性中的产品 ID
    const props = item.properties || {};
    if (props['copernicus:product_id']) {
        return props['copernicus:product_id'];
    }
    
    // 3. Check links for self link with product ID
    // 3. 检查链接中的产品 ID
    const links = item.links || [];
    for (const link of links) {
        if (link.rel === 'self' && link.href) {
            const match = link.href.match(/Products\(([0-9a-f-]+)\)/i);
            if (match) return match[1];
        }
    }
    
    // 4. For other providers, try to find product name and search
    // 4. 对于其他提供商，尝试查找产品名称
    // This would require an additional API call, so we return null for now
    // 这需要额外的 API 调用，所以暂时返回 null
    
    return null;
}

/**
 * Search for Copernicus product by name
 * 通过名称搜索 Copernicus 产品
 * 
 * @param {string} productName - Product name (e.g., S1A_IW_GRDH_...) / 产品名称
 * @returns {Promise<string|null>} Product UUID or null / 产品 UUID 或 null
 */
export async function searchCopernicusProductByName(productName) {
    if (!productName) return null;
    
    const odataUrl = STAC_PROVIDERS['copernicus-dataspace'].odataUrl;
    const searchUrl = `${odataUrl}/Products?$filter=Name eq '${encodeURIComponent(productName)}'&$top=1`;
    
    try {
        const response = await fetch(searchUrl);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.value && data.value.length > 0) {
            return data.value[0].Id;
        }
    } catch (e) {
        console.warn('Failed to search Copernicus product:', e);
    }
    
    return null;
}

/**
 * Get product name from STAC item for Copernicus search
 * 从 STAC 项目获取用于 Copernicus 搜索的产品名称
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @returns {string|null} Product name or null / 产品名称或 null
 */
export function getProductNameFromItem(item) {
    if (!item) return null;
    
    // For Sentinel-1, the product name typically follows a pattern like:
    // S1A_IW_GRDH_1SDV_20231015T...
    // 对于 Sentinel-1，产品名称通常遵循如下模式：
    // S1A_IW_GRDH_1SDV_20231015T...
    
    const props = item.properties || {};
    
    // Check for explicit product name
    // 检查显式产品名称
    if (props['s1:product_name']) return props['s1:product_name'];
    if (props['product_name']) return props['product_name'];
    
    // The item ID might be the product name (without .SAFE extension)
    // 项目 ID 可能是产品名称（不带 .SAFE 扩展名）
    if (item.id && item.id.startsWith('S1')) {
        // Add .SAFE extension if not present
        // 如果没有 .SAFE 扩展名则添加
        return item.id.endsWith('.SAFE') ? item.id : `${item.id}.SAFE`;
    }
    
    return null;
}


/**
 * @typedef {Object} CopernicusDownloadOptions
 * @property {function(DownloadProgress): void} [onProgress] - Progress callback / 进度回调
 * @property {function(string): void} [onStatus] - Status message callback / 状态消息回调
 * @property {AbortSignal} [abortSignal] - Abort signal / 中止信号
 */

/**
 * @typedef {Object} CopernicusDownloadResult
 * @property {boolean} success - Whether download succeeded / 下载是否成功
 * @property {string} [error] - Error message if failed / 失败时的错误消息
 * @property {string} [filename] - Downloaded filename / 下载的文件名
 * @property {number} [size] - File size in bytes / 文件大小（字节）
 * @property {string} [message] - Additional info message / 附加信息消息
 */

/**
 * Save blob to file using download link
 * 使用下载链接将 blob 保存为文件
 *
 * @param {Blob} blob - Blob to save / 要保存的 Blob
 * @param {string} filename - Filename for download / 下载的文件名
 */
async function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Download Sentinel-1 product as ZIP from Copernicus Data Space
 * 从 Copernicus Data Space 下载 Sentinel-1 产品 ZIP 文件
 *
 * Downloads directly using OAuth2 Bearer token authentication.
 * 使用 OAuth2 Bearer token 认证直接下载。
 *
 * @param {string} productId - Copernicus product UUID / Copernicus 产品 UUID
 * @param {string} [filename] - Optional filename for download / 可选的下载文件名
 * @param {CopernicusDownloadOptions} [options] - Download options / 下载选项
 * @returns {Promise<CopernicusDownloadResult>} Download result / 下载结果
 */
export async function downloadCopernicusProduct(productId, filename, options = {}) {
    const { onProgress, onStatus, abortSignal } = options;

    if (!productId) {
        return { success: false, error: 'Product ID is required' };
    }

    if (!hasCopernicusCredentials()) {
        return {
            success: false,
            error: 'Copernicus credentials not configured. Please set window.COPERNICUS_USERNAME and window.COPERNICUS_PASSWORD in browser console.'
        };
    }

    try {
        // Step 1: Get authentication token
        // 步骤 1：获取认证令牌
        onStatus?.('Authenticating with Copernicus Data Space...');

        let accessToken;
        try {
            accessToken = await getCopernicusToken();
        } catch (authError) {
            console.error('Copernicus authentication failed:', authError);
            return {
                success: false,
                error: `Authentication failed: ${authError.message}`
            };
        }

        // Step 2: Download the product with Bearer token
        // 步骤 2：使用 Bearer token 下载产品
        const downloadUrl = `https://zipper.dataspace.copernicus.eu/odata/v1/Products(${productId})/$value`;

        onStatus?.('Starting download...');

        const response = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            signal: abortSignal,
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('Copernicus download failed:', response.status, response.statusText, errorText);

            // If 401/403, token might be invalid - clear cache
            // 如果是 401/403，令牌可能无效 - 清除缓存
            if (response.status === 401 || response.status === 403) {
                clearCopernicusToken();
            }

            return {
                success: false,
                error: `Download failed: ${response.status} ${response.statusText}. ${errorText}`
            };
        }

        // Step 3: Stream download with progress
        // 步骤 3：流式下载并显示进度
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
        const reader = response.body?.getReader();

        if (!reader) {
            // Fallback for browsers without streaming
            // 不支持流式传输的浏览器回退
            onStatus?.('Downloading... (no progress available)');
            const blob = await response.blob();
            const finalFilename = filename || `${productId}.zip`;
            await saveBlob(blob, finalFilename);

            return {
                success: true,
                filename: finalFilename,
                size: blob.size,
            };
        }

        // Stream download with progress tracking
        // 流式下载并跟踪进度
        const chunks = [];
        let loaded = 0;

        onStatus?.(`Downloading... (${formatSize(contentLength)} total)`);

        while (true) {
            if (abortSignal?.aborted) {
                reader.cancel();
                return { success: false, error: 'Download cancelled' };
            }

            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            loaded += value.byteLength || 0;

            if (onProgress) {
                const percent = contentLength ? Math.round((loaded / contentLength) * 100) : null;
                onProgress({ loaded, total: contentLength, percent });
            }

            // Update status with progress
            // 更新状态并显示进度
            if (contentLength) {
                const progressPercent = Math.round((loaded / contentLength) * 100);
                onStatus?.(`Downloading... ${formatSize(loaded)} / ${formatSize(contentLength)} (${progressPercent}%)`);
            } else {
                onStatus?.(`Downloading... ${formatSize(loaded)}`);
            }
        }

        // Step 4: Save the file
        // 步骤 4：保存文件
        onStatus?.('Saving file...');
        const blob = new Blob(chunks);
        const finalFilename = filename || `${productId}.zip`;
        await saveBlob(blob, finalFilename);

        onStatus?.(`Download complete: ${finalFilename}`);

        return {
            success: true,
            filename: finalFilename,
            size: loaded,
        };

    } catch (e) {
        if (e.name === 'AbortError') {
            return { success: false, error: 'Download cancelled' };
        }
        console.error('Copernicus download error:', e);
        return { success: false, error: e.message || String(e) };
    }
}

/**
 * Format file size to human readable string
 * 格式化文件大小为人类可读字符串
 *
 * @param {number} bytes - Size in bytes / 字节大小
 * @returns {string} Formatted size / 格式化后的大小
 */
function formatSize(bytes) {
    if (!bytes || !isFinite(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[i]}`;
}

/**
 * Download Sentinel-1 product from any provider
 * 从任意提供商下载 Sentinel-1 产品
 *
 * This function handles the logic of finding the product in Copernicus Data Space
 * and downloading it as a complete ZIP file using OAuth2 authentication.
 * 此函数处理在 Copernicus Data Space 中查找产品并使用 OAuth2 认证下载完整 ZIP 文件的逻辑。
 *
 * @param {STACItem} item - STAC item / STAC 项目
 * @param {CopernicusDownloadOptions} [options] - Download options / 下载选项
 * @returns {Promise<CopernicusDownloadResult>} Download result / 下载结果
 */
export async function downloadSentinel1FullProduct(item, options = {}) {
    const { onStatus } = options;
    
    if (!item) {
        return { success: false, error: 'Item is required' };
    }
    
    // Try to get product ID directly
    // 尝试直接获取产品 ID
    let productId = extractCopernicusProductId(item);
    
    if (!productId) {
        // Try to search by product name
        // 尝试通过产品名称搜索
        const productName = getProductNameFromItem(item);
        
        if (productName) {
            onStatus?.(`Searching for product: ${productName}...`);
            productId = await searchCopernicusProductByName(productName);
        }
    }
    
    if (!productId) {
        return { 
            success: false, 
            error: 'Could not find Copernicus product ID. The product may not be available in Copernicus Data Space.' 
        };
    }
    
    // Generate filename from item
    // 从项目生成文件名
    const productName = getProductNameFromItem(item) || item.id;
    const filename = productName.endsWith('.zip') ? productName : `${productName}.zip`;
    
    return await downloadCopernicusProduct(productId, filename, options);
}

/**
 * Get quicklook/thumbnail URL for Sentinel-1 product
 * 获取 Sentinel-1 产品的快视图/缩略图 URL
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @returns {string|null} Quicklook URL or null / 快视图 URL 或 null
 */
export function getSentinel1Quicklook(item) {
    if (!item || !item.assets) return null;
    
    // Check for quicklook/preview assets
    // 检查快视图/预览资源
    const quicklookKeys = ['quicklook', 'preview', 'thumbnail', 'rendered_preview'];
    
    for (const key of quicklookKeys) {
        if (item.assets[key]?.href) {
            return item.assets[key].href;
        }
    }
    
    return null;
}
