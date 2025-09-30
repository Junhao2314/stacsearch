/**
 * Main application entry point
 * Integrates OpenLayers map, STAC search, and UI interactions
 */

import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, Vector as VectorSource } from 'ol/source';
import { fromLonLat, transformExtent, transform } from 'ol/proj';
import Draw, { createBox } from 'ol/interaction/Draw';
import { GeoJSON } from 'ol/format';
import { Style, Stroke, Fill } from 'ol/style';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Overlay from 'ol/Overlay';
import { searchStacItems, formatItemForDisplay, bboxToExtent, setProvider, getItemThumbnail } from './stac-service.js';

// Global variables
let map;
let drawInteraction;
let bboxLayer;
let itemsLayer;
let highlightLayer;
let currentItems = [];
let currentDrawType = 'Box'; // 'Box' or 'Polygon'

// Pagination state
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

// Map hover/selection state
let hoverOverlay;
let hoverLabelEl;
let lastHoverFeatureId = null;
let activeResultItemId = null;

// Default collection options snapshot
let defaultCollectionOptionsHTML = '';

// MPC (Microsoft Planetary Computer) curated collections
const MPC_COLLECTIONS = [
    { id: 'landsat-c2-l2', title: 'Landsat Collection 2 Level-2' },
    { id: 'sentinel-1-rtc', title: 'Sentinel 1 Radiometrically Terrain Corrected (RTC)' },
    { id: 'sentinel-1-grd', title: 'Sentinel 1 Level-1 Ground Range Detected (GRD)' },
    { id: 'sentinel-2-l2a', title: 'Sentinel-2 Level-2A' },
];

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeDateInputs();
    initializeMap();
    setupEventListeners();

    // Capture default collection options once
    const colSel = document.getElementById('collection');
    if (colSel && !defaultCollectionOptionsHTML) {
        defaultCollectionOptionsHTML = colSel.innerHTML;
    }
    // Populate curated collections for current provider
    const currentProviderSel = document.getElementById('provider');
    const currentProvider = currentProviderSel ? currentProviderSel.value : 'planetary-computer';
    populateCollections(currentProvider);
});

/**
 * Initialize date inputs with English format
 */
