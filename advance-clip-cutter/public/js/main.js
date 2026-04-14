import { fetchDuration, cutClipRequest } from './api.js';
import {
    applySettingsToForm,
    bindComposerEvents,
    getClipCount,
    normalizeSettings,
    readSettingsFromForm,
    saveProjectSettings,
    updateClipPreview
} from './composer.js';
import { resetUploadMetrics, updateRenderMetrics } from './metrics.js';
import {
    cleanupTempFiles,
    deleteAllProjects,
    deleteSelectedProjects,
    loadProjects
} from './projects.js';
import { assignRefs, refs, state } from './state.js';
import {
    clearStatus,
    logDebug,
    setRenderProgress,
    setStatus,
    setUploadProgress,
    showRenderProgress,
    showUploadProgress
} from './ui.js';
import {
    $,
    CHUNK_SIZE_BYTES,
    buildClipFilename,
    defaultSettings,
    formatBytes,
    slugifyFilename
} from './utils.js';
import { chunkedUpload, DIRECT_UPLOAD_THRESHOLD_MB, getDirectUploadData } from './upload.js';

console.log('Video Cutter script loaded at', new Date().toISOString());

function getProjectHandlers() {
    return {
        onOpenProject: loadProjectIntoWorkspace
    };
}

function openTab(tabName) {
    const showManager = tabName === 'manager';
    refs.uploadPage.style.display = showManager ? 'none' : 'block';
    refs.managerPage.style.display = showManager ? 'block' : 'none';
    refs.tabUpload.classList.toggle('active', !showManager);
    refs.tabManager.classList.toggle('active', showManager);
    refs.tabUpload.setAttribute('aria-selected', String(!showManager));
    refs.tabManager.setAttribute('aria-selected', String(showManager));
    if (showManager) {
        loadProjects(getProjectHandlers());
    }
}

async function loadProjectIntoWorkspace(project) {
    state.uploadedFile = { projectId: project.projectId, filename: project.videoName };
    refs.composerWorkspace.style.display = 'grid';
    refs.videoInfo.style.display = 'grid';
    refs.options.style.display = 'grid';
    refs.videoPreview.src = `/uploads/${project.projectId}/${encodeURIComponent(project.videoName)}`;
    refs.videoPreview.load();
    refs.downloads.style.display = 'none';
    showUploadProgress(false);
    showRenderProgress(false);

    const durationData = await fetchDuration(project.projectId, project.videoName);
    state.duration = durationData.duration;
    refs.duration.textContent = state.duration.toFixed(2);

    const settings = normalizeSettings(project.settings || {});
    if (settings.endTime === null) {
        settings.endTime = state.duration;
    }

    applySettingsToForm(settings);
    updateClipPreview();
    await saveProjectSettings();
    openTab('upload');
    setStatus(`Loaded project ${project.videoName}.`);
}

async function uploadVideo() {
    const file = refs.videoUpload.files[0];
    if (!file) {
        alert('Please select a video file.');
        setStatus('Upload blocked: no file selected.', 'error');
        return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const isChunkedUpload = fileSizeMB >= DIRECT_UPLOAD_THRESHOLD_MB;
    refs.uploadBtn.disabled = true;
    refs.downloads.style.display = 'none';
    showUploadProgress(true);
    showRenderProgress(false);
    setRenderProgress(0);
    state.lastRenderClipSeconds = 0;
    state.renderStartedAt = null;
    updateRenderMetrics();
    resetUploadMetrics(file.size, isChunkedUpload ? Math.ceil(file.size / CHUNK_SIZE_BYTES) : 1);

    try {
        setStatus(`Uploading ${file.name} (${fileSizeMB.toFixed(1)}MB)...`);
        let data;

        if (isChunkedUpload) {
            setStatus(`Uploading ${file.name} with ${formatBytes(CHUNK_SIZE_BYTES)} chunks and concurrency 4...`);
            data = await chunkedUpload(file);
        } else {
            setStatus(`Uploading ${file.name} directly...`);
            data = await getDirectUploadData(file);
        }

        await loadProjectIntoWorkspace({
            projectId: data.projectId,
            videoName: data.filename,
            settings: defaultSettings
        });

        setUploadProgress(100, 'Upload complete.');
        showUploadProgress(false);
        await loadProjects(getProjectHandlers());
    } catch (error) {
        setStatus(error.message, 'error');
        alert('Upload failed. See debug log for details.');
    } finally {
        refs.uploadBtn.disabled = false;
    }
}

function calculateClips() {
    const settings = readSettingsFromForm();
    if (!settings.baseTitle) {
        alert('Please enter a base title.');
        return;
    }
    if (!settings.clipLength) {
        alert('Please enter a valid clip length.');
        return;
    }
    const clipCount = updateClipPreview();
    logDebug(`Calculated ${clipCount} clips from ${settings.startTime}s to ${(settings.endTime ?? state.duration)}s with clip length ${settings.clipLength}s and title "${settings.baseTitle}".`);
}

function getRenderedClipFiles() {
    if (!state.uploadedFile) {
        return [];
    }
    return Array.from(refs.clipList.querySelectorAll('a')).map((link) => ({
        name: link.download || link.textContent.trim(),
        url: link.href
    }));
}

async function downloadClipsToChosenFolder(files) {
    const rootDirectory = await window.showDirectoryPicker();
    const folderName = `${slugifyFilename(readSettingsFromForm().baseTitle || state.uploadedFile.filename)}-clips`;
    const targetDirectory = await rootDirectory.getDirectoryHandle(folderName, { create: true });

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`Saving ${index + 1} of ${files.length} clips to folder...`);
        const response = await fetch(file.url);
        if (!response.ok) {
            throw new Error(`Download failed for ${file.name}`);
        }
        const blob = await response.blob();
        const fileHandle = await targetDirectory.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }
}

