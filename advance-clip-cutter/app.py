import json
import os
import re
import time
import subprocess
import shutil
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from moviepy import VideoFileClip
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
PUBLIC_FOLDER = os.path.join(BASE_DIR, 'public')
PROJECTS_FOLDER = os.path.join(UPLOAD_FOLDER, 'projects')
TEMP_FOLDER = os.path.join(UPLOAD_FOLDER, 'temp')
VERTICAL_WIDTH = 1080
VERTICAL_HEIGHT = 1920
APP_STORAGE_QUOTA_BYTES = 6 * 1024 * 1024 * 1024

for folder in [PROJECTS_FOLDER, TEMP_FOLDER]:
    os.makedirs(folder, exist_ok=True)


def get_project_folder(project_id):
    return os.path.join(PROJECTS_FOLDER, secure_filename(project_id))


def get_project_video_folder(project_id):
    return os.path.join(get_project_folder(project_id), 'video')


def get_project_clips_folder(project_id):
    return os.path.join(get_project_folder(project_id), 'clips')


def find_original_video(project_id):
    video_folder = get_project_video_folder(project_id)
    if not os.path.isdir(video_folder):
        return None
    for filename in os.listdir(video_folder):
        path = os.path.join(video_folder, filename)
        if os.path.isfile(path):
            return filename
    return None

app = Flask(__name__, static_folder=PUBLIC_FOLDER, static_url_path='')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['PROJECTS_FOLDER'] = PROJECTS_FOLDER
app.config['TEMP_FOLDER'] = TEMP_FOLDER
app.config['MAX_CONTENT_LENGTH'] = APP_STORAGE_QUOTA_BYTES

