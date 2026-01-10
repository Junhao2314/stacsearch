/**
 * @fileoverview Download Clients for STAC assets
 * STAC 资源下载客户端
 * 
 * - DefaultHttpClient: downloads via HTTP(S) / 通过 HTTP(S) 下载
 * - PlanetaryComputerClient: signs Azure Blob URLs via MPC SAS API then downloads / 通过 MPC SAS API 签名 Azure Blob URL 后下载
 * - S3Client: attempts to download s3:// assets via HTTPS mapping (best-effort) and optional requester-pays header / 尝试通过 HTTPS 映射下载 s3:// 资源（尽力而为）并支持可选的请求者付费头
 * - CopernicusClient: downloads full Sentinel-1 products from Copernicus Data Space / 从 Copernicus Data Space 下载完整的 Sentinel-1 产品
 */

/** @typedef {import('../types/index.js').STACItem} STACItem */
/** @typedef {import('../types/index.js').STACAsset} STACAsset */
/** @typedef {import('../types/index.js').DownloadSelection} DownloadSelection */
/** @typedef {import('../types/index.js').DownloadProgress} DownloadProgress */
/** @typedef {import('../types/index.js').DownloadOptions} DownloadOptions */

import { DOWNLOAD_CONFIG } from '../config/index.js';
import { 
    isSentinel1Collection, 
    hasCopernicusCredentials, 
    downloadSentinel1FullProduct 
} from './copernicus-client.js';
import JSZip from 'jszip';

const PC_SIGN_ENDPOINT = DOWNLOAD_CONFIG.pcSignEndpoint;

const CONFIG = {
  pcSubscriptionKey: DOWNLOAD_CONFIG.pcSubscriptionKey,
  s3RequesterPays: DOWNLOAD_CONFIG.s3RequesterPays,
};

/**
 * Derive filename from URL
 * 从 URL 推导文件名
 * 
 * @param {string} url - URL to extract filename from / 要提取文件名的 URL
 * @returns {string} Derived filename / 推导出的文件名
 */
function deriveFilenameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'download';
  } catch {
    const clean = url.split('?')[0].split('#')[0];
    return clean.substring(clean.lastIndexOf('/') + 1) || 'download';
  }
}

/**
 * Derive filename from asset
 * 从资源对象推导文件名
 * 
 * @param {STACAsset} asset - STAC asset / STAC 资源
 * @returns {string} Derived filename / 推导出的文件名
 */
export function deriveFilenameFromAsset(asset) {
  if (!asset) return 'download';
  // Use the tail of the URL path as the filename, ignoring title per requirement
  // 使用 URL 路径的末尾作为文件名，按要求忽略 title
  if (asset.href) return sanitizeFilename(deriveFilenameFromUrl(asset.href));
  return 'download';
}

/**
 * Sanitize filename by removing invalid characters
 * 通过移除无效字符来清理文件名
 * 
 * @param {string} name - Filename to sanitize / 要清理的文件名
 * @returns {string} Sanitized filename / 清理后的文件名
 */
function sanitizeFilename(name) {
  return String(name).replace(/[\/:*?"<>|]+/g, '_');
}

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
 * Default HTTP download client
 * 默认 HTTP 下载客户端
 */
class DefaultHttpClient {
  /**
   * Download file via HTTP(S)
   * 通过 HTTP(S) 下载文件
   * 
   * @param {string} url - URL to download / 要下载的 URL
   * @param {string} [filename] - Optional filename / 可选的文件名
   * @returns {Promise<boolean>} Whether download succeeded / 下载是否成功
   */
  static async download(url, filename) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();
      await saveBlob(blob, filename || deriveFilenameFromUrl(url));
      return true;
    } catch (err) {
      console.warn('DefaultHttpClient failed, fallback to opening URL:', err);
      try {
        window.open(url, '_blank', 'noopener');
      } catch {}
      return false;
    }
  }
}

/**
 * Planetary Computer download client with URL signing
 * 带 URL 签名的 Planetary Computer 下载客户端
 */
