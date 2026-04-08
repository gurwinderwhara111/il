// Global console log to confirm script loading
console.log('Video Cutter script loaded at', new Date().toISOString());

let uploadedFile = null;
let duration = 0;
let debugEl = null;
let debugLog = null;
let statusEl = null;
let uploadProgressEl = null;
let uploadProgressFill = null;
let uploadProgressText = null;
let storageSummaryEl = null;
let isChunkedUpload = false;
let currentUploadId = null;

// Web Worker for heavy processing to prevent UI blocking
let processingWorker = null;

function initProcessingWorker() {
    if (typeof Worker !== 'undefined') {
        processingWorker = new Worker(URL.createObjectURL(new Blob([`
            self.onmessage = function(e) {
                const { action, data } = e.data;
                if (action === 'process_clips') {
                    // Simulate processing work
                    self.postMessage({ status: 'processing', progress: 0 });
                    // In a real implementation, this would handle clip processing
                    self.postMessage({ status: 'complete', result: data });
                }
            };
        `], { type: 'text/javascript' })));
    }
}

function showDebug() {
    if (!debugEl) return;
    if (debugEl.style.display === 'none') {
        debugEl.style.display = 'block';
    }
}

function setStatus(message, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = `Status: ${message}`;
    statusEl.className = `status ${isError ? 'status-error' : 'status-success'}`;
    if (isError) {
        logDebug(message, true);
    } else {
        logDebug(message, false);
    }
}

function clearStatus() {
    if (!statusEl) return;
    statusEl.textContent = 'Status: Ready';
    statusEl.className = 'status status-ready';
}

function showUploadProgress(show) {
    if (!uploadProgressEl) return;
    uploadProgressEl.style.display = show ? 'block' : 'none';
}

