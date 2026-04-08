import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import requests
import threading
import os
import subprocess
import time
import platform
from datetime import datetime
from urllib.parse import quote
from flask import Flask, request, jsonify, send_from_directory
import webbrowser

class VideoCutterDesktop:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Video Cutter Pro - Desktop")
        self.root.geometry("900x700")
        self.uploads_folder = os.path.join(os.path.dirname(__file__), 'uploads')

        # Start Flask server in background
        self.flask_thread = threading.Thread(target=self.start_flask_server, daemon=True)
        self.flask_thread.start()

        self.create_widgets()
        self.check_server()

    def create_widgets(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Title
        title = ttk.Label(main_frame, text="Video Cutter Pro", font=("Arial", 16, "bold"))
        title.grid(row=0, column=0, columnspan=2, pady=(0, 20))

        # File selection
        ttk.Label(main_frame, text="Video File:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.file_entry = ttk.Entry(main_frame, width=50)
        self.file_entry.grid(row=1, column=1, padx=(10, 0), pady=5, sticky=(tk.W, tk.E))
        ttk.Button(main_frame, text="Browse", command=self.select_file).grid(row=1, column=2, padx=(10, 0))

        # Clip settings
        settings_frame = ttk.LabelFrame(main_frame, text="Cutting Settings", padding="10")
        settings_frame.grid(row=2, column=0, columnspan=3, pady=20, sticky=(tk.W, tk.E))

        ttk.Label(settings_frame, text="Clip Length (seconds):").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.clip_length = ttk.Entry(settings_frame, width=10)
        self.clip_length.insert(0, "2")
        self.clip_length.grid(row=0, column=1, padx=(10, 20), pady=5, sticky=tk.W)

        ttk.Label(settings_frame, text="Start Time (seconds):").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.start_time = ttk.Entry(settings_frame, width=10)
        self.start_time.insert(0, "0")
        self.start_time.grid(row=1, column=1, padx=(10, 20), pady=5, sticky=tk.W)

        ttk.Label(settings_frame, text="End Time (seconds):").grid(row=2, column=0, sticky=tk.W, pady=5)
        self.end_time = ttk.Entry(settings_frame, width=10)
        self.end_time.grid(row=2, column=1, padx=(10, 20), pady=5, sticky=tk.W)

        # Progress
        self.progress_var = tk.DoubleVar()
        self.progress = ttk.Progressbar(main_frame, variable=self.progress_var, maximum=100)
        self.progress.grid(row=3, column=0, columnspan=3, pady=10, sticky=(tk.W, tk.E))

        self.status_label = ttk.Label(main_frame, text="Ready")
        self.status_label.grid(row=4, column=0, columnspan=3, pady=5)

        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=5, column=0, columnspan=3, pady=20)

        ttk.Button(button_frame, text="Upload & Process", command=self.process_video).grid(row=0, column=0, padx=10)
        ttk.Button(button_frame, text="Open Web Interface", command=self.open_web).grid(row=0, column=1, padx=10)
        ttk.Button(button_frame, text="Open Uploads Folder", command=self.open_uploads_folder).grid(row=0, column=2, padx=10)
        ttk.Button(button_frame, text="Exit", command=self.root.quit).grid(row=0, column=3, padx=10)

        # Results
        results_frame = ttk.LabelFrame(main_frame, text="Generated Clips", padding="10")
        results_frame.grid(row=6, column=0, columnspan=3, pady=10, sticky=(tk.W, tk.E))

        self.results_text = tk.Text(results_frame, height=8, width=70)
        scrollbar = ttk.Scrollbar(results_frame, orient=tk.VERTICAL, command=self.results_text.yview)
        self.results_text.configure(yscrollcommand=scrollbar.set)

        self.results_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))

        # File manager
        file_manager_frame = ttk.LabelFrame(main_frame, text="File Manager", padding="10")
        file_manager_frame.grid(row=7, column=0, columnspan=3, pady=10, sticky=(tk.W, tk.E))

        self.storage_label = ttk.Label(file_manager_frame, text="Storage: calculating...")
        self.storage_label.grid(row=0, column=0, columnspan=3, sticky=tk.W, pady=(0, 8))

        self.files_tree = ttk.Treeview(file_manager_frame, columns=("type", "size", "modified"), show='headings', height=10)
        self.files_tree.heading("type", text="Type")
        self.files_tree.heading("size", text="Size")
        self.files_tree.heading("modified", text="Modified")
        self.files_tree.column("type", width=80, anchor='center')
        self.files_tree.column("size", width=110, anchor='center')
        self.files_tree.column("modified", width=200, anchor='center')
        self.files_tree.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))

        self.files_tree_scroll = ttk.Scrollbar(file_manager_frame, orient=tk.VERTICAL, command=self.files_tree.yview)
        self.files_tree.configure(yscrollcommand=self.files_tree_scroll.set)
        self.files_tree_scroll.grid(row=1, column=3, sticky=(tk.N, tk.S))

        file_buttons = ttk.Frame(file_manager_frame)
        file_buttons.grid(row=2, column=0, columnspan=3, pady=10, sticky=(tk.W, tk.E))

        ttk.Button(file_buttons, text="Refresh Files", command=self.refresh_file_list).grid(row=0, column=0, padx=5)
        ttk.Button(file_buttons, text="Open Selected", command=self.open_selected_file).grid(row=0, column=1, padx=5)
        ttk.Button(file_buttons, text="Delete Selected", command=self.delete_selected_file).grid(row=0, column=2, padx=5)
        ttk.Button(file_buttons, text="Cleanup Temp", command=self.cleanup_temp_files).grid(row=0, column=3, padx=5)
        ttk.Button(file_buttons, text="Open Uploads Folder", command=self.open_uploads_folder).grid(row=0, column=4, padx=5)

        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        results_frame.columnconfigure(0, weight=1)
        results_frame.rowconfigure(0, weight=1)
        file_manager_frame.columnconfigure(0, weight=1)
        file_manager_frame.columnconfigure(1, weight=1)
        file_manager_frame.columnconfigure(2, weight=1)

    def select_file(self):
        filename = filedialog.askopenfilename(
            title="Select Video File",
            filetypes=[("Video files", "*.mp4 *.mov *.mkv *.avi *.webm"), ("All files", "*.*")]
        )
        if filename:
            self.file_entry.delete(0, tk.END)
            self.file_entry.insert(0, filename)

    def check_server(self):
        try:
            response = requests.get("http://127.0.0.1:3000", timeout=2)
            if response.status_code == 200:
                self.status_label.config(text="Server ready")
                self.root.after(100, self.refresh_file_list)
            else:
                self.status_label.config(text="Server starting...")
                self.root.after(2000, self.check_server)
        except:
            self.status_label.config(text="Starting server...")
            self.root.after(2000, self.check_server)

    def refresh_file_list(self):
        try:
            response = requests.get("http://127.0.0.1:3000/files", timeout=5)
            if response.status_code != 200:
                raise Exception(response.text)

            data = response.json()
            self.videos_listbox.delete(0, tk.END)
            self.clips_listbox.delete(0, tk.END)

            for video in data.get('videos', []):
                self.videos_listbox.insert(tk.END, video['name'])
            for clip in data.get('clips', []):
                self.clips_listbox.insert(tk.END, clip['name'])

            self.status_label.config(text='File list refreshed')
        except Exception as e:
            self.status_label.config(text=f'File list error')
            print('File manager error:', e)

    def open_selected_file(self):
        selection = self.files_tree.selection()
        if not selection:
            messagebox.showwarning('Select file', 'Please select a file to open')
            return

        filename = self.files_tree.item(selection[0], 'text')
        webbrowser.open(f'http://127.0.0.1:3000/uploads/{quote(filename)}')

    def delete_selected_file(self):
        selection = self.files_tree.selection()
        if not selection:
            messagebox.showwarning('Select file', 'Please select a file to delete')
            return

        filename = self.files_tree.item(selection[0], 'text')
        if not messagebox.askyesno('Delete file', f'Delete {filename}?'):
            return

        try:
            url = f'http://127.0.0.1:3000/delete/{quote(filename)}'
            response = requests.delete(url, timeout=5)
            if response.status_code == 200:
                messagebox.showinfo('Deleted', f'{filename} deleted')
                self.refresh_file_list()
            else:
                raise Exception(response.text)
        except Exception as e:
            messagebox.showerror('Error', f'Unable to delete file: {e}')

    def cleanup_temp_files(self):
        if not messagebox.askyesno('Cleanup Temp Files', 'Remove temporary upload chunks and free storage?'):
            return

        try:
            response = requests.post('http://127.0.0.1:3000/cleanup-temp', timeout=10)
            if response.status_code != 200:
                raise Exception(response.text)
            data = response.json()
            messagebox.showinfo('Cleanup Complete', f'Removed {data.get("removed", 0)} temp folders.')
            self.refresh_file_list()
        except Exception as e:
            messagebox.showerror('Error', f'Cleanup failed: {e}')

    def open_uploads_folder(self):
        try:
            if os.name == 'nt':
                os.startfile(self.uploads_folder)
            elif platform.system() == 'Darwin':
                subprocess.Popen(['open', self.uploads_folder])
            else:
                subprocess.Popen(['xdg-open', self.uploads_folder])
        except Exception as e:
            messagebox.showerror('Error', f'Unable to open uploads folder: {e}')

    def format_size(self, size):
        if size == 0:
            return '0 B'
        suffixes = ['B', 'KB', 'MB', 'GB', 'TB']
        i = 0
        while size >= 1024 and i < len(suffixes) - 1:
            size /= 1024.0
            i += 1
        return f'{size:.2f} {suffixes[i]}'

    def refresh_file_list(self):
        try:
            response = requests.get('http://127.0.0.1:3000/files', timeout=5)
            if response.status_code != 200:
                raise Exception(response.text)

            data = response.json()
            self.files_tree.delete(*self.files_tree.get_children())

            for video in data.get('videos', []):
                self.files_tree.insert('', 'end', text=video['name'], values=(video['type'], self.format_size(video['size']), datetime.fromtimestamp(video['modified']).strftime('%Y-%m-%d %H:%M:%S')))
            for clip in data.get('clips', []):
                self.files_tree.insert('', 'end', text=clip['name'], values=(clip['type'], self.format_size(clip['size']), datetime.fromtimestamp(clip['modified']).strftime('%Y-%m-%d %H:%M:%S')))

            self.status_label.config(text='File list refreshed')
        except Exception as e:
            self.status_label.config(text='File list error')
            print('File manager error:', e)

        try:
            response = requests.get('http://127.0.0.1:3000/storage', timeout=5)
            if response.status_code == 200:
                storage = response.json()
                self.storage_label.config(text=f"Video: {self.format_size(storage['videos_size'])}, Clips: {self.format_size(storage['clips_size'])}, Temp: {self.format_size(storage['temp_size'])}, Total: {self.format_size(storage['total_size'])}")
        except Exception as e:
            print('Storage info error:', e)

    def start_flask_server(self):
        # Import here to avoid circular imports
        from app import app
        app.run(host='127.0.0.1', port=3000, debug=False, use_reloader=False)

    def process_video(self):
        video_path = self.file_entry.get()
        if not video_path or not os.path.exists(video_path):
            messagebox.showerror("Error", "Please select a valid video file")
            return

        try:
            clip_length = float(self.clip_length.get())
            start_time = float(self.start_time.get())
            end_time = float(self.end_time.get())

            if clip_length <= 0 or start_time < 0 or end_time <= start_time:
                raise ValueError("Invalid parameters")

        except ValueError:
            messagebox.showerror("Error", "Please enter valid numeric values")
            return

        # Process in background thread
        thread = threading.Thread(target=self._process_video_thread,
                                args=(video_path, clip_length, start_time, end_time))
        thread.daemon = True
        thread.start()

    def _process_video_thread(self, video_path, clip_length, start_time, end_time):
        try:
            self.progress_var.set(0)
            self.status_label.config(text="Uploading video...")

            # Upload file
            with open(video_path, 'rb') as f:
                files = {'video': f}
                response = requests.post("http://127.0.0.1:3000/upload", files=files)

            if response.status_code != 200:
                raise Exception(f"Upload failed: {response.text}")

            filename = response.json()['filename']
            self.progress_var.set(25)
            self.status_label.config(text="Getting duration...")

            # Get duration
            response = requests.get(f"http://127.0.0.1:3000/duration/{filename}")
            duration_data = response.json()
            total_duration = duration_data['duration']

            if end_time > total_duration:
                end_time = total_duration

            self.end_time.delete(0, tk.END)
            self.end_time.insert(0, str(end_time))

            # Calculate clips
            total_time = end_time - start_time
            clip_count = int(total_time // clip_length)

            self.progress_var.set(50)
            self.status_label.config(text=f"Cutting {clip_count} clips...")

            # Cut clips
            base_name = os.path.splitext(os.path.basename(video_path))[0]
            clips_created = []

            for i in range(clip_count):
                clip_start = start_time + i * clip_length
                clip_end = min(clip_start + clip_length, end_time)
                output_name = f"{base_name}_Part{i+1}.mp4"

                cut_data = {
                    'filename': filename,
                    'start': clip_start,
                    'end': clip_end,
                    'output': output_name
                }

                response = requests.post("http://127.0.0.1:3000/cut", json=cut_data)
                if response.status_code != 200:
                    raise Exception(f"Cutting failed for clip {i+1}")

                clips_created.append(output_name)
                progress = 50 + (i + 1) / clip_count * 50
                self.progress_var.set(progress)

            self.progress_var.set(100)
            self.status_label.config(text="Processing complete!")

            # Update results
            self.results_text.delete(1.0, tk.END)
            for clip in clips_created:
                self.results_text.insert(tk.END, f"✓ {clip}\n")

            messagebox.showinfo("Success", f"Created {len(clips_created)} clips successfully!")

        except Exception as e:
            self.status_label.config(text=f"Error: {str(e)}")
            messagebox.showerror("Error", f"Processing failed: {str(e)}")

    def open_web(self):
        webbrowser.open("http://127.0.0.1:3000")

    def run(self):
        self.root.mainloop()

if __name__ == "__main__":
    app = VideoCutterDesktop()
    app.run()