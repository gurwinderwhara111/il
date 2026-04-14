import { refs } from './state.js';
import { clamp } from './utils.js';

export function logDebug(message, isError = false) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    console[isError ? 'error' : 'log'](line);
    if (refs.debugLog) {
        refs.debugLog.textContent += `${line}\n`;
        refs.debugLog.scrollTop = refs.debugLog.scrollHeight;
        refs.debug.style.display = 'block';
    }
}

export function setStatus(message, type = 'success') {
    if (!refs.status) return;
    refs.status.textContent = `Status: ${message}`;
    refs.status.className = `status status-${type}`;
    logDebug(message, type === 'error');
}

export function clearStatus() {
    if (!refs.status) return;
    refs.status.textContent = 'Status: Ready';
    refs.status.className = 'status status-ready';
}

export function showUploadProgress(show) {
    refs.uploadProgress.style.display = show ? 'grid' : 'none';
}

export function showRenderProgress(show) {
    refs.progress.style.display = show ? 'block' : 'none';
}

export function setUploadProgress(percent, message) {
    refs.uploadProgressFill.style.width = `${clamp(percent, 0, 100)}%`;
    refs.uploadProgressText.textContent = message;
}

export function setRenderProgress(percent) {
    refs.progressFill.style.width = `${clamp(percent, 0, 100)}%`;
}