function setUploadProgress(percent, message) {
    if (!uploadProgressFill || !uploadProgressText) return;
    uploadProgressFill.style.width = `${percent}%`;
    uploadProgressText.textContent = message;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function logDebug(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${message}`;
    console[isError ? 'error' : 'log'](line);
    if (debugLog) {
        debugLog.textContent += `${line}\n`;
        debugLog.scrollTop = debugLog.scrollHeight;
        showDebug();
    }
}

function xhrUpload(file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percent, `Uploading ${file.name}: ${percent}%`);
            } else {
                setUploadProgress(0, `Uploading ${file.name}...`);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (error) {
                    reject(new Error(`Invalid JSON response: ${error.message}`));
                }
            } else {
                reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} - ${xhr.responseText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.onabort = () => reject(new Error('Upload aborted.'));

        const formData = new FormData();
        formData.append('video', file);
        xhr.send(formData);
    });
}

async function chunkedUpload(file) {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    logDebug(`Starting chunked upload: ${totalChunks} chunks for ${file.name}`);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('filename', file.name);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileId', fileId);

        const response = await fetch('/upload-chunk', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Chunk ${i + 1}/${totalChunks} upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(percent, `Uploading chunk ${i + 1}/${totalChunks}: ${percent}%`);

        if (result.complete) {
            logDebug(`Chunked upload complete: ${result.filename}`);
            return result;
        }
    }
}

async function uploadVideo() {
    const fileInput = document.getElementById('video-upload');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a video file.');
        setStatus('Upload blocked: no file selected.', true);
        return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    isChunkedUpload = fileSizeMB > 20;  // Use chunked upload for files >20MB

    setStatus(`Uploading ${file.name} (${fileSizeMB.toFixed(1)}MB)...`);
    setUploadProgress(0, `Preparing upload for ${file.name}...`);
    showUploadProgress(true);
    document.getElementById('upload-btn').disabled = true;

    try {
        let data;
        if (isChunkedUpload) {
            logDebug(`Using chunked upload for large file: ${fileSizeMB.toFixed(1)}MB`);
            data = await chunkedUpload(file);
        } else {
            data = await xhrUpload(file);
        }

        uploadedFile = {
            projectId: data.projectId,
            filename: data.filename
        };

        const previewUrl = `/uploads/${uploadedFile.projectId}/${encodeURIComponent(uploadedFile.filename)}`;
        document.getElementById('video-preview').src = previewUrl;
        document.getElementById('video-info').style.display = 'block';
        document.getElementById('options').style.display = 'block';
        setUploadProgress(100, 'Upload complete.');
        setStatus('Upload successful. Fetching duration...');

        const durationResponse = await fetch(`/duration/${uploadedFile.projectId}/${encodeURIComponent(uploadedFile.filename)}`);
        if (!durationResponse.ok) {
            const errorText = await durationResponse.text();
            setStatus(`Duration request failed: ${durationResponse.status} ${durationResponse.statusText}`, true);
            setUploadProgress(0, 'Duration request failed.');
            return;
        }

        const durationData = await durationResponse.json();
        duration = durationData.duration;
        document.getElementById('duration').textContent = duration.toFixed(2);
        document.getElementById('end-time').value = duration;
        document.getElementById('start-time').value = 0;
        setStatus(`Video ready: ${duration.toFixed(2)} seconds.`);
        setUploadProgress(100, 'Ready to cut.');

        await loadProjects();
    } catch (error) {
        setStatus(error.message, true);
        logDebug(`Upload error: ${error.message}`, true);
        alert('Upload failed. See debug log for details.');
    } finally {
        document.getElementById('upload-btn').disabled = false;
    }
}

function calculateClips() {
    const clipLength = parseFloat(document.getElementById('clip-length').value);
    if (!clipLength || clipLength <= 0) {
        alert('Please enter a valid clip length.');
        logDebug('Calculation blocked: invalid clip length.', true);
        return;
    }
    const start = parseFloat(document.getElementById('start-time').value) || 0;
    const end = parseFloat(document.getElementById('end-time').value) || duration;
    const totalTime = end - start;
    if (totalTime <= 0) {
        alert('End time must be greater than start time.');
        logDebug(`Calculation blocked: invalid timeline start=${start}, end=${end}.`, true);
        return;
    }
    const clipCount = Math.floor(totalTime / clipLength);
    document.getElementById('clip-count').textContent = `You will get ${clipCount} clips.`;
    logDebug(`Calculated ${clipCount} clips from ${start}s to ${end}s with clip length ${clipLength}s.`);
}

async function cutVideo() {
    if (!uploadedFile) {
        alert('Please upload a video first.');
        setStatus('Cut blocked: no uploaded video.', true);
        return;
    }

    const clipLength = parseFloat(document.getElementById('clip-length').value);
    if (!clipLength || clipLength <= 0) {
        alert('Please enter a valid clip length.');
        logDebug('Cut blocked: invalid clip length.', true);
        return;
    }
    const start = parseFloat(document.getElementById('start-time').value) || 0;
    const end = parseFloat(document.getElementById('end-time').value) || duration;
    const totalTime = end - start;
    if (totalTime <= 0) {
        alert('End time must be greater than start time.');
        logDebug(`Cut blocked: invalid timeline start=${start}, end=${end}.`, true);
        return;
    }
    const clipCount = Math.floor(totalTime / clipLength);
    if (clipCount <= 0) {
        alert('Clip length is too long for the selected interval.');
        logDebug('Cut blocked: clip count was 0.', true);
        return;
    }

    const originalName = uploadedFile.filename.split('.')[0] || 'video';
    logDebug(`Starting cutting: ${clipCount} clips from ${start}s to ${end}s.`);
    document.getElementById('progress').style.display = 'block';
    document.getElementById('progress-fill').style.width = '0%';

    for (let i = 0; i < clipCount; i++) {
        const clipStart = start + i * clipLength;
        const clipEnd = Math.min(clipStart + clipLength, end);
        const outputName = `${originalName}_Part${i + 1}.mp4`;

        logDebug(`Cut request #${i + 1}: ${clipStart}s to ${clipEnd}s => ${outputName}`);
        try {
            const response = await fetch('/cut', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId: uploadedFile.projectId,
                    filename: uploadedFile.filename,
                    start: clipStart,
                    end: clipEnd,
                    output: outputName
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                logDebug(`Cut failed for ${outputName}: ${response.status} ${response.statusText} - ${errorText}`, true);
                alert('Error cutting video. See debug log.');
                document.getElementById('progress').style.display = 'none';
                return;
            }
        } catch (error) {
            logDebug(`Cut error for ${outputName}: ${error.message}`, true);
            alert('Error cutting video. See debug log.');
            document.getElementById('progress').style.display = 'none';
            return;
        }

        const progress = ((i + 1) / clipCount) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
    }

    document.getElementById('progress').style.display = 'none';
    document.getElementById('downloads').style.display = 'block';
    logDebug('Cutting complete. Download links ready.');

    const clipList = document.getElementById('clip-list');
    clipList.innerHTML = '';
    for (let i = 0; i < clipCount; i++) {
        const outputName = `${originalName}_Part${i + 1}.mp4`;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/uploads/${uploadedFile.projectId}/${encodeURIComponent(outputName)}`;
        a.download = outputName;
        a.textContent = outputName;
        li.appendChild(a);
        clipList.appendChild(li);
    }
}

async function loadStorageInfo() {
    try {
        const response = await fetch('/storage');
        if (!response.ok) {
            throw new Error(`Failed to load storage info: ${response.statusText}`);
        }
        const data = await response.json();
        const total = data.projects_size + data.temp_size;
        const maxStorage = 2 * 1024 * 1024 * 1024; // 2GB max
        const used = Math.min((total / maxStorage) * 100, 100);
        
        const storageSummaryEl = document.getElementById('storage-summary');
        if (storageSummaryEl) {
            storageSummaryEl.textContent = `${formatBytes(data.projects_size)} used of ${formatBytes(maxStorage)}`;
        }
        
        const storageFill = document.getElementById('storage-fill');
        if (storageFill) {
            storageFill.style.width = `${used}%`;
        }
    } catch (error) {
        logDebug(`Error loading storage info: ${error.message}`, true);
    }
}

async function cleanupTempFiles() {
    if (!confirm('Delete all temporary chunk upload data?')) {
        return;
    }

    try {
        const response = await fetch('/cleanup-temp', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`Cleanup failed: ${response.statusText}`);
        }
        const data = await response.json();
        logDebug(`Temp cleanup complete: removed ${data.removed} folders.`);
        await loadProjects();
        alert('Temporary upload data cleaned up.');
    } catch (error) {
        logDebug(`Cleanup error: ${error.message}`, true);
        alert('Cleanup failed. See debug log.');
    }
}

async function loadProjects() {
    try {
        const response = await fetch('/projects');
        if (!response.ok) {
            throw new Error(`Failed to load projects: ${response.statusText}`);
        }

        const data = await response.json();
        displayProjects(data.projects);
        await loadStorageInfo();
    } catch (error) {
        logDebug(`Error loading projects: ${error.message}`, true);
    }
}

function displayProjects(projects) {
    const list = document.getElementById('projects-list');
    if (!list) {
        return;
    }

    list.innerHTML = '';
    if (!projects || projects.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <div class="empty-state-title">No Projects Yet</div>
                <div class="empty-state-text">Upload a video to get started and create your first project</div>
            </div>
        `;
        updateProjectStats([], {});
        return;
    }

    updateProjectStats(projects, {});

    projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';

        const header = document.createElement('div');
        header.className = 'project-header';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'project-checkbox';
        checkbox.value = project.projectId;
        
        const label = document.createElement('label');
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' '));
        
        const headerInfo = document.createElement('div');
        headerInfo.className = 'project-header-info';
        
        const title = document.createElement('div');
        title.className = 'project-header-title';
        title.textContent = project.name;
        headerInfo.appendChild(title);
        
        const meta = document.createElement('div');
        meta.className = 'project-header-meta';
        
        const clipBadge = document.createElement('div');
        clipBadge.className = 'project-meta-badge';
        clipBadge.innerHTML = `📹 ${project.clipCount} clip${project.clipCount !== 1 ? 's' : ''}`;
        
        const sizeMeta = document.createElement('span');
        sizeMeta.className = 'project-meta-item';
        sizeMeta.innerHTML = `📊 ${formatBytes(project.totalSize)}`;
        
        const dateMeta = document.createElement('span');
        dateMeta.className = 'project-meta-item';
        dateMeta.innerHTML = `📅 ${new Date(project.modified * 1000).toLocaleDateString()}`;
        
        meta.appendChild(clipBadge);
        meta.appendChild(sizeMeta);
        meta.appendChild(dateMeta);
        headerInfo.appendChild(meta);
        
        label.appendChild(headerInfo);
        header.appendChild(label);
        projectItem.appendChild(header);

        // Details section
        const details = document.createElement('div');
        details.className = 'project-details';
        
        const detailsRow1 = document.createElement('div');
        detailsRow1.className = 'project-details-row';
        detailsRow1.innerHTML = `
            <div class="project-detail-item">
                <span class="project-detail-label">Video File</span>
                <a href="/uploads/${project.projectId}/${encodeURIComponent(project.videoName)}" 
                   target="_blank" style="color: var(--primary); text-decoration: none; font-weight: 600;">${project.videoName}</a>
            </div>
            <div class="project-detail-item">
                <span class="project-detail-label">Video Size</span>
                <span class="project-detail-value">${formatBytes(project.videoSize)}</span>
            </div>
        `;
        
        const detailsRow2 = document.createElement('div');
        detailsRow2.className = 'project-details-row';
        detailsRow2.innerHTML = `
            <div class="project-detail-item">
                <span class="project-detail-label">Clips Size</span>
                <span class="project-detail-value">${formatBytes(project.clipsSize)}</span>
            </div>
            <div class="project-detail-item">
                <span class="project-detail-label">Last Modified</span>
                <span class="project-detail-value">${new Date(project.modified * 1000).toLocaleString()}</span>
            </div>
        `;
        
        details.appendChild(detailsRow1);
        details.appendChild(detailsRow2);
        projectItem.appendChild(details);

        // Clips section
        if (project.clips && project.clips.length > 0) {
            const clipsSection = document.createElement('div');
            clipsSection.className = 'project-clips-section';
            
            const clipsTitle = document.createElement('div');
            clipsTitle.className = 'project-clips-title';
            clipsTitle.textContent = `Generated Clips (${project.clips.length})`;
            clipsSection.appendChild(clipsTitle);
            
            const clipsList = document.createElement('div');
            clipsList.className = 'project-clips-list';
            
            project.clips.forEach(clip => {
                const clipItem = document.createElement('div');
                clipItem.className = 'clip-item';
                
                const clipInfo = document.createElement('div');
                clipInfo.className = 'clip-info';
                
                const clipName = document.createElement('a');
                clipName.className = 'clip-name';
                clipName.href = `/uploads/${project.projectId}/${encodeURIComponent(clip.name)}`;
                clipName.target = '_blank';
                clipName.textContent = clip.name;
                
                const clipSize = document.createElement('div');
                clipSize.className = 'clip-size';
                clipSize.textContent = formatBytes(clip.size);
                
                clipInfo.appendChild(clipName);
                clipInfo.appendChild(clipSize);
                clipItem.appendChild(clipInfo);
                clipsList.appendChild(clipItem);
            });
            
            clipsSection.appendChild(clipsList);
            projectItem.appendChild(clipsSection);
        }

        // Actions section
        const actions = document.createElement('div');
        actions.className = 'project-actions';
        
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-action btn-action-secondary';
        openBtn.textContent = '👁 Preview';
        openBtn.onclick = () => window.open(`/uploads/${project.projectId}/${encodeURIComponent(project.videoName)}`, '_blank');
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-action btn-action-danger';
        deleteBtn.textContent = '🗑 Delete';
        deleteBtn.onclick = () => deleteProject(project.projectId);
        
        actions.appendChild(openBtn);
        actions.appendChild(deleteBtn);
        projectItem.appendChild(actions);

        list.appendChild(projectItem);
    });
}

