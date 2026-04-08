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

    // Check file size and decide upload method
    const fileSizeMB = file.size / (1024 * 1024);
    isChunkedUpload = fileSizeMB > 100; // Use chunked upload for files > 100MB

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

        uploadedFile = data.filename;
        document.getElementById('video-preview').src = `/uploads/${uploadedFile}`;
        document.getElementById('video-info').style.display = 'block';
        document.getElementById('options').style.display = 'block';
        document.getElementById('file-manager').style.display = 'block';
        setUploadProgress(100, 'Upload complete.');
        setStatus('Upload successful. Fetching duration...');

        const durationResponse = await fetch(`/duration/${uploadedFile}`);
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

        // Refresh file list
        await loadFiles();

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

    const fileInput = document.getElementById('video-upload');
    const originalName = fileInput.files[0]?.name?.split('.')[0] || 'video';
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
                    filename: uploadedFile,
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
        a.href = `/uploads/${outputName}`;
        a.download = outputName;
        a.textContent = outputName;
        li.appendChild(a);
        clipList.appendChild(li);
    }
}

async function loadFiles() {
    try {
        const response = await fetch('/files');
        if (!response.ok) {
            throw new Error(`Failed to load files: ${response.statusText}`);
        }

        const data = await response.json();
        displayFiles(data.videos, data.clips);
    } catch (error) {
        logDebug(`Error loading files: ${error.message}`, true);
    }
}

function displayFiles(videos, clips) {
    const videosList = document.getElementById('videos-list');
    const clipsList = document.getElementById('clips-list');

    if (videosList) {
        videosList.innerHTML = '';
        videos.forEach(file => {
            const fileItem = createFileItem(file, 'video');
            videosList.appendChild(fileItem);
        });
    }

    if (clipsList) {
        clipsList.innerHTML = '';
        clips.forEach(file => {
            const fileItem = createFileItem(file, 'clip');
            clipsList.appendChild(fileItem);
        });
    }
}

function createFileItem(file, type) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px; border: 1px solid #ddd; margin: 5px 0; border-radius: 4px;';

    const info = document.createElement('div');
    info.innerHTML = `
        <strong>${file.name}</strong><br>
        <small>Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB | Modified: ${new Date(file.modified * 1000).toLocaleString()}</small>
    `;

    const actions = document.createElement('div');

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download';
    downloadBtn.onclick = () => window.open(`/uploads/${file.name}`, '_blank');

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = 'background: #ff4444; color: white; border: none; padding: 5px 10px; margin-left: 10px; border-radius: 3px; cursor: pointer;';
    deleteBtn.onclick = async () => {
        if (confirm(`Delete ${file.name}?`)) {
            try {
                const response = await fetch(`/delete/${file.name}`, { method: 'DELETE' });
                if (response.ok) {
                    logDebug(`Deleted ${file.name}`);
                    await loadFiles();
                } else {
                    throw new Error(`Delete failed: ${response.statusText}`);
                }
            } catch (error) {
                logDebug(`Delete error: ${error.message}`, true);
                alert('Delete failed. See debug log.');
            }
        }
    };

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);

    return item;
}

async function refreshFiles() {
    setStatus('Refreshing file list...');
    await loadFiles();
    setStatus('File list refreshed.');
}

document.addEventListener('DOMContentLoaded', () => {
    debugEl = document.getElementById('debug');
    debugLog = document.getElementById('debug-log');
    statusEl = document.getElementById('status');
    uploadProgressEl = document.getElementById('upload-progress');
    uploadProgressFill = document.getElementById('upload-progress-fill');
    uploadProgressText = document.getElementById('upload-progress-text');

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

    // File manager
    const refreshFilesBtn = document.getElementById('refresh-files-btn');
    refreshFilesBtn?.addEventListener('click', refreshFiles);

    // Initialize processing worker
    initProcessingWorker();
});

window.addEventListener('error', (event) => {
    logDebug(`Global error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, true);
});
window.addEventListener('unhandledrejection', (event) => {
    logDebug(`Unhandled rejection: ${event.reason}`, true);
});
