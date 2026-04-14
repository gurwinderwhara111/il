#!/usr/bin/env python3
"""
i3 Offline Video Cutter - Optimized for low-resource systems
Designed for i3 11th Gen laptops with 8GB RAM
Version: 1.0.0
"""

import os
import json
import time
import subprocess
import shutil
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, abort
from werkzeug.utils import secure_filename

# ==========================================
# CONFIGURATION
# ==========================================

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'config', 'i3-config.json')

# Load configuration
with open(CONFIG_FILE, 'r') as f:
    CONFIG = json.load(f)

PUBLIC_FOLDER = os.path.join(BASE_DIR, 'public')
DATA_FOLDER = os.path.join(BASE_DIR, CONFIG['storage']['project_folder'])
TEMP_FOLDER = os.path.join(BASE_DIR, CONFIG['storage']['temp_folder'])
CACHE_FOLDER = os.path.join(BASE_DIR, CONFIG['storage']['cache_folder'])

# Create folders
for folder in [DATA_FOLDER, TEMP_FOLDER, CACHE_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# Flask app
app = Flask(__name__, static_folder=PUBLIC_FOLDER, static_url_path='')
app.config['UPLOAD_FOLDER'] = TEMP_FOLDER
app.config['MAX_CONTENT_LENGTH'] = CONFIG['upload']['max_file_size_gb'] * 1024 * 1024 * 1024

ALLOWED_EXTENSIONS = set(CONFIG['video']['allowed_formats'])

# ==========================================
# SYSTEM MONITORING
# ==========================================

def get_system_info():
    """Get system resource information"""
    try:
        import psutil
        memory = psutil.virtual_memory()
        return {
            'timestamp': datetime.now().isoformat(),
            'total_ram_gb': round(memory.total / (1024**3), 2),
            'available_ram_gb': round(memory.available / (1024**3), 2),
            'used_ram_gb': round(memory.used / (1024**3), 2),
            'ram_percent': memory.percent,
            'cpu_cores': psutil.cpu_count(),
            'cpu_percent': psutil.cpu_percent(interval=0.1),
            'is_low_resource': memory.available < CONFIG['memory']['min_required_gb'] * 1024**3
        }
    except:
        return {'error': 'psutil not available', 'is_low_resource': True}

def log_message(message, msg_type='info'):
    """Log message with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_msg = f"[{timestamp}] [{msg_type.upper()}] {message}"
    print(log_msg)
    return log_msg

# ==========================================
# FILE MANAGEMENT
# ==========================================

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_project_folder(project_id):
    return os.path.join(DATA_FOLDER, secure_filename(project_id))

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

# ==========================================
# VIDEO PROCESSING (FAST MODE ONLY)
# ==========================================

def get_duration(filepath):
    """Get video duration using ffprobe (lightweight, no RAM)"""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
             '-of', 'default=noprint_wrappers=1:nokey=1:noprint_sections=1', filepath],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=CONFIG['video']['ffprobe_timeout']
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
        raise RuntimeError('ffprobe failed')
    except Exception as e:
        log_message(f"Duration error: {str(e)}", 'error')
        raise RuntimeError(f'Failed to get duration: {str(e)}')

def cut_video_stream_copy(input_path, output_path, start, duration):
    """Cut video using stream copy (NO re-encoding, FAST)"""
    try:
        cmd = [
            'ffmpeg', '-y', 
            '-ss', str(start), 
            '-i', input_path, 
            '-t', str(duration), 
            '-c', 'copy',  # Stream copy - NO encoding
            output_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600
        )
        
        if result.returncode != 0:
            raise RuntimeError(result.stderr)
        
        return True
    except Exception as e:
        log_message(f"Cut error: {str(e)}", 'error')
        raise RuntimeError(f'Cutting failed: {str(e)}')

# ==========================================
# ROUTES
# ==========================================

@app.route('/')
def index():
    return send_from_directory(PUBLIC_FOLDER, 'index-i3.html')

@app.route('/system-info')
def system_info():
    """Return system resource info"""
    info = get_system_info()
    log_message(f"RAM: {info.get('available_ram_gb', 0):.2f}GB available", 'info')
    return jsonify(info)

@app.route('/upload', methods=['POST'])
def upload_video():
    """Single file upload"""
    if 'video' not in request.files:
        return 'No file part', 400

    file = request.files['video']
    if file.filename == '' or not allowed_file(file.filename):
        return 'Invalid file', 400

    original_name = secure_filename(file.filename)
    project_id = str(int(round(time.time() * 1000)))
    
    os.makedirs(get_project_video_folder(project_id), exist_ok=True)
    os.makedirs(get_project_clips_folder(project_id), exist_ok=True)

    saved_path = os.path.join(get_project_video_folder(project_id), original_name)
    file.save(saved_path)
    
    log_message(f"Uploaded: {original_name} -> Project {project_id}", 'success')
    return jsonify(projectId=project_id, filename=original_name)

@app.route('/upload-chunk', methods=['POST'])
def upload_chunk():
    """Chunked upload for large files"""
    chunk = request.files.get('chunk')
    filename = request.form.get('filename')
    chunk_index = int(request.form.get('chunkIndex', 0))
    total_chunks = int(request.form.get('totalChunks', 1))
    file_id = request.form.get('fileId')

    if not chunk or not filename or not file_id:
        return 'Missing parameters', 400

    system_info = get_system_info()
    if system_info.get('available_ram_gb', 999) < 0.5:
        log_message(f"Low RAM warning: {system_info.get('available_ram_gb')}GB", 'warning')
        return jsonify(warning='Low RAM'), 207

    temp_dir = os.path.join(TEMP_FOLDER, file_id)
    os.makedirs(temp_dir, exist_ok=True)

    chunk_path = os.path.join(temp_dir, f'chunk_{chunk_index}')
    chunk.save(chunk_path)

    if chunk_index == total_chunks - 1:
        final_filename = secure_filename(filename)
        project_id = file_id
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

            os.rmdir(temp_dir)
            log_message(f"Chunk assembly complete: {total_chunks} chunks -> {final_filename}", 'success')
            return jsonify(projectId=project_id, filename=final_filename, complete=True)
        except Exception as e:
            log_message(f"Assembly failed: {str(e)}", 'error')
            return f'Assembly failed: {str(e)}', 500

    return jsonify(chunkIndex=chunk_index, complete=False)

@app.route('/duration/<project_id>/<filename>')
def get_video_duration(project_id, filename):
    """Get video duration"""
    safe_name = secure_filename(filename)
    file_path = os.path.join(get_project_video_folder(project_id), safe_name)
    
    if not os.path.exists(file_path):
        return 'File not found', 404

    try:
        duration = get_duration(file_path)
        log_message(f"Duration: {duration:.2f}s", 'info')
        return jsonify(duration=duration)
    except Exception as e:
        return str(e), 500

@app.route('/cut', methods=['POST'])
def cut_clip():
    """Cut video clip (FAST mode - stream copy only)"""
    data = request.get_json(silent=True)
    if not data:
        return 'Invalid JSON', 400

    project_id = data.get('projectId')
    filename = data.get('filename')
    start = data.get('start')
    end = data.get('end')
    output = data.get('output')

    if not all([project_id, filename, start is not None, end is not None, output]):
        return 'Missing parameters', 400

    safe_filename = secure_filename(filename)
    safe_output = secure_filename(output)
    input_path = os.path.join(get_project_video_folder(project_id), safe_filename)
    output_path = os.path.join(get_project_clips_folder(project_id), safe_output)

    if not os.path.exists(input_path):
        return 'Source file not found', 404

    duration_val = float(end) - float(start)
    if duration_val <= 0:
        return 'Invalid duration', 400

    try:
        log_message(f"Cutting: {start:.2f}s - {end:.2f}s -> {safe_output}", 'info')
        cut_video_stream_copy(input_path, output_path, start, duration_val)
        log_message(f"Clip created: {safe_output}", 'success')
        return jsonify(success=True, output=safe_output, quality='fast')
    except Exception as e:
        return f'Cutting failed: {str(e)}', 500

@app.route('/projects', methods=['GET'])
def list_projects():
    """List all projects with metadata"""
    projects = []
    try:
        for project_id in sorted(os.listdir(DATA_FOLDER)):
            project_folder = os.path.join(DATA_FOLDER, project_id)
            if not os.path.isdir(project_folder):
                continue
            
            video_folder = get_project_video_folder(project_id)
            clips_folder = get_project_clips_folder(project_id)
            
            # Find original video
            original_name = find_original_video(project_id)
            if not original_name:
                continue
            
            video_path = os.path.join(video_folder, original_name)
            video_stat = os.stat(video_path)
            
            # Get clips
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
            
            projects.append({
                'projectId': project_id,
                'name': original_name,
                'videoName': original_name,
                'videoSize': video_stat.st_size,
                'clips': clips,
                'clipCount': len(clips),
                'clipsSize': clips_size,
                'totalSize': video_stat.st_size + clips_size,
                'modified': video_stat.st_mtime
            })
    except Exception as e:
        log_message(f"List projects error: {str(e)}", 'error')
        return jsonify(error=str(e)), 500
    
    return jsonify(projects=projects)

@app.route('/storage', methods=['GET'])
def storage_info():
    """Get storage usage info"""
    def get_folder_size(folder_path):
        total = 0
        for root, _, files in os.walk(folder_path):
            for file in files:
                total += os.path.getsize(os.path.join(root, file))
        return total

    try:
        projects_size = get_folder_size(DATA_FOLDER)
        temp_size = get_folder_size(TEMP_FOLDER)
        return jsonify(
            projects_size=projects_size,
            temp_size=temp_size,
            total_size=projects_size + temp_size
        )
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project and all its files"""
    safe_id = secure_filename(project_id)
    project_folder = get_project_folder(safe_id)
    
    if not os.path.exists(project_folder):
        return 'Project not found', 404
    
    try:
        shutil.rmtree(project_folder)
        log_message(f"Project deleted: {project_id}", 'success')
        return jsonify(success=True, deleted=project_id)
    except Exception as e:
        log_message(f"Delete error: {str(e)}", 'error')
        return jsonify(error=str(e)), 500

@app.route('/cleanup-temp', methods=['POST'])
def cleanup_temp():
    """Clean up temporary files"""
    try:
        removed = 0
        for entry in os.listdir(TEMP_FOLDER):
            path = os.path.join(TEMP_FOLDER, entry)
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
                removed += 1
        log_message(f"Cleaned up {removed} temp folders", 'success')
        return jsonify(success=True, removed=removed)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/uploads/<project_id>/<path:filename>')
def serve_file(project_id, filename):
    """Serve uploaded/generated files"""
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

# ==========================================
# STARTUP
# ==========================================

if __name__ == '__main__':
    log_message("=" * 60, 'info')
    log_message("i3 Offline Video Cutter v1.0.0", 'info')
    log_message("=" * 60, 'info')
    
    system_info = get_system_info()
    log_message(f"CPU Cores: {system_info.get('cpu_cores')}", 'info')
    log_message(f"RAM Available: {system_info.get('available_ram_gb')}GB", 'info')
    log_message(f"Processing Mode: FAST (Stream Copy)", 'info')
    log_message(f"Starting Flask on {CONFIG['flask']['host']}:{CONFIG['flask']['port']}", 'info')
    log_message("Open browser: http://127.0.0.1:5000", 'info')
    log_message("=" * 60, 'info')
    
    app.run(
        host=CONFIG['flask']['host'],
        port=CONFIG['flask']['port'],
        debug=CONFIG['flask']['debug'],
        threaded=CONFIG['flask']['threaded']
    )
