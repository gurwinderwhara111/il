import os
import time
import subprocess
import shutil
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from moviepy import VideoFileClip
import json

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
PUBLIC_FOLDER = os.path.join(BASE_DIR, 'public')
PROJECTS_FOLDER = os.path.join(UPLOAD_FOLDER, 'projects')
TEMP_FOLDER = os.path.join(UPLOAD_FOLDER, 'temp')

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
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 2GB max upload size

ALLOWED_EXTENSIONS = {'mp4', 'mov', 'mkv', 'avi', 'webm'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


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
    project_folder = get_project_folder(project_id)
    os.makedirs(get_project_video_folder(project_id), exist_ok=True)
    os.makedirs(get_project_clips_folder(project_id), exist_ok=True)

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
    output = data.get('output')

    if not project_id or not filename or start is None or end is None or not output:
        return 'Missing parameters', 400

    safe_filename = secure_filename(filename)
    safe_output = secure_filename(output)
    input_path = os.path.join(get_project_video_folder(project_id), safe_filename)
    output_path = os.path.join(get_project_clips_folder(project_id), safe_output)

    if not os.path.exists(input_path):
        return 'Source file not found', 404

    duration_val = float(end) - float(start)
    if duration_val <= 0:
        return 'Invalid clip duration', 400

    try:
        # Use ffmpeg for reliable video cutting
        process = subprocess.run(
            ['ffmpeg', '-y', '-ss', str(start), '-i', input_path, '-t', str(duration_val), '-c', 'copy', output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if process.returncode != 0:
            return f'Cutting failed: {process.stderr}', 500
    except Exception as e:
        return f'Cutting failed: {str(e)}', 500

    return jsonify(success=True, output=safe_output)


@app.route('/upload-chunk', methods=['POST'])
def upload_chunk():
    """Handle chunked file uploads to bypass proxy limits"""
    chunk = request.files.get('chunk')
    filename = request.form.get('filename')
    chunk_index = int(request.form.get('chunkIndex', 0))
    total_chunks = int(request.form.get('totalChunks', 1))
    file_id = request.form.get('fileId')

    if not chunk or not filename or not file_id:
        return 'Missing parameters', 400

    # Create temp directory for this upload
    temp_dir = os.path.join(app.config['TEMP_FOLDER'], file_id)
    os.makedirs(temp_dir, exist_ok=True)

    chunk_path = os.path.join(temp_dir, f'chunk_{chunk_index}')
    chunk.save(chunk_path)

    # If this is the last chunk, combine all chunks
    if chunk_index == total_chunks - 1:
        final_filename = secure_filename(filename)
        project_id = file_id
        project_folder = get_project_folder(project_id)
        os.makedirs(get_project_video_folder(project_id), exist_ok=True)
        os.makedirs(get_project_clips_folder(project_id), exist_ok=True)
        final_path = os.path.join(get_project_video_folder(project_id), final_filename)

        try:
            with open(final_path, 'wb') as final_file:
                for i in range(total_chunks):
                    chunk_file = os.path.join(temp_dir, f'chunk_{i}')
                    with open(chunk_file, 'rb') as cf:
                        final_file.write(cf.read())
                    os.remove(chunk_file)

            # Clean up temp directory
            os.rmdir(temp_dir)
            return jsonify(projectId=project_id, filename=final_filename, complete=True)
        except Exception as e:
            return f'File assembly failed: {str(e)}', 500

    return jsonify(chunkIndex=chunk_index, complete=False)


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
    return {
        'projectId': project_id,
        'name': original_name,
        'videoName': original_name,
        'videoSize': video_stat.st_size,
        'clips': clips,
        'clipCount': len(clips),
        'clipsSize': clips_size,
        'totalSize': total_size,
        'modified': video_stat.st_mtime
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
        return jsonify(
            projects_size=projects_size,
            temp_size=temp_size,
            total_size=projects_size + temp_size
        )
    except Exception as e:
        return jsonify(error=str(e)), 500


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
