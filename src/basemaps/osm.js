/**
 * OSM basemap helper
 * OSM 底图辅助函数
 */
import OSM from 'ol/source/OSM';
import { Tile as TileLayer } from 'ol/layer';

/**
 * Create OpenStreetMap layer
 * 创建 OpenStreetMap 图层
 * 
 * @returns {TileLayer} OSM tile layer / OSM 瓦片图层
 */
export function createOsmLayer() {
  const src = new OSM();
  return new TileLayer({ source: src, visible: false, zIndex: 0 });
}
