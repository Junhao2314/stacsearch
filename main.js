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
 * Get stored theme from localStorage
 * 从 localStorage 获取存储的主题
 * 
 * @returns {string|null} Stored theme or null / 存储的主题或 null
 */
function getStoredTheme() {
    try {
        return localStorage.getItem('theme');
    } catch (e) {
        return null;
    }
}

/**
 * Check if user has manually selected a theme
 * 检查用户是否手动选择了主题
 * 
 * @returns {boolean} Whether user has selected a theme / 用户是否已选择主题
 */
function hasUserSelectedTheme() {
    try {
        return localStorage.getItem('theme-user-selected') === 'true';
    } catch (e) {
        return false;
    }
}

/**
 * Set theme to localStorage
 * 将主题存储到 localStorage
 * 
 * @param {string} value - Theme value ('light' or 'dark') / 主题值（'light' 或 'dark'）
 * @param {boolean} [userSelected=false] - Whether this was a manual user selection / 是否为用户手动选择
 */
function setStoredTheme(value, userSelected = false) {
    try {
        localStorage.setItem('theme', value);
        if (userSelected) {
            localStorage.setItem('theme-user-selected', 'true');
        }
    } catch (e) {
        // Ignore storage errors / 忽略存储错误
    }
}

/**
 * Check if current theme is dark
 * 检查当前是否为深色主题
 * 
 * @returns {boolean} Whether current theme is dark / 当前是否为深色主题
 */
function isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
}

/**
 * Apply theme to document
 * 应用主题到文档
 * 
 * @param {string} theme - Theme to apply ('light' or 'dark') / 要应用的主题（'light' 或 'dark'）
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Initialize theme from localStorage or system preference
 * 从 localStorage 或系统偏好初始化主题
 */
function initializeTheme() {
    const savedTheme = getStoredTheme();

    // Use saved theme if valid / 如果有效则使用保存的主题
    if (savedTheme === 'light' || savedTheme === 'dark') {
        applyTheme(savedTheme);
        return;
    }

    // Fallback to system preference, then light / 回退到系统偏好，然后是浅色
    let initialTheme = 'light';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        initialTheme = 'dark';
    }

    applyTheme(initialTheme);
    setStoredTheme(initialTheme);
}

/**
 * Toggle theme with View Transitions API support
 * 使用 View Transitions API 切换主题，带圆形扩散动画
 * 
 * @param {MouseEvent} event - Click event / 点击事件
 */
async function toggleTheme(event) {
    const newTheme = isDarkMode() ? 'light' : 'dark';

    // Check for reduced motion preference
    // 检查用户是否偏好减少动画
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // If browser doesn't support View Transitions or user prefers reduced motion, use simple toggle
    // 如果浏览器不支持 View Transitions 或用户偏好减少动画，使用简单切换
    if (!document.startViewTransition || prefersReducedMotion) {
        applyTheme(newTheme);
        setStoredTheme(newTheme, true); // Mark as user-selected / 标记为用户选择
        return;
    }

    // Get click position for ripple origin
    // 获取点击位置作为扩散圆心
    const x = event.clientX;
    const y = event.clientY;

    // Calculate radius to cover entire screen
    // 计算覆盖整个屏幕所需的半径
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    // Start view transition
    // 开始视图过渡
    const transition = document.startViewTransition(() => {
        applyTheme(newTheme);
        setStoredTheme(newTheme, true); // Mark as user-selected / 标记为用户选择
    });

    try {
        // Wait for pseudo-elements to be ready
        // 等待伪元素准备就绪
        await transition.ready;

        // Animate clip-path for circular reveal effect
        // 执行圆形扩散动画
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`
                ]
            },
            {
                duration: 400,
                easing: 'ease-out',
                pseudoElement: '::view-transition-new(root)'
            }
        );
    } catch (e) {
        // Fallback if animation fails
        // 动画失败时的回退处理
        console.warn('Theme transition animation failed:', e);
    }
}

/**
 * Listen for system theme changes
 * 监听系统主题变化
 * 
 * Only auto-switch if user hasn't manually selected a theme
 * 只有在用户未手动选择主题时才自动切换
 */
function setupSystemThemeListener() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    prefersDark.addEventListener('change', (e) => {
        // Only follow system preference if user hasn't manually selected a theme
        // 只有在用户未手动选择主题时才跟随系统偏好
        if (!hasUserSelectedTheme()) {
            const systemTheme = e.matches ? 'dark' : 'light';
            applyTheme(systemTheme);
            setStoredTheme(systemTheme, false); // Not user-selected / 非用户选择
        }
    });
}

/**
 * Initialize the application
 * 初始化应用程序
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme / 初始化主题
    initializeTheme();
    setupSystemThemeListener();
    
    // Setup theme toggle button / 设置主题切换按钮
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

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
