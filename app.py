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

# Create structured folders
VIDEOS_FOLDER = os.path.join(UPLOAD_FOLDER, 'videos')
CLIPS_FOLDER = os.path.join(UPLOAD_FOLDER, 'clips')
TEMP_FOLDER = os.path.join(UPLOAD_FOLDER, 'temp')

for folder in [VIDEOS_FOLDER, CLIPS_FOLDER, TEMP_FOLDER]:
    os.makedirs(folder, exist_ok=True)

app = Flask(__name__, static_folder=PUBLIC_FOLDER, static_url_path='')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['VIDEOS_FOLDER'] = VIDEOS_FOLDER
app.config['CLIPS_FOLDER'] = CLIPS_FOLDER
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
    _, file_ext = os.path.splitext(original_name)
    saved_name = f"{int(round(time.time() * 1000))}{file_ext}"
    saved_path = os.path.join(app.config['VIDEOS_FOLDER'], saved_name)
    file.save(saved_path)

    return jsonify(filename=saved_name)


@app.route('/duration/<filename>')
def duration(filename):
    safe_name = secure_filename(filename)
    file_path = os.path.join(app.config['VIDEOS_FOLDER'], safe_name)
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

    filename = data.get('filename')
    start = data.get('start')
    end = data.get('end')
    output = data.get('output')

    if not filename or start is None or end is None or not output:
        return 'Missing parameters', 400

    safe_filename = secure_filename(filename)
    safe_output = secure_filename(output)
    input_path = os.path.join(app.config['VIDEOS_FOLDER'], safe_filename)
    output_path = os.path.join(app.config['CLIPS_FOLDER'], safe_output)

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
        _, file_ext = os.path.splitext(final_filename)
        saved_name = f"{int(round(time.time() * 1000))}{file_ext}"
        final_path = os.path.join(app.config['VIDEOS_FOLDER'], saved_name)

        try:
            with open(final_path, 'wb') as final_file:
                for i in range(total_chunks):
                    chunk_file = os.path.join(temp_dir, f'chunk_{i}')
                    with open(chunk_file, 'rb') as cf:
                        final_file.write(cf.read())
                    os.remove(chunk_file)

            # Clean up temp directory
            os.rmdir(temp_dir)
            return jsonify(filename=saved_name, complete=True)
        except Exception as e:
            return f'File assembly failed: {str(e)}', 500

    return jsonify(chunkIndex=chunk_index, complete=False)


@app.route('/files', methods=['GET'])
def list_files():
    """List all uploaded videos and clips"""
    videos = []
    clips = []

    try:
        for filename in os.listdir(app.config['VIDEOS_FOLDER']):
            filepath = os.path.join(app.config['VIDEOS_FOLDER'], filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                videos.append({
                    'name': filename,
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                    'type': 'video'
                })

        for filename in os.listdir(app.config['CLIPS_FOLDER']):
            filepath = os.path.join(app.config['CLIPS_FOLDER'], filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                clips.append({
                    'name': filename,
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                    'type': 'clip'
                })

    except Exception as e:
        return jsonify(error=str(e)), 500

    return jsonify(videos=videos, clips=clips)


def get_folder_size(folder_path):
    total_size = 0
    for root, _, files in os.walk(folder_path):
        for file in files:
            total_size += os.path.getsize(os.path.join(root, file))
    return total_size


@app.route('/storage', methods=['GET'])
def storage_info():
    try:
        videos_size = get_folder_size(app.config['VIDEOS_FOLDER'])
        clips_size = get_folder_size(app.config['CLIPS_FOLDER'])
        temp_size = get_folder_size(app.config['TEMP_FOLDER'])
        total_size = videos_size + clips_size + temp_size
        return jsonify(
            videos_size=videos_size,
            clips_size=clips_size,
            temp_size=temp_size,
            total_size=total_size
        )
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


@app.route('/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    """Delete a file from videos or clips folder"""
    safe_name = secure_filename(filename)

    # Check both folders
    video_path = os.path.join(app.config['VIDEOS_FOLDER'], safe_name)
    clip_path = os.path.join(app.config['CLIPS_FOLDER'], safe_name)

    deleted = False
    if os.path.exists(video_path):
        os.remove(video_path)
        deleted = True
    elif os.path.exists(clip_path):
        os.remove(clip_path)
        deleted = True

    if deleted:
        return jsonify(success=True, deleted=safe_name)
    else:
        return 'File not found', 404


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    # Check both videos and clips folders
    video_path = os.path.join(app.config['VIDEOS_FOLDER'], secure_filename(filename))
    clip_path = os.path.join(app.config['CLIPS_FOLDER'], secure_filename(filename))

    if os.path.exists(video_path):
        return send_from_directory(app.config['VIDEOS_FOLDER'], secure_filename(filename))
    elif os.path.exists(clip_path):
        return send_from_directory(app.config['CLIPS_FOLDER'], secure_filename(filename))
    else:
        abort(404)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)

