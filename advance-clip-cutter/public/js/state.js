export const state = {
    uploadedFile: null,
    duration: 0,
    projects: [],
    saveTimer: null,
    renderStartedAt: null,
    lastRenderClipSeconds: 0,
    uploadSample: null,
    metrics: {
        uploadCurrent: '0.0 Mbps',
        uploadAverage: 'Average 0.0 Mbps',
        uploadBytes: '0 B / 0 B',
        uploadChunks: '0 / 0 chunks',
        uploadElapsed: 'Elapsed 0s',
        uploadEta: 'ETA --',
        storageUsed: '0 B used',
        storageRemaining: '0 B free in 6GB app quota',
        diskFree: '--',
        diskTotal: '--',
        renderCurrent: 'Idle',
        renderElapsed: 'Elapsed 0s'
    }
};

export const refs = {};

export function assignRefs(nextRefs) {
    Object.assign(refs, nextRefs);
}
