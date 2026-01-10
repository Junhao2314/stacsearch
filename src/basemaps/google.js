/**
 * Google Satellite Imagery Source Configuration
 * Google 卫星影像源配置
 *
 * This module provides configuration for accessing Google satellite and map imagery
 * through their XYZ tile service for global coverage.
 * 本模块提供通过 XYZ 瓦片服务访问 Google 卫星和地图影像的配置，覆盖全球。
 *
 * Note: Usage of mt*.google.com tile endpoints may be subject to Google's terms of service.
 * Ensure you have proper authorization to use these tiles in your application.
 * 注意：使用 mt*.google.com 瓦片端点可能受 Google 服务条款约束。
 * 请确保您有适当的授权在应用程序中使用这些瓦片。
 */

import XYZ from 'ol/source/XYZ';

/**
 * Create Google Satellite imagery tile source (imagery only)
 * 创建 Google 卫星影像瓦片源（仅影像）
 * 
 * @param {Object} options - Configuration options / 配置选项
 * @param {number} [options.maxZoom=20] - Maximum zoom level / 最大缩放级别
 * @param {string} [options.attribution='© Google'] - Attribution text / 版权信息
 * @param {Array<string>} [options.urls] - Custom tile URLs / 自定义瓦片 URL
 * @returns {XYZ} XYZ tile source / XYZ 瓦片源
 */
export function createGoogleSatelliteSource(options = {}) {
  const {
    maxZoom = 20,
    attribution = '© Google',
    urls = null
  } = options;

  const googleSatelliteUrls = urls || [
    'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
  ];

  return new XYZ({
    urls: googleSatelliteUrls,
    maxZoom,
    attributions: attribution,
    crossOrigin: 'anonymous'
  });
}

/**
 * Create Google Hybrid (satellite + labels) tile source
 * 创建 Google 混合（卫星 + 标注）瓦片源
 * 
 * @param {Object} options - Configuration options / 配置选项
 * @param {number} [options.maxZoom=20] - Maximum zoom level / 最大缩放级别
 * @param {string} [options.attribution='© Google'] - Attribution text / 版权信息
 * @returns {XYZ} XYZ tile source / XYZ 瓦片源
 */
export function createGoogleHybridSource(options = {}) {
  const {
    maxZoom = 20,
    attribution = '© Google'
  } = options;

  const googleHybridUrls = [
    'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
  ];

  return new XYZ({
    urls: googleHybridUrls,
    maxZoom,
    attributions: attribution,
    crossOrigin: 'anonymous'
  });
}

/**
 * Create Google Maps road tile source (road map)
 * 创建 Google 地图道路瓦片源（道路地图）
 * 
 * @param {Object} options - Configuration options / 配置选项
 * @param {number} [options.maxZoom=20] - Maximum zoom level / 最大缩放级别
 * @param {string} [options.attribution='© Google'] - Attribution text / 版权信息
 * @returns {XYZ} XYZ tile source / XYZ 瓦片源
 */
export function createGoogleMapsSource(options = {}) {
  const {
    maxZoom = 20,
    attribution = '© Google'
  } = options;

  const googleMapsUrls = [
    'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
  ];

  return new XYZ({
    urls: googleMapsUrls,
    maxZoom,
    attributions: attribution,
    crossOrigin: 'anonymous'
  });
}

/**
 * Google layer type constants
 * Google 图层类型常量
 */
export const GOOGLE_LAYER_TYPES = {
  SATELLITE: 's',    // Satellite imagery / 卫星影像
  HYBRID: 'y',       // Satellite + labels / 卫星 + 标注
  ROADMAP: 'm',      // Road map / 道路地图
  TERRAIN: 'p',      // Terrain / 地形
  TERRAIN_HYBRID: 't' // Terrain + labels / 地形 + 标注
};

/**
 * Create a custom Google XYZ source with specific layer type
 * 创建具有特定图层类型的自定义 Google XYZ 源
 * 
 * @param {string} layerType - Value from GOOGLE_LAYER_TYPES / GOOGLE_LAYER_TYPES 中的值
 * @param {Object} options - Configuration options / 配置选项
 * @returns {XYZ} XYZ tile source / XYZ 瓦片源
 */
export function createCustomGoogleSource(layerType, options = {}) {
  const {
    maxZoom = 20,
    attribution = '© Google'
  } = options;

  const urls = [
    `https://mt0.google.com/vt/lyrs=${layerType}&x={x}&y={y}&z={z}`,
    `https://mt1.google.com/vt/lyrs=${layerType}&x={x}&y={y}&z={z}`,
    `https://mt2.google.com/vt/lyrs=${layerType}&x={x}&y={y}&z={z}`,
    `https://mt3.google.com/vt/lyrs=${layerType}&x={x}&y={y}&z={z}`
  ];

  return new XYZ({
    urls,
    maxZoom,
    attributions: attribution,
    crossOrigin: 'anonymous'
  });
}

export const GOOGLE_ATTRIBUTION = '© Google';
