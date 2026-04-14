async function parseError(response) {
    const text = await response.text();
    return text || `${response.status} ${response.statusText}`;
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(await parseError(response));
    }
    return response.json();
}

export function fetchProjects() {
    return fetchJson('/projects');
}

export function fetchStorageInfo() {
    return fetchJson('/storage');
}

export function fetchDuration(projectId, filename) {
    return fetchJson(`/duration/${encodeURIComponent(projectId)}/${encodeURIComponent(filename)}`);
}

export function saveProjectSettingsRequest(projectId, settings) {
    return fetchJson(`/projects/${encodeURIComponent(projectId)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
}

export function deleteProjectRequest(projectId) {
    return fetchJson(`/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}

export function deleteAllProjectsRequest() {
    return fetchJson('/cleanup-all', { method: 'POST' });
}

export function cleanupTempRequest() {
    return fetchJson('/cleanup-temp', { method: 'POST' });
}

export function finalizeUploadRequest(payload) {
    return fetchJson('/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

export async function cutClipRequest(payload) {
    const response = await fetch('/cut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(await parseError(response));
    }

    return response.json();
}
