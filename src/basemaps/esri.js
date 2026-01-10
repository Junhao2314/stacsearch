/**
 * Esri basemap helpers (World Imagery and labels)
 * Esri 底图辅助函数（世界影像和标注）
 */
import XYZ from 'ol/source/XYZ';
import { Tile as TileLayer } from 'ol/layer';

/**
 * Create Esri World Imagery layer
 * 创建 Esri 世界影像图层
 * 
 * @returns {TileLayer} Esri World Imagery tile layer / Esri 世界影像瓦片图层
 */
export function createEsriWorldImageryLayer() {
  const src = new XYZ({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    crossOrigin: 'anonymous',
    attributions: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });
  return new TileLayer({ source: src, visible: false, zIndex: 0 });
}

/**
 * Create Esri World Labels layer
 * 创建 Esri 世界标注图层
 * 
 * @returns {TileLayer} Esri World Labels tile layer / Esri 世界标注瓦片图层
 */
export function createEsriWorldLabelsLayer() {
  const src = new XYZ({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    crossOrigin: 'anonymous',
    attributions: 'Esri — Reference Layer'
  });
  return new TileLayer({ source: src, visible: false, zIndex: 1 });
}
