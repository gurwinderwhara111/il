import { saveProjectSettingsRequest } from './api.js';
import { refs, state } from './state.js';
import { logDebug } from './ui.js';
import {
    OUTPUT_HEIGHT,
    defaultSettings,
    clamp,
    buildClipTitle,
    secondsToTimeParts,
    timePartsToSeconds
} from './utils.js';

export function normalizeSettings(raw = {}) {
    const settings = { ...defaultSettings, ...raw };
    settings.baseTitle = String(settings.baseTitle || '').trim();
    settings.clipLength = clamp(Number(settings.clipLength) || defaultSettings.clipLength, 0.25, 3600);
    settings.startTime = clamp(Number(settings.startTime) || 0, 0, 24 * 3600);
    settings.endTime = settings.endTime === null || settings.endTime === '' || Number.isNaN(Number(settings.endTime))
        ? null
        : clamp(Number(settings.endTime), 0, 24 * 3600);
    if (settings.endTime !== null && settings.endTime < settings.startTime) {
        settings.endTime = settings.startTime;
    }
    settings.textSize = clamp(Number(settings.textSize) || defaultSettings.textSize, 16, 200);
    settings.textX = clamp(Number(settings.textX) || defaultSettings.textX, 0, 100);
    settings.textY = clamp(Number(settings.textY) || defaultSettings.textY, 0, 100);
    settings.videoScale = clamp(Number(settings.videoScale) || defaultSettings.videoScale, 10, 200);
    settings.videoX = clamp(Number(settings.videoX) || defaultSettings.videoX, 0, 100);
    settings.videoY = clamp(Number(settings.videoY) || defaultSettings.videoY, 0, 100);
    return settings;
}

export function readSettingsFromForm() {
    return normalizeSettings({
        baseTitle: refs.baseTitle.value,
        clipLength: readTimeControl('clipLength'),
        startTime: readTimeControl('startTime'),
        endTime: readTimeControl('endTime'),
        textSize: refs.textSizeNumber.value,
        textX: refs.textXNumber.value,
        textY: refs.textYNumber.value,
        videoScale: refs.videoScaleNumber.value,
        videoX: refs.videoXNumber.value,
        videoY: refs.videoYNumber.value
    });
}

export function syncControlValue(controlName, value) {
    refs[`${controlName}Range`].value = value;
    refs[`${controlName}Number`].value = value;
}

export function applySettingsToForm(rawSettings = {}) {
    const settings = normalizeSettings(rawSettings);
    refs.baseTitle.value = settings.baseTitle;
    applyTimeControl('clipLength', settings.clipLength);
    applyTimeControl('startTime', settings.startTime);
    applyTimeControl('endTime', settings.endTime ?? state.duration ?? 0);
    syncControlValue('textSize', settings.textSize);
    syncControlValue('textX', settings.textX);
    syncControlValue('textY', settings.textY);
    syncControlValue('videoScale', settings.videoScale);
    syncControlValue('videoX', settings.videoX);
    syncControlValue('videoY', settings.videoY);
}

function applyTimeControl(controlName, totalSeconds) {
    const parts = secondsToTimeParts(totalSeconds);
    refs[controlName].value = Number(totalSeconds || 0).toFixed(2).replace(/\.00$/, '');
    refs[`${controlName}Minutes`].value = parts.minutes;
    refs[`${controlName}Seconds`].value = parts.seconds.toFixed(2).replace(/\.00$/, '');
}

function readTimeControl(controlName) {
    const totalSeconds = timePartsToSeconds(
        refs[`${controlName}Minutes`].value,
        refs[`${controlName}Seconds`].value
    );
    refs[controlName].value = totalSeconds.toFixed(2).replace(/\.00$/, '');
    return totalSeconds;
}

export function getClipCount(settings = readSettingsFromForm()) {
    const totalTime = (settings.endTime ?? state.duration) - settings.startTime;
    return settings.clipLength > 0 ? Math.floor(totalTime / settings.clipLength) : 0;
}