class PlanetaryComputerClient {
  /** @type {number} Maximum retry attempts for rate limiting / 速率限制的最大重试次数 */
  static MAX_RETRIES = 5;
  /** @type {number} Base delay in ms for exponential backoff / 指数退避的基础延迟（毫秒） */
  static BASE_DELAY = 1000;

  /**
   * Sleep for specified milliseconds
   * 休眠指定的毫秒数
   * 
   * @param {number} ms - Milliseconds to sleep / 休眠的毫秒数
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sign URL using Planetary Computer SAS API with retry logic
   * 使用 Planetary Computer SAS API 签名 URL，带重试逻辑
   * 
   * @param {string} url - URL to sign / 要签名的 URL
   * @param {number} [retryCount=0] - Current retry count / 当前重试次数
   * @returns {Promise<string>} Signed URL / 签名后的 URL
   */
  static async signUrl(url, retryCount = 0) {
    // If already appears signed with SAS, return as-is
    // 如果已经有 SAS 签名，直接返回
    try {
      const u = new URL(url);
      const qp = u.searchParams;
      if (qp.has('se') && qp.has('sig')) return url;
    } catch {}

    const signUrl = PC_SIGN_ENDPOINT + encodeURIComponent(url);

    const headers = { 'Accept': 'application/json' };
    if (CONFIG.pcSubscriptionKey) {
      headers['Ocp-Apim-Subscription-Key'] = CONFIG.pcSubscriptionKey;
    }

    const resp = await fetch(signUrl, {
      method: 'GET',
      headers
    });

    // Handle rate limiting with exponential backoff / 使用指数退避处理速率限制
    if (resp.status === 429) {
      if (retryCount >= PlanetaryComputerClient.MAX_RETRIES) {
        throw new Error(`PC sign failed: Rate limit exceeded after ${retryCount} retries`);
      }
      
      // Get retry-after header or use exponential backoff / 获取 retry-after 头或使用指数退避
      const retryAfter = resp.headers.get('retry-after');
      let delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : PlanetaryComputerClient.BASE_DELAY * Math.pow(2, retryCount);
      // Add jitter to prevent thundering herd / 添加抖动以防止惊群效应
      delay += Math.random() * 500;
      
      console.log(`PC sign rate limited, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${PlanetaryComputerClient.MAX_RETRIES})`);
      await PlanetaryComputerClient.sleep(delay);
      return PlanetaryComputerClient.signUrl(url, retryCount + 1);
    }

    if (!resp.ok) {
      throw new Error(`PC sign failed: ${resp.status} ${resp.statusText}`);
    }

    // Read once as text, then try JSON first, else treat as plain URL
    // 先读取为文本，然后尝试解析 JSON，否则作为纯 URL 处理
    const body = await resp.text();
    try {
      const data = JSON.parse(body);
      if (data && data.href) return data.href;
    } catch {
      // not JSON / 不是 JSON
    }
    if (body && /^https?:\/\//i.test(body.trim())) {
      return body.trim();
    }
    throw new Error('PC sign returned invalid payload');
  }

  /**
   * Download file using signed URL
   * 使用签名 URL 下载文件
   * 
   * @param {string} url - URL to download / 要下载的 URL
   * @param {string} [filename] - Optional filename / 可选的文件名
   * @returns {Promise<boolean>} Whether download succeeded / 下载是否成功
   */
  static async download(url, filename) {
    const signed = await PlanetaryComputerClient.signUrl(url);
    return DefaultHttpClient.download(signed, filename);
  }
}

/**
 * Sign Planetary Computer URL for use in UI (e.g., thumbnails)
 * 为 UI 使用签名 Planetary Computer URL（如缩略图）
 * 
 * Returns the original URL if signing fails, to allow graceful degradation
 * 签名失败时返回原始 URL，以实现优雅降级
 * 
 * @param {string} url - URL to sign / 要签名的 URL
 * @returns {Promise<string>} Signed URL / 签名后的 URL
 */
export async function signPlanetaryComputerUrl(url) {
  try {
    return await PlanetaryComputerClient.signUrl(url);
  } catch (e) {
    console.warn('Failed to sign Planetary Computer URL:', url, e);
    throw e; // Re-throw so callers can handle appropriately / 重新抛出以便调用者可以适当处理
  }
}

