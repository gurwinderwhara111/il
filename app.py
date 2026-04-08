import os
import time
import subprocess
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename
from moviepy import VideoFileClip

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
PUBLIC_FOLDER = os.path.join(BASE_DIR, 'public')

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__, static_folder=PUBLIC_FOLDER, static_url_path='')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
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
    saved_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
    file.save(saved_path)

    return jsonify(filename=saved_name)


@app.route('/duration/<filename>')
def duration(filename):
    safe_name = secure_filename(filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_name)
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
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
    output_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_output)

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


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], secure_filename(filename))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)

