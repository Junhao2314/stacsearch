/**
 * @fileoverview UIController - UI control module
 * UIController - UI 控制模块
 * 
 * Responsible for event bindng, modal management, result list rendering
 * 负责事件绑定、模态框管理、结果列表渲染
 */

/** @typedef {import('../types.js').STACItem} STACItem */
/** @typedef {import('../types.js').STACAsset} STACAsset */
/** @typedef {import('../types.js').DownloadProgress} DownloadProgress */
/** @typedef {import('./MapManager.js').MapManager} MapManager */
/** @typedef {import('./SearchManager.js').SearchManager} SearchManager */
/** @typedef {import('./DrawingManager.js').DrawingManager} DrawingManager */
/** @typedef {import('./CollectionPicker.js').CollectionPicker} CollectionPicker */

import { formatItemForDisplay, getItemThumbnail, resolveAssetHref } from '../stac-service.js';
import { signPlanetaryComputerUrl, deriveFilenameFromAsset, downloadAssets, choosePrimaryAssets } from '../download-clients.js';
import { coalesce, escapeHtml, throttle } from './utils.js';

export class UIController {
    /**
     * @param {MapManager} mapManager - Map manager instance
     * @param {SearchManager} searchManager - Search manager instance
     * @param {DrawingManager} drawingManager - Drawing manager instance
     * @param {CollectionPicker} collectionPicker - Collection picker instance
     */
    constructor(mapManager, searchManager, drawingManager, collectionPicker) {
        /** @type {MapManager} */
        this.mapManager = mapManager;
        /** @type {SearchManager} */
        this.searchManager = searchManager;
        /** @type {DrawingManager} */
        this.drawingManager = drawingManager;
        /** @type {CollectionPicker} */
        this.collectionPicker = collectionPicker;
        /** @type {string|null} */
        this.activeResultItemId = null;
        
        /** @type {HTMLElement|null} */
        this._resultsListEl = null;
        /** @type {HTMLElement|null} */
        this._paginationEl = null;
        /** @type {HTMLElement|null} */
        this._lastFocusedElement = null;
        
        // Create throttled version of pointer move handler
        // 创建节流版本的 pointer move 处理函数
        this._throttledPointerMove = throttle(this._handleMapPointerMoveCore.bind(this), 50);
    }

