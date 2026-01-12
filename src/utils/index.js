/**
 * @fileoverview Utility functions module
 * 工具函数模块
 * 
 * Common utility functions used across the application
 * 应用程序中使用的通用工具函数
 */

/** @typedef {import('../types/index.js').PaginateOptions} PaginateOptions */
/** @typedef {import('../types/index.js').PaginateResult} PaginateResult */

/**
 * Throttle function - limits function execution to once per specified time interval
 * 节流函数 - 限制函数在指定时间内只能执行一次
 * 
 * @template {Function} T
 * @param {T} fn - Function to throttle / 要节流的函数
 * @param {number} delay - Throttle delay in milliseconds / 节流延迟时间（毫秒）
 * @returns {T} Throttled function / 节流后的函数
 */
export function throttle(fn, delay) {
    let lastCall = 0;
    let timeoutId = null;
    
    return function throttled(...args) {
        const now = Date.now();
        const remaining = delay - (now - lastCall);
        
        if (remaining <= 0) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastCall = now;
            fn.apply(this, args);
        } else if (!timeoutId) {
            // Ensure the last call is also executed / 确保最后一次调用也能执行
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

/**
 * Debounce function - delays function execution until after a period of inactivity
 * 防抖函数 - 延迟执行函数，直到停止调用一段时间后
 * 
 * @template {Function} T
 * @param {T} fn - Function to debounce / 要防抖的函数
 * @param {number} delay - Debounce delay in milliseconds / 防抖延迟时间（毫秒）
 * @returns {T} Debounced function / 防抖后的函数
 */
export function debounce(fn, delay) {
    let timeoutId = null;
    
    return function debounced(...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * Simple nullish coalesce helper (first non-null/undefined)
 * 简单的空值合并辅助函数（返回第一个非 null/undefined 的值）
 * 
 * @template T
 * @param {...(T|null|undefined)} args - Values to check / 要检查的值
 * @returns {T|undefined} First non-null/undefined value / 第一个非 null/undefined 的值
 */
export function coalesce(...args) {
    for (let i = 0; i < args.length; i++) {
        if (args[i] !== undefined && args[i] !== null) return args[i];
    }
    return undefined;
}

/**
 * HTML special character escape map
 * HTML 特殊字符转义映射
 * @type {Object<string, string>}
 */
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/**
 * Escape HTML special characters
 * 转义 HTML 特殊字符
 * 
 * @param {string|number|null|undefined} str - String to escape / 要转义的字符串
 * @returns {string} Escaped string / 转义后的字符串
 */
export function escapeHtml(str) {
    try {
        return String(str).replace(/[&<>"']/g, s => HTML_ESCAPE_MAP[s]);
    } catch {
        return String(str || '');
    }
}

/**
 * Date format regex pattern (YYYY-MM-DD)
 * 日期格式正则表达式（YYYY-MM-DD）
 */
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check if a date string is in valid YYYY-MM-DD format
 * 检查日期字符串是否为有效的 YYYY-MM-DD 格式
 * 
 * @param {string} dateStr - Date string to check / 要检查的日期字符串
 * @returns {boolean} Whether the format is valid / 格式是否有效
 */
export function isValidDateFormat(dateStr) {
    return DATE_FORMAT_REGEX.test(dateStr);
}

/**
 * Parse and validate a date string (YYYY-MM-DD)
 * 解析并验证日期字符串（YYYY-MM-DD）
 * 
 * @param {string} dateStr - Date string to validate / 要验证的日期字符串
 * @returns {{valid: boolean, year?: number, month?: number, day?: number, date?: Date}} Validation result / 验证结果
 */
export function parseAndValidateDate(dateStr) {
    if (!dateStr || !isValidDateFormat(dateStr)) {
        return { valid: false };
    }
    
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // Check if the date is valid by comparing components
    // 通过比较各部分检查日期是否有效
    const isValid = date.getFullYear() === year &&
                    date.getMonth() === month - 1 &&
                    date.getDate() === day;
    
    if (!isValid) {
        return { valid: false };
    }
    
    return { valid: true, year, month, day, date };
}

/**
 * Generic pagination utility function
 * 通用分页工具函数
 * 
 * @param {PaginateOptions} options - Pagination options / 分页选项
 * @returns {PaginateResult} Pagination result / 分页结果
 */
export function paginate({ items, page, perPage, paginationEl, prevBtnId, nextBtnId, extraClass, onPageChange }) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const clampedPage = Math.min(Math.max(1, page), totalPages);

    const start = (clampedPage - 1) * perPage;
    const end = Math.min(start + perPage, total);
    const pageItems = items.slice(start, end);

    // Render pagination controls / 渲染分页控件
    if (paginationEl) {
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
        } else {
            paginationEl.className = extraClass ? `${extraClass} pagination` : 'pagination';
            paginationEl.innerHTML = `
                <button class="pager-btn" id="${prevBtnId}" ${clampedPage === 1 ? 'disabled' : ''}>Prev</button>
                <span class="page-info">Page ${clampedPage} of ${totalPages}</span>
                <button class="pager-btn" id="${nextBtnId}" ${clampedPage === totalPages ? 'disabled' : ''}>Next</button>
            `;

            const prevBtn = document.getElementById(prevBtnId);
            const nextBtn = document.getElementById(nextBtnId);
            if (prevBtn) prevBtn.onclick = () => onPageChange(Math.max(1, clampedPage - 1));
            if (nextBtn) nextBtn.onclick = () => onPageChange(Math.min(totalPages, clampedPage + 1));
        }
    }

    return { pageItems, totalPages, clampedPage };
}