/**
 * S3 download client for s3:// URLs
 * 用于 s3:// URL 的 S3 下载客户端
 */
class S3Client {
  /**
   * Parse S3 URL to bucket and key
   * 解析 S3 URL 为 bucket 和 key
   * 
   * @param {string} s3url - S3 URL (s3://bucket/key)
   * @returns {{bucket: string, key: string}|null} Parsed result or null / 解析结果或 null
   */
  static parseS3(s3url) {
    const m = /^s3:\/\/([^\/]+)\/(.+)$/.exec(s3url);
    if (!m) return null;
    return { bucket: m[1], key: m[2] };
  }

  /**
   * Convert S3 bucket/key to HTTPS URL
   * 将 S3 bucket/key 转换为 HTTPS URL
   * 
   * @param {{bucket: string, key: string}} params - Bucket and key / Bucket 和 key
   * @returns {string} HTTPS URL / HTTPS URL
   */
  static toHttps({ bucket, key }) {
    // Virtual-hosted–style URL / 虚拟主机风格的 URL
    return `https://${bucket}.s3.amazonaws.com/${encodeURI(key)}`;
  }

  /**
   * Download file from S3 URL
   * 从 S3 URL 下载文件
   * 
   * @param {string} s3url - S3 URL to download / 要下载的 S3 URL
   * @param {string} [filename] - Optional filename / 可选的文件名
   * @returns {Promise<boolean>} Whether download succeeded / 下载是否成功
   */
  static async download(s3url, filename) {
    const parsed = S3Client.parseS3(s3url);
    if (!parsed) throw new Error('Invalid s3 url');
    const httpsUrl = S3Client.toHttps(parsed);

    const headers = {};
    if (CONFIG.s3RequesterPays) headers['x-amz-request-payer'] = 'requester';

    try {
      const resp = await fetch(httpsUrl, { method: 'GET', mode: 'cors', credentials: 'omit', headers });
      if (!resp.ok) throw new Error(`S3 HTTP ${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();
      await saveBlob(blob, filename || deriveFilenameFromUrl(httpsUrl));
      return true;
    } catch (err) {
      console.warn('S3Client direct HTTPS failed (likely requires signed request or CORS). s3url:', s3url, err);
      // Fallback: open the HTTPS URL; if blocked, inform user
      // 回退：打开 HTTPS URL；如果被阻止，通知用户
      try {
        window.open(httpsUrl, '_blank', 'noopener');
      } catch {}
      return false;
    }
  }
}

/**
 * Check if URL is an Azure Blob Storage URL
 * 检查 URL 是否为 Azure Blob 存储 URL
 * 
 * @param {string} url - URL to check / 要检查的 URL
 * @returns {boolean} Whether URL is Azure Blob / 是否为 Azure Blob URL
 */
function isAzureBlobUrl(url) {
  try {
    const u = new URL(url);
    return /\.blob\.core\.windows\.net$/i.test(u.hostname);
  } catch { return false; }
}

/**
 * Pick appropriate download client based on asset and provider
 * 根据资源和提供者选择合适的下载客户端
 * 
 * @param {STACAsset} asset - Asset to download / 要下载的资源
 * @param {string} provider - STAC provider key / STAC 数据源键名
 * @returns {{type: string}} Client type / 客户端类型
 */
function pickDownloadClient(asset, provider) {
  const href = String(asset?.href || '');
  if (href.startsWith('s3://')) return { type: 's3' };
  if (provider === 'planetary-computer' || isAzureBlobUrl(href)) return { type: 'pc' };
  return { type: 'http' };
}

/**
 * Choose primary downloadable assets from item
 * 从 item 中选择主要可下载资源
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @returns {{key: string, asset: STACAsset}[]} Array of asset selections / 资源选择数组
 */
export function choosePrimaryAssets(item) {
  const assets = item?.assets || {};
  const keys = Object.keys(assets);
  if (!keys.length) return [];
  // Prefer assets where roles include 'data'
  // 优先选择 roles 包含 'data' 的资源
  const dataKeys = keys.filter(k => {
    const roles = assets[k].roles;
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes('data');
    if (typeof roles === 'string') return roles.toLowerCase().includes('data');
    return false;
  });
  let chosen = dataKeys.length ? dataKeys : keys;
  // Exclude obvious non-data assets
  // 排除明显的非数据资源
  chosen = chosen.filter(k => !['thumbnail', 'rendered_preview', 'preview'].includes(k));
  return chosen.map(k => ({ key: k, asset: assets[k] }));
}

/**
 * Download item data (all primary assets)
 * 下载项目数据（所有主要资源）
 * 
 * @param {STACItem} item - STAC item to download / 要下载的 STAC 项目
 */
export async function downloadItemData(item) {
  if (!item) return;
  const providerSel = document.getElementById('provider');
  const provider = providerSel ? providerSel.value : 'planetary-computer';

  const toDownload = choosePrimaryAssets(item);
  if (!toDownload.length) {
    alert('No downloadable assets found for this item.');
    return;
  }

  for (const { key, asset } of toDownload) {
    const href = String(asset.href || '');
    const filenameBase = deriveFilenameFromAsset(asset);
    const client = pickDownloadClient(asset, provider);
    try {
      if (client.type === 's3') {
        await S3Client.download(href, filenameBase);
      } else if (client.type === 'pc') {
        await PlanetaryComputerClient.download(href, filenameBase);
      } else {
        await DefaultHttpClient.download(href, filenameBase);
      }
    } catch (e) {
      console.error(`Failed to download asset ${key}:`, e);
    }
  }
}

/**
 * Stream response to writer with progress tracking
 * 将响应流式传输到写入器并跟踪进度
 * 
 * @param {Response} resp - Fetch response / Fetch 响应
 * @param {FileSystemWritableFileStream} writer - File writer / 文件写入器
 * @param {function(DownloadProgress): void} [onProgress] - Progress callback / 进度回调
 * @param {AbortSignal} [abortSignal] - Abort signal / 中止信号
 */
async function streamToWriter(resp, writer, onProgress, abortSignal) {
  const contentLength = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
  const reader = resp.body?.getReader ? resp.body.getReader() : null;
  if (!reader) {
    const blob = await resp.blob();
    await writer.write(blob);
    if (onProgress) onProgress({ loaded: contentLength, total: contentLength, percent: 100 });
    return;
  }
  let loaded = 0;
  while (true) {
    if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength || value.length || 0;
    await writer.write(value);
    if (onProgress) {
      const percent = contentLength ? Math.round((loaded / contentLength) * 100) : null;
      onProgress({ loaded, total: contentLength, percent });
    }
  }
}

/**
 * Resolve final download URL based on asset and provider
 * 根据资源和提供者解析最终下载 URL
 * 
 * @param {STACAsset} asset - Asset to resolve / 要解析的资源
 * @param {string} provider - STAC provider key / STAC 数据源键名
 * @returns {Promise<string>} Resolved URL / 解析后的 URL
 */
async function resolveFinalUrl(asset, provider) {
  const href = String(asset.href || '');
  const client = pickDownloadClient(asset, provider);
  if (client.type === 's3') {
    const parsed = S3Client.parseS3(href);
    if (!parsed) throw new Error('Invalid s3 url');
    return S3Client.toHttps(parsed);
  }
  if (client.type === 'pc') {
    return await PlanetaryComputerClient.signUrl(href);
  }
  return href;
}

/**
 * Download multiple assets with progress tracking
 * 下载多个资源并跟踪进度
 * 
 * @param {DownloadSelection[]} selections - Assets to download / 要下载的资源
 * @param {DownloadOptions} [options] - Download options / 下载选项
 * @throws {DOMException} If aborted / 如果被中止
 */
export async function downloadAssets(selections, { provider, directoryHandle, onProgress, abortSignal } = {}) {
  let aborted = false;
  for (const sel of selections) {
    if (abortSignal?.aborted) { aborted = true; break; }
    const finalUrl = await resolveFinalUrl(sel.asset, provider);
    try {
      if (directoryHandle && window.isSecureContext && directoryHandle.createWritable) {
        const fileHandle = await directoryHandle.getFileHandle(sel.filename, { create: true });
        const writer = await fileHandle.createWritable();
        try {
          const resp = await fetch(finalUrl, { method: 'GET', signal: abortSignal });
          if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
          await streamToWriter(resp, writer, p => onProgress && onProgress(sel.key, p), abortSignal);
          await writer.close();
        } catch (e) {
          try { await writer.abort?.(); } catch (_) { try { await writer.close?.(); } catch {} }
          if (abortSignal?.aborted) { aborted = true; break; }
          throw e;
        }
      } else {
        // Fallback: still stream to memory for progress if possible, then save
        // 回退：如果可能，仍然流式传输到内存以获取进度，然后保存
        const resp = await fetch(finalUrl, { method: 'GET', signal: abortSignal });
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        const chunks = [];
        const contentLength = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
        const reader = resp.body?.getReader ? resp.body.getReader() : null;
        if (!reader) {
          const blob = await resp.blob();
          if (abortSignal?.aborted) { aborted = true; break; }
          await saveBlob(blob, sel.filename);
        } else {
          let loaded = 0;
          while (true) {
            if (abortSignal?.aborted) { aborted = true; break; }
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.byteLength || value.length || 0;
            if (onProgress) {
              const percent = contentLength ? Math.round((loaded / contentLength) * 100) : null;
              onProgress(sel.key, { loaded, total: contentLength, percent });
            }
          }
          if (aborted) break;
          const blob = new Blob(chunks);
          await saveBlob(blob, sel.filename);
        }
      }
    } catch (e) {
      if (abortSignal?.aborted) { aborted = true; break; }
      console.error(`Download failed for ${sel.key}:`, e);
      // Fallback: open the URL in a new tab/window so the browser can handle the download without CORS
      // 回退：在新标签页/窗口中打开 URL，让浏览器处理下载而不受 CORS 限制
      try { window.open(finalUrl, '_blank', 'noopener'); } catch {}
    }
  }
  if (aborted) throw new DOMException('Aborted', 'AbortError');
}

// ============================================================================
// ZIP Download Functions / ZIP 下载功能
// ============================================================================

/** @type {number} Warning threshold for ZIP download (500MB) / ZIP 下载的警告阈值（500MB） */
const ZIP_WARN_SIZE = 500 * 1024 * 1024;

/**
 * @typedef {Object} ZipDownloadOptions

 * @property {string} provider - STAC provider key / STAC 数据源键名
 * @property {STACItem} item - STAC item for metadata / 用于元数据的 STAC 项目
 * @property {function(string, DownloadProgress): void} [onProgress] - Progress callback / 进度回调
 * @property {function(string): void} [onStatus] - Status message callback / 状态消息回调
 * @property {AbortSignal} [abortSignal] - Abort signal / 中止信号
 * @property {boolean} [skipSizeWarning] - Skip size warning confirmation / 跳过大小警告确认
 */

/**
 * @typedef {Object} ZipDownloadResult
 * @property {boolean} success - Whether download succeeded / 下载是否成功
 * @property {string} [error] - Error message if failed / 失败时的错误消息
 * @property {number} [totalSize] - Total size of downloaded files / 下载文件的总大小
 * @property {number} [fileCount] - Number of files in ZIP / ZIP 中的文件数量
 * @property {boolean} [needsConfirmation] - Whether user confirmation is needed / 是否需要用户确认
 * @property {number} [estimatedSize] - Estimated total size / 估算的总大小
 */

/**
 * Estimate total size of assets by fetching HEAD requests
 * 通过 HEAD 请求估算资源的总大小
 * 
 * @param {DownloadSelection[]} selections - Assets to estimate / 要估算的资源
 * @param {string} provider - STAC provider key / STAC 数据源键名
 * @returns {Promise<{totalSize: number, sizes: Map<string, number>}>} Size info / 大小信息
 */
async function estimateAssetsSize(selections, provider) {
  const sizes = new Map();
  let totalSize = 0;

  // Process sequentially instead of in parallel to avoid triggering
  // Planetary Computer SAS API rate limits (HTTP 429) when many assets
  // need signing at once.
  // 顺序处理而不是并发处理，以避免在大量资源需要签名时触发
  // Planetary Computer SAS API 的限流（HTTP 429）。
  for (const sel of selections) {
    try {
      const finalUrl = await resolveFinalUrl(sel.asset, provider);
      const resp = await fetch(finalUrl, { method: 'HEAD' });
      if (resp.ok) {
        const size = parseInt(resp.headers.get('content-length') || '0', 10) || 0;
        sizes.set(sel.key, size);
        totalSize += size;
      }
    } catch {
      // Ignore errors, size will be 0 / 忽略错误，大小将为 0
    }
  }

  return { totalSize, sizes };
}

/**
 * Format bytes to human readable string
 * 将字节格式化为人类可读的字符串
 * 
 * @param {number} bytes - Bytes to format / 要格式化的字节数
 * @returns {string} Formatted string / 格式化后的字符串
 */
export function formatBytes(bytes) {
  if (!isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

/**
 * Generate ZIP filename from item ID and timestamp
 * 从 item ID 和时间戳生成 ZIP 文件名
 * 
 * @param {string} itemId - STAC item ID / STAC 项目 ID
 * @returns {string} ZIP filename / ZIP 文件名
 */
export function generateZipFilename(itemId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeId = sanitizeFilename(itemId).slice(0, 50);
  return `${safeId}_${timestamp}.zip`;
}

/**
 * Download assets and pack them into a ZIP file
 * 下载资源并打包成 ZIP 文件
 * 
 * @param {DownloadSelection[]} selections - Assets to download / 要下载的资源
 * @param {ZipDownloadOptions} options - Download options / 下载选项
 * @returns {Promise<ZipDownloadResult>} Download result / 下载结果
 */
export async function downloadAssetsAsZip(selections, options) {
  const { provider, item, onProgress, onStatus, abortSignal, skipSizeWarning } = options;

  if (!selections.length) {
    return { success: false, error: 'No assets selected' };
  }

  // Step 1: Estimate total size / 步骤 1：估算总大小
  onStatus?.('Estimating file sizes...');
  const { totalSize, sizes } = await estimateAssetsSize(selections, provider);

  // Warn if size exceeds threshold (but don't block) / 如果大小超过阈值则警告（但不阻止）
  if (!skipSizeWarning && totalSize > ZIP_WARN_SIZE) {
    const sizeStr = formatBytes(totalSize);
    return {
      success: false,
      needsConfirmation: true,
      estimatedSize: totalSize,
      error: `Estimated size is ${sizeStr}. Large files may take a while and use significant memory. Continue?`
    };
  }

  // Step 2: Create ZIP and download files / 步骤 2：创建 ZIP 并下载文件
  const zip = new JSZip();
  let downloadedSize = 0;
  let downloadedCount = 0;
  const failedAssets = [];

  // Add STAC Item metadata JSON / 添加 STAC Item 元数据 JSON
  if (item) {
    const itemJson = JSON.stringify(item, null, 2);
    zip.file('metadata.json', itemJson);
    onStatus?.('Added metadata.json to ZIP');
  }

  for (const sel of selections) {
    if (abortSignal?.aborted) {
      return { success: false, error: 'Download cancelled' };
    }

    onStatus?.(`Downloading: ${sel.filename}`);

    try {
      const finalUrl = await resolveFinalUrl(sel.asset, provider);
      const resp = await fetch(finalUrl, { method: 'GET', signal: abortSignal });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      // Stream download with progress / 流式下载并显示进度
      const contentLength = parseInt(resp.headers.get('content-length') || '0', 10) || sizes.get(sel.key) || 0;
      const reader = resp.body?.getReader();
      
      if (reader) {
        const chunks = [];
        let loaded = 0;

        while (true) {
          if (abortSignal?.aborted) {
            return { success: false, error: 'Download cancelled' };
          }

          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          loaded += value.byteLength || 0;

          if (onProgress) {
            const percent = contentLength ? Math.round((loaded / contentLength) * 100) : null;
            onProgress(sel.key, { loaded, total: contentLength, percent });
          }
        }

        const blob = new Blob(chunks);
        const arrayBuffer = await blob.arrayBuffer();
        zip.file(sel.filename, arrayBuffer);
        downloadedSize += loaded;
      } else {
        // Fallback for browsers without streaming / 不支持流式传输的浏览器回退
        const blob = await resp.blob();
        const arrayBuffer = await blob.arrayBuffer();
        zip.file(sel.filename, arrayBuffer);
        downloadedSize += blob.size;
        
        if (onProgress) {
          onProgress(sel.key, { loaded: blob.size, total: blob.size, percent: 100 });
        }
      }

      downloadedCount++;
    } catch (e) {
      if (abortSignal?.aborted) {
        return { success: false, error: 'Download cancelled' };
      }
      console.error(`Failed to download ${sel.key}:`, e);
      failedAssets.push({ key: sel.key, error: e.message });
    }
  }

  if (downloadedCount === 0) {
    return {
      success: false,
      error: `All downloads failed. ${failedAssets.map(f => `${f.key}: ${f.error}`).join('; ')}`
    };
  }

  // Step 3: Generate ZIP file / 步骤 3：生成 ZIP 文件
  onStatus?.('Generating ZIP file...');

  try {
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    }, (metadata) => {
      // ZIP generation progress / ZIP 生成进度
      if (onProgress) {
        onProgress('__zip__', {
          loaded: Math.round(metadata.percent),
          total: 100,
          percent: Math.round(metadata.percent)
        });
      }
    });

    // Step 4: Save ZIP file / 步骤 4：保存 ZIP 文件
    const zipFilename = generateZipFilename(item?.id || 'stac-assets');
    await saveBlob(zipBlob, zipFilename);

    onStatus?.(`ZIP download complete: ${zipFilename}`);

    // Report warnings for failed assets / 报告失败资源的警告
    if (failedAssets.length > 0) {
      console.warn('Some assets failed to download:', failedAssets);
    }

    return {
      success: true,
      totalSize: downloadedSize,
      fileCount: downloadedCount,
      ...(failedAssets.length > 0 && {
        error: `${failedAssets.length} asset(s) failed: ${failedAssets.map(f => f.key).join(', ')}`
      })
    };
  } catch (e) {
    console.error('Failed to generate ZIP:', e);
    return { success: false, error: `Failed to generate ZIP: ${e.message}` };
  }
}

/**
 * Get ZIP size warning threshold
 * 获取 ZIP 大小警告阈值
 * 
 * @returns {number} Size threshold in bytes / 字节为单位的大小阈值
 */
export function getZipSizeLimit() {
  return ZIP_WARN_SIZE;
}

// ============================================================================
// Sentinel-1 Full Product Download / Sentinel-1 完整产品下载
// ============================================================================

/**
 * Check if item is from a Sentinel-1 collection
 * 检查项目是否来自 Sentinel-1 集合
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @returns {boolean} Whether item is Sentinel-1 / 是否为 Sentinel-1
 */
export function isItemSentinel1(item) {
  return isSentinel1Collection(item?.collection);
}

/**
 * Check if Sentinel-1 full product download is available
 * 检查 Sentinel-1 完整产品下载是否可用
 * 
 * @returns {boolean} Whether download is available / 下载是否可用
 */
export function isSentinel1DownloadAvailable() {
  return hasCopernicusCredentials();
}

/**
 * Download Sentinel-1 full product as ZIP
 * 下载 Sentinel-1 完整产品 ZIP 文件
 * 
 * @param {STACItem} item - STAC item / STAC 项目
 * @param {Object} [options] - Download options / 下载选项
 * @param {function(DownloadProgress): void} [options.onProgress] - Progress callback / 进度回调
 * @param {function(string): void} [options.onStatus] - Status callback / 状态回调
 * @param {AbortSignal} [options.abortSignal] - Abort signal / 中止信号
 * @returns {Promise<{success: boolean, error?: string, filename?: string, size?: number}>} Download result / 下载结果
 */
export async function downloadSentinel1Product(item, options = {}) {
  return await downloadSentinel1FullProduct(item, options);
}