    /**
     * Initialize date inputs - hybrid mode supporting both native picker and manual input
     * 初始化日期输入 - 支持原生选择器和手动输入的混合模式
     */
    initializeDateInputs() {
        const dateWrappers = document.querySelectorAll('.date-input-wrapper');
        
        dateWrappers.forEach(wrapper => {
            const displayInput = wrapper.querySelector('.date-display');
            const nativeInput = wrapper.querySelector('.date-native');
            const pickerBtn = wrapper.querySelector('.date-picker-btn');
            
            if (!displayInput || !nativeInput) return;

            // Manual input formatting (YYYY-MM-DD)
            // 手动输入格式化（YYYY-MM-DD）
            displayInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length >= 4) value = value.substring(0, 4) + '-' + value.substring(4);
                if (value.length >= 7) value = value.substring(0, 7) + '-' + value.substring(7, 9);
                e.target.value = value.substring(0, 10);
                
                // Sync to native input if valid date
                // 如果是有效日期则同步到原生输入
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                    nativeInput.value = e.target.value;
                    this._validateDateRange();
                }
            });

            // Validate on blur / 失焦时验证
            displayInput.addEventListener('blur', () => {
                this._validateDateRange();
            });

            // Native picker change syncs to display
            // 原生选择器变更同步到显示输入
            nativeInput.addEventListener('change', () => {
                if (nativeInput.value) {
                    displayInput.value = nativeInput.value;
                    this._validateDateRange();
                }
            });

            // Click on picker button opens native date picker
            // 点击选择器按钮打开原生日期选择器
            if (pickerBtn) {
                pickerBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    nativeInput.showPicker?.() || nativeInput.click();
                });
            }
        });

        this._setDefaultDates();
    }

    /**
     * Validate date range - ensure start date <= end date
     * 验证日期范围 - 确保开始日期 <= 结束日期
     * 
     * @private
     */
    _validateDateRange() {
        const fromDisplay = document.getElementById('date-from-display');
        const toDisplay = document.getElementById('date-to-display');
        const fromNative = document.getElementById('date-from');
        const toNative = document.getElementById('date-to');

        if (!fromDisplay || !toDisplay) return;

        const fromVal = fromDisplay.value;
        const toVal = toDisplay.value;

        // Only validate if both are valid dates
        // 仅在两个都是有效日期时验证
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromVal) || !/^\d{4}-\d{2}-\d{2}$/.test(toVal)) {
            fromDisplay.classList.remove('date-error');
            toDisplay.classList.remove('date-error');
            return;
        }

        const fromDate = new Date(fromVal);
        const toDate = new Date(toVal);

        if (fromDate > toDate) {
            // Swap dates / 交换日期
            fromDisplay.value = toVal;
            toDisplay.value = fromVal;
            if (fromNative) fromNative.value = toVal;
            if (toNative) toNative.value = fromVal;
        }
    }

    /**
     * Set default date values
     * 设置默认日期值
     */
    _setDefaultDates() {
        const dateFromDisplay = document.getElementById('date-from-display');
        const dateToDisplay = document.getElementById('date-to-display');
        const dateFromNative = document.getElementById('date-from');
        const dateToNative = document.getElementById('date-to');

        const formatYMD = (d) => {
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

        const toDate = formatYMD(now);
        const fromDate = formatYMD(startOfMonth);

        // Set both display and native inputs / 设置显示和原生输入
        if (dateToDisplay) dateToDisplay.value = toDate;
        if (dateToNative) dateToNative.value = toDate;
        if (dateFromDisplay) dateFromDisplay.value = fromDate;
        if (dateFromNative) dateFromNative.value = fromDate;
    }

    /**
     * Setup all event listeners
     * 设置所有事件监听器
     */
    setupEventListeners() {
        this._setupSearchEvents();
        this._setupDrawingEvents();
        this._setupNavigationEvents();
        this._setupModalEvents();
        this._setupMapEvents();
        this._setupBasemapEvents();
        this._setupCollectionPickerEvents();
    }

    _setupSearchEvents() {
        document.getElementById('search-btn').addEventListener('click', () => this.performSearch());
        
        document.getElementById('provider').addEventListener('change', (e) => {
            this.searchManager.changeProvider(e.target.value);
            this.collectionPicker.populateLegacySelect(e.target.value);
            this.collectionPicker.reset();
            
            const hiddenCol = document.getElementById('collection');
            if (hiddenCol) hiddenCol.value = '';
            const btn = document.getElementById('open-collection-picker');
            if (btn) btn.textContent = 'Select Collection';
        });
    }

    _setupDrawingEvents() {
        const drawBboxBtn = document.getElementById('draw-bbox');
        if (drawBboxBtn) {
            drawBboxBtn.addEventListener('click', () => {
                const fields = ['bbox-west', 'bbox-south', 'bbox-east', 'bbox-north'];
                const values = fields.map(id => document.getElementById(id).value);

                if (values.every(v => v !== '')) {
                    this._drawBboxFromInputs();
                } else {
                    this.drawingManager.startDrawing('Box', (bbox) => this._updateBboxInputs(bbox));
                    this._updateToolbarButtons('draw-rectangle');
                }
            });
        }

        document.getElementById('draw-polygon').addEventListener('click', () => {
            this.drawingManager.startDrawing('Polygon', (bbox) => this._updateBboxInputs(bbox));
            this._updateToolbarButtons('draw-polygon');
        });

        document.getElementById('draw-rectangle').addEventListener('click', () => {
            this.drawingManager.startDrawing('Box', (bbox) => this._updateBboxInputs(bbox));
            this._updateToolbarButtons('draw-rectangle');
        });

        document.getElementById('clear-drawing').addEventListener('click', () => {
            this.drawingManager.clearDrawing();
            this._clearBboxInputs();
        });

        document.getElementById('toggle-drawing-tools').addEventListener('click', () => {
            this._toggleDrawingTools();
        });
    }

    _setupNavigationEvents() {
        document.getElementById('zoom-in').addEventListener('click', () => this.mapManager.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.mapManager.zoomOut());
        document.getElementById('reset-view').addEventListener('click', () => this.mapManager.resetView());
    }

    _setupModalEvents() {
        // Item modal close button / 项目弹窗关闭按钮
        const itemModalClose = document.querySelector('#item-modal .close');
        if (itemModalClose) {
            itemModalClose.addEventListener('click', () => this.closeModal());
        }
        
        // Item modal backdrop click / 项目弹窗背景点击
        document.getElementById('item-modal').addEventListener('click', (e) => {
            if (e.target.id === 'item-modal') this.closeModal();
        });

        // Collection modal close button / 集合弹窗关闭按钮
        const colClose = document.querySelector('#collection-modal .close');
        if (colClose) colClose.addEventListener('click', () => this.collectionPicker.close());
        
        // Collection modal backdrop click / 集合弹窗背景点击
        const colModal = document.getElementById('collection-modal');
        if (colModal) {
            colModal.addEventListener('click', (e) => {
                if (e.target.id === 'collection-modal') this.collectionPicker.close();
            });
        }

        // Global ESC key handler for modals / 弹窗的全局 ESC 键处理
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const itemModal = document.getElementById('item-modal');
                const colModal = document.getElementById('collection-modal');
                
                if (itemModal?.classList.contains('show')) {
                    this.closeModal();
                    e.preventDefault();
                } else if (colModal?.classList.contains('show')) {
                    this.collectionPicker.close();
                    e.preventDefault();
                }
            }
        });

        // Setup focus trap for item modal / 为项目弹窗设置焦点陷阱
        this._setupFocusTrap('item-modal');
        this._setupFocusTrap('collection-modal');
    }

    /**
     * Setup focus trap for a modal
     * 为弹窗设置焦点陷阱
     * 
     * @param {string} modalId - Modal element ID / 弹窗元素 ID
     * @private
     */
    _setupFocusTrap(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab' || !modal.classList.contains('show')) return;

            const focusableElements = modal.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        });
    }

    _setupMapEvents() {
        const map = this.mapManager.getMap();
        map.on('pointermove', (evt) => this._handleMapPointerMove(evt));
        map.on('singleclick', (evt) => this._handleMapSingleClick(evt));
    }

    /**
     * Get cached results list element
     * 获取缓存的结果列表元素
     */
    _getResultsListEl() {
        if (!this._resultsListEl) {
            this._resultsListEl = document.getElementById('results-list');
        }
        return this._resultsListEl;
    }

    /**
     * Get cached pagination element
     * 获取缓存的分页元素
     */
    _getPaginationEl() {
        if (!this._paginationEl) {
            this._paginationEl = document.getElementById('results-pagination');
            if (!this._paginationEl) {
                this._paginationEl = document.createElement('div');
                this._paginationEl.id = 'results-pagination';
                this._getResultsListEl()?.insertAdjacentElement('afterend', this._paginationEl);
            }
        }
        return this._paginationEl;
    }

    _setupBasemapEvents() {
        const basemapSel = document.getElementById('basemap-select');
        if (basemapSel) {
            basemapSel.addEventListener('change', (e) => this.mapManager.setBasemap(e.target.value));
        }
    }

    _setupCollectionPickerEvents() {
        const openPickerBtn = document.getElementById('open-collection-picker');
        if (openPickerBtn) {
            openPickerBtn.addEventListener('click', () => {
                const provider = document.getElementById('provider')?.value || 'planetary-computer';
                this.collectionPicker.open(provider);
            });
        }
    }

    /**
     * Perform search
     * 执行搜索
     */
    async performSearch() {
        const searchParams = this.searchManager.collectSearchParameters(this.drawingManager, this.mapManager);
        const validation = this.searchManager.validateSearchParams(searchParams);
        
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }

        this.showLoadingState();

        try {
            const results = await this.searchManager.search(searchParams);
            this.displaySearchResults(results);
            this.searchManager.displayItemsOnMap(this.mapManager);
        } catch (error) {
            this.showError(`Search failed: ${error.message || error}`);
        }
    }

    /**
     * Display search results
     * 显示搜索结果
     */
    displaySearchResults(results) {
        const resultsCount = document.getElementById('results-count');
        const total = coalesce(results?.features?.length, this.searchManager.getAllItems().length, 0);
        resultsCount.textContent = `Found ${total} items`;

        // Ensure pagination element exists / 确保分页元素存在
        this._getPaginationEl();

        this.renderResultsPage();
    }

    /**
     * Render results page - optimized version using incremental updates
     * 渲染结果页面 - 优化版本，使用增量更新
     */
    renderResultsPage() {
        const resultsList = this._getResultsListEl();
        const pag = this._getPaginationEl();

        const { items, currentPage, totalPages } = this.searchManager.getPageItems();

        // Update pagination controls / 更新分页控件
        if (totalPages > 1) {
            pag.className = 'pagination';
            pag.setAttribute('role', 'navigation');
            pag.setAttribute('aria-label', 'Search results pagination');
            pag.innerHTML = `
                <button class="pager-btn" id="page-prev" ${currentPage === 1 ? 'disabled' : ''} aria-label="Go to previous page">Prev</button>
                <span class="page-info" aria-live="polite">Page ${currentPage} of ${totalPages}</span>
                <button class="pager-btn" id="page-next" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Go to next page">Next</button>
            `;
            document.getElementById('page-prev').onclick = () => {
                this.searchManager.setPage(currentPage - 1);
                this.renderResultsPage();
            };
            document.getElementById('page-next').onclick = () => {
                this.searchManager.setPage(currentPage + 1);
                this.renderResultsPage();
            };
        } else {
            pag.innerHTML = '';
        }

        // Use DocumentFragment for batch DOM updates to reduce reflows
        // 使用 DocumentFragment 批量更新 DOM，减少重排
        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const formattedItem = formatItemForDisplay(item);
            const el = this._createResultItemElement(formattedItem);
            fragment.appendChild(el);
        });

        // Clear and add all elements at once / 一次性清空并添加所有元素
        resultsList.innerHTML = '';
        resultsList.appendChild(fragment);
    }

    /**
     * Create result item element
     * 创建结果项元素
     * 
     * @param {STACItem} item - Formatted STAC item / 格式化的 STAC 项目
     * @returns {HTMLElement} Result item element / 结果项元素
     * @private
     */
    _createResultItemElement(item) {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.dataset.itemId = item.id;
        div.setAttribute('title', item.id);
        div.setAttribute('role', 'listitem');
        div.setAttribute('tabindex', '0');
        div.setAttribute('aria-label', `Item ${escapeHtml(item.id)}, Collection: ${escapeHtml(item.collection)}, Date: ${escapeHtml(item.datetime)}`);

        const thumb = getItemThumbnail(item);
        const thumbHTML = thumb ? `<img class="thumb-xs" src="${escapeHtml(thumb)}" alt="" onerror="this.style.display='none'" />` : '';

        div.innerHTML = `
            <h3>${escapeHtml(item.id)}</h3>
            <div class="result-foot">
                ${thumbHTML}
                <div class="result-body">
                    <div class="meta">
                        <span>Collection: ${escapeHtml(item.collection)}</span>
                        <span>Date: ${escapeHtml(item.datetime)}</span>
                        ${item.properties.platform ? `<span>Platform: ${escapeHtml(item.properties.platform)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;

        if (this.activeResultItemId === item.id) {
            div.classList.add('active');
        }

        div.addEventListener('mouseenter', () => {
            this.activeResultItemId = item.id;
            this._setActiveResultCard(item.id, false);
            this._highlightItemOnMap(item);
        });
        
        div.addEventListener('mouseleave', () => {
            this.mapManager.clearHighlight();
            this._setActiveResultCard(null, false);
        });

        div.addEventListener('click', () => this.showItemDetails(item));

        // Keyboard support: Enter and Space to activate
        // 键盘支持：Enter 和 Space 激活
        div.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showItemDetails(item);
            }
        });

        // Focus events for keyboard navigation
        // 键盘导航的焦点事件
        div.addEventListener('focus', () => {
            this.activeResultItemId = item.id;
            this._setActiveResultCard(item.id, false);
            this._highlightItemOnMap(item);
        });

        div.addEventListener('blur', () => {
            this.mapManager.clearHighlight();
        });

        return div;
    }

    /**
     * Show item details modal
     * 显示项目详情弹窗
     * 
     * @param {STACItem} item - STAC item to display / 要显示的 STAC 项目
     */
    async showItemDetails(item) {
        const modal = document.getElementById('item-modal');
        const detailsDiv = document.getElementById('item-details');
        const props = item.properties || {};

        const platform = props.platform || 'N/A';
        const instruments = Array.isArray(props.instruments) ? props.instruments.join(', ') : (props.instrument || 'N/A');
        const cloudCoverVal = coalesce(props['eo:cloud_cover'], props['cloud_cover'], props['s2:cloud_cover'], props['s2:cloud_percent']);
        const ccNum = (typeof cloudCoverVal === 'number') ? cloudCoverVal : parseFloat(cloudCoverVal);
        const cloudCover = (!isNaN(ccNum)) ? `${ccNum.toFixed(2)}%` : 'N/A';
        const gsdVal = coalesce(props['eo:gsd'], props['gsd'], props['s2:spatial_resolution']);
        const gsd = (gsdVal !== undefined && gsdVal !== null) ? `${gsdVal} m` : 'N/A';
        const epsg = props['proj:epsg'] || 'N/A';
        const mgrs = props['s2:mgrs_tile'] || props['mgrs:tile'] || null;
        const dt = item.datetime || formatItemForDisplay(item).datetime;

        const provider = document.getElementById('provider')?.value || 'planetary-computer';
        const assets = item.assets || {};

        // Sign thumbnails for Planetary Computer / 为 Planetary Computer 签名缩略图
        if (provider === 'planetary-computer') {
            if (assets.thumbnail?.href) {
                try { assets.thumbnail.href = await signPlanetaryComputerUrl(assets.thumbnail.href); } catch {}
            }
            if (assets.rendered_preview?.href) {
                try { assets.rendered_preview.href = await signPlanetaryComputerUrl(assets.rendered_preview.href); } catch {}
            }
        }

        let thumbUrl = assets.rendered_preview?.href || assets.thumbnail?.href || getItemThumbnail(item);
        thumbUrl = resolveAssetHref(thumbUrl);

        let detailsHTML = `
            <div class="item-summary">
                ${thumbUrl ? `<div class="thumb"><img src="${escapeHtml(thumbUrl)}" alt="Thumbnail" onerror="this.parentElement.style.display='none'"/></div>` : ''}
                <div class="summary-meta">
                    <div class="id-line" title="${escapeHtml(item.id)}">${escapeHtml(item.id)}</div>
                    <div class="summary-grid">
                        <span class="label">Collection:</span><span class="value">${escapeHtml(item.collection)}</span>
                        <span class="label">Date/Time:</span><span class="value">${escapeHtml(dt)}</span>
                        <span class="label">Platform:</span><span class="value">${escapeHtml(platform)}</span>
                        <span class="label">Instrument:</span><span class="value">${escapeHtml(instruments)}</span>
                        <span class="label">Cloud cover:</span><span class="value">${escapeHtml(cloudCover)}</span>
                        <span class="label">GSD:</span><span class="value">${escapeHtml(gsd)}</span>
                        <span class="label">CRS (EPSG):</span><span class="value value-with-action"><span>${escapeHtml(String(epsg))}</span><button id="download-item-btn" class="download-btn" type="button" title="Download item data">Download</button></span>
                        ${mgrs ? `<span class="label">MGRS tile:</span><span class="value">${escapeHtml(mgrs)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;

        if (item.assets && Object.keys(item.assets).length > 0) {
            const assetButtons = Object.keys(item.assets)
                .map(key => `<button class="asset-pill" type="button" data-asset-key="${escapeHtml(key)}">${escapeHtml(key)}</button>`)
                .join('');
            detailsHTML += `
                <div class="detail-section" id="assets-section">
                    <h3>Assets</h3>
                    <div class="assets-grid">${assetButtons}</div>
                    <div id="asset-detail" class="asset-detail hidden"></div>
                </div>
            `;
        }

        if (item.bbox) {
            detailsHTML += `
                <div class="detail-section">
                    <h3>Bounding Box</h3>
                    <div class="detail-grid">
                        <span class="label">West:</span><span class="value">${item.bbox[0]}</span>
                        <span class="label">South:</span><span class="value">${item.bbox[1]}</span>
                        <span class="label">East:</span><span class="value">${item.bbox[2]}</span>
                        <span class="label">North:</span><span class="value">${item.bbox[3]}</span>
                    </div>
                </div>
            `;
        }

        if (item.properties && Object.keys(item.properties).length > 0) {
            detailsHTML += `
                <div class="detail-section">
                    <h3>All Properties (raw)</h3>
                    <pre>${escapeHtml(JSON.stringify(item.properties, null, 2))}</pre>
                </div>
            `;
        }

        detailsDiv.innerHTML = detailsHTML;
        modal.classList.add('show');

        // Store the element that triggered the modal for focus restoration
        // 存储触发弹窗的元素以便恢复焦点
        this._lastFocusedElement = document.activeElement;

        // Focus the close button when modal opens
        // 弹窗打开时聚焦关闭按钮
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 50);
        }

        // Wire up download button / 连接下载按钮
        detailsDiv.querySelector('#download-item-btn')?.addEventListener('click', () => this._openDownloadDialog(item));

        // Wire up asset pills / 连接资源标签
        this._setupAssetPills(detailsDiv, item);
    }

    /**
     * Setup asset pill interactions
     * 设置资源标签交互
     * 
     * @param {HTMLElement} detailsDiv - Details container / 详情容器
     * @param {STACItem} item - STAC item / STAC 项目
     * @private
     */
    _setupAssetPills(detailsDiv, item) {
        const pills = detailsDiv.querySelectorAll('.asset-pill');
        const assetDetailContainer = detailsDiv.querySelector('#asset-detail');
        let activeAssetKey = null;

        if (!pills || !assetDetailContainer || !item.assets) return;

        pills.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const key = btn.getAttribute('data-asset-key');

                if (activeAssetKey === key) {
                    activeAssetKey = null;
                    pills.forEach(b => b.classList.remove('active'));
                    assetDetailContainer.classList.add('hidden');
                    assetDetailContainer.innerHTML = '';
                    return;
                }

                const asset = item.assets[key];
                activeAssetKey = key;
                pills.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderAssetDetail(assetDetailContainer, key, asset);
            });
        });
    }

    /**
     * Render asset detail
     * 渲染资源详情
     * 
     * @param {HTMLElement} container - Container element / 容器元素
     * @param {string} key - Asset key / 资源键名
     * @param {STACAsset} asset - Asset object / 资源对象
     * @private
     */
    _renderAssetDetail(container, key, asset) {
        if (!container || !asset) return;

        const hrefRaw = String(asset.href || '');
        const resolvedHref = resolveAssetHref(hrefRaw);
        const hrefLower = resolvedHref.toLowerCase();
        const typeLower = String(asset.type || '').toLowerCase();
        
        const isPreviewableImage = (
            ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(typeLower) ||
            ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => hrefLower.endsWith(ext))
        );

        const roles = Array.isArray(asset.roles) ? asset.roles.join(', ') : (asset.roles || 'N/A');
        const previewHTML = isPreviewableImage ? `<div class="asset-preview"><img src="${escapeHtml(resolvedHref)}" alt="${escapeHtml(key)} preview" /></div>` : '';

        let displayHref = resolvedHref || 'N/A';
        try {
            const u = new URL(resolvedHref);
            const parts = u.pathname.split('/').filter(Boolean);
            const tail = parts.slice(-2).join('/');
            displayHref = `${u.origin}/.../${tail}`;
        } catch {
            if (displayHref.length > 80) {
                displayHref = displayHref.slice(0, 40) + '...' + displayHref.slice(-30);
            }
        }

        container.classList.remove('hidden');
        container.innerHTML = `
            <h4>Asset: ${escapeHtml(key)}</h4>
            ${previewHTML}
            <div class="detail-grid">
                <span class="label">Type:</span><span class="value">${escapeHtml(asset.type || 'N/A')}</span>
                <span class="label">Roles:</span><span class="value">${escapeHtml(roles)}</span>
                <span class="label">Href:</span><span class="value"><a href="${escapeHtml(resolvedHref)}" title="${escapeHtml(resolvedHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayHref)}</a></span>
                ${asset.title ? `<span class="label">Title:</span><span class="value">${escapeHtml(asset.title)}</span>` : ''}
                ${asset.description ? `<span class="label">Description:</span><span class="value">${escapeHtml(asset.description)}</span>` : ''}
            </div>
            <div class="detail-section">
                <h3>Asset JSON</h3>
                <pre>${escapeHtml(JSON.stringify(asset, null, 2))}</pre>
            </div>
        `;
    }

    /**
     * Open download dialog
     * 打开下载对话框
     * 
     * @param {STACItem} item - STAC item / STAC 项目
     * @private
     */
    _openDownloadDialog(item) {
        const provider = document.getElementById('provider')?.value || 'planetary-computer';
        const candidates = choosePrimaryAssets(item);
        
        if (!candidates.length) {
            alert('No downloadable assets found for this item.');
            return;
        }

        const overlay = document.createElement('div');
        overlay.className = 'download-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'download-dialog-title');

        const dialog = document.createElement('div');
        dialog.className = 'download-dialog';

        const supportsDirPicker = typeof window.showDirectoryPicker === 'function';

        const assetRows = candidates.map(({ key, asset }) => {
            const fn = deriveFilenameFromAsset(asset);
            return `
                <div class="asset-row" role="listitem">
                    <label class="asset-name"><input type="checkbox" class="asset-check" data-key="${escapeHtml(key)}" checked aria-label="Select ${escapeHtml(key)} for download"> ${escapeHtml(key)}</label>
                    <span class="filename-hint" title="${escapeHtml(fn)}">${escapeHtml(fn)}</span>
                </div>
                <div class="progress-row" data-key="${escapeHtml(key)}" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Download progress for ${escapeHtml(key)}">
                    <div class="progress-bar"><div class="bar"></div></div>
                    <span class="progress-text" aria-live="polite">0%</span>
                </div>
            `;
        }).join('');

        dialog.innerHTML = `
            <div class="dialog-header">
                <h3 id="download-dialog-title">Select assets to download</h3>
                <div class="list-actions">
                    <button class="download-btn secondary" id="select-all">Select All</button>
                    <button class="download-btn secondary" id="deselect-all">Deselect All</button>
                </div>
            </div>
            <div class="asset-list" role="list" aria-label="Downloadable assets">${assetRows}</div>
            <div class="dialog-actions">
                <div>
                    ${supportsDirPicker ? '<button class="download-btn" id="pick-folder">Select Folder</button>' : '<span style="color:#5a6c7d; font-size:0.85rem;">Folder selection not supported in this browser.</span>'}
                </div>
                <div>
                    <button class="download-btn" id="start-download">Start</button>
                    <button class="download-btn" id="stop-download">Stop</button>
                    <button class="download-btn" id="close-download">Close</button>
                </div>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        this._setupDownloadDialogEvents(dialog, overlay, candidates, provider);
    }

    /**
     * Setup download dialog events
     * 设置下载对话框事件
     */
    _setupDownloadDialogEvents(dialog, overlay, candidates, provider) {
        const dialogState = {
            directoryHandle: null,
            dlAbortController: null,
            progressState: new Map(),
            eventCleanupFns: []
        };

        const addTrackedListener = (el, event, handler) => {
            if (!el) return;
            el.addEventListener(event, handler);
            dialogState.eventCleanupFns.push(() => el.removeEventListener(event, handler));
        };

        const cleanupDialog = () => {
            try { dialogState.dlAbortController?.abort(); } catch {}
            dialogState.progressState.clear();
            dialogState.directoryHandle = null;
            dialogState.eventCleanupFns.forEach(fn => { try { fn(); } catch {} });
            dialogState.eventCleanupFns.length = 0;
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };

        // Row selection / 行选择
        dialog.querySelectorAll('.asset-row').forEach(row => {
            const checkbox = row.querySelector('.asset-check');
            if (!checkbox) return;
            if (checkbox.checked) row.classList.add('selected');
            addTrackedListener(checkbox, 'click', (e) => {
                e.stopPropagation();
                setTimeout(() => row.classList.toggle('selected', checkbox.checked), 0);
            });
            addTrackedListener(row, 'click', () => {
                checkbox.checked = !checkbox.checked;
                row.classList.toggle('selected', checkbox.checked);
            });
        });

        // Folder picker / 文件夹选择器
        const pickBtn = dialog.querySelector('#pick-folder');
        if (pickBtn) {
            addTrackedListener(pickBtn, 'click', async () => {
                try {
                    dialogState.directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                    pickBtn.textContent = 'Folder Selected';
                    pickBtn.disabled = true;
                } catch {}
            });
        }

        addTrackedListener(dialog.querySelector('#close-download'), 'click', cleanupDialog);
        addTrackedListener(dialog.querySelector('#select-all'), 'click', () => {
            dialog.querySelectorAll('.asset-check').forEach(c => { c.checked = true; c.closest('.asset-row')?.classList.add('selected'); });
        });
        addTrackedListener(dialog.querySelector('#deselect-all'), 'click', () => {
            dialog.querySelectorAll('.asset-check').forEach(c => { c.checked = false; c.closest('.asset-row')?.classList.remove('selected'); });
        });

        const startBtn = dialog.querySelector('#start-download');
        const stopBtn = dialog.querySelector('#stop-download');
        stopBtn.disabled = true;

        addTrackedListener(startBtn, 'click', async () => {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            dialogState.progressState.clear();
            dialogState.dlAbortController = new AbortController();

            const selected = Array.from(dialog.querySelectorAll('.asset-check'))
                .filter(c => c.checked)
                .map(c => c.getAttribute('data-key'));

            if (!selected.length) {
                alert('Please select at least one asset.');
                startBtn.disabled = false;
                return;
            }

            const selections = candidates
                .filter(c => selected.includes(c.key))
                .map(c => ({ key: c.key, asset: c.asset, filename: deriveFilenameFromAsset(c.asset) }));

            const onProgress = (assetKey, p) => this._updateDownloadProgress(dialog, dialogState, assetKey, p);

            try {
                await downloadAssets(selections, { provider, directoryHandle: dialogState.directoryHandle, onProgress, abortSignal: dialogState.dlAbortController.signal });
                alert('Downloads completed.');
            } catch (e) {
                if (e?.name === 'AbortError') alert('Downloads stopped.');
                else alert('Download error. See console for details.');
            } finally {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                dialogState.dlAbortController = null;
            }
        });

        addTrackedListener(stopBtn, 'click', () => {
            try { dialogState.dlAbortController?.abort(); } catch {}
            stopBtn.disabled = true;
        });
    }

    /**
     * Update download progress UI
     * 更新下载进度 UI
     * 
     * @param {HTMLElement} dialog - Dialog element / 对话框元素
     * @param {Object} dialogState - Dialog state object / 对话框状态对象
     * @param {string} assetKey - Asset key / 资源键名
     * @param {DownloadProgress} p - Progress data / 进度数据
     * @private
     */
    _updateDownloadProgress(dialog, dialogState, assetKey, p) {
        const row = dialog.querySelector(`.progress-row[data-key="${assetKey}"]`);
        if (!row) return;

        const bar = row.querySelector('.bar');
        const txt = row.querySelector('.progress-text');
        const now = Date.now();

        let st = dialogState.progressState.get(assetKey);
        if (!st) {
            st = { lastTime: now, lastLoaded: p.loaded || 0, rate: 0, speedHistory: [], lastUIUpdate: 0 };
            dialogState.progressState.set(assetKey, st);
        }

        if (now - st.lastUIUpdate < 1000) return;
        st.lastUIUpdate = now;

        const loaded = p.loaded || 0;
        const total = p.total || 0;
        const dt = (now - st.lastTime) / 1000;

        if (dt > 0 && loaded >= st.lastLoaded) {
            const inst = (loaded - st.lastLoaded) / dt;
            st.speedHistory.push({ time: now, speed: inst });
            st.speedHistory = st.speedHistory.filter(h => now - h.time <= 2000);
            st.rate = st.speedHistory.reduce((sum, h) => sum + h.speed, 0) / st.speedHistory.length;
            st.lastTime = now;
            st.lastLoaded = loaded;
        }

        if (bar && p.percent != null) {
            bar.style.width = `${p.percent}%`;
            row.setAttribute('aria-valuenow', Math.round(p.percent));
        }

        const formatBytes = (bytes) => {
            if (!isFinite(bytes)) return '?';
            const units = ['B', 'KB', 'MB', 'GB'];
            let i = 0, v = bytes;
            while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
            return `${v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
        };

        if (txt) {
            const parts = [
                `Progress: ${p.percent ?? '—'}%`,
                st.rate > 0 ? `Speed: ${formatBytes(st.rate)}/s` : '',
                `Downloaded: ${formatBytes(loaded)} / ${total ? formatBytes(total) : '?'}`
            ].filter(Boolean);
            txt.innerHTML = parts.map(t => `<span class="piece">${t}</span>`).join('');
        }
    }

    /**
     * Handle map pointer move - throttle entry
     * 处理地图指针移动 - 节流入口
     */
    _handleMapPointerMove(evt) {
        this._throttledPointerMove(evt);
    }

    /**
     * Handle map pointer move - core logic
     * 处理地图指针移动 - 核心逻辑
     */
    _handleMapPointerMoveCore(evt) {
        const map = this.mapManager.getMap();
        if (!map || evt.dragging) return;

        let hitFeature = null;
        map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
            if (layer === this.mapManager.itemsLayer) {
                hitFeature = feature;
                return true;
            }
            return false;
        }, { layerFilter: l => l === this.mapManager.itemsLayer, hitTolerance: 5 });

        if (!hitFeature) {
            if (this.mapManager.lastHoverFeatureId) {
                this._setActiveResultCard(null, false);
                this.mapManager.clearHighlight();
            }
            return;
        }

        const id = hitFeature.getId?.() || hitFeature.get('id');
        if (!id) return;

        if (this.mapManager.lastHoverFeatureId === id) {
            const geom = hitFeature.getGeometry();
            if (geom) {
                const ex = geom.getExtent();
                const center = [(ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2];
                this.mapManager.showHoverLabel(id, center);
            }
            return;
        }

        this.mapManager.lastHoverFeatureId = id;
        this.mapManager.highlightFeature(hitFeature);

        const geom = hitFeature.getGeometry();
        if (geom) {
            const ex = geom.getExtent();
            const center = [(ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2];
            this.mapManager.showHoverLabel(id, center);
        }

        this._gotoItemInResults(id);
    }

    /**
     * Handle map single click
     * 处理地图单击
     */
    _handleMapSingleClick(evt) {
        const map = this.mapManager.getMap();
        if (!map) return;

        let hitFeature = null;
        map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
            if (layer === this.mapManager.itemsLayer) {
                hitFeature = feature;
                return true;
            }
            return false;
        }, { layerFilter: l => l === this.mapManager.itemsLayer, hitTolerance: 5 });

        if (!hitFeature) return;

        const id = hitFeature.getId?.() || hitFeature.get('id');
        if (!id) return;

        const item = this.searchManager.findItem(id);
        if (!item) return;

        this._setActiveResultCard(id, true);
        this.mapManager.highlightFeature(hitFeature);
        this.mapManager.hideHoverLabel();
        this.showItemDetails(item);
    }

    /**
     * Highlight item on map
     * 在地图上高亮项目
     * 
     * @param {STACItem} item - STAC item / STAC 项目
     * @private
     */
    _highlightItemOnMap(item) {
        if (!item) return;
        
        const itemsSource = this.mapManager.getItemsSource();
        let feature = itemsSource.getFeatureById?.(item.id);
        
        if (!feature) {
            feature = itemsSource.getFeatures().find(f => f.getId?.() === item.id);
        }

        if (feature) {
            this.mapManager.highlightFeature(feature);
        }
    }

    /**
     * Set active result card
     * 设置活动结果卡片
     * 
     * @param {string|null} id - Item ID or null to clear / 项目 ID 或 null 以清除
     * @param {boolean} scrollIntoView - Whether to scroll to the card / 是否滚动到卡片
     * @private
     */
    _setActiveResultCard(id, scrollIntoView) {
        this.activeResultItemId = id;
        document.querySelectorAll('.result-item').forEach(el => {
            if (id && el.getAttribute('data-item-id') === id) {
                el.classList.add('active');
                if (scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
    }

    /**
     * Go to item in results list
     * 跳转到结果列表中的项目
     * 
     * @param {string} id - Item ID / 项目 ID
     * @private
     */
    _gotoItemInResults(id) {
        const targetPage = this.searchManager.getPageForItem(id);
        if (targetPage === null) return;

        const { currentPage } = this.searchManager.getPageItems();
        if (targetPage !== currentPage) {
            this.searchManager.setPage(targetPage);
            this.renderResultsPage();
        }
        this._setActiveResultCard(id, true);
    }

    /**
     * Update bbox inputs from drawn bbox
     * 从绘制的边界框更新输入框
     * 
     * @param {number[]} bbox - Bounding box [west, south, east, north] / 边界框 [西, 南, 东, 北]
     * @private
     */
    _updateBboxInputs(bbox) {
        const [w, s, e, n] = bbox;
        
        const westHemSel = document.getElementById('bbox-west-hem');
        const southHemSel = document.getElementById('bbox-south-hem');
        const eastHemSel = document.getElementById('bbox-east-hem');
        const northHemSel = document.getElementById('bbox-north-hem');
        
        if (westHemSel) westHemSel.value = w < 0 ? 'W' : 'E';
        if (southHemSel) southHemSel.value = s < 0 ? 'S' : 'N';
        if (eastHemSel) eastHemSel.value = e < 0 ? 'W' : 'E';
        if (northHemSel) northHemSel.value = n < 0 ? 'S' : 'N';
        
        document.getElementById('bbox-west').value = Math.abs(w).toFixed(4);
        document.getElementById('bbox-south').value = Math.abs(s).toFixed(4);
        document.getElementById('bbox-east').value = Math.abs(e).toFixed(4);
        document.getElementById('bbox-north').value = Math.abs(n).toFixed(4);
    }

    /**
     * Clear bbox inputs
     * 清除边界框输入
     */
    _clearBboxInputs() {
        ['bbox-west', 'bbox-south', 'bbox-east', 'bbox-north'].forEach(id => {
            document.getElementById(id).value = '';
        });
    }

    /**
     * Draw bbox from input values
     * 从输入值绘制边界框
     */
    _drawBboxFromInputs() {
        const westRaw = parseFloat(document.getElementById('bbox-west').value);
        const southRaw = parseFloat(document.getElementById('bbox-south').value);
        const eastRaw = parseFloat(document.getElementById('bbox-east').value);
        const northRaw = parseFloat(document.getElementById('bbox-north').value);

        const westHem = document.getElementById('bbox-west-hem')?.value || 'E';
        const southHem = document.getElementById('bbox-south-hem')?.value || 'N';
        const eastHem = document.getElementById('bbox-east-hem')?.value || 'E';
        const northHem = document.getElementById('bbox-north-hem')?.value || 'N';

        const applyLon = (v, hem) => (isNaN(v) ? NaN : (hem === 'W' ? -Math.abs(v) : Math.abs(v)));
        const applyLat = (v, hem) => (isNaN(v) ? NaN : (hem === 'S' ? -Math.abs(v) : Math.abs(v)));

        try {
            this.drawingManager.drawBboxFromCoords(
                applyLon(westRaw, westHem),
                applyLat(southRaw, southHem),
                applyLon(eastRaw, eastHem),
                applyLat(northRaw, northHem)
            );
        } catch (e) {
            this.showError(e.message);
        }
    }

    /**
     * Update toolbar button states
     * 更新工具栏按钮状态
     * 
     * @param {string} activeId - Active button ID / 活动按钮 ID
     * @private
     */
    _updateToolbarButtons(activeId) {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            if (btn.id === activeId) {
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            } else if (btn.id.startsWith('draw-') && btn.id !== 'draw-bbox') {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            }
        });
    }

    /**
     * Toggle drawing tools visibility
     * 切换绘制工具可见性
     */
    _toggleDrawingTools() {
        const content = document.querySelector('.drawing-tools-content');
        const toggleBtn = document.getElementById('toggle-drawing-tools');

        const setToggleIcon = (state) => {
            if (state === 'expanded') {
                toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            } else {
                toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><polygon points="5 5 19 8 16 19 6 16"></polygon></svg>`;
            }
        };

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            setToggleIcon('expanded');
            toggleBtn.setAttribute('title', 'Hide Drawing Tools');
            toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
            content.classList.add('collapsed');
            setToggleIcon('collapsed');
            toggleBtn.setAttribute('title', 'Show Drawing Tools');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Close item modal
     * 关闭项目弹窗
     */
    closeModal() {
        document.getElementById('item-modal').classList.remove('show');
        
        // Restore focus to the element that triggered the modal
        // 恢复焦点到触发弹窗的元素
        if (this._lastFocusedElement && typeof this._lastFocusedElement.focus === 'function') {
            this._lastFocusedElement.focus();
            this._lastFocusedElement = null;
        }
    }

    /**
     * Show loading state
     * 显示加载状态
     */
    showLoadingState() {
        this._getResultsListEl().innerHTML = '<div class="loading" role="status" aria-live="polite">Searching...</div>';
        document.getElementById('results-count').textContent = '';
    }

    /**
     * Show error message
     * 显示错误信息
     * 
     * @param {string} message - Error message / 错误信息
     */
    showError(message) {
        this._getResultsListEl().innerHTML = `<div class="error" role="alert" aria-live="assertive">${escapeHtml(message)}</div>`;
        document.getElementById('results-count').textContent = '';
    }
}
