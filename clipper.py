from moviepy.editor import VideoFileClip

# Load your long video
video = VideoFileClip("sample.mp4")

# Duration of the full video in seconds
duration = video.duration
print(f"Total video duration: {duration} seconds")

# Length of each clip in seconds (you can change this)
clip_length = 60  # 60 seconds = 1 minute clips

# Loop through the video and save clips
start = 0
count = 1

while start < duration:
    end = min(start + clip_length, duration)
    clip = video.subclip(start, end)
    output_filename = f"clip_{count:03d}.mp4"  # clip_001.mp4, clip_002.mp4, ...
    
    print(f"Saving clip {count}: {start} to {end} seconds as {output_filename}")
    clip.write_videofile(output_filename, codec="libx264", audio_codec="aac")
    
    start += clip_length
    count += 1

print("All clips exported successfully!")