function initializeDateInputs() {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    
    dateInputs.forEach(input => {
        // Always use text inputs to ensure English ISO format
        input.setAttribute('type', 'text');
        input.setAttribute('placeholder', 'YYYY-MM-DD');
        input.setAttribute('pattern', '[0-9]{4}-[0-9]{2}-[0-9]{2}');
        input.setAttribute('inputmode', 'numeric');

        // Add input mask
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9]/g, '');
            if (value.length >= 4) {
                value = value.substring(0, 4) + '-' + value.substring(4);
            }
            if (value.length >= 7) {
                value = value.substring(0, 7) + '-' + value.substring(7, 9);
            }
            e.target.value = value.substring(0, 10);
        });
        
        // Ensure tooltip shows English formatted date
        input.addEventListener('change', function() {
            if (this.value && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(this.value)) {
                try {
                    const date = new Date(this.value + 'T00:00:00Z');
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const formatted = `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
                    this.setAttribute('title', formatted);
                    this.style.color = 'var(--text-primary)';
                } catch (e) {
                    this.style.color = 'var(--text-muted)';
                }
            }
        });
        
        // Set min and max dates (for browsers that still respect these on text inputs)
        const today = new Date();
        const maxDate = today.toISOString().split('T')[0];
        const minDate = new Date(1970, 0, 1).toISOString().split('T')[0];
        
        input.setAttribute('min', minDate);
        input.setAttribute('max', maxDate);
        
        // Add focus/blur handlers for better UX
        input.addEventListener('focus', function() {
            if (!this.value) {
                this.setAttribute('placeholder', 'YYYY-MM-DD');
            }
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.setAttribute('placeholder', input.id === 'date-from' ? 'Start' : 'End');
            }
        });
    });
    
    // Initialize with placeholders and defaults
    const dateFromInput = document.getElementById('date-from');
    const dateToInput = document.getElementById('date-to');

    // Helper to format as YYYY-MM-DD in UTC
    const formatYMD = (d) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    
    if (dateFromInput) {
        dateFromInput.setAttribute('placeholder', 'Start');
    }
    if (dateToInput) {
        dateToInput.setAttribute('placeholder', 'End');
    }

    // Set default values using UTC: end = today (UTC), start = first day of that month (UTC)
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endStr = formatYMD(now);
    const startStr = formatYMD(startOfMonth);

    if (dateToInput) {
        dateToInput.value = endStr;
        // Human-readable tooltip (UTC)
        dateToInput.setAttribute('title', now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
    }
    if (dateFromInput) {
        dateFromInput.value = startStr;
        dateFromInput.setAttribute('title', startOfMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }));
    }
}

/**
 * Initialize OpenLayers map
 */
function initializeMap() {
    // Create vector source and layer for bbox drawing
    const bboxSource = new VectorSource();
    bboxLayer = new VectorLayer({
        source: bboxSource,
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

    // Create vector layer for displaying items
    const itemsSource = new VectorSource();
    itemsLayer = new VectorLayer({
        source: itemsSource,
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

    // Highlight layer (for hover highlighting of items)
    const highlightSource = new VectorSource();
    highlightLayer = new VectorLayer({
        source: highlightSource,
        zIndex: 30,
        style: new Style({
            stroke: new Stroke({
                color: 'rgba(255, 193, 7, 0.95)', // amber
                width: 4
            }),
            fill: new Fill({
                color: 'rgba(255, 193, 7, 0.10)'
            })
        })
    });

    // Initialize the map
    map = new Map({
        target: 'map',
        layers: [
            new TileLayer({
                source: new OSM()
            }),
            bboxLayer,
            itemsLayer,
            highlightLayer
        ],
        view: new View({
            center: fromLonLat([0, 0]),
            zoom: 2
        }),
        controls: []
    });

    // Map hover overlay for item id
    hoverLabelEl = document.createElement('div');
    hoverLabelEl.className = 'map-hover-label';
    hoverOverlay = new Overlay({
        element: hoverLabelEl,
        offset: [0, -10],
        positioning: 'bottom-center',
        stopEvent: false
    });
    map.addOverlay(hoverOverlay);

    // Navigation controls will be set up in setupEventListeners
}

/**
 * Setup event listeners for UI elements
 */
function setupEventListeners() {
    // Search button
    document.getElementById('search-btn').addEventListener('click', performSearch);

    // Provider change
    document.getElementById('provider').addEventListener('change', (e) => {
        setProvider(e.target.value);
        populateCollections(e.target.value);
    });

    // Draw bbox button
    const drawBboxBtn = document.getElementById('draw-bbox');
    if (drawBboxBtn) {
        drawBboxBtn.addEventListener('click', () => {
            const fields = ['bbox-west', 'bbox-south', 'bbox-east', 'bbox-north'];
            const values = fields.map(id => document.getElementById(id).value);

            if (values.every(v => v !== '')) {
                drawBboxFromInputs();
            } else {
                currentDrawType = 'Box';
                startDrawing('Box');
                updateToolbarButtons('draw-rectangle');
            }
        });
    }

    // Map hover -> highlight + sync results
    map.on('pointermove', handleMapPointerMove);
    // Map single click -> open item details
    map.on('singleclick', handleMapSingleClick);

    // Drawing toolbar buttons
    document.getElementById('draw-polygon').addEventListener('click', () => {
        currentDrawType = 'Polygon';
        startDrawing('Polygon');
        updateToolbarButtons('draw-polygon');
    });
    
    document.getElementById('draw-rectangle').addEventListener('click', () => {
        currentDrawType = 'Box';
        startDrawing('Box');
        updateToolbarButtons('draw-rectangle');
    });

    document.getElementById('clear-drawing').addEventListener('click', () => {
        clearDrawing();
    });

    document.getElementById('toggle-drawing-tools').addEventListener('click', () => {
        const content = document.querySelector('.drawing-tools-content');
        const toggleBtn = document.getElementById('toggle-drawing-tools');

        const setToggleIcon = (state) => {
            if (state === 'expanded') {
                // Chevron icon for collapse action (expanded state)
                toggleBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                `;
            } else {
                // Vector drawing icon (collapsed state)
                toggleBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 5 19 8 16 19 6 16"></polygon>
                    </svg>
                `;
            }
        };

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            setToggleIcon('expanded');
            toggleBtn.setAttribute('title', 'Hide Drawing Tools');
        } else {
            content.classList.add('collapsed');
            setToggleIcon('collapsed');
            toggleBtn.setAttribute('title', 'Show Drawing Tools');
        }
    });

    // Navigation controls (separate and independent)
    document.getElementById('zoom-in').addEventListener('click', () => {
        const view = map.getView();
        const currentZoom = view.getZoom();
        view.animate({
            zoom: currentZoom + 1,
            duration: 250
        });
    });
    
    document.getElementById('zoom-out').addEventListener('click', () => {
        const view = map.getView();
        const currentZoom = view.getZoom();
        view.animate({
            zoom: currentZoom - 1,
            duration: 250
        });
    });

    document.getElementById('reset-view').addEventListener('click', () => {
        map.getView().animate({
            center: fromLonLat([0, 0]),
            zoom: 2,
            duration: 500
        });
    });

    // Modal close button
    document.querySelector('.close').addEventListener('click', closeModal);
    
    // Click outside modal to close
    document.getElementById('item-modal').addEventListener('click', (e) => {
        if (e.target.id === 'item-modal') {
            closeModal();
        }
    });
}

/**
 * Start drawing on map
 */
function startDrawing(type) {
    // Remove existing interaction
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
    }

    // Clear existing drawings
    bboxLayer.getSource().clear();

    if (type === 'Box') {
        drawInteraction = new Draw({
            source: bboxLayer.getSource(),
            type: 'Circle',
            geometryFunction: createBox()
        });
    } else if (type === 'Polygon') {
        drawInteraction = new Draw({
            source: bboxLayer.getSource(),
            type: 'Polygon'
        });
    }

    drawInteraction.on('drawend', (event) => {
        const geometry = event.feature.getGeometry();
        const extent = geometry.getExtent();
        
        // Transform from map projection to EPSG:4326
        const bbox = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
        
        // Update bbox inputs and hemisphere selects
        const [w, s, e, n] = bbox;
        const westHemSel = document.getElementById('bbox-west-hem');
        const southHemSel = document.getElementById('bbox-south-hem');
        const eastHemSel = document.getElementById('bbox-east-hem');
        const northHemSel = document.getElementById('bbox-north-hem');
        if (westHemSel) westHemSel.value = w < 0 ? 'W' : 'E';
        if (southHemSel) southHemSel.value = s < 0 ? 'S' : 'N';
        if (eastHemSel) eastHemSel.value = e < 0 ? 'W' : 'E';
        if (northHemSel) northHemSel.value = n < 0 ? 'S' : 'N';
        document.getElementById('bbox-west').value = Math.abs(w).toFixed(4);
        document.getElementById('bbox-south').value = Math.abs(s).toFixed(4);
        document.getElementById('bbox-east').value = Math.abs(e).toFixed(4);
        document.getElementById('bbox-north').value = Math.abs(n).toFixed(4);
        
        // Keep the shape and stop interaction immediately
        map.removeInteraction(drawInteraction);
        drawInteraction = null;

        // Fit view to drawn bbox
        const extent3857 = transformExtent(bbox, 'EPSG:4326', 'EPSG:3857');
        map.getView().fit(extent3857, { padding: [40, 40, 40, 40], duration: 300 });
    });

    map.addInteraction(drawInteraction);
}

/**
 * Clear all drawings
 */
function clearDrawing() {
    bboxLayer.getSource().clear();
    
    // Clear bbox input fields
    document.getElementById('bbox-west').value = '';
    document.getElementById('bbox-south').value = '';
    document.getElementById('bbox-east').value = '';
    document.getElementById('bbox-north').value = '';
    
    // Remove draw interaction if active
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
    }
}

/**
 * Update toolbar button states
 */
function updateToolbarButtons(activeId) {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (btn.id === activeId) {
            btn.classList.add('active');
        } else if (btn.id.startsWith('draw-')) {
            btn.classList.remove('active');
        }
    });
}

/**
 * Toggle bbox drawing interaction (for old button)
 */
function toggleBboxDrawing() {
    if (drawInteraction) {
        map.removeInteraction(drawInteraction);
        drawInteraction = null;
        document.getElementById('draw-bbox').textContent = 'Draw on Map';
        return;
    }
    startDrawing('Box');
    document.getElementById('draw-bbox').textContent = 'Cancel Drawing';
}

/**
 * Draw a bbox rectangle on the map using input fields
 */
function drawBboxFromInputs() {
    const westRaw = parseFloat(document.getElementById('bbox-west').value);
    const southRaw = parseFloat(document.getElementById('bbox-south').value);
    const eastRaw = parseFloat(document.getElementById('bbox-east').value);
    const northRaw = parseFloat(document.getElementById('bbox-north').value);

    const westHem = document.getElementById('bbox-west-hem')?.value || 'E';
    const southHem = document.getElementById('bbox-south-hem')?.value || 'N';
    const eastHem = document.getElementById('bbox-east-hem')?.value || 'E';
    const northHem = document.getElementById('bbox-north-hem')?.value || 'N';

    const applyLon = (v, hem) => (isNaN(v) ? NaN : (hem === 'W' ? -Math.abs(v) : Math.abs(v)));
    const applyLat = (v, hem) => (isNaN(v) ? NaN : (hem === 'S' ? -Math.abs(v) : Math.abs(v)));

    const west = applyLon(westRaw, westHem);
    const south = applyLat(southRaw, southHem);
    const east = applyLon(eastRaw, eastHem);
    const north = applyLat(northRaw, northHem);

    if ([west, south, east, north].some(v => isNaN(v))) {
        showError('Please enter valid numeric bbox values');
        return;
    }
    if (west >= east || south >= north) {
        showError('Invalid bbox: West < East and South < North required');
        return;
    }

    // Clear previous drawings
    bboxLayer.getSource().clear();

    // Clamp to valid EPSG:4326 ranges
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
    bboxLayer.getSource().addFeature(feature);

    // Fit view to bbox
    map.getView().fit(extent3857, { padding: [40, 40, 40, 40], duration: 300 });
}

/**
 * Perform STAC search
 */
async function performSearch() {
    const searchParams = collectSearchParameters();
    
    if (!validateSearchParams(searchParams)) {
        return;
    }

    // Show loading state
    showLoadingState();

    try {
        const results = await searchStacItems(searchParams);
        // Store and reset pagination
        currentItems = results.features || [];
        currentPage = 1;
        displaySearchResults(results);
        
        // Display items on map
        displayItemsOnMap(currentItems);
        
    } catch (error) {
        // Avoid duplicate prefix and show specific reason
        showError(`Search failed: ${error.message || error}`);
    }
}

/**
 * Collect search parameters from form
 */
function collectSearchParameters() {
    const params = {
        provider: document.getElementById('provider').value,
        collection: document.getElementById('collection').value,
        dateFrom: document.getElementById('date-from').value,
        dateTo: document.getElementById('date-to').value,
        limit: parseInt(document.getElementById('limit').value) || 10
    };

    // Priority: if a polygon is drawn on the map, use it; otherwise use current viewport extent
    const drawnFeatures = bboxLayer?.getSource()?.getFeatures?.() || [];
    if (drawnFeatures.length > 0) {
        const lastFeature = drawnFeatures[drawnFeatures.length - 1];
        const geom = lastFeature.getGeometry();
        // Convert to GeoJSON geometry in EPSG:4326
        const geojson = new GeoJSON().writeGeometryObject(geom, {
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857'
        });
        params.intersects = geojson;
    } else {
        // Use current map extent as bbox and sanitize to valid EPSG:4326 bounds
        const extent = map.getView().calculateExtent(map.getSize());
        const rawBbox = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        let [minX, minY, maxX, maxY] = rawBbox.map(v => Number(v));
        if ([minX, minY, maxX, maxY].every(Number.isFinite)) {
            minX = clamp(minX, -180, 180);
            maxX = clamp(maxX, -180, 180);
            minY = clamp(minY, -85, 85);
            maxY = clamp(maxY, -85, 85);
            if (minX < maxX && minY < maxY) {
                params.bbox = [minX, minY, maxX, maxY];
            } else {
                // Fallback to near-world bbox if invalid ordering occurs
                params.bbox = [-179.9, -80, 179.9, 80];
            }
        } else {
            // Fallback safe bbox if extent produced non-finite values
            params.bbox = [-179.9, -80, 179.9, 80];
        }
    }

    return params;
}

/**
 * Validate search parameters
 */
function validateSearchParams(params) {
    // At least one search criteria should be provided
    if (!params.collection && !params.dateFrom && !params.dateTo && !params.bbox && !params.intersects) {
        showError('Please provide at least one search parameter');
        return false;
    }

    // Validate bbox if provided
    if (params.bbox) {
        if (!params.bbox.every(Number.isFinite)) {
            showError('Invalid bounding box values');
            return false;
        }
        
        if (params.bbox[0] >= params.bbox[2] || params.bbox[1] >= params.bbox[3]) {
            showError('Invalid bounding box: West must be less than East, South must be less than North');
            return false;
        }
        // Ensure bbox within EPSG:4326 valid ranges
        const [minX, minY, maxX, maxY] = params.bbox;
        if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) {
            showError('Invalid bounding box range');
            return false;
        }
    }

    // Basic validation for intersects geometry (ensure coordinates exist)
    if (params.intersects) {
        if (!params.intersects.type || !params.intersects.coordinates) {
            showError('Invalid polygon geometry');
            return false;
        }
    }

    return true;
}

/**
 * Display search results in the results panel with pagination
 */
// Simple nullish coalesce helper (first non-null/undefined)
function coalesce() {
    for (var i = 0; i < arguments.length; i++) {
        var v = arguments[i];
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}

function displaySearchResults(results) {
    const resultsCount = document.getElementById('results-count');
    // Update count using total items we have client-side
    const total = coalesce(results && results.features && results.features.length, currentItems.length, 0);
    resultsCount.textContent = `Found ${total} items`;

    // Ensure pagination container exists and is placed after the list
    let pag = document.getElementById('results-pagination');
    const resultsList = document.getElementById('results-list');
    if (!pag) {
        pag = document.createElement('div');
        pag.id = 'results-pagination';
        resultsList.insertAdjacentElement('afterend', pag);
    }

    renderResultsPage();
}

/**
 * Render current page of results and pagination controls
 */
function renderResultsPage() {
    const resultsList = document.getElementById('results-list');
    const pag = document.getElementById('results-pagination');

    // Clear list
    resultsList.innerHTML = '';

    const total = currentItems.length;
    const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

    // Clamp current page
    currentPage = Math.min(Math.max(1, currentPage), totalPages);

    // Slice items for the current page
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, total);
    const pageItems = currentItems.slice(start, end);

    // Render items
    pageItems.forEach(item => {
        const formattedItem = formatItemForDisplay(item);
        const el = createResultItemElement(formattedItem);
        resultsList.appendChild(el);
    });

    // Render pagination controls
    if (totalPages <= 1) {
        pag.innerHTML = '';
        return;
    }

    pag.className = 'pagination';
    pag.innerHTML = `
        <button class="pager-btn" id="page-prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
        <span class="page-info">Page ${currentPage} of ${totalPages}</span>
        <button class="pager-btn" id="page-next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;

    // Wire up buttons
    const prevBtn = document.getElementById('page-prev');
    const nextBtn = document.getElementById('page-next');
    if (prevBtn) prevBtn.onclick = () => { currentPage = Math.max(1, currentPage - 1); renderResultsPage(); };
    if (nextBtn) nextBtn.onclick = () => { currentPage = Math.min(totalPages, currentPage + 1); renderResultsPage(); };
}

/**
 * Create result item HTML element
 */
function createResultItemElement(item) {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.dataset.itemId = item.id;
    // Show full id on hover via tooltip
    div.setAttribute('title', item.id);

    const thumb = getItemThumbnail(item);
    const thumbHTML = thumb ? `<img class=\"thumb-xs\" src=\"${thumb}\" alt=\"Thumbnail\" />` : '';

    div.innerHTML = `
        <h3>${item.id}</h3>
        <div class=\"result-foot\">
            ${thumbHTML}
            <div class=\"result-body\">
                <div class=\"meta\">
                    <span>Collection: ${item.collection}</span>
                    <span>Date: ${item.datetime}</span>
                    ${item.properties.platform ? `<span>Platform: ${item.properties.platform}</span>` : ''}
                </div>
            </div>
        </div>
    `;

    if (activeResultItemId === item.id) {
        div.classList.add('active');
    }
    
    // Highlight on hover over card
    div.addEventListener('mouseenter', () => {
        activeResultItemId = item.id;
        setActiveResultCard(item.id, false);
        highlightItemOnMap(item);
    });
    div.addEventListener('mouseleave', () => {
        clearHighlight();
        setActiveResultCard(null, false);
    });

    // Click to open details
    div.addEventListener('click', () => showItemDetails(item));
    
    return div;
}

/**
 * Display items on the map
 */
function displayItemsOnMap(items) {
    // Clear previous items
    itemsLayer.getSource().clear();
    
    const geojsonFormat = new GeoJSON();
    
    items.forEach(item => {
        if (item.geometry) {
            const feature = geojsonFormat.readFeature(item, {
                featureProjection: 'EPSG:3857'
            });
            if (feature && feature.setId) feature.setId(item.id);
            itemsLayer.getSource().addFeature(feature);
        }
    });
    
    // Fit map to show all items
    const extent = itemsLayer.getSource().getExtent();
    if (extent && !extent.includes(Infinity) && !extent.includes(-Infinity)) {
        map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 500
        });
    }
}

/**
 * Show item details in modal
 */
function showItemDetails(item) {
    const modal = document.getElementById('item-modal');
    const detailsDiv = document.getElementById('item-details');

    const props = item.properties || {};

    // Derive common fields gracefully
    const platform = props.platform || 'N/A';
    const instruments = Array.isArray(props.instruments) ? props.instruments.join(', ') : (props.instrument || 'N/A');
    const cloudCoverVal = coalesce(props['eo:cloud_cover'], props['cloud_cover'], props['s2:cloud_cover'], props['s2:cloud_percent']);
    const ccNum = (typeof cloudCoverVal === 'number') ? cloudCoverVal : parseFloat(cloudCoverVal);
    const cloudCover = (!isNaN(ccNum)) ? `${ccNum.toFixed(2)}%` : 'N/A';
    const gsdVal = coalesce(props['eo:gsd'], props['gsd'], props['s2:spatial_resolution']);
    const gsd = (gsdVal !== undefined && gsdVal !== null) ? `${gsdVal} m` : 'N/A';
    const epsg = props['proj:epsg'] || 'N/A';
    const mgrs = props['s2:mgrs_tile'] || props['mgrs:tile'] || null;

    const thumbUrl = getItemThumbnail(item);

    // Build details HTML - improved layout
    let detailsHTML = `
        <div class="item-summary">
            ${thumbUrl ? `<div class="thumb"><img src="${thumbUrl}" alt="Thumbnail"/></div>` : ''}
            <div class="summary-meta">
                <div class="id-line" title="${item.id}">${item.id}</div>
                <div class="summary-grid">
                    <span class="label">Collection:</span><span class="value">${item.collection}</span>
                    <span class="label">Date/Time:</span><span class="value">${item.datetime}</span>
                    <span class="label">Platform:</span><span class="value">${platform}</span>
                    <span class="label">Instrument:</span><span class="value">${instruments}</span>
                    <span class="label">Cloud cover:</span><span class="value">${cloudCover}</span>
                    <span class="label">GSD:</span><span class="value">${gsd}</span>
                    <span class="label">CRS (EPSG):</span><span class="value">${epsg}</span>
                    ${mgrs ? `<span class=\"label\">MGRS tile:</span><span class=\"value\">${mgrs}</span>` : ''}
                </div>
            </div>
        </div>
    `;

    // Assets section (links)
    if (item.assets && Object.keys(item.assets).length > 0) {
        const assetButtons = Object.keys(item.assets)
            .map((key) => `<button class=\"asset-pill\" type=\"button\" data-asset-key=\"${key}\">${key}</button>`) 
            .join('');
        detailsHTML += `
            <div class=\"detail-section\" id=\"assets-section\">
                <h3>Assets</h3>
                <div class=\"assets-grid\">${assetButtons}</div>
                <div id=\"asset-detail\" class=\"asset-detail hidden\"></div>
            </div>
        `;
    }

    // Bounding box section
    if (item.bbox) {
        detailsHTML += `
            <div class="detail-section">
                <h3>Bounding Box</h3>
                <div class="detail-grid">
                    <span class="label">West:</span><span class="value">${item.bbox[0]}</span>
                    <span class="label">South:</span><span class="value">${item.bbox[1]}</span>
                    <span class="label">East:</span><span class="value">${item.bbox[2]}</span>
                    <span class="label">North:</span><span class="value">${item.bbox[3]}</span>
                </div>
            </div>
        `;
    }

    // Raw properties (collapsible could be added later if desired)
    if (item.properties && Object.keys(item.properties).length > 0) {
        detailsHTML += `
            <div class="detail-section">
                <h3>All Properties (raw)</h3>
                <pre>${JSON.stringify(item.properties, null, 2)}</pre>
            </div>
        `;
    }

    detailsDiv.innerHTML = detailsHTML;
    modal.classList.add('show');

    // Wire up asset pill interactions to show details inline
    const pills = detailsDiv.querySelectorAll('.asset-pill');
    const assetDetailContainer = detailsDiv.querySelector('#asset-detail');
    let activeAssetKey = null;
    if (pills && assetDetailContainer && item.assets) {
        pills.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const key = btn.getAttribute('data-asset-key');

                if (activeAssetKey === key) {
                    // Toggle off if clicking the same asset
                    activeAssetKey = null;
                    pills.forEach(b => b.classList.remove('active'));
                    assetDetailContainer.classList.add('hidden');
                    assetDetailContainer.innerHTML = '';
                    return;
                }

                const asset = item.assets[key];
                // Update active state
                activeAssetKey = key;
                pills.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Render detail
                renderAssetDetail(assetDetailContainer, key, asset);
            });
        });
    }
}

