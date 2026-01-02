/**
 * @fileoverview Download Clients for STAC assets
 * STAC 资源下载客户端
 * 
 * - DefaultHttpClient: downloads via HTTP(S) / 通过 HTTP(S) 下载
 * - PlanetaryComputerClient: signs Azure Blob URLs via MPC SAS API then downloads / 通过 MPC SAS API 签名 Azure Blob URL 后下载
 * - S3Client: attempts to download s3:// assets via HTTPS mapping (best-effort) and optional requester-pays header / 尝试通过 HTTPS 映射下载 s3:// 资源（尽力而为）并支持可选的请求者付费头
 */

/** @typedef {import('./types.js').STACItem} STACItem */
/** @typedef {import('./types.js').STACAsset} STACAsset */
/** @typedef {import('./types.js').DownloadSelection} DownloadSelection */
/** @typedef {import('./types.js').DownloadProgress} DownloadProgress */
/** @typedef {import('./types.js').DownloadOptions} DownloadOptions */

import { DOWNLOAD_CONFIG } from './config.js';

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
  /**
   * Sign URL using Planetary Computer SAS API
   * 使用 Planetary Computer SAS API 签名 URL
   * 
   * @param {string} url - URL to sign / 要签名的 URL
   * @returns {Promise<string>} Signed URL / 签名后的 URL
   */
  static async signUrl(url) {
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
