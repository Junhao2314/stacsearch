/**
 * @fileoverview CollectionPicker - Collection picker module
 * CollectionPicker - 集合选择器模块
 * 
 * Responsible for collection list loading, search, pagination, and detail display
 * 负责集合列表加载、搜索、分页、详情展示
 */

/** @typedef {import('../types.js').STACCollection} STACCollection */

import { getCollections, getCollection } from '../stac-service.js';
import { PAGINATION_CONFIG, PRIORITY_COLLECTIONS, MPC_COLLECTIONS } from '../config.js';
import { paginate, escapeHtml, debounce } from './utils.js';

export class CollectionPicker {
    constructor() {
        /** @type {STACCollection[]} */
        this.allCollections = [];
        /** @type {STACCollection[]} */
        this.filteredCollections = [];
        /** @type {number} */
        this.collectionsPage = 1;
        /** @type {string|null} */
        this.collectionsLoadedProvider = null;
        /** @type {number} */
        this.collectionsRequestId = 0;
        /** @type {string} */
        this.defaultCollectionOptionsHTML = '';
        /** @type {HTMLElement|null} */
        this._lastFocusedElement = null;
        /** @type {Function|null} */
        this._debouncedSearch = null;
        /** @type {string|null} */
        this._currentProvider = null;
        /** @type {boolean} */
        this._searchInputBound = false;
        /** @type {number} */
        this._detailRequestId = 0;
    }

    /**
     * Initialize - capture default options
     * 初始化 - 捕获默认选项
     */
    initialize() {
        const colSel = document.getElementById('collection');
        if (colSel && colSel.tagName === 'SELECT' && !this.defaultCollectionOptionsHTML) {
            this.defaultCollectionOptionsHTML = colSel.innerHTML;
        }
    }