function updateProjectStats(projects, storage) {
    const statProjects = document.getElementById('stat-projects');
    const statClips = document.getElementById('stat-clips');
    const statStorage = document.getElementById('stat-storage');
    
    if (statProjects) statProjects.textContent = projects.length;
    
    if (statClips) {
        const totalClips = projects.reduce((sum, p) => sum + (p.clipCount || 0), 0);
        statClips.textContent = totalClips;
    }
    
    if (statStorage) {
        const totalSize = projects.reduce((sum, p) => sum + (p.totalSize || 0), 0);
        statStorage.textContent = formatBytes(totalSize);
    }
}


async function deleteProject(projectId, requireConfirm = true) {
    if (requireConfirm && !confirm(`Delete project ${projectId} and all its files?`)) {
        return;
    }

    try {
        const response = await fetch(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error(`Delete failed: ${response.statusText}`);
        }
        await loadProjects();
        logDebug(`Deleted project ${projectId}`);
    } catch (error) {
        logDebug(`Delete project error: ${error.message}`, true);
        alert('Delete failed. See debug log.');
    }
}

async function deleteSelectedProjects() {
    const selected = Array.from(document.querySelectorAll('.project-checkbox:checked')).map(checkbox => checkbox.value);
    if (selected.length === 0) {
        alert('Select at least one project to delete.');
        return;
    }

    if (!confirm(`Delete ${selected.length} selected project(s)?`)) {
        return;
    }

    for (const projectId of selected) {
        await deleteProject(projectId, false);
    }
}

