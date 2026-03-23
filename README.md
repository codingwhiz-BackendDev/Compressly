📸 Compressly

Smart Image Compression for University & Portal Uploads

UniCompress is a modern web application that helps users compress and optimize images so they meet strict upload limits used by universities, exam registrations, and job application portals.

Many platforms reject uploads with errors like "Image is too large" — UniCompress fixes that instantly.

This project started as an experiment after I saw someone build a simple image compression tool online. I decided to try it myself and explore how images can be manipulated and optimized, while also adding several advanced features that were not in the original idea.

✨ Features
🧠 Smart Compression
Reduce image resolution
Reduce image quality
Automatically generate smaller file sizes
Fast browser-based compression
🎯 Target File Size

Compress images to specific sizes:

20KB
50KB
100KB
Custom size

Perfect for:

University admission portals
Exam registrations
Job applications
🖼 Image Optimization Tools
Resize image dimensions
Maintain aspect ratio
Convert formats:
PNG → JPG
JPG → WebP
Keep original format
📂 Drag & Drop Upload

Simple and modern upload experience.

Just drag your image into the upload area.

📦 Batch Compression

Upload multiple images and compress them all at once.

🔍 Before vs After Comparison

See the difference instantly:

Original file size
Compressed file size
Compression percentage
Side-by-side preview
🎓 Passport Photo Presets

Quick presets for common uploads:

WAEC / JAMB passport photo
University admission uploads
Job application photos
🎨 UI Preview

Modern and clean interface with:

Smooth animations
Drag & drop upload zone
Responsive layout
Dashboard-style compression tool
Beautiful cards and buttons
🛠 Tech Stack

Backend

Django

Frontend

HTML
CSS / Tailwind
JavaScript

Image Processing

Canvas API (client-side compression)
Pillow (optional server-side processing)
⚡ How It Works
Upload an image
Choose compression settings or presets
UniCompress optimizes the image
Preview the result
Download the compressed image
🚀 Installation

Clone the repository:

git clone https://github.com/yourusername/unicompress.git
cd unicompress

Create a virtual environment:

python -m venv venv

Activate it:

Windows

venv\Scripts\activate

Mac/Linux

source venv/bin/activate

Install dependencies:

pip install -r requirements.txt

Run the server:

python manage.py runserver
💡 Why I Built This

I noticed many students struggle with uploading images to portals because of strict file size limits.

After seeing a similar idea online, I decided to:

Experiment with image manipulation
Improve the concept
Add more powerful features
Build a tool that could actually help people
🔮 Future Improvements
AI auto-compress to exact KB size
Image cropping for passport photos
Dark mode
Mobile app version
Cloud storage support
Public API
🤝 Contributing

Contributions are welcome!
If you'd like to improve UniCompress, feel free to fork the repo and submit a pull request.

⭐ Support

If you like this project, consider giving it a star on GitHub — it helps the project grow!
