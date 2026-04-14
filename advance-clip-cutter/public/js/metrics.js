import { refs, state } from './state.js';
import { APP_QUOTA_BYTES, formatBytes, formatMbps, formatSeconds } from './utils.js';

export function updateMetricsPanel(metrics) {
    state.metrics = { ...state.metrics, ...metrics };
    refs.metricUploadCurrent.textContent = state.metrics.uploadCurrent;
    refs.metricUploadAverage.textContent = state.metrics.uploadAverage;
    refs.metricUploadBytes.textContent = state.metrics.uploadBytes;
    refs.metricUploadChunks.textContent = state.metrics.uploadChunks;
    refs.metricUploadElapsed.textContent = state.metrics.uploadElapsed;
    refs.metricUploadEta.textContent = state.metrics.uploadEta;
    refs.metricStorageUsed.textContent = state.metrics.storageUsed;
    refs.metricStorageRemaining.textContent = state.metrics.storageRemaining;
    refs.metricDiskFree.textContent = state.metrics.diskFree;
    refs.metricDiskTotal.textContent = state.metrics.diskTotal;
    refs.metricRenderCurrent.textContent = state.metrics.renderCurrent;
    refs.metricRenderElapsed.textContent = state.metrics.renderElapsed;
}

export function resetUploadMetrics(totalBytes = 0, totalChunks = 0) {
    state.uploadSample = null;
    updateMetricsPanel({
        uploadCurrent: '0.0 Mbps',
        uploadAverage: 'Average 0.0 Mbps',
        uploadBytes: `${formatBytes(0)} / ${formatBytes(totalBytes)}`,
        uploadChunks: `0 / ${totalChunks} chunks`,
        uploadElapsed: 'Elapsed 0s',
        uploadEta: 'ETA --',
        renderCurrent: 'Idle',
        renderElapsed: 'Elapsed 0s'
    });
}

export function updateUploadMetrics({ uploadedBytes, totalBytes, totalChunks, uploadedChunks, startedAt }) {
    const now = performance.now();
    const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001);
    const averageBytesPerSecond = uploadedBytes / elapsedSeconds;
    let currentBytesPerSecond = averageBytesPerSecond;

    if (state.uploadSample) {
        const deltaBytes = Math.max(uploadedBytes - state.uploadSample.bytes, 0);
        const deltaSeconds = Math.max((now - state.uploadSample.time) / 1000, 0.001);
        currentBytesPerSecond = deltaBytes / deltaSeconds;
    }

    state.uploadSample = { bytes: uploadedBytes, time: now };
    const remainingBytes = Math.max(totalBytes - uploadedBytes, 0);
    const etaSeconds = averageBytesPerSecond > 0 ? remainingBytes / averageBytesPerSecond : 0;

    updateMetricsPanel({
        uploadCurrent: formatMbps(currentBytesPerSecond),
        uploadAverage: `Average ${formatMbps(averageBytesPerSecond)}`,
        uploadBytes: `${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`,
        uploadChunks: `${uploadedChunks} / ${totalChunks} chunks`,
        uploadElapsed: `Elapsed ${formatSeconds(elapsedSeconds)}`,
        uploadEta: uploadedBytes >= totalBytes ? 'ETA 0s' : `ETA ${formatSeconds(etaSeconds)}`
    });
}

export function updateRenderMetrics(currentClip = 0, totalClips = 0, lastClipSeconds = 0) {
    const totalElapsed = state.renderStartedAt ? (performance.now() - state.renderStartedAt) / 1000 : 0;
    const currentText = totalClips > 0 ? `Clip ${currentClip} / ${totalClips}` : 'Idle';
    const elapsedText = totalClips > 0
        ? `Last ${formatSeconds(lastClipSeconds)} • Total ${formatSeconds(totalElapsed)}`
        : 'Elapsed 0s';

    updateMetricsPanel({
        renderCurrent: currentText,
        renderElapsed: elapsedText
    });
}

export function applyStorageInfo(data = {}) {
    const quotaBytes = data.quota_bytes || APP_QUOTA_BYTES;
    const usedBytes = data.total_size || 0;
    const remainingQuota = data.quota_remaining ?? Math.max(quotaBytes - usedBytes, 0);
    const usedPercent = Math.min((usedBytes / quotaBytes) * 100, 100);

    refs.storageSummary.textContent = `${formatBytes(usedBytes)} used of ${formatBytes(quotaBytes)} app quota`;
    refs.storageFill.style.width = `${usedPercent}%`;

    updateMetricsPanel({
        storageUsed: `${formatBytes(usedBytes)} used`,
        storageRemaining: `${formatBytes(remainingQuota)} free in ${formatBytes(quotaBytes)} app quota`,
        diskFree: `${formatBytes(data.disk_free_bytes || 0)} disk free`,
        diskTotal: `${formatBytes(data.disk_total_bytes || 0)} total disk`
    });
}
