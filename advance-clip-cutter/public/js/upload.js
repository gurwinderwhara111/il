import { finalizeUploadRequest } from './api.js';
import { logDebug, setUploadProgress } from './ui.js';
import { resetUploadMetrics, updateUploadMetrics } from './metrics.js';
import {
    CHUNK_RETRY_LIMIT,
    CHUNK_SIZE_BYTES,
    CHUNK_UPLOAD_CONCURRENCY,
    DIRECT_UPLOAD_THRESHOLD_MB,
    formatBytes
} from './utils.js';

export { DIRECT_UPLOAD_THRESHOLD_MB };

export function getDirectUploadData(file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const startedAt = performance.now();
        xhr.open('POST', '/upload');

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            setUploadProgress(Math.round((event.loaded / event.total) * 100), `Uploading ${file.name} directly...`);
            updateUploadMetrics({
                uploadedBytes: event.loaded,
                totalBytes: event.total,
                totalChunks: 1,
                uploadedChunks: event.loaded === event.total ? 1 : 0,
                startedAt
            });
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch (error) {
                    reject(new Error(`Invalid JSON response: ${error.message}`));
                }
                return;
            }
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText} - ${xhr.responseText}`));
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.onabort = () => reject(new Error('Upload aborted.'));

        const formData = new FormData();
        formData.append('video', file);
        xhr.send(formData);
    });
}

export async function chunkedUpload(file) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
    const fileId = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const chunkProgress = new Array(totalChunks).fill(0);
    const completedChunks = new Set();
    const startedAt = performance.now();

    const updateAggregate = () => {
        const uploadedBytes = chunkProgress.reduce((sum, value) => sum + value, 0);
        const percent = Math.min(Math.round((uploadedBytes / file.size) * 100), 100);
        setUploadProgress(
            percent,
            `Uploading ${totalChunks} chunks at concurrency ${CHUNK_UPLOAD_CONCURRENCY} (${formatBytes(CHUNK_SIZE_BYTES)} each)`
        );
        updateUploadMetrics({
            uploadedBytes,
            totalBytes: file.size,
            totalChunks,
            uploadedChunks: completedChunks.size,
            startedAt
        });
    };

    const uploadChunk = (chunkIndex, attempt = 0) => new Promise((resolve, reject) => {
        const start = chunkIndex * CHUNK_SIZE_BYTES;
        const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
        const chunk = file.slice(start, end);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload-chunk');

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            chunkProgress[chunkIndex] = event.loaded;
            updateAggregate();
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                chunkProgress[chunkIndex] = chunk.size;
                completedChunks.add(chunkIndex);
                updateAggregate();
                resolve();
                return;
            }

            const errorText = xhr.responseText || `${xhr.status} ${xhr.statusText}`;
            if (xhr.status === 413) {
                reject(new Error('Chunk rejected by Codespaces proxy (413 Request Entity Too Large).'));
                return;
            }
            if (attempt < CHUNK_RETRY_LIMIT) {
                logDebug(`Retrying chunk ${chunkIndex + 1}/${totalChunks}: ${errorText}`, true);
                chunkProgress[chunkIndex] = 0;
                updateAggregate();
                resolve(uploadChunk(chunkIndex, attempt + 1));
                return;
            }
            reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed: ${errorText}`));
        };

        xhr.onerror = () => {
            if (attempt < CHUNK_RETRY_LIMIT) {
                chunkProgress[chunkIndex] = 0;
                updateAggregate();
                resolve(uploadChunk(chunkIndex, attempt + 1));
                return;
            }
            reject(new Error(`Chunk ${chunkIndex + 1}/${totalChunks} upload failed: network error.`));
        };

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('filename', file.name);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileId', fileId);
        formData.append('totalSize', file.size.toString());
        xhr.send(formData);
    });

    resetUploadMetrics(file.size, totalChunks);
    logDebug(`Starting chunked upload: ${totalChunks} chunks for ${file.name} using ${formatBytes(CHUNK_SIZE_BYTES)} chunks at concurrency ${CHUNK_UPLOAD_CONCURRENCY}`);

    for (let startIndex = 0; startIndex < totalChunks; startIndex += CHUNK_UPLOAD_CONCURRENCY) {
        const batch = [];
        for (let offset = 0; offset < CHUNK_UPLOAD_CONCURRENCY && startIndex + offset < totalChunks; offset += 1) {
            batch.push(uploadChunk(startIndex + offset));
        }
        await Promise.all(batch);
    }

    setUploadProgress(100, `Finalizing upload for ${file.name}...`);
    const result = await finalizeUploadRequest({
        fileId,
        filename: file.name,
        totalChunks
    });
    logDebug(`Chunked upload complete: ${result.filename}`);
    return result;
}