async function downloadClipsSequentially(files) {
    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`Starting clip download ${index + 1} of ${files.length}...`);
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
}

async function downloadAllClips() {
    const files = getRenderedClipFiles();
    if (!files.length) {
        alert('No rendered clips are ready to download yet.');
        return;
    }

    try {
        if (typeof window.showDirectoryPicker === 'function') {
            await downloadClipsToChosenFolder(files);
            setStatus(`Saved ${files.length} clips into a folder.`);
            logDebug(`Saved ${files.length} clips into a chosen folder.`);
            return;
        }

        await downloadClipsSequentially(files);
        setStatus(`Started downloading ${files.length} clips.`);
        logDebug(`Started sequential download for ${files.length} clips.`);
    } catch (error) {
        if (error?.name === 'AbortError') {
            setStatus('Bulk download canceled.', 'ready');
            return;
        }
        logDebug(`Download all failed: ${error.message}`, true);
        setStatus('Download all failed.', 'error');
        alert('Bulk download failed. See debug log for details.');
    }
}

async function cutVideo() {
    if (!state.uploadedFile) {
        alert('Please upload or open a project first.');
        setStatus('Cut blocked: no uploaded video.', 'error');
        return;
    }

    const settings = readSettingsFromForm();
    if (!settings.baseTitle) {
        alert('Please enter a base title.');
        return;
    }

    const clipCount = getClipCount(settings);
    updateClipPreview();
    if (clipCount <= 0) {
        alert('Clip length is too long for the selected interval.');
        return;
    }

    state.renderStartedAt = performance.now();
    showRenderProgress(true);
    setRenderProgress(0);
    refs.clipList.innerHTML = '';
    refs.downloads.style.display = 'none';
    setStatus(`Rendering ${clipCount} vertical clips...`);

    for (let index = 0; index < clipCount; index += 1) {
        const clipIndex = index + 1;
        const clipStart = settings.startTime + (index * settings.clipLength);
        const clipEnd = Math.min(clipStart + settings.clipLength, settings.endTime ?? state.duration);
        const outputName = buildClipFilename(settings.baseTitle, clipIndex);
        const clipStartedAt = performance.now();

        logDebug(`Cut request #${clipIndex}: ${clipStart}s to ${clipEnd}s => ${outputName}`);

        try {
            await cutClipRequest({
                projectId: state.uploadedFile.projectId,
                filename: state.uploadedFile.filename,
                clipIndex,
                start: clipStart,
                end: clipEnd,
                ...settings
            });
        } catch (error) {
            logDebug(`Cut failed for ${outputName}: ${error.message}`, true);
            setStatus(`Cut failed for ${outputName}.`, 'error');
            showRenderProgress(false);
            return;
        }

        state.lastRenderClipSeconds = (performance.now() - clipStartedAt) / 1000;
        updateRenderMetrics(clipIndex, clipCount, state.lastRenderClipSeconds);
        setRenderProgress((clipIndex / clipCount) * 100);
        setStatus(`Rendered clip ${clipIndex} of ${clipCount}.`);
    }

    showRenderProgress(false);
    setStatus(`Finished rendering ${clipCount} vertical clips.`);
    refs.downloads.style.display = 'block';
    refs.clipList.innerHTML = '';

    for (let index = 0; index < clipCount; index += 1) {
        const outputName = buildClipFilename(settings.baseTitle, index + 1);
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `/uploads/${state.uploadedFile.projectId}/${encodeURIComponent(outputName)}`;
        link.download = outputName;
        link.textContent = outputName;
        item.appendChild(link);
        refs.clipList.appendChild(item);
    }

    logDebug('Cutting complete. Download links ready.');
    await loadProjects(getProjectHandlers());
}

