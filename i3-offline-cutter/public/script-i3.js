// i3 Video Cutter - Frontend Logic
console.log('i3 Video Cutter loaded');

let uploadedFile = null;
let duration = 0;
let systemInfo = null;
let adaptiveChunkSize = 2 * 1024 * 1024; // 2MB default

// ==========================================
// SYSTEM MONITORING
// ==========================================

async function initSystem() {
    try {
        const response = await fetch('/system-info');
        systemInfo = await response.json();
        
        log(`RAM Available: ${systemInfo.available_ram_gb?.toFixed(1)}GB / ${systemInfo.total_ram_gb?.toFixed(1)}GB`, 'info');
        log(`CPU: ${systemInfo.cpu_cores} cores @ ${systemInfo.cpu_percent?.toFixed(1)}%`, 'info');
        
        // Update system info display
        const infoEl = document.getElementById('system-info');
        if (infoEl && !systemInfo.error) {
            infoEl.innerHTML = `
                <span>💾 RAM: ${systemInfo.available_ram_gb?.toFixed(1)}GB</span> | 
                <span>⚙️ CPU: ${systemInfo.cpu_percent?.toFixed(0)}%</span> | 
                <span>📊 Mode: FAST</span>
            `;
        }
        
        if (systemInfo.is_low_resource) {
            log('⚠️ Low resource system detected - using conservative settings', 'warning');
        }
    } catch (e) {
        log(`System info error: ${e.message}`, 'error');
    }
}

// ==========================================
// LOGGING
// ==========================================

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${message}`;
    console.log(logMsg);
    
    const logBox = document.getElementById('debug-log');
    if (logBox) {
        const line = document.createElement('div');
        line.textContent = logMsg;
        line.className = type;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
    }
}

// ==========================================
// FILE UPLOAD
// ==========================================

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function uploadVideo() {
    const fileInput = document.getElementById('video-upload');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a video file');
        return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    const useChunks = fileSizeMB > 20;

    log(`Uploading: ${file.name} (${formatBytes(file.size)})`, 'info');
    
    try {
        document.getElementById('upload-btn').disabled = true;
        document.getElementById('upload-progress').style.display = 'block';

        let data;
        if (useChunks) {
            log(`Using chunked upload (${formatBytes(adaptiveChunkSize)}/chunk)`, 'info');
            data = await chunkedUpload(file);
        } else {
            data = await simpleUpload(file);
        }

        uploadedFile = {
            projectId: data.projectId,
            filename: data.filename
        };

        document.getElementById('video-preview').src = `/uploads/${data.projectId}/${encodeURIComponent(data.filename)}`;
        document.getElementById('video-info').style.display = 'block';
        document.getElementById('cutting-section').style.display = 'block';

        // Get duration
        log('Fetching video duration...', 'info');
        const durationResponse = await fetch(`/duration/${data.projectId}/${encodeURIComponent(data.filename)}`);
        const durationData = await durationResponse.json();
        duration = durationData.duration;
        
        document.getElementById('duration').textContent = duration.toFixed(2);
        document.getElementById('end-time').value = Math.floor(duration);
        document.getElementById('start-time').value = 0;
        
        log(`✓ Video ready: ${duration.toFixed(2)}s`, 'success');
        await loadProjects();
    } catch (error) {
        log(`Upload error: ${error.message}`, 'error');
        alert('Upload failed: ' + error.message);
    } finally {
        document.getElementById('upload-btn').disabled = false;
        document.getElementById('upload-progress').style.display = 'none';
    }
}

async function simpleUpload(file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                document.getElementById('progress-fill').style.width = percent + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error('Upload failed: ' + xhr.statusText));
            }
        };

        xhr.onerror = () => reject(new Error('Network error'));

        const formData = new FormData();
        formData.append('video', file);
        xhr.send(formData);
    });
}

async function chunkedUpload(file) {
    const CHUNK_SIZE = adaptiveChunkSize;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('filename', file.name);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', totalChunks);
        formData.append('fileId', fileId);

        const response = await fetch('/upload-chunk', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Chunk ${i+1} failed`);
        }

        const result = await response.json();
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        document.getElementById('progress-fill').style.width = percent + '%';

        if (result.complete) {
            return result;
        }
    }
}

// ==========================================
// VIDEO CUTTING
// ==========================================

function calculateClips() {
    const clipLength = parseFloat(document.getElementById('clip-length').value);
    const start = parseFloat(document.getElementById('start-time').value) || 0;
    const end = parseFloat(document.getElementById('end-time').value) || duration;

    if (!clipLength || clipLength <= 0) {
        alert('Invalid clip length');
        return;
    }

    const totalTime = end - start;
    if (totalTime <= 0) {
        alert('Invalid time range');
        return;
    }

    const clipCount = Math.floor(totalTime / clipLength);
    const estimatedTime = clipCount * 5; // ~5 seconds per clip in FAST mode

    document.getElementById('clip-count').textContent = `📊 You will get ${clipCount} clips`;
    document.getElementById('estimate-time').textContent = `⏱️ Estimated time: ~${estimatedTime} seconds`;

    log(`Calculated: ${clipCount} clips (${formatBytes(0)} per clip average)`, 'info');
}

