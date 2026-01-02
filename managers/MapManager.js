/**
 * @fileoverview MapManager - Map management module
 * MapManager - 地图管理模块
 * 
 * Responsible for OpenLayers map initialization, layer management, basemap switching, hover interaction
 * 负责 OpenLayers 地图初始化、图层管理、底图切换、悬停交互
 */

/** @typedef {import('../types.js').MapConfig} MapConfig */
/** @typedef {import('../types.js').BasemapConfig} BasemapConfig */

import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { fromLonLat, transformExtent } from 'ol/proj';
import { Style, Stroke, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import Overlay from 'ol/Overlay';

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