    /**
     * Open collection picker modal
     * 打开集合选择器弹窗
     * 
     * @param {string} provider - STAC provider key / STAC 数据源键名
     */
    async open(provider) {
        const modal = document.getElementById('collection-modal');
        const listView = document.getElementById('collection-list');
        const detailView = document.getElementById('collection-detail');
        const grid = document.getElementById('collection-grid');
        const pag = document.getElementById('collection-pagination');
        const searchInput = document.getElementById('collection-search');
        
        if (!modal || !grid || !pag) return;

        // Store the element that triggered the modal for focus restoration
        // 存储触发弹窗的元素以便恢复焦点
        this._lastFocusedElement = document.activeElement;

        modal.classList.add('show');
        if (detailView) { 
            detailView.classList.add('hidden'); 
            detailView.innerHTML = ''; 
        }
        if (listView) listView.classList.remove('hidden');

        grid.innerHTML = '<div class="loading" role="status" aria-live="polite">Loading collections...</div>';
        pag.innerHTML = '';
        this.collectionsPage = 1;

        // Focus the search input when modal opens
        // 弹窗打开时聚焦搜索输入框
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 50);
        }

        const thisRequestId = ++this.collectionsRequestId;

        try {
            if (!this.allCollections.length || this.collectionsLoadedProvider !== provider) {
                const cols = await getCollections(provider);
                
                if (thisRequestId !== this.collectionsRequestId) return;
                
                this.allCollections = Array.isArray(cols) ? cols : [];
                this.collectionsLoadedProvider = provider;

                const priorityIds = PRIORITY_COLLECTIONS[provider] || [];
                if (priorityIds.length > 0) {
                    const prioritySet = new Set(priorityIds);
                    const priority = this.allCollections.filter(c => prioritySet.has(c.id));
                    const others = this.allCollections.filter(c => !prioritySet.has(c.id));
                    const orderedPriority = priorityIds.map(id => priority.find(c => c.id === id)).filter(Boolean);
                    this.allCollections = [...orderedPriority, ...others];
                }
            }
            
            if (thisRequestId !== this.collectionsRequestId) return;
            
            this._applyFilter('');
            this._renderPage(provider);
        } catch (e) {
            if (thisRequestId === this.collectionsRequestId) {
                grid.innerHTML = `<div class="error" role="alert" aria-live="assertive">Failed to load collections: ${escapeHtml(e.message || String(e))}</div>`;
            }
        }

        if (searchInput) {
            searchInput.value = '';
            this._currentProvider = provider;
            
            // Only bind event listener once to avoid memory leaks
            // 只绑定一次事件监听器以避免内存泄漏
            if (!this._searchInputBound) {
                this._debouncedSearch = debounce(() => {
                    this.collectionsPage = 1;
                    this._applyFilter(searchInput.value);
                    this._renderPage(this._currentProvider);
                }, 200);
                searchInput.oninput = this._debouncedSearch;
                this._searchInputBound = true;
            }
        }
    }

    /**
     * Close modal
     * 关闭弹窗
     */
    close() {
        const modal = document.getElementById('collection-modal');
        if (modal) modal.classList.remove('show');
        
        // Restore focus to the element that triggered the modal
        // 恢复焦点到触发弹窗的元素
        if (this._lastFocusedElement && typeof this._lastFocusedElement.focus === 'function') {
            this._lastFocusedElement.focus();
            this._lastFocusedElement = null;
        }
    }

    /**
     * Reset state when provider changes
     * 当数据源变更时重置状态
     */
    reset() {
        this.allCollections = [];
        this.filteredCollections = [];
        this.collectionsPage = 1;
        this.collectionsLoadedProvider = null;
    }

    /**
     * Populate legacy SELECT dropdown
     * 填充旧版 SELECT 下拉框
     * 
     * @param {string} provider - STAC provider key / STAC 数据源键名
     */
    populateLegacySelect(provider) {
        const select = document.getElementById('collection');
        if (!select || select.tagName !== 'SELECT') return;

        if (provider === 'planetary-computer' || provider === 'earth-search') {
            let collections = MPC_COLLECTIONS;
            if (provider === 'earth-search') {
                collections = MPC_COLLECTIONS.filter(c => 
                    c.id !== 'sentinel-1-rtc' && c.id !== 'landsat-c2-l2'
                );
            }
            const opts = ['<option value="">Select a collection...</option>']
                .concat(collections.map(c => `<option value="${c.id}" title="${c.title}">${c.title}</option>`));
            select.innerHTML = opts.join('');
            select.value = '';
        } else if (provider === 'copernicus-dataspace') {
            // Copernicus Data Space collections
            // Copernicus Data Space 集合
            const copernicusCollections = [
                { id: 'SENTINEL-1', title: 'Sentinel-1 SAR (GRD, SLC, OCN)' },
                { id: 'SENTINEL-2', title: 'Sentinel-2 MSI' },
                { id: 'SENTINEL-3', title: 'Sentinel-3 (OLCI, SLSTR, etc.)' },
                { id: 'SENTINEL-5P', title: 'Sentinel-5P TROPOMI' },
            ];
            const opts = ['<option value="">Select a collection...</option>']
                .concat(copernicusCollections.map(c => `<option value="${c.id}" title="${c.title}">${c.title}</option>`));
            select.innerHTML = opts.join('');
            select.value = '';
        } else if (this.defaultCollectionOptionsHTML) {
            select.innerHTML = this.defaultCollectionOptionsHTML;
        }
    }

    /**
     * Apply search filter
     * 应用搜索过滤器
     * 
     * @param {string} query - Search query / 搜索查询
     * @private
     */
    _applyFilter(query) {
        const q = String(query || '').trim().toLowerCase();
        if (!q) {
            this.filteredCollections = this.allCollections.slice();
            return;
        }
        this.filteredCollections = this.allCollections.filter(c => {
            const id = String(c.id || '').toLowerCase();
            const title = String(c.title || '').toLowerCase();
            const keywords = Array.isArray(c.keywords) ? c.keywords.join(' ').toLowerCase() : '';
            return id.includes(q) || title.includes(q) || keywords.includes(q);
        });
    }

    /**
     * Render current page
     * 渲染当前页面
     * 
     * @param {string} provider - STAC provider key / STAC 数据源键名
     * @private
     */
    _renderPage(provider) {
        const grid = document.getElementById('collection-grid');
        const pag = document.getElementById('collection-pagination');
        if (!grid || !pag) return;

        grid.innerHTML = '';

        const { pageItems, clampedPage } = paginate({
            items: this.filteredCollections,
            page: this.collectionsPage,
            perPage: PAGINATION_CONFIG.collectionsPerPage,
            paginationEl: pag,
            prevBtnId: 'col-page-prev',
            nextBtnId: 'col-page-next',
            extraClass: 'collection-pagination',
            onPageChange: (newPage) => { 
                this.collectionsPage = newPage; 
                this._renderPage(provider); 
            }
        });

        this.collectionsPage = clampedPage;

        pageItems.forEach(col => {
            const card = this._createCard(col, provider);
            grid.appendChild(card);
        });
    }

    /**
     * Create collection card element
     * 创建集合卡片元素
     * 
     * @param {STACCollection} c - Collection data / 集合数据
     * @param {string} provider - STAC provider key / STAC 数据源键名
     * @returns {HTMLElement} Card element / 卡片元素
     * @private
     */
    _createCard(c, provider) {
        const div = document.createElement('div');
        div.className = 'collection-card';
        div.setAttribute('title', c.id || 'collection');
        div.setAttribute('role', 'listitem');
        div.setAttribute('tabindex', '0');
        div.setAttribute('aria-label', `Collection: ${c.title || c.id}`);

        const assets = c.assets || {};
        const thumb = assets.thumbnail?.href || null;
        const title = c.title || c.id || '';
        const desc = c.description ? String(c.description).replace(/\n+/g, ' ') : '';
        const shortDesc = c['msft:short_description'] || (desc.length > 180 ? (desc.slice(0, 180) + '…') : desc);
        const kw = Array.isArray(c.keywords) ? c.keywords.slice(0, 8) : [];

        const thumbHTML = thumb ? `<img src="${escapeHtml(thumb)}" alt="" onerror="this.style.display='none'"/>` : '';

        const priorityIds = PRIORITY_COLLECTIONS[provider] || [];
        const isTested = priorityIds.includes(c.id);
        const testedBadge = isTested ? '<span class="tested-badge">Tested</span>' : '';

        div.innerHTML = `
            <div class="thumb">${thumbHTML}</div>
            <div class="info">
                <div class="title">${escapeHtml(title)}${testedBadge}</div>
                <div class="id">${escapeHtml(c.id)}</div>
                ${shortDesc ? `<div class="desc">${escapeHtml(shortDesc)}</div>` : ''}
                ${kw.length ? `<div class="keywords">${kw.map(k => `<span>${escapeHtml(k)}</span>`).join('')}</div>` : ''}
            </div>
        `;

        div.addEventListener('click', () => {
            this._showDetail(c, provider);
        });

        // Keyboard support: Enter and Space to activate
        // 键盘支持：Enter 和 Space 激活
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._showDetail(c, provider);
            }
        });

        return div;
    }

    /**
     * Show collection detail view
     * 显示集合详情视图
     * 
     * @param {STACCollection} meta - Collection metadata / 集合元数据
     * @param {string} provider - STAC provider key / STAC 数据源键名
     * @private
     */
    async _showDetail(meta, provider) {
        const listView = document.getElementById('collection-list');
        const detailView = document.getElementById('collection-detail');
        if (!detailView) return;

        // Increment request ID to prevent race conditions when user clicks multiple cards quickly
        // 增加请求 ID 以防止用户快速点击多个卡片时的竞态条件
        const thisDetailRequestId = ++this._detailRequestId;

        let col = meta;
        try {
            col = await getCollection(provider, meta.id);
            // Check if this request is still the latest one
            // 检查此请求是否仍是最新的
            if (thisDetailRequestId !== this._detailRequestId) return;
        } catch (e) {
            if (thisDetailRequestId !== this._detailRequestId) return;
            col = meta;
        }

        const assets = col.assets || {};
        const thumb = assets.thumbnail?.href || '';
        const title = col.title || col.id || '';
        const desc = col.description || '';
        const keywords = Array.isArray(col.keywords) ? col.keywords : [];
        const providers = Array.isArray(col.providers) ? col.providers : [];
        const extent = col.extent || {};
        const temporal = extent.temporal?.interval?.[0] || [];
        const spatial = extent.spatial?.bbox?.[0] || [];

        const links = Array.isArray(col.links) ? col.links : [];
        const describedBy = links.find(l => l.rel === 'describedby');
        const summaries = col.summaries || {};

        let temporalRange = 'N/A';
        if (temporal.length >= 2) {
            const start = temporal[0] ? new Date(temporal[0]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Start';
            const end = temporal[1] ? new Date(temporal[1]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Present';
            temporalRange = `${start} – ${end}`;
        }

        let spatialExtent = 'Global';
        if (spatial.length === 4) {
            const [west, south, east, north] = spatial;
            if (!(west === -180 && south === -90 && east === 180 && north === 90)) {
                spatialExtent = `[${west.toFixed(2)}, ${south.toFixed(2)}] to [${east.toFixed(2)}, ${north.toFixed(2)}]`;
            }
        }

        const kwHTML = keywords.slice(0, 15).map(k => `<span>${escapeHtml(k)}</span>`).join('');
        const providersHTML = providers.map(p => {
            const roles = Array.isArray(p.roles) ? p.roles.join(', ') : '';
            return `
                <div class="provider-card">
                    <span class="provider-name">${escapeHtml(p.name || 'Unknown')}</span>
                    ${roles ? `<span class="provider-roles">(${escapeHtml(roles)})</span>` : ''}
                </div>
            `;
        }).join('');

        const summariesHTML = this._formatSummaries(summaries);

        detailView.innerHTML = `
            <div class="header-section">
                <div class="thumb">${thumb ? `<img src="${thumb}" alt="Thumbnail" onerror="this.parentElement.style.display='none'"/>` : ''}</div>
                <div class="header-info">
                    <div class="title">${escapeHtml(title)}</div>
                    <div class="id">${escapeHtml(col.id)}</div>
                    ${kwHTML ? `
                        <div class="keywords-section">
                            <span class="keywords-label">Keywords:</span>
                            <div class="keywords">${kwHTML}</div>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${desc ? `<div class="desc">${escapeHtml(desc)}</div>` : ''}

            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Temporal Coverage</span>
                    <span class="info-value">${temporalRange}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Spatial Extent</span>
                    <span class="info-value">${spatialExtent}</span>
                </div>
                ${describedBy && describedBy.href && /^https?:\/\//i.test(describedBy.href) ? `
                    <div class="info-item">
                        <span class="info-label">Documentation</span>
                        <span class="info-value"><a href="${escapeHtml(describedBy.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(describedBy.title || 'View Docs')}</a></span>
                    </div>
                ` : ''}
                ${summariesHTML}
            </div>

            ${providersHTML ? `
                <div>
                    <div class="keywords-label" style="margin-bottom: 0.5rem;">Providers</div>
                    <div class="providers-section">${providersHTML}</div>
                </div>
            ` : ''}

            <div class="actions">
                <button id="collection-back" type="button" class="secondary-btn" title="Back to list">Back</button>
                <button id="collection-import" type="button" class="primary-btn">Import Collection</button>
            </div>
        `;

        if (listView) listView.classList.add('hidden');
        detailView.classList.remove('hidden');

        document.getElementById('collection-back').onclick = () => {
            detailView.classList.add('hidden');
            detailView.innerHTML = '';
            if (listView) listView.classList.remove('hidden');
        };

        document.getElementById('collection-import').onclick = () => {
            const hidden = document.getElementById('collection');
            if (hidden) hidden.value = col.id;
            const selBtn = document.getElementById('open-collection-picker');
            if (selBtn) selBtn.textContent = title || col.id;
            this.close();
        };
    }

    /**
     * Format summaries for display
     * 格式化摘要以供显示
     * 
     * @param {Object} summaries - Collection summaries / 集合摘要
     * @returns {string} HTML string / HTML 字符串
     * @private
     */
    _formatSummaries(summaries) {
        if (!Object.keys(summaries).length) return '';

        const formatValue = (key, value) => {
            if (Array.isArray(value)) {
                if (value.length === 0) return 'N/A';
                if (Array.isArray(value[0])) {
                    return value.map(arr => Array.isArray(arr) ? `[${arr.join(', ')}]` : arr).join(' • ');
                }
                if (typeof value[0] === 'object' && value[0] !== null) {
                    if (key === 'eo:bands') {
                        return value.map(band => {
                            const parts = [];
                            if (band.name) parts.push(`<strong>${escapeHtml(band.name)}</strong>`);
                            if (band.common_name) parts.push(`(${escapeHtml(band.common_name)})`);
                            if (band.description) parts.push(`- ${escapeHtml(band.description)}`);
                            if (band.center_wavelength) parts.push(`λ=${escapeHtml(String(band.center_wavelength))}μm`);
                            if (band.gsd) parts.push(`${escapeHtml(String(band.gsd))}m`);
                            return parts.join(' ');
                        }).join('<br>');
                    }
                    return JSON.stringify(value, null, 2);
                }
                return value.join(', ');
            }
            if (typeof value === 'object' && value !== null) {
                const keys = Object.keys(value);
                if (keys.length <= 4) {
                    const parts = keys.map(k => {
                        const v = value[k];
                        if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
                            return `${k}: ${v}`;
                        }
                        return null;
                    }).filter(Boolean);
                    if (parts.length === keys.length) return parts.join(' | ');
                }
                return JSON.stringify(value, null, 2);
            }
            return String(value);
        };

        return Object.entries(summaries).map(([key, value]) => {
            const formattedValue = formatValue(key, value);
            const isEoBands = key === 'eo:bands';
            const needsHTML = formattedValue.includes('<br>') || formattedValue.includes('<strong>');
            const isLongValue = !needsHTML && (formattedValue.length > 100 || formattedValue.includes('\n'));

            return `
                <div class="info-item ${isLongValue || isEoBands ? 'info-item-full' : ''}">
                    <span class="info-label">${escapeHtml(key)}</span>
                    <span class="info-value ${isLongValue ? 'info-value-pre' : (isEoBands ? 'info-value-bands' : '')}">${needsHTML ? formattedValue : escapeHtml(formattedValue)}</span>
                </div>
            `;
        }).join('');
    }
}