export function renderPreview(rawSettings = readSettingsFromForm()) {
    const settings = normalizeSettings(rawSettings);
    if (!refs.previewFrame || !refs.videoPreview.src) {
        return;
    }

    const frameWidth = refs.previewFrame.clientWidth || 1;
    const frameHeight = refs.previewFrame.clientHeight || 1;
    const sourceWidth = refs.videoPreview.videoWidth || 16;
    const sourceHeight = refs.videoPreview.videoHeight || 9;
    const fitScale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
    const scaledWidth = sourceWidth * fitScale * (settings.videoScale / 100);
    const scaledHeight = sourceHeight * fitScale * (settings.videoScale / 100);
    const centerX = (settings.videoX / 100) * frameWidth;
    const centerY = (settings.videoY / 100) * frameHeight;

    refs.previewVideoLayer.style.width = `${scaledWidth}px`;
    refs.previewVideoLayer.style.height = `${scaledHeight}px`;
    refs.previewVideoLayer.style.left = `${centerX}px`;
    refs.previewVideoLayer.style.top = `${centerY}px`;
    refs.previewVideoLayer.style.transform = 'translate(-50%, -50%)';

    const title = settings.baseTitle ? buildClipTitle(settings.baseTitle, 1) : 'Title Preview';
    const textScale = frameHeight / OUTPUT_HEIGHT;
    const textTop = clamp((settings.textY / 100) * frameHeight, 0, Math.max(frameHeight - 24, 0));

    refs.previewTextLayer.textContent = title;
    refs.previewTextLayer.style.fontSize = `${settings.textSize * textScale}px`;
    refs.previewTextLayer.style.top = `${textTop}px`;
    refs.previewTextLayer.style.transform = 'translateX(-50%)';
    refs.previewTextLayer.style.left = '50%';

    const textWidth = refs.previewTextLayer.offsetWidth || 0;
    const halfTextWidth = Math.min(textWidth / 2, frameWidth / 2);
    const desiredCenterX = (settings.textX / 100) * frameWidth;
    const clampedCenterX = clamp(
        desiredCenterX,
        halfTextWidth,
        Math.max(frameWidth - halfTextWidth, halfTextWidth)
    );
    refs.previewTextLayer.style.left = `${clampedCenterX}px`;
}

export async function saveProjectSettings() {
    if (!state.uploadedFile?.projectId) {
        return;
    }
    const settings = readSettingsFromForm();
    try {
        await saveProjectSettingsRequest(state.uploadedFile.projectId, settings);
    } catch (error) {
        logDebug(`Settings save failed: ${error.message}`, true);
    }
}

export function scheduleSaveProjectSettings() {
    if (!state.uploadedFile?.projectId) {
        return;
    }
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => {
        saveProjectSettings();
    }, 300);
}

export function updateClipPreview() {
    const settings = readSettingsFromForm();
    const totalTime = (settings.endTime ?? state.duration) - settings.startTime;
    const clipCount = getClipCount(settings);

    refs.clipTitlePreview.textContent = settings.baseTitle
        ? `Preview: ${buildClipTitle(settings.baseTitle, 1)}`
        : 'Add a base title to preview the burned-in text.';

    if (!settings.clipLength || totalTime <= 0) {
        refs.clipCount.textContent = 'Enter a valid clip length and time range to calculate clips.';
    } else if (clipCount <= 0) {
        refs.clipCount.textContent = 'No clips can be generated from the selected range.';
    } else {
        refs.clipCount.textContent = `${clipCount} clips will be generated from this range.`;
    }

    renderPreview(settings);
    scheduleSaveProjectSettings();
    return clipCount;
}

function bindSyncedControl(controlName) {
    const range = refs[`${controlName}Range`];
    const number = refs[`${controlName}Number`];
    const sync = (value) => {
        range.value = value;
        number.value = value;
        updateClipPreview();
    };
    range.addEventListener('input', () => sync(range.value));
    number.addEventListener('input', () => sync(number.value));
}

function bindTimeControl(controlName, fallbackSeconds = 0) {
    const minutesInput = refs[`${controlName}Minutes`];
    const secondsInput = refs[`${controlName}Seconds`];

    const sync = () => {
        if (!minutesInput.value) {
            minutesInput.value = '0';
        }
        if (!secondsInput.value) {
            secondsInput.value = '0';
        }

        let totalSeconds = timePartsToSeconds(minutesInput.value, secondsInput.value);
        if (controlName === 'clipLength') {
            totalSeconds = Math.max(totalSeconds, 0.25);
        }

        const parts = secondsToTimeParts(totalSeconds || fallbackSeconds);
        refs[controlName].value = totalSeconds.toFixed(2).replace(/\.00$/, '');
        minutesInput.value = parts.minutes;
        secondsInput.value = parts.seconds.toFixed(2).replace(/\.00$/, '');
        updateClipPreview();
    };

    minutesInput.addEventListener('input', sync);
    secondsInput.addEventListener('input', sync);
}

export function bindComposerEvents() {
    refs.baseTitle.addEventListener('input', updateClipPreview);
    bindTimeControl('clipLength', defaultSettings.clipLength);
    bindTimeControl('startTime', 0);
    bindTimeControl('endTime', state.duration || 0);

    ['textSize', 'textX', 'textY', 'videoScale', 'videoX', 'videoY'].forEach(bindSyncedControl);

    refs.videoPreview.addEventListener('loadedmetadata', () => {
        renderPreview();
    });

    window.addEventListener('resize', () => {
        renderPreview();
    });
}
