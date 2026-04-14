import {
    cleanupTempRequest,
    deleteAllProjectsRequest,
    deleteProjectRequest,
    fetchProjects,
    fetchStorageInfo
} from './api.js';
import { applyStorageInfo } from './metrics.js';
import { refs, state } from './state.js';
import { logDebug, setStatus } from './ui.js';
import { formatBytes } from './utils.js';

function displayProjects(projects, handlers = {}) {
    refs.projectsList.innerHTML = '';
    if (!projects.length) {
        refs.projectsList.innerHTML = `
            <div class="empty-state">
                <h2>No Projects Yet</h2>
                <p class="empty-state-text">Upload a video to create a project and save your clip layout settings.</p>
            </div>
        `;
        refs.statProjects.textContent = '0';
        refs.statClips.textContent = '0';
        refs.statStorage.textContent = '0 B';
        return;
    }

    refs.statProjects.textContent = String(projects.length);
    refs.statClips.textContent = String(projects.reduce((sum, project) => sum + (project.clipCount || 0), 0));
    refs.statStorage.textContent = formatBytes(projects.reduce((sum, project) => sum + (project.totalSize || 0), 0));

    projects.forEach((project) => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.innerHTML = `
            <div class="project-header">
                <label>
                    <input type="checkbox" class="project-checkbox" value="${project.projectId}">
                    <span>
                        <div class="project-header-title">${project.name}</div>
                        <div class="project-header-meta">
                            <span class="project-meta-badge">${project.clipCount} clips</span>
                            <span class="project-meta-item">${formatBytes(project.totalSize)}</span>
                            <span class="project-meta-item">${new Date(project.modified * 1000).toLocaleString()}</span>
                        </div>
                    </span>
                </label>
            </div>
            <div class="project-details">
                <div class="project-details-row">
                    <div class="project-detail-item">
                        <span class="project-detail-label">Video File</span>
                        <a class="project-link" target="_blank" href="/uploads/${project.projectId}/${encodeURIComponent(project.videoName)}">${project.videoName}</a>
                    </div>
                    <div class="project-detail-item">
                        <span class="project-detail-label">Video Size</span>
                        <span class="project-detail-value">${formatBytes(project.videoSize)}</span>
                    </div>
                    <div class="project-detail-item">
                        <span class="project-detail-label">Saved Title</span>
                        <span class="project-detail-value">${project.settings?.baseTitle || 'Not set'}</span>
                    </div>
                    <div class="project-detail-item">
                        <span class="project-detail-label">Text / Video Layout</span>
                        <span class="project-detail-value">Text ${project.settings?.textSize || 64}px • Video ${project.settings?.videoScale || 100}%</span>
                    </div>
                </div>
            </div>
        `;

        if (project.clips?.length) {
            const clipsSection = document.createElement('div');
            clipsSection.className = 'project-clips-section';
            clipsSection.innerHTML = '<div class="project-clips-title">Generated Clips</div>';
            const clipsList = document.createElement('div');
            clipsList.className = 'project-clips-list';

            project.clips.forEach((clip) => {
                const clipItem = document.createElement('div');
                clipItem.className = 'clip-item';
                clipItem.innerHTML = `
                    <div class="clip-info">
                        <a class="clip-name" target="_blank" href="/uploads/${project.projectId}/${encodeURIComponent(clip.name)}">${clip.name}</a>
                        <span class="clip-size">${formatBytes(clip.size)}</span>
                    </div>
                `;
                clipsList.appendChild(clipItem);
            });

            clipsSection.appendChild(clipsList);
            item.appendChild(clipsSection);
        }

        const actions = document.createElement('div');
        actions.className = 'project-actions';

        const openButton = document.createElement('button');
        openButton.className = 'btn btn-primary';
        openButton.textContent = 'Open Project';
        openButton.addEventListener('click', async () => {
            try {
                await handlers.onOpenProject?.(project);
            } catch (error) {
                logDebug(`Open project failed: ${error.message}`, true);
                alert('Unable to open project. See debug log for details.');
            }
        });

        const previewButton = document.createElement('button');
        previewButton.className = 'btn btn-secondary';
        previewButton.textContent = 'Preview Video';
        previewButton.addEventListener('click', () => {
            window.open(`/uploads/${project.projectId}/${encodeURIComponent(project.videoName)}`, '_blank');
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteProject(project.projectId, handlers, true));

        actions.append(openButton, previewButton, deleteButton);
        item.appendChild(actions);
        refs.projectsList.appendChild(item);
    });
}

export async function loadStorageInfo() {
    try {
        const data = await fetchStorageInfo();
        applyStorageInfo(data);
    } catch (error) {
        logDebug(`Error loading storage info: ${error.message}`, true);
    }
}

export async function loadProjects(handlers = {}) {
    try {
        const data = await fetchProjects();
        state.projects = data.projects || [];
        displayProjects(state.projects, handlers);
        await loadStorageInfo();
    } catch (error) {
        logDebug(`Error loading projects: ${error.message}`, true);
    }
}

export async function deleteProject(projectId, handlers = {}, requireConfirm = true) {
    if (requireConfirm && !window.confirm(`Delete project ${projectId} and all its files?`)) {
        return;
    }
    try {
        await deleteProjectRequest(projectId);
        await loadProjects(handlers);
        setStatus(`Deleted project ${projectId}.`);
    } catch (error) {
        logDebug(`Delete project error: ${error.message}`, true);
        alert('Delete failed. See debug log for details.');
    }
}

export async function deleteSelectedProjects(handlers = {}) {
    const selected = Array.from(document.querySelectorAll('.project-checkbox:checked')).map((checkbox) => checkbox.value);
    if (!selected.length) {
        alert('Select at least one project to delete.');
        return;
    }
    if (!window.confirm(`Delete ${selected.length} selected project(s)?`)) {
        return;
    }
    for (const projectId of selected) {
        await deleteProject(projectId, handlers, false);
    }
}

export async function deleteAllProjects(handlers = {}) {
    if (!window.confirm('Delete all projects and free all storage?')) {
        return;
    }
    try {
        const data = await deleteAllProjectsRequest();
        setStatus(`Deleted ${data.removed} projects.`);
        await loadProjects(handlers);
    } catch (error) {
        logDebug(`Delete all error: ${error.message}`, true);
        alert('Delete all failed. See debug log for details.');
    }
}

export async function cleanupTempFiles(handlers = {}) {
    if (!window.confirm('Delete all temporary upload chunks?')) {
        return;
    }
    try {
        const data = await cleanupTempRequest();
        setStatus(`Removed ${data.removed} temp upload folders.`);
        await loadProjects(handlers);
    } catch (error) {
        logDebug(`Cleanup error: ${error.message}`, true);
        alert('Cleanup failed. See debug log for details.');
    }
}