function bindAppEvents() {
    bindComposerEvents();

    refs.uploadBtn.addEventListener('click', uploadVideo);
    refs.testBtn.addEventListener('click', () => {
        alert('App is working! Script loaded successfully.');
        setStatus('Test passed: App is functional.');
    });
    refs.downloadAllBtn.addEventListener('click', downloadAllClips);
    refs.calculateBtn.addEventListener('click', calculateClips);
    refs.recalculateBtn.addEventListener('click', calculateClips);
    refs.cutBtn.addEventListener('click', cutVideo);
    refs.tabUpload.addEventListener('click', () => openTab('upload'));
    refs.tabManager.addEventListener('click', () => openTab('manager'));
    refs.refreshProjectsBtn.addEventListener('click', () => loadProjects(getProjectHandlers()));
    refs.deleteSelectedBtn.addEventListener('click', () => deleteSelectedProjects(getProjectHandlers()));
    refs.deleteAllBtn.addEventListener('click', () => deleteAllProjects(getProjectHandlers()));
    refs.cleanupTempBtn.addEventListener('click', () => cleanupTempFiles(getProjectHandlers()));
}

document.addEventListener('DOMContentLoaded', async () => {
    assignRefs({
        composerWorkspace: $('composer-workspace'),
        debug: $('debug'),
        debugLog: $('debug-log'),
        status: $('status'),
        uploadProgress: $('upload-progress'),
        uploadProgressFill: $('upload-progress-fill'),
        uploadProgressText: $('upload-progress-text'),
        videoUpload: $('video-upload'),
        videoPreview: $('video-preview'),
        previewFrame: $('preview-frame'),
        previewVideoLayer: $('preview-video-layer'),
        previewTextLayer: $('preview-text-layer'),
        videoInfo: $('video-info'),
        options: $('options'),
        downloads: $('downloads'),
        downloadAllBtn: $('download-all-btn'),
        clipList: $('clip-list'),
        duration: $('duration'),
        clipCount: $('clip-count'),
        clipTitlePreview: $('clip-title-preview'),
        baseTitle: $('base-title'),
        clipLength: $('clip-length'),
        clipLengthMinutes: $('clip-length-minutes'),
        clipLengthSeconds: $('clip-length-seconds'),
        startTime: $('start-time'),
        startTimeMinutes: $('start-time-minutes'),
        startTimeSeconds: $('start-time-seconds'),
        endTime: $('end-time'),
        endTimeMinutes: $('end-time-minutes'),
        endTimeSeconds: $('end-time-seconds'),
        textSizeRange: $('text-size-range'),
        textSizeNumber: $('text-size-number'),
        textXRange: $('text-x-range'),
        textXNumber: $('text-x-number'),
        textYRange: $('text-y-range'),
        textYNumber: $('text-y-number'),
        videoScaleRange: $('video-scale-range'),
        videoScaleNumber: $('video-scale-number'),
        videoXRange: $('video-x-range'),
        videoXNumber: $('video-x-number'),
        videoYRange: $('video-y-range'),
        videoYNumber: $('video-y-number'),
        calculateBtn: $('calculate-btn'),
        recalculateBtn: $('recalculate-btn'),
        cutBtn: $('cut-btn'),
        uploadBtn: $('upload-btn'),
        testBtn: $('test-btn'),
        progress: $('progress'),
        progressFill: $('progress-fill'),
        storageSummary: $('storage-summary'),
        storageFill: $('storage-fill'),
        metricUploadCurrent: $('metric-upload-current'),
        metricUploadAverage: $('metric-upload-average'),
        metricUploadBytes: $('metric-upload-bytes'),
        metricUploadChunks: $('metric-upload-chunks'),
        metricUploadElapsed: $('metric-upload-elapsed'),
        metricUploadEta: $('metric-upload-eta'),
        metricStorageUsed: $('metric-storage-used'),
        metricStorageRemaining: $('metric-storage-remaining'),
        metricDiskFree: $('metric-disk-free'),
        metricDiskTotal: $('metric-disk-total'),
        metricRenderCurrent: $('metric-render-current'),
        metricRenderElapsed: $('metric-render-elapsed'),
        uploadPage: $('upload-page'),
        managerPage: $('manager-page'),
        tabUpload: $('tab-upload'),
        tabManager: $('tab-manager'),
        projectsList: $('projects-list'),
        statProjects: $('stat-projects'),
        statClips: $('stat-clips'),
        statStorage: $('stat-storage'),
        refreshProjectsBtn: $('refresh-projects-btn'),
        deleteSelectedBtn: $('delete-selected-btn'),
        deleteAllBtn: $('delete-all-btn'),
        cleanupTempBtn: $('cleanup-temp-btn')
    });

    clearStatus();
    showUploadProgress(false);
    showRenderProgress(false);
    applySettingsToForm(defaultSettings);
    bindAppEvents();
    updateClipPreview();
    await loadProjects(getProjectHandlers());
});

window.addEventListener('error', (event) => {
    logDebug(`Global error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
    logDebug(`Unhandled rejection: ${event.reason}`, true);
});