ALLOWED_EXTENSIONS = {'mp4', 'mov', 'mkv', 'avi', 'webm'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_project_settings_path(project_id):
    return os.path.join(get_project_folder(project_id), 'settings.json')


def get_upload_temp_dir(file_id):
    return os.path.join(app.config['TEMP_FOLDER'], secure_filename(file_id))


def get_upload_metadata_path(file_id):
    return os.path.join(get_upload_temp_dir(file_id), 'metadata.json')


def load_upload_metadata(file_id):
    metadata_path = get_upload_metadata_path(file_id)
    if not os.path.exists(metadata_path):
        return None
    with open(metadata_path, 'r', encoding='utf-8') as metadata_file:
        return json.load(metadata_file)


def save_upload_metadata(file_id, metadata):
    os.makedirs(get_upload_temp_dir(file_id), exist_ok=True)
    metadata_path = get_upload_metadata_path(file_id)
    with open(metadata_path, 'w', encoding='utf-8') as metadata_file:
        json.dump(metadata, metadata_file)


def default_project_settings():
    return {
        'baseTitle': '',
        'clipLength': 5,
        'startTime': 0,
        'endTime': None,
        'textSize': 64,
        'textX': 50,
        'textY': 4,
        'videoScale': 100,
        'videoX': 50,
        'videoY': 50,
    }


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


def load_project_settings(project_id):
    settings = default_project_settings()
    settings_path = get_project_settings_path(project_id)
    if not os.path.exists(settings_path):
        return settings
    try:
        with open(settings_path, 'r', encoding='utf-8') as settings_file:
            stored = json.load(settings_file)
    except (OSError, json.JSONDecodeError):
        return settings

    normalized = normalize_project_settings(stored, settings)
    return normalized


def save_project_settings(project_id, settings):
    project_folder = get_project_folder(project_id)
    os.makedirs(project_folder, exist_ok=True)
    settings_path = get_project_settings_path(project_id)
    with open(settings_path, 'w', encoding='utf-8') as settings_file:
        json.dump(settings, settings_file)


def normalize_project_settings(payload, base=None):
    payload = payload or {}
    settings = dict(base or default_project_settings())

    def as_float(key, default):
        value = payload.get(key, default)
        if value in (None, ''):
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    settings['baseTitle'] = str(payload.get('baseTitle', settings['baseTitle']) or '').strip()
    settings['clipLength'] = round(clamp(as_float('clipLength', settings['clipLength']), 0.25, 3600), 2)
    settings['startTime'] = round(clamp(as_float('startTime', settings['startTime']), 0, 24 * 3600), 2)

    raw_end = payload.get('endTime', settings['endTime'])
    if raw_end in (None, ''):
        settings['endTime'] = None
    else:
        try:
            settings['endTime'] = round(clamp(float(raw_end), 0, 24 * 3600), 2)
        except (TypeError, ValueError):
            settings['endTime'] = settings.get('endTime')

    if settings['endTime'] is not None and settings['endTime'] < settings['startTime']:
        settings['endTime'] = settings['startTime']

    settings['textSize'] = int(round(clamp(as_float('textSize', settings['textSize']), 16, 200)))
    settings['textX'] = round(clamp(as_float('textX', settings['textX']), 0, 100), 2)
    settings['textY'] = round(clamp(as_float('textY', settings['textY']), 0, 100), 2)
    settings['videoScale'] = round(clamp(as_float('videoScale', settings['videoScale']), 10, 200), 2)
    settings['videoX'] = round(clamp(as_float('videoX', settings['videoX']), 0, 100), 2)
    settings['videoY'] = round(clamp(as_float('videoY', settings['videoY']), 0, 100), 2)
    return settings


def slugify_filename(value):
    slug = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return slug or 'clip'


def build_clip_title(base_title, clip_index):
    return f'{base_title.strip()} Clip {clip_index}'


def build_clip_filename(base_title, clip_index):
    return f'{slugify_filename(build_clip_title(base_title, clip_index))}.mp4'


def escape_drawtext(value):
    escaped = value.replace('\\', r'\\')
    escaped = escaped.replace(':', r'\:')
    escaped = escaped.replace("'", r"\'")
    escaped = escaped.replace('%', r'\%')
    escaped = escaped.replace(',', r'\,')
    escaped = escaped.replace('[', r'\[')
    escaped = escaped.replace(']', r'\]')
    return escaped


def build_vertical_filter_graph(project_settings, overlay_title, clip_duration):
    video_scale_multiplier = project_settings['videoScale'] / 100.0
    video_center_x_ratio = project_settings['videoX'] / 100.0
    video_center_y_ratio = project_settings['videoY'] / 100.0
    text_x_ratio = project_settings['textX'] / 100.0
    text_y_ratio = project_settings['textY'] / 100.0
    safe_title = escape_drawtext(overlay_title)
    duration_expr = round(float(clip_duration), 3)

    return (
        f"color=c=black:s={VERTICAL_WIDTH}x{VERTICAL_HEIGHT}:d={duration_expr}[canvas];"
        f"[0:v]scale="
        f"trunc(iw*min({VERTICAL_WIDTH}/iw\\,{VERTICAL_HEIGHT}/ih)*{video_scale_multiplier}/2)*2:"
        f"trunc(ih*min({VERTICAL_WIDTH}/iw\\,{VERTICAL_HEIGHT}/ih)*{video_scale_multiplier}/2)*2"
        "[scaled];"
        f"[canvas][scaled]overlay="
        f"x=({video_center_x_ratio}*main_w)-(overlay_w/2):"
        f"y=({video_center_y_ratio}*main_h)-(overlay_h/2)"
        "[composed];"
        "[composed]drawtext="
        f"text='{safe_title}':"
        "fontcolor=white:"
        f"fontsize={project_settings['textSize']}:"
        f"x=max(min(({text_x_ratio}*w)-(text_w/2)\\,w-text_w)\\,0):"
        f"y=max(min(({text_y_ratio}*h)\\,h-text_h)\\,0),"
        "format=yuv420p"
        "[v]"
    )


def get_duration(filepath):
    try:
        video = VideoFileClip(filepath)
        duration = video.duration
        video.close()
        return duration
    except Exception as e:
        raise RuntimeError(f'Failed to get duration: {str(e)}')


@app.route('/')
def index():
    return send_from_directory(PUBLIC_FOLDER, 'index.html')


@app.route('/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return 'No file part', 400

    file = request.files['video']
    if file.filename == '':
        return 'No selected file', 400

    if not allowed_file(file.filename):
        return 'File type not allowed', 400

    original_name = secure_filename(file.filename)
    project_id = str(int(round(time.time() * 1000)))
    os.makedirs(get_project_video_folder(project_id), exist_ok=True)
    os.makedirs(get_project_clips_folder(project_id), exist_ok=True)
    save_project_settings(project_id, default_project_settings())

    saved_path = os.path.join(get_project_video_folder(project_id), original_name)
    file.save(saved_path)

    return jsonify(projectId=project_id, filename=original_name)


@app.route('/duration/<project_id>/<filename>')
def duration(project_id, filename):
    safe_name = secure_filename(filename)
    file_path = os.path.join(get_project_video_folder(project_id), safe_name)
    if not os.path.exists(file_path):
        return 'File not found', 404

    try:
        duration_value = get_duration(file_path)
    except Exception as exc:
        return str(exc), 500

    return jsonify(duration=duration_value)


@app.route('/cut', methods=['POST'])
def cut_clip():
    data = request.get_json(silent=True)
    if not data:
        return 'Invalid JSON', 400

    project_id = data.get('projectId')
    filename = data.get('filename')
    start = data.get('start')
    end = data.get('end')
    clip_index = data.get('clipIndex')
    project_settings = normalize_project_settings(data, load_project_settings(project_id))
    base_title = project_settings.get('baseTitle', '').strip()

    if not project_id or not filename or start is None or end is None or not base_title or clip_index is None:
        return 'Missing parameters', 400

    try:
        clip_index = int(clip_index)
    except (TypeError, ValueError):
        return 'Invalid clip index', 400

    if clip_index <= 0:
        return 'Invalid clip index', 400

    safe_filename = secure_filename(filename)
    overlay_title = build_clip_title(base_title, clip_index)
    safe_output = secure_filename(build_clip_filename(base_title, clip_index))
    input_path = os.path.join(get_project_video_folder(project_id), safe_filename)
    output_path = os.path.join(get_project_clips_folder(project_id), safe_output)

    if not os.path.exists(input_path):
        return 'Source file not found', 404

    duration_val = float(end) - float(start)
    if duration_val <= 0:
        return 'Invalid clip duration', 400

    try:
        filter_graph = build_vertical_filter_graph(project_settings, overlay_title, duration_val)
        process = subprocess.run(
            [
                'ffmpeg',
                '-y',
                '-ss',
                str(start),
                '-i',
                input_path,
                '-t',
                str(duration_val),
                '-filter_complex',
                filter_graph,
                '-map',
                '[v]',
                '-map',
                '0:a?',
                '-c:v',
                'libx264',
                '-preset',
                'fast',
                '-crf',
                '20',
                '-c:a',
                'aac',
                '-b:a',
                '192k',
                '-movflags',
                '+faststart',
                output_path,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if process.returncode != 0:
            return f'Cutting failed: {process.stderr}', 500
    except Exception as e:
        return f'Cutting failed: {str(e)}', 500

    save_project_settings(project_id, project_settings)
    return jsonify(success=True, output=safe_output)


@app.route('/upload-chunk', methods=['POST'])
def upload_chunk():
    """Handle chunked file uploads to bypass proxy limits"""
    chunk = request.files.get('chunk')
    filename = request.form.get('filename')
    chunk_index = int(request.form.get('chunkIndex', 0))
    total_chunks = int(request.form.get('totalChunks', 1))
    file_id = secure_filename(request.form.get('fileId') or '')
    total_size = int(request.form.get('totalSize', 0) or 0)

    if not chunk or not filename or not file_id:
        return 'Missing parameters', 400

    if not allowed_file(filename):
        return 'File type not allowed', 400

    if chunk_index < 0 or total_chunks <= 0 or chunk_index >= total_chunks:
        return 'Invalid chunk parameters', 400

    # Create temp directory for this upload
    temp_dir = get_upload_temp_dir(file_id)
    os.makedirs(temp_dir, exist_ok=True)

    safe_filename = secure_filename(filename)
    metadata = load_upload_metadata(file_id)
    if metadata is None:
        metadata = {
            'filename': safe_filename,
            'totalChunks': total_chunks,
            'totalSize': total_size,
            'receivedChunks': [],
        }
    else:
        if metadata.get('filename') != safe_filename or metadata.get('totalChunks') != total_chunks:
            return 'Upload session mismatch', 400
        if total_size and metadata.get('totalSize') not in (0, total_size):
            return 'Upload size mismatch', 400

    chunk_path = os.path.join(temp_dir, f'chunk_{chunk_index}')
    chunk.save(chunk_path)
    received_chunks = set(metadata.get('receivedChunks', []))
    received_chunks.add(chunk_index)
    metadata['receivedChunks'] = sorted(received_chunks)
    save_upload_metadata(file_id, metadata)

    return jsonify(
        accepted=True,
        chunkIndex=chunk_index,
        receivedCount=len(metadata['receivedChunks']),
        totalChunks=total_chunks,
    )


@app.route('/upload-complete', methods=['POST'])
def upload_complete():
    data = request.get_json(silent=True)
    if not data:
        return 'Invalid JSON', 400

    file_id = secure_filename(data.get('fileId') or '')
    filename = secure_filename(data.get('filename') or '')
    total_chunks = data.get('totalChunks')

    if not file_id or not filename or total_chunks is None:
        return 'Missing parameters', 400

    try:
        total_chunks = int(total_chunks)
    except (TypeError, ValueError):
        return 'Invalid totalChunks', 400

    if total_chunks <= 0:
        return 'Invalid totalChunks', 400

    metadata = load_upload_metadata(file_id)
    if metadata is None:
        return 'Upload session not found', 404

    if metadata.get('filename') != filename or metadata.get('totalChunks') != total_chunks:
        return 'Upload session mismatch', 400

    missing_chunks = [
        index for index in range(total_chunks)
        if not os.path.exists(os.path.join(get_upload_temp_dir(file_id), f'chunk_{index}'))
    ]
    if missing_chunks:
        return jsonify(error='Missing chunks', missingChunks=missing_chunks), 400

    temp_dir = get_upload_temp_dir(file_id)
    project_id = file_id
    os.makedirs(get_project_video_folder(project_id), exist_ok=True)
    os.makedirs(get_project_clips_folder(project_id), exist_ok=True)
    final_path = os.path.join(get_project_video_folder(project_id), filename)

    try:
        with open(final_path, 'wb') as final_file:
            for index in range(total_chunks):
                chunk_path = os.path.join(temp_dir, f'chunk_{index}')
                with open(chunk_path, 'rb') as chunk_file:
                    shutil.copyfileobj(chunk_file, final_file)
                os.remove(chunk_path)

        metadata_path = get_upload_metadata_path(file_id)
        if os.path.exists(metadata_path):
            os.remove(metadata_path)
        os.rmdir(temp_dir)
        if not os.path.exists(get_project_settings_path(project_id)):
            save_project_settings(project_id, default_project_settings())
        return jsonify(projectId=project_id, filename=filename, complete=True)
    except Exception as e:
        return f'File assembly failed: {str(e)}', 500


def build_project_metadata(project_id):
    project_folder = get_project_folder(project_id)
    video_folder = get_project_video_folder(project_id)
    clips_folder = get_project_clips_folder(project_id)

    original_name = find_original_video(project_id)
    if original_name is None:
        return None

    video_path = os.path.join(video_folder, original_name)
    video_stat = os.stat(video_path)
    clips = []
    clips_size = 0
    for clip_name in sorted(os.listdir(clips_folder)):
        clip_path = os.path.join(clips_folder, clip_name)
        if os.path.isfile(clip_path):
            stat = os.stat(clip_path)
            clips_size += stat.st_size
            clips.append({
                'name': clip_name,
                'size': stat.st_size,
                'modified': stat.st_mtime
            })

    total_size = video_stat.st_size + clips_size
    settings = load_project_settings(project_id)
    return {
        'projectId': project_id,
        'name': original_name,
        'videoName': original_name,
        'videoSize': video_stat.st_size,
        'clips': clips,
        'clipCount': len(clips),
        'clipsSize': clips_size,
        'totalSize': total_size,
        'modified': video_stat.st_mtime,
        'settings': settings
    }


@app.route('/projects', methods=['GET'])
def list_projects():
    projects = []
    try:
        for project_id in sorted(os.listdir(app.config['PROJECTS_FOLDER'])):
            project_folder = os.path.join(app.config['PROJECTS_FOLDER'], project_id)
            if not os.path.isdir(project_folder):
                continue
            metadata = build_project_metadata(project_id)
            if metadata:
                projects.append(metadata)
    except Exception as e:
        return jsonify(error=str(e)), 500
    return jsonify(projects=projects)


@app.route('/files', methods=['GET'])
def list_files():
    return list_projects()


def get_folder_size(folder_path):
    total_size = 0
    for root, _, files in os.walk(folder_path):
        for file in files:
            total_size += os.path.getsize(os.path.join(root, file))
    return total_size


@app.route('/storage', methods=['GET'])
def storage_info():
    try:
        projects_size = get_folder_size(app.config['PROJECTS_FOLDER'])
        temp_size = get_folder_size(app.config['TEMP_FOLDER'])
        disk_usage = shutil.disk_usage(app.config['UPLOAD_FOLDER'])
        quota_remaining = max(APP_STORAGE_QUOTA_BYTES - (projects_size + temp_size), 0)
        return jsonify(
            projects_size=projects_size,
            temp_size=temp_size,
            total_size=projects_size + temp_size,
            quota_bytes=APP_STORAGE_QUOTA_BYTES,
            quota_remaining=quota_remaining,
            disk_free_bytes=disk_usage.free,
            disk_total_bytes=disk_usage.total
        )
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/projects/<project_id>/settings', methods=['GET', 'PUT'])
def project_settings(project_id):
    safe_id = secure_filename(project_id)
    project_folder = get_project_folder(safe_id)
    if not os.path.exists(project_folder):
        return 'Project not found', 404

    if request.method == 'GET':
        return jsonify(settings=load_project_settings(safe_id))

    data = request.get_json(silent=True)
    if data is None:
        return 'Invalid JSON', 400

    settings = normalize_project_settings(data, load_project_settings(safe_id))
    save_project_settings(safe_id, settings)
    return jsonify(success=True, settings=settings)


@app.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    safe_id = secure_filename(project_id)
    project_folder = get_project_folder(safe_id)
    if not os.path.exists(project_folder):
        return 'Project not found', 404
    try:
        shutil.rmtree(project_folder)
        return jsonify(success=True, deleted=project_id)
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/cleanup-all', methods=['POST'])
def cleanup_all():
    removed = 0
    try:
        for project_id in os.listdir(app.config['PROJECTS_FOLDER']):
            project_folder = os.path.join(app.config['PROJECTS_FOLDER'], project_id)
            if os.path.isdir(project_folder):
                shutil.rmtree(project_folder, ignore_errors=True)
                removed += 1
        return jsonify(success=True, removed=removed)
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/cleanup-temp', methods=['POST'])
def cleanup_temp():
    try:
        removed_count = 0
        for entry in os.listdir(app.config['TEMP_FOLDER']):
            path = os.path.join(app.config['TEMP_FOLDER'], entry)
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
                removed_count += 1
        return jsonify(success=True, removed=removed_count)
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route('/uploads/<project_id>/<path:filename>')
def uploaded_file(project_id, filename):
    project_id = secure_filename(project_id)
    safe_name = secure_filename(filename)
    video_path = os.path.join(get_project_video_folder(project_id), safe_name)
    clip_path = os.path.join(get_project_clips_folder(project_id), safe_name)

    if os.path.exists(video_path):
        return send_from_directory(get_project_video_folder(project_id), safe_name)
    elif os.path.exists(clip_path):
        return send_from_directory(get_project_clips_folder(project_id), safe_name)
    else:
        abort(404)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
