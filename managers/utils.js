/**
 * @fileoverview Utility functions module
 * 工具函数模块
 * 
 * Common utility functions used across the application
 * 应用程序中使用的通用工具函数
 */

/** @typedef {import('../types.js').PaginateOptions} PaginateOptions */
/** @typedef {import('../types.js').PaginateResult} PaginateResult */

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
 * Escape HTML special characters
 * 转义 HTML 特殊字符
 * 
 * @param {string|number|null|undefined} str - String to escape / 要转义的字符串
 * @returns {string} Escaped string / 转义后的字符串
 */
export function escapeHtml(str) {
    try {
        return String(str).replace(/[&<>"]/g, s => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        }[s]));
    } catch {
        return String(str || '');
    }
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
