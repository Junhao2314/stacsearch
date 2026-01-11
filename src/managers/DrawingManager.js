/**
 * @fileoverview DrawingManager - Drawing management module
 * DrawingManager - 绘制管理模块
 * 
 * Responsible for map bounding box/polygon drawing interaction
 * 负责地图边界框/多边形绘制交互
 */

/** @typedef {import('../types.js').GeoJSONGeometry} GeoJSONGeometry */
/** @typedef {import('./MapManager.js').MapManager} MapManager */

import Draw, { createBox } from 'ol/interaction/Draw';
import { transformExtent } from 'ol/proj';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { GeoJSON } from 'ol/format';

export class DrawingManager {
    /**
     * @param {MapManager} mapManager - Map manager instance
     */
    constructor(mapManager) {
        /** @type {MapManager} */
        this.mapManager = mapManager;
        /** @type {Draw|null} */
        this.drawInteraction = null;
        /** @type {'Box'|'Polygon'} */
        this.currentDrawType = 'Box';
    }

    /**
     * Dispose drawing interaction and clear references (helps avoid leaks on re-init/HMR)
     */
    dispose() {
        try {
            this.clearDrawing();
        } catch {}
        this.drawInteraction = null;
        this.mapManager = null;
    }

    /**
     * Start drawing interaction
     * 开始绘制交互
     * 
     * @param {'Box'|'Polygon'} type - Drawing type / 绘制类型
     * @param {function(number[]): void} [onDrawEnd] - Callback with bbox [west, south, east, north] / 回调函数，参数为 bbox [西, 南, 东, 北]
     */
    startDrawing(type, onDrawEnd) {
        const map = this.mapManager.getMap();
        const bboxSource = this.mapManager.getBboxSource();
        
        // Remove existing interaction / 移除现有交互
        if (this.drawInteraction) {
            map.removeInteraction(this.drawInteraction);
        }

        // Clear existing drawings / 清除现有绘制
        bboxSource.clear();
        this.currentDrawType = type;

        if (type === 'Box') {
            this.drawInteraction = new Draw({
                source: bboxSource,
                type: 'Circle',
                geometryFunction: createBox()
            });
        } else if (type === 'Polygon') {
            this.drawInteraction = new Draw({
                source: bboxSource,
                type: 'Polygon'
            });
        }

        this.drawInteraction.on('drawend', (event) => {
            const geometry = event.feature.getGeometry();
            const extent = geometry.getExtent();
            const bbox = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');

            // Stop interaction / 停止交互
            map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;

            // Fit view to drawn bbox / 将视图适配到绘制的边界框
            const extent3857 = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');
            this.mapManager.fitToExtent(extent3857, { padding: [40, 40, 40, 40], duration: 300 });

            // Callback with bbox / 使用 bbox 调用回调
            if (onDrawEnd) {
                onDrawEnd(bbox);
            }
        });

        map.addInteraction(this.drawInteraction);
    }

    /**
     * Clear all drawings
     * 清除所有绘制
     */
    clearDrawing() {
        const map = this.mapManager.getMap();
        const bboxSource = this.mapManager.getBboxSource();
        
        bboxSource.clear();

        if (this.drawInteraction) {
            map.removeInteraction(this.drawInteraction);
            this.drawInteraction = null;
        }
    }

    /**
     * Draw bbox from coordinate values
     * 从坐标值绘制边界框
     * 
     * @param {number} west - West longitude / 西经
     * @param {number} south - South latitude / 南纬
     * @param {number} east - East longitude / 东经
     * @param {number} north - North latitude / 北纬
     * @throws {Error} If coordinates are invalid / 如果坐标无效
     */
    drawBboxFromCoords(west, south, east, north) {
        if ([west, south, east, north].some(v => isNaN(v))) {
            throw new Error('Please enter valid numeric bbox values');
        }
        if (west >= east || south >= north) {
            throw new Error('Invalid bbox: West < East and South < North required');
        }

        const bboxSource = this.mapManager.getBboxSource();
        bboxSource.clear();

        // Clamp to valid EPSG:4326 ranges / 限制在有效的 EPSG:4326 范围内
        const clampLon = v => Math.max(-180, Math.min(180, v));
        const clampLat = v => Math.max(-85, Math.min(85, v));
        
        const extent4326 = [
            clampLon(west),
            clampLat(south),
            clampLon(east),
            clampLat(north)
        ];
        
        const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
        const poly = Polygon.fromExtent(extent3857);
        const feature = new Feature({ geometry: poly });
        bboxSource.addFeature(feature);

        // Fit view to bbox / 将视图适配到边界框
        this.mapManager.fitToExtent(extent3857, { padding: [40, 40, 40, 40], duration: 300 });
    }

    /**
     * Get drawn geometry as GeoJSON (for search intersects parameter)
     * 获取绘制的几何图形作为 GeoJSON（用于搜索 intersects 参数）
     * 
     * @returns {GeoJSONGeometry|null} GeoJSON geometry or null / GeoJSON 几何图形或 null
     */
    getDrawnGeometry() {
        const bboxSource = this.mapManager.getBboxSource();
        const features = bboxSource?.getFeatures?.() || [];
        
        if (features.length === 0) return null;

        const lastFeature = features[features.length - 1];
        const geom = lastFeature.getGeometry();
        
        return new GeoJSON().writeGeometryObject(geom, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
    }

    /**
     * Check if there's a drawn shape
     * 检查是否有绘制的形状
     * 
     * @returns {boolean} True if shape exists / 如果形状存在则返回 true
     */
    hasDrawnShape() {
        const features = this.mapManager.getBboxSource()?.getFeatures?.() || [];
        return features.length > 0;
    }

    /**
     * Get current draw type
     * 获取当前绘制类型
     * 
     * @returns {'Box'|'Polygon'} Current draw type / 当前绘制类型
     */
    getCurrentDrawType() {
        return this.currentDrawType;
    }
}
