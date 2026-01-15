"""
Ayah Share Image Generator

Creates beautiful, artistic shareable images for Quran ayahs.
Features rounded card design with macOS-style blurred shadow and elegant typography.
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

# Card dimensions (content area)
CARD_WIDTH = 1200
CARD_HEIGHT = 630  # 16:9 aspect ratio
SQUARE_CARD_SIZE = 1080  # For Instagram

# Shadow and padding settings
SHADOW_EXPAND = 80  # Extra pixels around card for shadow
SHADOW_BLUR = 40
SHADOW_OPACITY = 100  # 0-255
SHADOW_OFFSET_Y = 15
SHADOW_OFFSET_X = 0
CORNER_RADIUS = 32


def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def get_font(size, bold=False):
    """
    Get a font for rendering text.
    Uses InstrumentSerif as primary, Inter as fallback.
    """
    font_options = [
        'InstrumentSerif-Regular.ttf',      # Primary choice - elegant serif
        'Inter-VariableFont_opsz,wght.ttf', # Fallback - clean sans-serif
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
    """Get a font specifically for Arabic text. Uses AmiriQuran as primary."""
    font_options = [
        'AmiriQuran-Regular.ttf',               # Primary - optimized for Quran
        'PlaypenSansArabic-VariableFont_wght.ttf',  # Alternative - modern style
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
                font = ImageFont.truetype(str(font_path), size)
                return font
            except Exception as e:
                print(f"Failed to load {font_path}: {e}")
                pass

    for font_name in font_options:
        try:
            return ImageFont.truetype(font_name, size)
        except:
            continue

    return ImageFont.load_default()


def create_rounded_rectangle_mask(size, radius):
    """Create a mask for a rounded rectangle."""
    width, height = size
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (width - 1, height - 1)], radius=radius, fill=255)
    return mask


def create_shadow(width, height, radius, blur, opacity, offset_x=0, offset_y=0):
    """
    Create a macOS-style blurred shadow for a rounded rectangle.
    Returns an RGBA image with the shadow.
    """
    # Create a larger canvas for the shadow blur
    expand = blur * 2
    shadow_width = width + expand * 2
    shadow_height = height + expand * 2
    
    # Create shadow shape
    shadow = Image.new('RGBA', (shadow_width, shadow_height), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    
    # Draw the rounded rectangle shape for shadow
    shadow_draw.rounded_rectangle(
        [(expand + offset_x, expand + offset_y), 
         (expand + width - 1 + offset_x, expand + height - 1 + offset_y)],
        radius=radius,
        fill=(0, 0, 0, opacity)
    )
    
    # Apply gaussian blur for soft shadow effect
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur))
    
    return shadow


def wrap_arabic_text(text, font, max_width, draw):
    """
    Wrap Arabic text to fit within a maximum width.
    Returns a list of text lines.
    """
    # Reshape Arabic text for proper rendering
    reshaped_text = arabic_reshaper.reshape(text)
    
    lines = []
    current_line = ""
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

    # Apply bidi algorithm for proper RTL display
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
    Creates a rounded card with macOS-style shadow on transparent background.

    Args:
        arabic_text: The Arabic text of the ayah
        translation_text: The translation text
        surah_name: Name of the surah (Arabic)
        surah_number: Surah number
        ayah_number: Ayah number within the surah
        edition_name: Name of the translation edition
        square: If True, generate a square image (for Instagram)

    Returns:
        PIL Image object (RGBA with transparency)
    """
    # Set card dimensions
    if square:
        card_width, card_height = SQUARE_CARD_SIZE, SQUARE_CARD_SIZE
    else:
        card_width, card_height = CARD_WIDTH, CARD_HEIGHT

    # Calculate total canvas size (card + shadow space)
    canvas_width = card_width + SHADOW_EXPAND * 2
    canvas_height = card_height + SHADOW_EXPAND * 2

    # Color RGB values
    bg_rgb = hex_to_rgb(COLORS['bg_cream'])
    accent_rgb = hex_to_rgb(COLORS['accent'])
    text_primary_rgb = hex_to_rgb(COLORS['text_primary'])
    text_secondary_rgb = hex_to_rgb(COLORS['text_secondary'])
    gold_rgb = hex_to_rgb(COLORS['gold'])
    white_rgb = hex_to_rgb(COLORS['white'])

    # Create shadow
    shadow = create_shadow(
        card_width, card_height,
        radius=CORNER_RADIUS,
        blur=SHADOW_BLUR,
        opacity=SHADOW_OPACITY,
        offset_x=SHADOW_OFFSET_X,
        offset_y=SHADOW_OFFSET_Y
    )

    # Create main canvas (transparent)
    img = Image.new('RGBA', (canvas_width, canvas_height), (0, 0, 0, 0))

    # Calculate shadow position to center the card
    shadow_x = SHADOW_EXPAND - SHADOW_BLUR * 2
    shadow_y = SHADOW_EXPAND - SHADOW_BLUR * 2

    # Paste shadow onto canvas
    img.paste(shadow, (shadow_x, shadow_y), shadow)

    # Create card layer
    card = Image.new('RGBA', (card_width, card_height), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card)

    # Draw rounded rectangle background with gradient effect
    # First, create a solid background
    card_draw.rounded_rectangle(
        [(0, 0), (card_width - 1, card_height - 1)],
        radius=CORNER_RADIUS,
        fill=(*bg_rgb, 255)
    )

    # Add subtle gradient overlay inside the card
    gradient = Image.new('RGBA', (card_width, card_height), (0, 0, 0, 0))
    gradient_draw = ImageDraw.Draw(gradient)
    for y in range(card_height):
        # Very subtle gradient from top to bottom
        factor = y / card_height
        alpha = int(10 * factor)  # Very subtle
        gradient_draw.line([(0, y), (card_width, y)], fill=(0, 0, 0, alpha))
    
    # Apply gradient with rounded mask
    mask = create_rounded_rectangle_mask((card_width, card_height), CORNER_RADIUS)
    card = Image.composite(Image.alpha_composite(card, gradient), card, mask)
    card_draw = ImageDraw.Draw(card)

    # Content margins
    margin_x = 60
    margin_top = 50
    margin_bottom = 80

    # Content area
    content_width = card_width - 2 * margin_x
    current_y = margin_top

    # Draw surah and ayah info badge
    info_font = get_font(24, bold=True)
    surah_info = f"Surah {surah_number}: {surah_name}  •  Ayah {ayah_number}"
    info_bbox = card_draw.textbbox((0, 0), surah_info, font=info_font)
    info_width = info_bbox[2] - info_bbox[0]
    info_height = info_bbox[3] - info_bbox[1]
    info_x = (card_width - info_width) // 2

    # Info badge background
    badge_padding_x = 24
    badge_padding_y = 12
    badge_height = info_height + badge_padding_y * 2
    
    card_draw.rounded_rectangle(
        [(info_x - badge_padding_x, current_y), 
         (info_x + info_width + badge_padding_x, current_y + badge_height)],
        radius=badge_height // 2,
        fill=(*accent_rgb, 255)
    )

    card_draw.text(
        (info_x, current_y + badge_padding_y - 2), 
        surah_info, 
        fill=(255, 255, 255), 
        font=info_font
    )
    current_y += badge_height + 40

    # Draw Arabic text
    arabic_font_size = 44 if square else 48
    arabic_font = get_arabic_font(arabic_font_size)
    arabic_lines = wrap_arabic_text(arabic_text, arabic_font, content_width, card_draw)

    # Calculate arabic text block height
    arabic_line_height = int(arabic_font_size * 1.6)
    arabic_block_height = len(arabic_lines) * arabic_line_height

    # Calculate translation height
    translation_height = 0
    trans_lines = []
    if translation_text:
        translation_font = get_font(22)
        trans_lines = wrap_english_text(translation_text, translation_font, content_width, card_draw)
        translation_height = len(trans_lines) * 32 + 30

    total_content_height = arabic_block_height + 30 + translation_height

    # Calculate available space and center content vertically
    available_height = card_height - current_y - margin_bottom - 50  # 50 for footer
    if total_content_height < available_height:
        current_y += (available_height - total_content_height) // 2

    # Draw Arabic text with nice spacing
    for line in arabic_lines:
        bbox = card_draw.textbbox((0, 0), line, font=arabic_font)
        line_width = bbox[2] - bbox[0]
        line_x = (card_width - line_width) // 2

        # Draw text with subtle shadow
        card_draw.text(
            (line_x + 1, current_y + 1), 
            line, 
            fill=(*text_primary_rgb, 40), 
            font=arabic_font
        )
        card_draw.text(
            (line_x, current_y), 
            line, 
            fill=text_primary_rgb, 
            font=arabic_font
        )

        current_y += arabic_line_height

    current_y += 25

    # Draw separator line
    separator_padding = 100
    card_draw.line(
        [(margin_x + separator_padding, current_y), 
         (card_width - margin_x - separator_padding, current_y)], 
        fill=(*gold_rgb, 150), 
        width=2
    )
    current_y += 25

    # Draw translation
    if translation_text and trans_lines:
        translation_font = get_font(22)
        translation_line_height = 32

        for line in trans_lines:
            bbox = card_draw.textbbox((0, 0), line, font=translation_font)
            line_width = bbox[2] - bbox[0]
            line_x = (card_width - line_width) // 2

            card_draw.text(
                (line_x, current_y), 
                line, 
                fill=text_secondary_rgb, 
                font=translation_font
            )
            current_y += translation_line_height

    # Draw footer branding
    footer_y = card_height - 45
    footer_font = get_font(16)
    
    # Draw a subtle footer line
    card_draw.line(
        [(margin_x, footer_y - 15), (card_width - margin_x, footer_y - 15)],
        fill=(*text_secondary_rgb, 50),
        width=1
    )
    
    # Branding text
    branding = "📖 Quran Reader  •  islam-llm.app"
    brand_bbox = card_draw.textbbox((0, 0), branding, font=footer_font)
    brand_width = brand_bbox[2] - brand_bbox[0]
    footer_x = (card_width - brand_width) // 2
    card_draw.text(
        (footer_x, footer_y), 
        branding, 
        fill=(*text_secondary_rgb, 180), 
        font=footer_font
    )

    # Paste card onto main canvas (centered)
    card_x = SHADOW_EXPAND
    card_y = SHADOW_EXPAND
    
    # Create rounded mask for card
    card_mask = create_rounded_rectangle_mask((card_width, card_height), CORNER_RADIUS)
    img.paste(card, (card_x, card_y), card_mask)

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
    
    # For PNG, save with transparency
    if format.upper() == "PNG":
        img.save(buffer, format="PNG")
    else:
        # For JPEG, convert to RGB and add white background
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
            img = background
        img.save(buffer, format=format, quality=95)
    
    buffer.seek(0)
    return buffer
