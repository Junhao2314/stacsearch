/**
 * @fileoverview MapManager - Map management module
 * MapManager - 地图管理模块
 * 
 * Responsible for OpenLayers map initialization, layer management, basemap switching, hover interaction
 * 负责 OpenLayers 地图初始化、图层管理、底图切换、悬停交互
 */

/** @typedef {import('../types/index.js').MapConfig} MapConfig */
/** @typedef {import('../types/index.js').BasemapConfig} BasemapConfig */

import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { fromLonLat, transformExtent } from 'ol/proj';
import { Style, Stroke, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import Overlay from 'ol/Overlay';
import { getPointResolution } from 'ol/proj';
import { unByKey } from 'ol/Observable';

import { createGoogleSatelliteSource, createGoogleHybridSource, createGoogleMapsSource } from '../basemaps/google.js';
import { createEsriWorldImageryLayer, createEsriWorldLabelsLayer } from '../basemaps/esri.js';
import { createOsmLayer } from '../basemaps/osm.js';

export class MapManager {
    /**
     * @param {MapConfig} mapConfig - Map configuration
     * @param {BasemapConfig} basemapConfig - Basemap configuration
     */
    constructor(mapConfig, basemapConfig) {
        this.mapConfig = mapConfig;
        this.basemapConfig = basemapConfig;
        
        /** @type {Map|null} */
        this.map = null;
        
        /** @type {VectorLayer<VectorSource>|null} */
        this.bboxLayer = null;
        /** @type {VectorLayer<VectorSource>|null} */
        this.itemsLayer = null;
        /** @type {VectorLayer<VectorSource>|null} */
        this.highlightLayer = null;
        /** @type {Object<string, TileLayer[]>} */
        this.basemapRegistry = {};
        /** @type {string} */
        this.currentBasemapKey = basemapConfig.defaultBasemap;
        
        /** @type {Overlay|null} */
        this.hoverOverlay = null;
        /** @type {HTMLElement|null} */
        this.hoverLabelEl = null;
        /** @type {string|null} */
        this.lastHoverFeatureId = null;
        
        /** @type {HTMLElement|null} */
        this.scaleBarEl = null;

        /** @type {any[]} OpenLayers events keys for cleanup */
        this._eventKeys = [];
    }

    /**
     * Initialize the map
     * 初始化地图
     * 
     * @param {string} targetId - Target element ID / 目标元素 ID
     * @returns {Map} OpenLayers map instance / OpenLayers 地图实例
     */
    initialize(targetId) {
        // Create bbox layer / 创建边界框图层
        this.bboxLayer = new VectorLayer({
            source: new VectorSource(),
            zIndex: 20,
            style: new Style({
                stroke: new Stroke({
                    color: 'rgba(102, 126, 234, 0.8)',
                    width: 2,
                    lineDash: [5, 5]
                }),
                fill: new Fill({
                    color: 'rgba(102, 126, 234, 0.1)'
                })
            })
        });

        // Create items layer / 创建项目图层
        this.itemsLayer = new VectorLayer({
            source: new VectorSource(),
            zIndex: 10,
            style: new Style({
                stroke: new Stroke({
                    color: 'rgba(118, 75, 162, 0.9)',
                    width: 3
                }),
                fill: new Fill({
                    color: 'rgba(118, 75, 162, 0.2)'
                })
            })
        });

        // Create highlight layer / 创建高亮图层
        this.highlightLayer = new VectorLayer({
            source: new VectorSource(),
            zIndex: 30,
            style: new Style({
                stroke: new Stroke({
                    color: 'rgba(255, 193, 7, 0.95)',
                    width: 4
                }),
                fill: new Fill({
                    color: 'rgba(255, 193, 7, 0.10)'
                })
            })
        });

        // Initialize basemap layers / 初始化底图图层
        this._initBasemaps();

        const allBaseLayers = Object.values(this.basemapRegistry).flat();

        // Create map / 创建地图
        this.map = new Map({
            target: targetId,
            layers: [
                ...allBaseLayers,
                this.bboxLayer,
                this.itemsLayer,
                this.highlightLayer
            ],
            view: new View({
                center: fromLonLat(this.mapConfig.initialCenter),
                zoom: this.mapConfig.initialZoom
            }),
            controls: []
        });

        // Set initial basemap / 设置初始底图
        this.setBasemap(this.currentBasemapKey || 'osm');

        // Initialize hover overlay / 初始化悬停覆盖层
        this._initHoverOverlay();
        
        // Initialize scale bar / 初始化比例尺
        this._initScaleBar();

        return this.map;
    }

    /**
     * Initialize basemap layers
     * 初始化底图图层
     */
    _initBasemaps() {
        const osm = createOsmLayer();
        osm.setVisible(true);

        const esriImg = createEsriWorldImageryLayer();
        const esriLbl = createEsriWorldLabelsLayer();

        let googleUrls = null;
        if (this.basemapConfig.google.tileUrl) {
            googleUrls = (this.basemapConfig.google.subdomains && this.basemapConfig.google.subdomains.length)
                ? this.basemapConfig.google.subdomains.map(s => this.basemapConfig.google.tileUrl.replace('{s}', s))
                : [this.basemapConfig.google.tileUrl];
        }

        const googleSat = new TileLayer({ 
            source: createGoogleSatelliteSource({ urls: googleUrls || undefined }), 
            visible: false, 
            zIndex: 0 
        });
        const googleHyb = new TileLayer({ 
            source: createGoogleHybridSource(), 
            visible: false, 
            zIndex: 0 
        });
        const googleRoad = new TileLayer({ 
            source: createGoogleMapsSource(), 
            visible: false, 
            zIndex: 0 
        });

        this.basemapRegistry = {
            'osm': [osm],
            'esri_img': [esriImg, esriLbl],
            'google_sat': [googleSat],
            'google_hyb': [googleHyb],
            'google_road': [googleRoad]
        };
    }

    /**
     * Initialize hover overlay
     * 初始化悬停覆盖层
     */
    _initHoverOverlay() {
        this.hoverLabelEl = document.createElement('div');
        this.hoverLabelEl.className = 'map-hover-label';
        
        this.hoverOverlay = new Overlay({
            element: this.hoverLabelEl,
            offset: [0, -10],
            positioning: 'bottom-center',
            stopEvent: false
        });
        
        this.map.addOverlay(this.hoverOverlay);
    }

    /**
     * Initialize custom scale bar with integer values
     * 初始化自定义比例尺（显示整数值）
     */
    _initScaleBar() {
        // Create scale bar container / 创建比例尺容器
        this.scaleBarEl = document.createElement('div');
        this.scaleBarEl.className = 'map-scale-bar';
        this.scaleBarEl.innerHTML = `
            <div class="scale-line"></div>
            <div class="scale-text"></div>
        `;
        
        // Add to map container / 添加到地图容器
        const mapContainer = this.map.getTargetElement();
        mapContainer.appendChild(this.scaleBarEl);
        
        // Update scale bar on view change / 视图变化时更新比例尺
        this._eventKeys.push(this.map.getView().on('change:resolution', () => this._updateScaleBar()));
        this._eventKeys.push(this.map.getView().on('change:center', () => this._updateScaleBar()));
        
        // Initial update / 初始更新
        this._updateScaleBar();
    }

    /**
     * Dispose map resources and event listeners (helps avoid leaks on re-init/HMR)
     */
    dispose() {
        try {
            if (this._eventKeys.length) unByKey(this._eventKeys);
        } catch {}
        this._eventKeys = [];

        try { this.bboxLayer?.getSource()?.clear(); } catch {}
        try { this.itemsLayer?.getSource()?.clear(); } catch {}
        try { this.highlightLayer?.getSource()?.clear(); } catch {}

        try { this.map?.removeOverlay?.(this.hoverOverlay); } catch {}
        try { this.hoverLabelEl?.remove?.(); } catch {}
        try { this.scaleBarEl?.remove?.(); } catch {}

        try { this.map?.setTarget?.(null); } catch {}
        try { this.map?.dispose?.(); } catch {}

        this.map = null;
        this.bboxLayer = null;
        this.itemsLayer = null;
        this.highlightLayer = null;
        this.basemapRegistry = {};
        this.hoverOverlay = null;
        this.hoverLabelEl = null;
        this.lastHoverFeatureId = null;
        this.scaleBarEl = null;
    }

    /**
     * Update scale bar display with nice integer values
     * 更新比例尺显示（使用整数值）
     */
    _updateScaleBar() {
        if (!this.scaleBarEl) return;
        
        const view = this.map.getView();
        const center = view.getCenter();
        const resolution = view.getResolution();
        
        if (!center || !resolution) return;
        
        // Get meters per pixel at map center / 获取地图中心的每像素米数
        const metersPerPixel = getPointResolution('EPSG:3857', resolution, center, 'm');
        
        // Nice scale values (in meters) / 美观的比例尺数值（米）
        const niceValues = [
            1, 2, 5, 10, 20, 50, 100, 200, 500,
            1000, 2000, 5000, 10000, 20000, 50000, 100000,
            200000, 500000, 1000000, 2000000, 5000000
        ];
        
        // Target width in pixels / 目标宽度（像素）
        const targetWidth = 100;
        const targetMeters = metersPerPixel * targetWidth;
        
        // Find the best nice value / 找到最佳的整数值
        let bestValue = niceValues[0];
        for (const val of niceValues) {
            if (val <= targetMeters * 1.5) {
                bestValue = val;
            } else {
                break;
            }
        }
        
        // Calculate actual width in pixels / 计算实际像素宽度
        const actualWidth = bestValue / metersPerPixel;
        
        // Format the label / 格式化标签
        let label;
        if (bestValue >= 1000) {
            label = `${bestValue / 1000} km`;
        } else {
            label = `${bestValue} m`;
        }
        
        // Update DOM / 更新 DOM
        const scaleLine = this.scaleBarEl.querySelector('.scale-line');
        const scaleText = this.scaleBarEl.querySelector('.scale-text');
        
        if (scaleLine) {
            scaleLine.style.width = `${Math.round(actualWidth)}px`;
        }
        if (scaleText) {
            scaleText.textContent = label;
        }
    }

    /**
     * Set active basemap
     * 设置活动底图
     * 
     * @param {string} key - Basemap key / 底图键名
     */
    setBasemap(key) {
        if (!this.basemapRegistry || !Object.keys(this.basemapRegistry).length) return;
        
        this.currentBasemapKey = key;
        
        for (const k in this.basemapRegistry) {
            this.basemapRegistry[k].forEach(layer => layer.setVisible(false));
        }
        
        if (this.basemapRegistry[key]) {
            this.basemapRegistry[key].forEach(layer => layer.setVisible(true));
        }

        // Sync UI / 同步 UI
        const sel = document.getElementById('basemap-select');
        if (sel && sel.value !== key) sel.value = key;
    }

    /**
     * Get map instance
     * 获取地图实例
     * 
     * @returns {Map|null} OpenLayers map instance / OpenLayers 地图实例
     */
    getMap() {
        return this.map;
    }

    /**
     * Get bbox layer source
     * 获取边界框图层源
     * 
     * @returns {VectorSource|undefined} Bbox layer source / 边界框图层源
     */
    getBboxSource() {
        return this.bboxLayer?.getSource();
    }

    /**
     * Get items layer source
     * 获取项目图层源
     * 
     * @returns {VectorSource|undefined} Items layer source / 项目图层源
     */
    getItemsSource() {
        return this.itemsLayer?.getSource();
    }

    /**
     * Get highlight layer source
     * 获取高亮图层源
     * 
     * @returns {VectorSource|undefined} Highlight layer source / 高亮图层源
     */
    getHighlightSource() {
        return this.highlightLayer?.getSource();
    }

    /**
     * Get items layer (for layer comparison in event handlers)
     * 获取项目图层（用于事件处理器中的图层比较）
     * 
     * @returns {VectorLayer<VectorSource>|null} Items layer / 项目图层
     */
    getItemsLayer() {
        return this.itemsLayer;
    }

    /**
     * Fit view to extent
     * 将视图适配到范围
     * 
     * @param {number[]} extent - Extent to fit [minX, minY, maxX, maxY] / 要适配的范围
     * @param {Object} [options] - Fit options / 适配选项
     */
    fitToExtent(extent, options = {}) {
        if (!extent || extent.includes(Infinity) || extent.includes(-Infinity)) return;
        
        this.map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 500,
            ...options
        });
    }

    /**
     * Zoom in
     * 放大
     */
    zoomIn() {
        const view = this.map.getView();
        view.animate({ zoom: view.getZoom() + 1, duration: 250 });
    }

    /**
     * Zoom out
     * 缩小
     */
    zoomOut() {
        const view = this.map.getView();
        view.animate({ zoom: view.getZoom() - 1, duration: 250 });
    }

    /**
     * Reset view to initial state
     * 重置视图到初始状态
     */
    resetView() {
        this.map.getView().animate({
            center: fromLonLat(this.mapConfig.initialCenter),
            zoom: this.mapConfig.initialZoom,
            duration: 500
        });
    }

    /**
     * Highlight a feature on the map
     * 在地图上高亮显示要素
     * 
     * @param {Feature} feature - Feature to highlight / 要高亮的要素
     */
    highlightFeature(feature) {
        const hsrc = this.highlightLayer?.getSource();
        if (!hsrc) return;
        
        hsrc.clear();
        const geom = feature.getGeometry();
        if (geom) {
            const f = new Feature({ geometry: geom.clone() });
            hsrc.addFeature(f);
        }
    }

    /**
     * Clear highlight
     * 清除高亮
     */
    clearHighlight() {
        this.highlightLayer?.getSource()?.clear();
        this.hoverOverlay?.setPosition(undefined);
        this.lastHoverFeatureId = null;
    }

    /**
     * Show hover label at position
     * 在指定位置显示悬停标签
     * 
     * @param {string} text - Label text / 标签文本
     * @param {number[]} position - Map coordinate [x, y] / 地图坐标 [x, y]
     */
    showHoverLabel(text, position) {
        if (this.hoverLabelEl) {
            this.hoverLabelEl.textContent = text;
        }
        if (this.hoverOverlay) {
            this.hoverOverlay.setPosition(position);
        }
    }

    /**
     * Hide hover label
     * 隐藏悬停标签
     */
    hideHoverLabel() {
        this.hoverOverlay?.setPosition(undefined);
    }

    /**
     * Get current map extent in EPSG:4326
     * 获取当前地图范围（EPSG:4326 坐标系）
     * 
     * @returns {number[]} Extent [west, south, east, north] / 范围 [西, 南, 东, 北]
     */
    getExtent4326() {
        const extent = this.map.getView().calculateExtent(this.map.getSize());
        return transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    }
}
