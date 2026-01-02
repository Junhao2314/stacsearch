/**
 * Tianditu basemap helpers (English labels)
 * 天地图底图辅助函数（英文标注）
 *
 * Provides factory functions for Tianditu world vector/imagery layers with English annotations.
 * Requires a valid Tianditu token (tk). Some networks may block tianditu.gov.cn.
 * 提供天地图世界矢量/影像图层的工厂函数，带英文标注。
 * 需要有效的天地图令牌（tk）。某些网络可能会阻止 tianditu.gov.cn。
 *
 * NOTE: This module is currently NOT imported in main.js.
 * It is kept for future use when Tianditu basemap support is needed.
 * 注意：此模块目前未在 main.js 中导入。
 * 保留此模块以供将来需要天地图底图支持时使用。
 * 
 * To enable Tianditu basemaps / 启用天地图底图：
 * 1. Import the functions in main.js / 在 main.js 中导入函数：
 *    import { createTiandituVectorENLayers, createTiandituImageryENLayers, isTiandituAvailable } from './basemaps/tianditu.js';
 * 2. Add Tianditu layers to basemapRegistry in initializeMap() / 在 initializeMap() 中将天地图图层添加到 basemapRegistry
 * 3. Add corresponding options to the basemap-select dropdown in index.html / 在 index.html 的 basemap-select 下拉框中添加相应选项
 * 4. Provide a valid Tianditu token (tk) via environment variable or window global / 通过环境变量或 window 全局变量提供有效的天地图令牌（tk）
 */

import XYZ from 'ol/source/XYZ';
import { Tile as TileLayer } from 'ol/layer';

const TDT_SUBS = ['0','1','2','3','4','5','6','7'];

/**
 * Create Tianditu vector layers with English labels
 * 创建带英文标注的天地图矢量图层
 * 
 * @param {string} tk - Tianditu token / 天地图令牌
 * @returns {{base: TileLayer, labels: TileLayer}|null} Layer pair or null if no token / 图层对或 null（如果没有令牌）
 */
export function createTiandituVectorENLayers(tk) {
  if (!tk) return null;
  const vec = new TileLayer({
    source: new XYZ({
      urls: TDT_SUBS.map(s => `https://t${s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${tk}`),
      crossOrigin: 'anonymous'
    }),
    visible: false,
    zIndex: 0
  });
  // English vector annotation / 英文矢量标注
  const eva = new TileLayer({
    source: new XYZ({
      urls: TDT_SUBS.map(s => `https://t${s}.tianditu.gov.cn/DataServer?T=eva_w&x={x}&y={y}&l={z}&tk=${tk}`),
      crossOrigin: 'anonymous'
    }),
    visible: false,
    zIndex: 1
  });
  return { base: vec, labels: eva };
}

/**
 * Create Tianditu imagery layers with English labels
 * 创建带英文标注的天地图影像图层
 * 
 * @param {string} tk - Tianditu token / 天地图令牌
 * @returns {{base: TileLayer, labels: TileLayer}|null} Layer pair or null if no token / 图层对或 null（如果没有令牌）
 */
export function createTiandituImageryENLayers(tk) {
  if (!tk) return null;
  const img = new TileLayer({
    source: new XYZ({
      urls: TDT_SUBS.map(s => `https://t${s}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${tk}`),
      crossOrigin: 'anonymous'
    }),
    visible: false,
    zIndex: 0
  });
  // English image annotation / 英文影像标注
  const eia = new TileLayer({
    source: new XYZ({
      urls: TDT_SUBS.map(s => `https://t${s}.tianditu.gov.cn/DataServer?T=eia_w&x={x}&y={y}&l={z}&tk=${tk}`),
      crossOrigin: 'anonymous'
    }),
    visible: false,
    zIndex: 1
  });
  return { base: img, labels: eia };
}

/**
 * Check if Tianditu is available (has valid token)
 * 检查天地图是否可用（是否有有效令牌）
 * 
 * @param {string} tk - Tianditu token / 天地图令牌
 * @returns {boolean} Whether Tianditu is available / 天地图是否可用
 */
export function isTiandituAvailable(tk) {
  return typeof tk === 'string' && tk.trim().length > 0;
}