/**
 * Render details for a specific asset in the modal
 */
function renderAssetDetail(container, key, asset) {
    if (!container || !asset) return;

    // Decide if we should preview the asset as an image (exclude TIFF/GeoTIFF)
    const hrefLower = String(asset.href || '').toLowerCase();
    const typeLower = String(asset.type || '').toLowerCase();
    const isPreviewableImage = (
        (typeLower === 'image/jpeg' || typeLower === 'image/jpg' || typeLower === 'image/png' || typeLower === 'image/gif' || typeLower === 'image/webp') ||
        hrefLower.endsWith('.jpg') || hrefLower.endsWith('.jpeg') || hrefLower.endsWith('.png') || hrefLower.endsWith('.gif') || hrefLower.endsWith('.webp')
    );

    const roles = Array.isArray(asset.roles) ? asset.roles.join(', ') : (asset.roles || 'N/A');

    const previewHTML = isPreviewableImage ? `
        <div class=\"asset-preview\"><img src=\"${asset.href}\" alt=\"${key} preview\" /></div>
    ` : '';

    // Short display for long HREFs
    let displayHref = asset.href || 'N/A';
    try {
        const u = new URL(asset.href);
        const parts = u.pathname.split('/').filter(Boolean);
        const tail = parts.slice(-2).join('/');
        displayHref = `${u.origin}/.../${tail}`;
    } catch {
        if (displayHref.length > 80) {
            displayHref = displayHref.slice(0, 40) + '...' + displayHref.slice(-30);
        }
    }

    container.classList.remove('hidden');
    container.innerHTML = `
        <h4>Asset: ${key}</h4>
        ${previewHTML}
        <div class=\"detail-grid\">
            <span class=\"label\">Type:</span><span class=\"value\">${asset.type || 'N/A'}</span>
            <span class=\"label\">Roles:</span><span class=\"value\">${roles}</span>
            <span class=\"label\">Href:</span><span class=\"value\"><a href=\"${asset.href}\" title=\"${asset.href}\" target=\"_blank\" rel=\"noopener noreferrer\">${displayHref}</a></span>
            ${asset.title ? `<span class=\"label\">Title:</span><span class=\"value\">${asset.title}</span>` : ''}
            ${asset.description ? `<span class=\"label\">Description:</span><span class=\"value\">${asset.description}</span>` : ''}
        </div>
        <div class=\"detail-section\">
            <h3>Asset JSON</h3>
            <pre>${JSON.stringify(asset, null, 2)}</pre>
        </div>
    `;
}

/**
 * Highlight a given item on the map by drawing its geometry in highlightLayer
 */
function highlightItemOnMap(item) {
    if (!item || !itemsLayer || !highlightLayer) return;
    const source = itemsLayer.getSource();
    const hsrc = highlightLayer.getSource();
    if (!source || !hsrc) return;

    hsrc.clear();

    // Find feature by id
    let feature = null;
    if (source.getFeatureById) {
        feature = source.getFeatureById(item.id);
    }
    if (!feature) {
        const feats = source.getFeatures();
        feature = feats.find(f => (f.getId && f.getId()) === item.id);
    }

    if (feature) {
        const geom = feature.getGeometry();
        if (geom) {
            const clone = geom.clone();
            const f = new Feature({ geometry: clone });
            hsrc.addFeature(f);
        }
    }
}

/**
 * Clear the highlight overlay
 */
function clearHighlight() {
    if (highlightLayer) {
        highlightLayer.getSource()?.clear();
    }
    if (hoverOverlay) {
        hoverOverlay.setPosition(undefined);
    }
    lastHoverFeatureId = null;
}

/**
 * Handle map hover to highlight item, show id label, and sync results list
 */
function handleMapPointerMove(evt) {
    if (!map || evt.dragging) return;
    const pixel = evt.pixel;
    let hitFeature = null;
    map.forEachFeatureAtPixel(pixel, (feature, layer) => {
        if (layer === itemsLayer) {
            hitFeature = feature;
            return true; // stop
        }
        return false;
    }, { layerFilter: l => l === itemsLayer, hitTolerance: 5 });

    if (!hitFeature) {
        if (lastHoverFeatureId) {
            setActiveResultCard(null, false);
            clearHighlight();
        }
        return;
    }

    const id = (hitFeature.getId && hitFeature.getId()) || hitFeature.get('id');
    if (!id) return;

    if (lastHoverFeatureId === id) {
        const geom = hitFeature.getGeometry();
        if (geom && hoverOverlay) {
            const ex = geom.getExtent();
            const center = [(ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2];
            hoverLabelEl.textContent = id;
            hoverOverlay.setPosition(center);
        }
        return;
    }

    lastHoverFeatureId = id;

    // Highlight and label
    highlightFeature(hitFeature);
    const geom = hitFeature.getGeometry();
    if (geom && hoverOverlay) {
        const ex = geom.getExtent();
        const center = [(ex[0] + ex[2]) / 2, (ex[1] + ex[3]) / 2];
        hoverLabelEl.textContent = id;
        hoverOverlay.setPosition(center);
    }

    // Sync results list
    gotoItemInResults(id);
}

function handleMapSingleClick(evt) {
    if (!map) return;
    let hitFeature = null;
    map.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
        if (layer === itemsLayer) {
            hitFeature = feature;
            return true; // stop
        }
        return false;
    }, { layerFilter: l => l === itemsLayer, hitTolerance: 5 });

    if (!hitFeature) return;

    const id = (hitFeature.getId && hitFeature.getId()) || hitFeature.get('id');
    if (!id) return;

    // Find full item by id
    const item = currentItems.find(f => f.id === id);
    if (!item) return;

    // Sync UI and show details
    setActiveResultCard(id, true);
    highlightFeature(hitFeature);
    // Hide hover label when opening details for a cleaner view
    if (hoverOverlay) hoverOverlay.setPosition(undefined);
    showItemDetails(item);
}

function highlightFeature(feature) {
    const hsrc = highlightLayer?.getSource?.();
    if (!hsrc) return;
    hsrc.clear();
    const geom = feature.getGeometry();
    if (geom) {
        const f = new Feature({ geometry: geom.clone() });
        hsrc.addFeature(f);
    }
}


function setActiveResultCard(id, scrollIntoView) {
    activeResultItemId = id;
    document.querySelectorAll('.result-item').forEach(el => {
        if (id && el.getAttribute('data-item-id') === id) {
            el.classList.add('active');
            if (scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            el.classList.remove('active');
        }
    });
}

function isItemInCurrentPage(id) {
    const idx = currentItems.findIndex(f => f.id === id);
    if (idx === -1) return false;
    const page = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    return page === currentPage;
}

function gotoItemInResults(id) {
    const idx = currentItems.findIndex(f => f.id === id);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    if (targetPage !== currentPage) {
        currentPage = targetPage;
        renderResultsPage();
    }
    setActiveResultCard(id, true);
}

/**
 * Populate the Collection select based on provider
 */
function populateCollections(provider) {
    const select = document.getElementById('collection');
    if (!select) return;

    if (provider === 'planetary-computer' || provider === 'earth-search') {
        let collections = MPC_COLLECTIONS;
        if (provider === 'earth-search') {
            collections = MPC_COLLECTIONS.filter(c => c.id !== 'sentinel-1-rtc');
        }
        const opts = ['<option value="">Select a collection...</option>']
            .concat(collections.map(c => `<option value="${c.id}" title="${c.title}">${c.title}</option>`));
        select.innerHTML = opts.join('');
        select.value = '';
    } else {
        // Restore original options for any other provider (not used currently)
        if (defaultCollectionOptionsHTML) {
            select.innerHTML = defaultCollectionOptionsHTML;
        }
    }
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('item-modal').classList.remove('show');
}

/**
 * Show loading state
 */
function showLoadingState() {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '<div class="loading">Searching...</div>';
    document.getElementById('results-count').textContent = '';
}

/**
 * Show error message
 */
function showError(message) {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = `<div class="error">${message}</div>`;
    document.getElementById('results-count').textContent = '';
}
