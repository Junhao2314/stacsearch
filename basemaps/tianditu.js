/**
 * Tianditu basemap helpers (English labels)
 *
 * Provides factory functions for Tianditu world vector/imagery layers with English annotations.
 * Requires a valid Tianditu token (tk). Some networks may block tianditu.gov.cn.
 */

import XYZ from 'ol/source/XYZ';
import { Tile as TileLayer } from 'ol/layer';

const TDT_SUBS = ['0','1','2','3','4','5','6','7'];

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
  // English vector annotation
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
  // English image annotation
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

export function isTiandituAvailable(tk) {
  return typeof tk === 'string' && tk.trim().length > 0;
}
