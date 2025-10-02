/**
 * Download Clients for STAC assets
 * - DefaultHttpClient: downloads via HTTP(S)
 * - PlanetaryComputerClient: signs Azure Blob URLs via MPC SAS API then downloads
 * - S3Client: attempts to download s3:// assets via HTTPS mapping (best-effort) and optional requester-pays header
 */

const PC_SIGN_ENDPOINT = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=';

// Pull configuration from environment or window globals
const CONFIG = {
  pcSubscriptionKey:
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PC_SUBSCRIPTION_KEY) ||
    (typeof window !== 'undefined' && window.PC_SUBSCRIPTION_KEY) ||
    '',
  s3RequesterPays:
    ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_S3_REQUESTER_PAYS) ||
      (typeof window !== 'undefined' && window.S3_REQUESTER_PAYS) ||
      'false')
      .toString()
      .toLowerCase() === 'true'
};

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

export function deriveFilenameFromAsset(asset) {
  if (!asset) return 'download';
  // Use the tail of the URL path as the filename, ignoring title per requirement
  if (asset.href) return sanitizeFilename(deriveFilenameFromUrl(asset.href));
  return 'download';
}

function sanitizeFilename(name) {
  return String(name).replace(/[\/:*?"<>|]+/g, '_');
}

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

class DefaultHttpClient {
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

class PlanetaryComputerClient {
  static async signUrl(url) {
    // If already appears signed with SAS, return as-is
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
    const body = await resp.text();
    try {
      const data = JSON.parse(body);
      if (data && data.href) return data.href;
    } catch {
      // not JSON
    }
    if (body && /^https?:\/\//i.test(body.trim())) {
      return body.trim();
    }
    throw new Error('PC sign returned invalid payload');
  }

  static async download(url, filename) {
    const signed = await PlanetaryComputerClient.signUrl(url);
    return DefaultHttpClient.download(signed, filename);
  }
}

class S3Client {
  static parseS3(s3url) {
    // s3://bucket/key -> {bucket, key}
    const m = /^s3:\/\/([^\/]+)\/(.+)$/.exec(s3url);
    if (!m) return null;
    return { bucket: m[1], key: m[2] };
  }

  static toHttps({ bucket, key }) {
    // Virtual-hosted–style URL
    return `https://${bucket}.s3.amazonaws.com/${encodeURI(key)}`;
  }

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
      try {
        window.open(httpsUrl, '_blank', 'noopener');
      } catch {}
      return false;
    }
  }
}

function isAzureBlobUrl(url) {
  try {
    const u = new URL(url);
    return /\.blob\.core\.windows\.net$/i.test(u.hostname);
  } catch { return false; }
}

function pickDownloadClient(asset, provider) {
  const href = String(asset?.href || '');
  if (href.startsWith('s3://')) return { type: 's3' };
  if (provider === 'planetary-computer' || isAzureBlobUrl(href)) return { type: 'pc' };
  return { type: 'http' };
}

export function choosePrimaryAssets(item) {
  const assets = item?.assets || {};
  const keys = Object.keys(assets);
  if (!keys.length) return [];
  // Prefer assets where roles include 'data'
  const dataKeys = keys.filter(k => {
    const roles = assets[k].roles;
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes('data');
    if (typeof roles === 'string') return roles.toLowerCase().includes('data');
    return false;
  });
  let chosen = dataKeys.length ? dataKeys : keys;
  // Exclude obvious non-data assets
  chosen = chosen.filter(k => !['thumbnail', 'rendered_preview', 'preview'].includes(k));
  return chosen.map(k => ({ key: k, asset: assets[k] }));
}

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
    }
  }
  if (aborted) throw new DOMException('Aborted', 'AbortError');
}