async function deleteAllProjects() {
    if (!confirm('Delete all projects and free all storage?')) {
        return;
    }

    try {
        const response = await fetch('/cleanup-all', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`Cleanup failed: ${response.statusText}`);
        }
        const data = await response.json();
        logDebug(`All projects deleted: ${data.removed}`);
        await loadProjects();
    } catch (error) {
        logDebug(`Delete all error: ${error.message}`, true);
        alert('Delete all failed. See debug log.');
    }
}

function openTab(tabName) {
    const uploadPage = document.getElementById('upload-page');
    const managerPage = document.getElementById('manager-page');
    const tabUpload = document.getElementById('tab-upload');
    const tabManager = document.getElementById('tab-manager');

    if (tabName === 'manager') {
        uploadPage.style.display = 'none';
        managerPage.style.display = 'block';
        tabUpload.classList.remove('active');
        tabManager.classList.add('active');
        loadProjects();
    } else {
        uploadPage.style.display = 'block';
        managerPage.style.display = 'none';
        tabUpload.classList.add('active');
        tabManager.classList.remove('active');
    }
}

async function refreshFiles() {
    setStatus('Refreshing file list...');
    await loadProjects();
    setStatus('File list refreshed.');
}

document.addEventListener('DOMContentLoaded', async () => {
    debugEl = document.getElementById('debug');
    debugLog = document.getElementById('debug-log');
    statusEl = document.getElementById('status');
    uploadProgressEl = document.getElementById('upload-progress');
    uploadProgressFill = document.getElementById('upload-progress-fill');
    uploadProgressText = document.getElementById('upload-progress-text');
    storageSummaryEl = document.getElementById('storage-summary');

    logDebug('Script loaded and DOM ready.');
    clearStatus();
    showUploadProgress(false);

    const uploadBtn = document.getElementById('upload-btn');
    const testBtn = document.getElementById('test-btn');
    const calculateBtn = document.getElementById('calculate-btn');
    const recalculateBtn = document.getElementById('recalculate-btn');
    const cutBtn = document.getElementById('cut-btn');

    if (!uploadBtn) {
        logDebug('upload-btn not found in DOM.', true);
        return;
    }

    uploadBtn.addEventListener('click', uploadVideo);
    testBtn?.addEventListener('click', () => {
        alert('App is working! Script loaded successfully.');
        setStatus('Test passed: App is functional.');
        logDebug('Test button clicked - app is working.');
    });
    calculateBtn?.addEventListener('click', calculateClips);
    recalculateBtn?.addEventListener('click', calculateClips);
    cutBtn?.addEventListener('click', cutVideo);

    // Tab navigation
    document.getElementById('tab-upload')?.addEventListener('click', () => openTab('upload'));
    document.getElementById('tab-manager')?.addEventListener('click', () => openTab('manager'));

    // File manager controls
    const refreshProjectsBtn = document.getElementById('refresh-projects-btn');
    refreshProjectsBtn?.addEventListener('click', refreshFiles);

    const deleteSelectedBtn = document.getElementById('delete-selected-btn');
    deleteSelectedBtn?.addEventListener('click', deleteSelectedProjects);

    const deleteAllBtn = document.getElementById('delete-all-btn');
    deleteAllBtn?.addEventListener('click', deleteAllProjects);

    const cleanupTempBtn = document.getElementById('cleanup-temp-btn');
    cleanupTempBtn?.addEventListener('click', cleanupTempFiles);

    // Initialize processing worker
    initProcessingWorker();

    // Load current storage data
    await loadProjects();
});

window.addEventListener('error', (event) => {
    logDebug(`Global error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, true);
});
window.addEventListener('unhandledrejection', (event) => {
    logDebug(`Unhandled rejection: ${event.reason}`, true);
});
