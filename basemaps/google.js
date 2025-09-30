/**
 * Google Satellite Imagery Source Configuration
 *
 * This module provides configuration for accessing Google satellite and map imagery
 * through their XYZ tile service for global coverage.
 *
 * Note: Usage of mt*.google.com tile endpoints may be subject to Google's terms of service.
 * Ensure you have proper authorization to use these tiles in your application.
 */

import XYZ from 'ol/source/XYZ';

/**
 * Create Google Satellite imagery tile source (imagery only)
 * @param {Object} options
 * @param {number} [options.maxZoom=20]
 * @param {string} [options.attribution='© Google']
 * @param {Array<string>} [options.urls]
 * @returns {XYZ}
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
 * @param {Object} options
 * @param {number} [options.maxZoom=20]
 * @param {string} [options.attribution='© Google']
 * @returns {XYZ}
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
 * @param {Object} options
 * @param {number} [options.maxZoom=20]
 * @param {string} [options.attribution='© Google']
 * @returns {XYZ}
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

export const GOOGLE_LAYER_TYPES = {
  SATELLITE: 's',
  HYBRID: 'y',
  ROADMAP: 'm',
  TERRAIN: 'p',
  TERRAIN_HYBRID: 't'
};

/**
 * Create a custom Google XYZ source with specific layer type
 * @param {string} layerType Value from GOOGLE_LAYER_TYPES
 * @param {Object} options
 * @returns {XYZ}
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
