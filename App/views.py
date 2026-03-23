import io
import json
import os
from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import Image


def index(request):
    return render(request, 'index.html')


@csrf_exempt
@require_http_methods(["POST"])
def compress_image(request):
    import base64

    if 'image' not in request.FILES:
        return JsonResponse({'error': 'No image provided'}, status=400)

    file = request.FILES['image']
    target_kb = int(request.POST.get('target_kb', 0))
    quality = int(request.POST.get('quality', 85))
    new_width = int(request.POST.get('width', 0))
    new_height = int(request.POST.get('height', 0))
    output_format = request.POST.get('format', 'auto').upper()
    proportional = request.POST.get('proportional', 'true') == 'true'

    try:
        img = Image.open(file)
        original_size = file.size
        original_format = img.format or 'JPEG'

        # Convert RGBA to RGB if saving as JPEG
        if img.mode in ('RGBA', 'P'):
            bg = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            bg.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
            img = bg
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Determine output format
        fmt_map = {'JPG': 'JPEG', 'JPEG': 'JPEG', 'PNG': 'PNG', 'WEBP': 'WEBP', 'AUTO': original_format}
        save_format = fmt_map.get(output_format, original_format)
        if save_format not in ('JPEG', 'PNG', 'WEBP'):
            save_format = 'JPEG'

        # Resize
        orig_w, orig_h = img.size
        if new_width > 0 and new_height > 0:
            if proportional:
                img.thumbnail((new_width, new_height), Image.LANCZOS)
            else:
                img = img.resize((new_width, new_height), Image.LANCZOS)
        elif new_width > 0:
            ratio = new_width / orig_w
            img = img.resize((new_width, int(orig_h * ratio)), Image.LANCZOS)
        elif new_height > 0:
            ratio = new_height / orig_h
            img = img.resize((int(orig_w * ratio), new_height), Image.LANCZOS)

        # Compress to target size
        if target_kb > 0:
            target_bytes = target_kb * 1024
            low, high = 10, 95
            best_buf = None
            for _ in range(15):
                mid = (low + high) // 2
                buf = io.BytesIO()
                if save_format == 'PNG':
                    compress_level = max(0, min(9, int((100 - mid) / 11)))
                    img.save(buf, format='PNG', optimize=True, compress_level=compress_level)
                else:
                    img.save(buf, format=save_format, quality=mid, optimize=True)
                size = buf.tell()
                if size <= target_bytes:
                    best_buf = buf
                    low = mid + 1
                else:
                    high = mid - 1
                if high - low <= 1:
                    break

            if best_buf is None:
                # Try downscaling
                scale = 0.8
                temp_img = img.copy()
                for _ in range(10):
                    w, h = temp_img.size
                    temp_img = temp_img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
                    buf = io.BytesIO()
                    temp_img.save(buf, format=save_format, quality=60, optimize=True)
                    if buf.tell() <= target_bytes:
                        best_buf = buf
                        break
                if best_buf is None:
                    best_buf = buf
            output_buf = best_buf
        else:
            output_buf = io.BytesIO()
            if save_format == 'PNG':
                img.save(output_buf, format='PNG', optimize=True)
            else:
                img.save(output_buf, format=save_format, quality=quality, optimize=True)

        output_buf.seek(0)
        compressed_bytes = output_buf.read()
        compressed_size = len(compressed_bytes)

        mime_map = {'JPEG': 'image/jpeg', 'PNG': 'image/png', 'WEBP': 'image/webp'}
        mime = mime_map.get(save_format, 'image/jpeg')
        ext_map = {'JPEG': 'jpg', 'PNG': 'png', 'WEBP': 'webp'}
        ext = ext_map.get(save_format, 'jpg')

        encoded = base64.b64encode(compressed_bytes).decode('utf-8')

        return JsonResponse({
            'success': True,
            'image': f'data:{mime};base64,{encoded}',
            'original_size': original_size,
            'compressed_size': compressed_size,
            'reduction': round((1 - compressed_size / original_size) * 100, 1),
            'width': img.size[0],
            'height': img.size[1],
            'format': save_format,
            'extension': ext,
            'mime': mime,
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def batch_compress(request):
    """Handle batch compression — processes multiple files server-side."""
    import base64

    results = []
    files = request.FILES.getlist('images')
    target_kb = int(request.POST.get('target_kb', 100))
    quality = int(request.POST.get('quality', 85))
    preset = request.POST.get('preset', '')

    preset_configs = {
        'waec_jamb': {'width': 150, 'height': 200, 'target_kb': 20, 'format': 'JPEG'},
        'university': {'width': 300, 'height': 400, 'target_kb': 50, 'format': 'JPEG'},
        'job': {'width': 200, 'height': 200, 'target_kb': 100, 'format': 'JPEG'},
    }

    config = preset_configs.get(preset, {})

    for file in files:
        try:
            img = Image.open(file)
            original_size = file.size

            if img.mode in ('RGBA', 'P'):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                bg.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                img = bg
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            w = config.get('width', 0)
            h = config.get('height', 0)
            if w and h:
                img = img.resize((w, h), Image.LANCZOS)

            tk = config.get('target_kb', target_kb)
            fmt = config.get('format', 'JPEG')
            target_bytes = tk * 1024

            buf = io.BytesIO()
            q = quality
            while q >= 20:
                buf = io.BytesIO()
                img.save(buf, format=fmt, quality=q, optimize=True)
                if buf.tell() <= target_bytes:
                    break
                q -= 5

            buf.seek(0)
            compressed_bytes = buf.read()
            encoded = base64.b64encode(compressed_bytes).decode('utf-8')
            mime = 'image/jpeg' if fmt == 'JPEG' else f'image/{fmt.lower()}'

            results.append({
                'name': file.name,
                'success': True,
                'image': f'data:{mime};base64,{encoded}',
                'original_size': original_size,
                'compressed_size': len(compressed_bytes),
                'reduction': round((1 - len(compressed_bytes) / original_size) * 100, 1),
            })
        except Exception as e:
            results.append({'name': file.name, 'success': False, 'error': str(e)})

    return JsonResponse({'results': results})
