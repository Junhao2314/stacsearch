/**
 * Main application entry point
 * 应用程序主入口
 * 
 * Integrates OpenLayers map, STAC search, and UI interactions
 * 集成 OpenLayers 地图、STAC 搜索和 UI 交互
 * 
 * Refactored to use modular architecture:
 * 重构为模块化架构：
 * - MapManager: Map initialization, layer management, basemap switching / 地图初始化、图层管理、底图切换
 * - SearchManager: STAC search, result storage, pagination / STAC 搜索、结果存储、分页
 * - DrawingManager: Drawing interaction, bbox management / 绘制交互、bbox 管理
 * - CollectionPicker: Collection picker UI and state / 集合选择器 UI 和状态
 * - UIController: Event bindng, modal management, result list rendering / 事件绑定、模态框管理、结果列表渲染
 */

import 'ol/ol.css';

// Configuration / 配置
import { MAP_CONFIG, BASEMAP_CONFIG } from './config.js';

// Managers / 管理模块
import { MapManager } from './managers/MapManager.js';
import { SearchManager } from './managers/SearchManager.js';
import { DrawingManager } from './managers/DrawingManager.js';
import { CollectionPicker } from './managers/CollectionPicker.js';
import { UIController } from './managers/UIController.js';

// Application instances / 应用实例
let mapManager;
let searchManager;
let drawingManager;
let collectionPicker;
let uiController;

/**
 * Initialize the application
 * 初始化应用程序
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize managers / 初始化管理器
    mapManager = new MapManager(MAP_CONFIG, BASEMAP_CONFIG);
    mapManager.initialize('map');

    searchManager = new SearchManager();
    drawingManager = new DrawingManager(mapManager);
    collectionPicker = new CollectionPicker();
    
    uiController = new UIController(mapManager, searchManager, drawingManager, collectionPicker);

    // Initialize UI / 初始化 UI
    uiController.initializeDateInputs();
    uiController.setupEventListeners();

    // Initialize collection picker / 初始化集合选择器
    collectionPicker.initialize();
    const currentProvider = document.getElementById('provider')?.value || 'planetary-computer';
    collectionPicker.populateLegacySelect(currentProvider);
});
