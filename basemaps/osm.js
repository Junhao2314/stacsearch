/**
 * OSM basemap helper
 */
import OSM from 'ol/source/OSM';
import { Tile as TileLayer } from 'ol/layer';

export function createOsmLayer() {
  const src = new OSM();
  return new TileLayer({ source: src, visible: false, zIndex: 0 });
}