async function cutVideo() {
    if (!uploadedFile) {
        alert('Please upload a video first');
        return;
    }

    const clipLength = parseFloat(document.getElementById('clip-length').value);
    const start = parseFloat(document.getElementById('start-time').value) || 0;
    const end = parseFloat(document.getElementById('end-time').value) || duration;

    if (!clipLength || clipLength <= 0 || start >= end) {
        alert('Invalid parameters');
        return;
    }

    const totalTime = end - start;
    const clipCount = Math.floor(totalTime / clipLength);

    if (clipCount <= 0) {
        alert('Clip length is too long');
        return;
    }

    const originalName = uploadedFile.filename.split('.')[0];
    
    log(`Starting to cut: ${clipCount} clips (FAST mode - stream copy)`, 'info');
    
    document.getElementById('cutting-progress').style.display = 'block';
    document.getElementById('cutting-status').textContent = `Processing 1/${clipCount}...`;

    try {
        for (let i = 0; i < clipCount; i++) {
            const clipStart = start + i * clipLength;
            const clipEnd = Math.min(clipStart + clipLength, end);
            const outputName = `${originalName}_Part${i + 1}.mp4`;

            log(`Cutting clip ${i + 1}/${clipCount}: ${clipStart.toFixed(2)}s - ${clipEnd.toFixed(2)}s`, 'info');

            const response = await fetch('/cut', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: uploadedFile.projectId,
                    filename: uploadedFile.filename,
                    start: clipStart,
                    end: clipEnd,
                    output: outputName
                })
            });

            if (!response.ok) {
                throw new Error(`Clip ${i + 1} failed`);
            }

            const progress = ((i + 1) / clipCount) * 100;
            document.getElementById('cutting-progress-fill').style.width = progress + '%';
            document.getElementById('cutting-status').textContent = `Processing ${i + 1}/${clipCount}...`;

            // Small delay between clips
            if (i < clipCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        log(`✓ Cutting complete: ${clipCount} clips created`, 'success');
        document.getElementById('cutting-progress').style.display = 'none';
        document.getElementById('downloads-section').style.display = 'block';

        // Display download links
        const clipList = document.getElementById('clip-list');
        clipList.innerHTML = '';
        for (let i = 0; i < clipCount; i++) {
            const outputName = `${originalName}_Part${i + 1}.mp4`;
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="/uploads/${uploadedFile.projectId}/${encodeURIComponent(outputName)}" download="${outputName}">
                    📥 ${outputName}
                </a>
            `;
            clipList.appendChild(li);
        }

        await loadProjects();
    } catch (error) {
        log(`Cutting error: ${error.message}`, 'error');
        alert('Cutting failed: ' + error.message);
    } finally {
        document.getElementById('cutting-progress').style.display = 'none';
    }
}

// ==========================================
// PROJECT MANAGEMENT
// ==========================================

async function loadProjects() {
    try {
        const response = await fetch('/projects');
        const data = await response.json();
        displayProjects(data.projects);
    } catch (error) {
        log(`Load projects error: ${error.message}`, 'error');
    }
}

function displayProjects(projects) {
    const list = document.getElementById('projects-list');
    
    // Update stats
    let totalClips = 0;
    let totalSize = 0;
    
    projects.forEach(p => {
        totalClips += p.clipCount || 0;
        totalSize += p.totalSize || 0;
    });
    
    document.getElementById('stat-projects').textContent = projects.length;
    document.getElementById('stat-clips').textContent = totalClips;
    document.getElementById('stat-storage').textContent = formatBytes(totalSize);

    if (projects.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No projects yet. Upload a video to get started.</p></div>';
        return;
    }

    list.innerHTML = '';
    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-item';
        
        let clipsHtml = '';
        if (project.clips && project.clips.length > 0) {
            clipsHtml = '<div class="project-clips"><strong>Clips:</strong>';
            project.clips.forEach(clip => {
                clipsHtml += `<div>📄 ${clip.name}</div>`;
            });
            clipsHtml += '</div>';
        }

        item.innerHTML = `
            <h3>📁 ${project.name}</h3>
            <div class="project-meta">
                <span>📹 ${formatBytes(project.videoSize)}</span>
                <span>🎬 ${project.clipCount} clips (${formatBytes(project.clipsSize)})</span>
                <span>💾 Total: ${formatBytes(project.totalSize)}</span>
            </div>
            ${clipsHtml}
            <div class="project-actions">
                <button onclick="deleteProject('${project.projectId}')" class="btn btn-danger">🗑️ Delete</button>
            </div>
        `;
        list.appendChild(item);
    });
}

async function deleteProject(projectId) {
    if (!confirm('Delete this project and all its files?')) return;

    try {
        const response = await fetch(`/projects/${projectId}`, { method: 'DELETE' });
        if (response.ok) {
            log(`✓ Project deleted`, 'success');
            await loadProjects();
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        log(`Delete error: ${error.message}`, 'error');
        alert('Delete failed');
    }
}

async function cleanupTemp() {
    if (!confirm('Delete temporary upload files?')) return;

    try {
        const response = await fetch('/cleanup-temp', { method: 'POST' });
        const data = await response.json();
        log(`✓ Cleaned up ${data.removed} folders`, 'success');
    } catch (error) {
        log(`Cleanup error: ${error.message}`, 'error');
    }
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    log('Initializing i3 Video Cutter...', 'info');
    
    await initSystem();
    await loadProjects();

    // Event listeners
    document.getElementById('upload-btn').addEventListener('click', uploadVideo);
    document.getElementById('calculate-btn').addEventListener('click', calculateClips);
    document.getElementById('cut-btn').addEventListener('click', cutVideo);
    document.getElementById('refresh-btn').addEventListener('click', loadProjects);
    document.getElementById('cleanup-btn').addEventListener('click', cleanupTemp);

    log('✓ Ready', 'success');
});
