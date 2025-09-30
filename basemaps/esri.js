/**
 * Esri basemap helpers (World Imagery and labels)
 */
import XYZ from 'ol/source/XYZ';
import { Tile as TileLayer } from 'ol/layer';

export function createEsriWorldImageryLayer() {
  const src = new XYZ({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    crossOrigin: 'anonymous',
    attributions: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  });
  return new TileLayer({ source: src, visible: false, zIndex: 0 });
}

export function createEsriWorldLabelsLayer() {
  const src = new XYZ({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    crossOrigin: 'anonymous',
    attributions: 'Esri — Reference Layer'
  });
  return new TileLayer({ source: src, visible: false, zIndex: 1 });
}
