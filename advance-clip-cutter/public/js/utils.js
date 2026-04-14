export const CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
export const CHUNK_UPLOAD_CONCURRENCY = 4;
export const DIRECT_UPLOAD_THRESHOLD_MB = 8;
export const CHUNK_RETRY_LIMIT = 2;
export const APP_QUOTA_BYTES = 6 * 1024 * 1024 * 1024;
export const OUTPUT_WIDTH = 1080;
export const OUTPUT_HEIGHT = 1920;

export const defaultSettings = {
    baseTitle: '',
    clipLength: 5,
    startTime: 0,
    endTime: null,
    textSize: 64,
    textX: 50,
    textY: 4,
    videoScale: 100,
    videoX: 50,
    videoY: 50
};

export function $(id) {
    return document.getElementById(id);
}

export function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / (1024 ** index)).toFixed(2)} ${sizes[index]}`;
}

export function formatMbps(bytesPerSecond) {
    if (!bytesPerSecond || bytesPerSecond <= 0) return '0.0 Mbps';
    return `${((bytesPerSecond * 8) / (1024 * 1024)).toFixed(1)} Mbps`;
}

export function formatSeconds(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const whole = Math.round(seconds);
    const mins = Math.floor(whole / 60);
    const secs = whole % 60;
    return `${mins}m ${secs}s`;
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function slugifyFilename(value) {
    const slug = String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'clip';
}

export function buildClipTitle(baseTitle, clipIndex) {
    return `${baseTitle} Clip ${clipIndex}`;
}

export function buildClipFilename(baseTitle, clipIndex) {
    return `${slugifyFilename(buildClipTitle(baseTitle, clipIndex))}.mp4`;
}

export function secondsToTimeParts(totalSeconds = 0) {
    const safeSeconds = Math.max(Number(totalSeconds) || 0, 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds - (minutes * 60);
    return {
        minutes,
        seconds: Number(seconds.toFixed(2))
    };
}

export function timePartsToSeconds(minutesValue, secondsValue) {
    const minutes = Math.max(Math.floor(Number(minutesValue) || 0), 0);
    const seconds = Math.max(Number(secondsValue) || 0, 0);
    return Number(((minutes * 60) + seconds).toFixed(2));
}
