"""
Ayah Share Image Generator

Creates beautiful, artistic shareable images for Quran ayahs.
Features Islamic geometric patterns, elegant typography, and social media optimization.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from io import BytesIO
import arabic_reshaper
from bidi.algorithm import get_display
import math
import os
from pathlib import Path

# Colors based on the app's design system
COLORS = {
    # Primary colors
    'accent': '#f97316',           # Orange
    'accent_dark': '#ea580c',      # Darker orange
    'accent_light': '#fed7aa',     # Light orange
    'bg_cream': '#fafaf9',         # Light cream
    'bg_dark': '#0f172a',          # Dark slate
    'text_primary': '#0f172a',     # Dark slate
    'text_secondary': '#475569',   # Medium slate
    'white': '#ffffff',
    'gold': '#d4af37',
    'gold_light': '#f4e4bc',
}

# Image dimensions for social media (optimal for Twitter/X, Instagram, etc.)
IMAGE_WIDTH = 1200
IMAGE_HEIGHT = 630  # 16:9 aspect ratio for Twitter cards
SQUARE_SIZE = 1080  # For Instagram


def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def get_font(size, bold=False):
    """
    Get a font for rendering text.
    Tries multiple font options for cross-platform compatibility.
    """
    font_options = []

    if bold:
        font_options = [
            'Amiri-Bold.ttf',
            'NotoNaskhArabic-Bold.ttf',
            'ScheherazadeNew-Bold.ttf',
            'Arial_Bold.ttf',
            'Helvetica_Bold.ttf',
            'DejaVuSans-Bold.ttf',
        ]
    else:
        font_options = [
            'Amiri-Regular.ttf',
            'NotoNaskhArabic-Regular.ttf',
            'ScheherazadeNew-Regular.ttf',
            'Arial.ttf',
            'Helvetica.ttf',
            'DejaVuSans.ttf',
        ]

    # Try to load font from the backend directory first
    backend_dir = Path(__file__).parent
    for font_name in font_options:
        font_path = backend_dir / 'fonts' / font_name
        if font_path.exists():
            try:
                return ImageFont.truetype(str(font_path), size)
            except:
                pass

    # Fall back to system fonts
    for font_name in font_options:
        try:
            return ImageFont.truetype(font_name, size)
        except:
            continue

    # Ultimate fallback
    return ImageFont.load_default()


def get_arabic_font(size):
    """Get a font specifically for Arabic text."""
    font_options = [
        'Amiri-Regular.ttf',
        'NotoNaskhArabic-Regular.ttf',
        'ScheherazadeNew-Regular.ttf',
        'Traditional Arabic.ttf',
        'Arial.ttf',
    ]

    backend_dir = Path(__file__).parent
    for font_name in font_options:
        font_path = backend_dir / 'fonts' / font_name
        if font_path.exists():
            try:
                return ImageFont.truetype(str(font_path), size)
            except:
                pass

    for font_name in font_options:
        try:
            return ImageFont.truetype(font_name, size)
        except:
            continue

    return ImageFont.load_default()


def draw_geometric_pattern(draw, width, height, color_rgb, alpha=30):
    """
    Draw an Islamic geometric pattern as background decoration.
    Creates interlacing 8-pointed star pattern.
    """
    # Create a pattern layer
    pattern = Image.new('RGBA', (width, height), (255, 255, 255, 0))
    pattern_draw = ImageDraw.Draw(pattern)

    # Pattern size and spacing
    star_size = 80
    spacing = 120

    # Draw 8-pointed stars across the image
    for y in range(-star_size, height + star_size, spacing):
        for x in range(-star_size, width + star_size, spacing):
            # Offset every other row
            offset = (spacing // 2) if ((y + star_size) // spacing) % 2 == 0 else 0
            x_pos = x + offset

            # Draw 8-pointed star
            points = []
            for i in range(16):
                angle = i * (2 * math.pi / 16)
                radius = star_size / 2 if i % 2 == 0 else star_size / 4
                px = x_pos + radius * math.cos(angle - math.pi / 16)
                py = y + radius * math.sin(angle - math.pi / 16)
                points.append((px, py))

            pattern_draw.polygon(points, fill=(*color_rgb, alpha))

    return pattern


def draw_corner_ornament(draw, x, y, size, color_rgb, alpha=50):
    """
    Draw an ornate corner decoration.
    """
    # Create corner ornament with overlapping circles
    layer = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    layer_draw = ImageDraw.Draw(layer)

    # Draw intersecting circles
    circle_size = size // 3
    for i in range(3):
        offset = i * circle_size // 2
        layer_draw.ellipse(
            [offset, offset, offset + circle_size, offset + circle_size],
            outline=(*color_rgb, alpha),
            width=2
        )
        layer_draw.ellipse(
            [offset, size - offset - circle_size, offset + circle_size, size - offset],
            outline=(*color_rgb, alpha),
            width=2
        )

    # Draw corner accent
    layer_draw.polygon([
        (0, 0), (size // 4, 0), (0, size // 4)
    ], fill=(*color_rgb, alpha + 30))

    return layer


def draw_bismillah_banner(draw, y, width, accent_rgb):
    """Draw a decorative banner with Bismillah text."""
    banner_height = 60
    font = get_arabic_font(28)

    # Draw gradient background for banner
    for x in range(width):
        # Gradient from accent to lighter
        factor = x / width
        r = int(accent_rgb[0] + (255 - accent_rgb[0]) * factor * 0.3)
        g = int(accent_rgb[1] + (255 - accent_rgb[1]) * factor * 0.3)
        b = int(accent_rgb[2] + (255 - accent_rgb[2]) * factor * 0.3)
        draw.rectangle([(x, y), (x + 1, y + banner_height)], fill=(r, g, b))

    # Bismillah text
    bismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
    reshaped_text = arabic_reshaper.reshape(bismillah)
    bidi_text = get_display(reshaped_text)

    # Get text bounding box
    bbox = draw.textbbox((0, 0), bidi_text, font=font)
    text_width = bbox[2] - bbox[0]
    text_x = (width - text_width) // 2
    text_y = y + (banner_height - (bbox[3] - bbox[1])) // 2 - 2

    # Draw text with shadow
    draw.text((text_x + 2, text_y + 2), bidi_text, fill=(0, 0, 0, 50), font=font)
    draw.text((text_x, text_y), bidi_text, fill=(255, 255, 255, 255), font=font)

    return y + banner_height


def wrap_arabic_text(text, font, max_width, draw):
    """
    Wrap Arabic text to fit within a maximum width.
    Returns a list of text lines.
    """
    lines = []
    current_line = ""

    # Reshape for proper Arabic display
    reshaped_text = arabic_reshaper.reshape(text)
    words = reshaped_text.split(' ')

    for word in words:
        test_line = current_line + (' ' if current_line else '') + word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        width = bbox[2] - bbox[0]

        if width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return [get_display(line) for line in lines]


def wrap_english_text(text, font, max_width, draw):
    """
    Wrap English text to fit within a maximum width.
    """
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test_line = current_line + (' ' if current_line else '') + word
        bbox = draw.textbbox((0, 0), test_line, font=font)
        width = bbox[2] - bbox[0]

        if width <= max_width:
            current_line = test_line
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines


def generate_ayah_image(
    arabic_text,
    translation_text,
    surah_name,
    surah_number,
    ayah_number,
    edition_name="",
    square=False
):
    """
    Generate a beautiful, artistic image for sharing an ayah.

    Args:
        arabic_text: The Arabic text of the ayah
        translation_text: The translation text
        surah_name: Name of the surah (Arabic)
        surah_number: Surah number
        ayah_number: Ayah number within the surah
        edition_name: Name of the translation edition
        square: If True, generate a square image (for Instagram)

    Returns:
        PIL Image object
    """
    # Set dimensions
    if square:
        width, height = SQUARE_SIZE, SQUARE_SIZE
    else:
        width, height = IMAGE_WIDTH, IMAGE_HEIGHT

    # Color RGB values
    bg_rgb = hex_to_rgb(COLORS['bg_cream'])
    accent_rgb = hex_to_rgb(COLORS['accent'])
    accent_dark_rgb = hex_to_rgb(COLORS['accent_dark'])
    text_primary_rgb = hex_to_rgb(COLORS['text_primary'])
    text_secondary_rgb = hex_to_rgb(COLORS['text_secondary'])
    gold_rgb = hex_to_rgb(COLORS['gold'])

    # Create base image
    img = Image.new('RGB', (width, height), bg_rgb)
    draw = ImageDraw.Draw(img)

    # Draw gradient background
    for y in range(height):
        # Subtle gradient from top to bottom
        factor = y / height
        r = int(bg_rgb[0] + (245 - bg_rgb[0]) * factor * 0.2)
        g = int(bg_rgb[1] + (245 - bg_rgb[1]) * factor * 0.2)
        b = int(bg_rgb[2] + (245 - bg_rgb[2]) * factor * 0.2)
        draw.rectangle([(0, y), (width, y + 1)], fill=(r, g, b))

    # Draw subtle geometric pattern
    pattern = draw_geometric_pattern(draw, width, height, accent_rgb, alpha=20)
    img = Image.alpha_composite(img.convert('RGBA'), pattern).convert('RGB')
    draw = ImageDraw.Draw(img)

    # Draw corner ornaments
    corner_size = 100
    corner_offset = 20

    # Top-left corner
    corner_tl = draw_corner_ornament(draw, 0, 0, corner_size, gold_rgb, 40)
    img.paste(corner_tl, (corner_offset, corner_offset), corner_tl)

    # Top-right corner (flip horizontal)
    corner_tr = corner_tl.transpose(Image.FLIP_LEFT_RIGHT)
    img.paste(corner_tr, (width - corner_size - corner_offset, corner_offset), corner_tr)

    # Bottom-left corner (flip vertical)
    corner_bl = corner_tl.transpose(Image.FLIP_TOP_BOTTOM)
    img.paste(corner_bl, (corner_offset, height - corner_size - corner_offset), corner_bl)

    # Bottom-right corner (flip both)
    corner_br = corner_tl.transpose(Image.ROTATE_180)
    img.paste(corner_br, (width - corner_size - corner_offset, height - corner_size - corner_offset), corner_br)

    # Redraw after paste
    draw = ImageDraw.Draw(img)

    # Content margins
    margin_x = 100
    margin_top = 120 if square else 80
    margin_bottom = 150 if square else 100

    # Draw Bismillah banner at top (if not Al-Fatiha which starts with it)
    if surah_number != 1:
        banner_y = 40
        draw_bismillah_banner(draw, banner_y, width, accent_rgb)
        margin_top = banner_y + 100

    # Content area
    content_width = width - 2 * margin_x
    current_y = margin_top

    # Draw surah and ayah info
    info_font = get_font(28, bold=True)
    surah_info = f"Surah {surah_number}: {surah_name} | Ayah {ayah_number}"
    info_bbox = draw.textbbox((0, 0), surah_info, font=info_font)
    info_width = info_bbox[2] - info_bbox[0]
    info_x = (width - info_width) // 2

    # Info badge background
    badge_height = 50
    draw.rounded_rectangle(
        [(info_x - 20, current_y), (info_x + info_width + 20, current_y + badge_height)],
        radius=25,
        fill=(*accent_rgb, 255)
    )

    draw.text((info_x, current_y + 10), surah_info, fill=(255, 255, 255), font=info_font)
    current_y += badge_height + 50

    # Draw Arabic text
    arabic_font = get_arabic_font(48 if square else 52)
    arabic_lines = wrap_arabic_text(arabic_text, arabic_font, content_width, draw)

    # Calculate arabic text block height
    arabic_line_height = 70
    arabic_block_height = len(arabic_lines) * arabic_line_height

    # Center the content vertically
    available_height = height - margin_bottom - current_y - 80  # 80 for translation
    translation_height = 60
    if translation_text:
        translation_font = get_font(24)
        trans_lines = wrap_english_text(translation_text, translation_font, content_width, draw)
        translation_height = len(trans_lines) * 35 + 30

    total_content_height = arabic_block_height + 30 + translation_height

    # Adjust starting y to center content
    if total_content_height < available_height:
        current_y += (available_height - total_content_height) // 2

    # Draw Arabic text with nice spacing
    for line in arabic_lines:
        bbox = draw.textbbox((0, 0), line, font=arabic_font)
        line_width = bbox[2] - bbox[0]
        line_x = (width - line_width) // 2

        # Draw text with subtle shadow
        draw.text((line_x + 2, current_y + 2), line, fill=(*text_primary_rgb, 50), font=arabic_font)
        draw.text((line_x, current_y), line, fill=text_primary_rgb, font=arabic_font)

        current_y += arabic_line_height

    current_y += 30

    # Draw separator
    separator_y = current_y
    draw.line([(margin_x, separator_y), (width - margin_x, separator_y)], fill=(*gold_rgb, 150), width=2)
    current_y += 30

    # Draw translation
    if translation_text:
        translation_font = get_font(24)
        trans_lines = wrap_english_text(translation_text, translation_font, content_width, draw)

        for line in trans_lines:
            bbox = draw.textbbox((0, 0), line, font=translation_font)
            line_width = bbox[2] - bbox[0]
            line_x = (width - line_width) // 2

            draw.text((line_x, current_y), line, fill=text_secondary_rgb, font=translation_font)
            current_y += 35

    # Draw footer with branding
    footer_y = height - 60
    footer_font = get_font(20)

    # Semi-transparent footer background
    footer_overlay = Image.new('RGBA', (width, 60), (*accent_dark_rgb, 230))
    img.paste(footer_overlay, (0, footer_y), footer_overlay)
    draw = ImageDraw.Draw(img)

    # Branding text
    branding = "📖 Quran Reader | Read more at"
    brand_bbox = draw.textbbox((0, 0), branding, font=footer_font)
    brand_width = brand_bbox[2] - brand_bbox[0]

    # Center the footer
    footer_content_x = (width - brand_width - 200) // 2
    draw.text((footer_content_x, footer_y + 18), branding, fill=(255, 255, 255), font=footer_font)

    # URL
    url_font = get_font(22, bold=True)
    url_text = "islam-llm.app"
    url_bbox = draw.textbbox((0, 0), url_text, font=url_font)
    url_x = footer_content_x + brand_width + 10
    draw.text((url_x, footer_y + 16), url_text, fill=(255, 255, 255), font=url_font)

    return img


def generate_ayah_image_bytes(
    arabic_text,
    translation_text,
    surah_name,
    surah_number,
    ayah_number,
    edition_name="",
    square=False,
    format="PNG"
):
    """
    Generate an ayah image and return as bytes.

    Args:
        arabic_text: The Arabic text of the ayah
        translation_text: The translation text
        surah_name: Name of the surah (Arabic)
        surah_number: Surah number
        ayah_number: Ayah number within the surah
        edition_name: Name of the translation edition
        square: If True, generate a square image
        format: Image format (PNG, JPEG, etc.)

    Returns:
        BytesIO object containing the image
    """
    img = generate_ayah_image(
        arabic_text=arabic_text,
        translation_text=translation_text,
        surah_name=surah_name,
        surah_number=surah_number,
        ayah_number=ayah_number,
        edition_name=edition_name,
        square=square
    )

    buffer = BytesIO()
    img.save(buffer, format=format, quality=95 if format == "JPEG" else None)
    buffer.seek(0)
    return buffer
