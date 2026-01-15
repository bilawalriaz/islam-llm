"""
Ayah Share Image Generator

Creates beautiful, artistic shareable images for Quran ayahs.
Features rounded card design with warm orange gradient and elegant typography.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops
from io import BytesIO
import math
import os
import requests
import random
from pathlib import Path

# Colors based on the app's design system - modern premium look
COLORS = {
    # Primary colors - warm orange gradient
    'accent': '#f97316',           # Orange
    'accent_dark': '#ea580c',      # Darker orange
    'accent_light': '#fed7aa',     # Light orange
    'gradient_start': '#fff7ed',   # Very light orange/cream
    'gradient_end': '#ffedd5',     # Light peachy orange
    'bg_dark': '#0f172a',          # Dark slate
    'text_primary': '#1c1917',     # Warm dark
    'text_secondary': '#44403c',   # Warm gray
    'text_muted': '#78716c',       # Lighter warm gray
    'white': '#ffffff',
    'gold': '#c2410c',             # Deep warm orange for divider
    'gold_light': '#fdba74',
    'glass_bg': 'rgba(255, 255, 255, 0.15)',
    'glass_border': 'rgba(255, 255, 255, 0.3)',
}

# Nature background options (Unsplash category/query)
NATURE_QUERIES = [
    'nature', 'mountain', 'stars', 'galaxy', 'ocean', 'forest', 'desert', 'night'
]

# Card dimensions (content area) - ULTRA HIGH RES for sharp text
CARD_WIDTH = 2400
CARD_HEIGHT = 1350
SQUARE_CARD_SIZE = 2160
PORTRAIT_WIDTH = 1620  # 9:16 for mobile stories
PORTRAIT_HEIGHT = 2880

# Shadow and padding settings - scaled for higher resolution
# macOS-style: softer, more diffuse, lower opacity
SHADOW_EXPAND = 200
SHADOW_BLUR = 100
SHADOW_OPACITY = 40  # Lower opacity for softer look
SHADOW_OFFSET_Y = 20  # Minimal offset
SHADOW_OFFSET_X = 0
CORNER_RADIUS = 72


def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def get_font(size, bold=False):
    """Get a font for rendering text."""
    font_options = [
        'InstrumentSerif-Regular.ttf',
        'Inter-VariableFont_opsz,wght.ttf',
        'Arial.ttf',
        'Helvetica.ttf',
        'DejaVuSans.ttf',
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


def get_arabic_font(size):
    """Get a font specifically for Arabic text."""
    font_options = [
        'AmiriQuran-Regular.ttf',
        'PlaypenSansArabic-VariableFont_wght.ttf',
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


def create_rounded_rectangle_mask(size, radius):
    """Create a mask for rounded rectangles."""
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([(0, 0), (size[0]-1, size[1]-1)], radius=radius, fill=255)
    return mask


def create_shadow(width, height, radius=20, blur=30, opacity=100, offset_x=0, offset_y=10):
    """Create a macOS-style blurred shadow for the card.

    macOS shadows are:
    - Very soft and diffuse
    - Lower opacity (~30%)
    - Larger blur radius
    - Minimal offset
    """
    # macOS style: larger expand for the diffuse glow effect
    expand = blur * 3
    shadow_width = width + expand * 2
    shadow_height = height + expand * 2

    shadow = Image.new('RGBA', (shadow_width, shadow_height), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)

    shadow_draw.rounded_rectangle(
        [(expand + offset_x, expand + offset_y),
         (expand + width - 1 + offset_x, expand + height - 1 + offset_y)],
        radius=radius,
        fill=(0, 0, 0, opacity)
    )

    # Apply Gaussian blur for the soft effect
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur))

    return shadow


def get_unsplash_image(width, height, query="nature"):
    """Fetch a random image from Unsplash with caching."""
    # Cache directory
    cache_dir = Path(__file__).parent / 'bg_cache'
    cache_dir.mkdir(exist_ok=True)

    # Curated list of 50 high-quality nature images
    nature_images = _NATURE_IMAGES

    img_url = random.choice(nature_images)
    # Extract image ID from URL for caching (photo-{id})
    img_id = img_url.split('/')[-1].split('?')[0]
    cache_path = cache_dir / f"{img_id}.png"

    # Check cache first (fast path - no network)
    if cache_path.exists():
        try:
            return Image.open(cache_path).convert('RGBA').resize((width, height), Image.LANCZOS)
        except:
            pass

    # Fetch and cache (only if not cached)
    try:
        response = requests.get(img_url, timeout=15)
        if response.status_code == 200:
            img = Image.open(BytesIO(response.content)).convert('RGBA')
            # Save to cache at full resolution
            img.save(cache_path, 'PNG', optimize=True)
            return img.resize((width, height), Image.LANCZOS)
    except Exception as e:
        print(f"Error fetching Unsplash image: {e}")

    # Fallback: Create a nice dark gradient
    fallback = Image.new('RGBA', (width, height), (15, 23, 42, 255))
    draw = ImageDraw.Draw(fallback)
    for y in range(height):
        r, g, b = 15, 23, 42
        alpha = int(255 * (1 - y/height * 0.5))
        draw.line([(0, y), (width, y)], fill=(r, g, b, alpha))
    return fallback


_NATURE_IMAGES = [
    # Mountains & peaks
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1458668383970-8ddd3927deed?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=2400&q=85",

    # Forests & trees
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=2400&q=85",

    # Landscapes & valleys
    "https://images.unsplash.com/photo-1506744038d36-0831d10ca9ce?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1434725039720-abb26e22ebe8?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2400&q=85",

    # Sky & clouds
    "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1507400492013-162706c8c05e?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=2400&q=85",

    # Sunsets & golden hour
    "https://images.unsplash.com/photo-1532274402911-5a33904d2824?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=2400&q=85",

    # Ocean & water
    "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&w=2400&q=85",

    # Desert & sand
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1542401886-65d6c61db217?auto=format&fit=crop&w=2400&q=85",

    # Night & stars
    "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2400&q=85",
    "https://images.unsplash.com/photo-1507400492013-162706c8c05e?auto=format&fit=crop&w=2400&q=85",
]


def preload_backgrounds():
    """Pre-warm the background cache by downloading all images.
    Call this on app startup to ensure fast first generation.
    Runs in background, non-blocking.
    """
    import threading

    def _preload():
        cache_dir = Path(__file__).parent / 'bg_cache'
        cache_dir.mkdir(exist_ok=True)

        for img_url in _NATURE_IMAGES:
            img_id = img_url.split('/')[-1].split('?')[0]
            cache_path = cache_dir / f"{img_id}.png"

            if cache_path.exists():
                continue  # Already cached

            try:
                response = requests.get(img_url, timeout=15)
                if response.status_code == 200:
                    img = Image.open(BytesIO(response.content)).convert('RGBA')
                    img.save(cache_path, 'PNG', optimize=True)
                    print(f"Cached: {img_id}")
            except Exception as e:
                print(f"Failed to cache {img_id}: {e}")

    # Run in background thread
    thread = threading.Thread(target=_preload, daemon=True)
    thread.start()


def wrap_arabic_text(text, font, max_width, draw):
    """Wrap Arabic text to fit within a maximum width."""
    lines = []
    current_line = ""
    words = text.split(' ')

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


def wrap_english_text(text, font, max_width, draw):
    """Wrap English text to fit within a maximum width."""
    lines = []
    current_line = ""
    words = text.split(' ')

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
    surah_english_name="",
    surah_translation="",
    total_ayahs=0,
    edition_name="",
    square=False,
    portrait=False,
    style="classic"
):
    """Generate a beautiful image for sharing an ayah.
    
    Args:
        portrait: If True, generate 9:16 portrait image for mobile stories
        style: 'classic' (orange gradient) or 'nature' (unsplash background)
    """
    
    # Set card dimensions based on format
    if portrait:
        card_width, card_height = PORTRAIT_WIDTH, PORTRAIT_HEIGHT
    elif square:
        card_width, card_height = SQUARE_CARD_SIZE, SQUARE_CARD_SIZE
    else:
        card_width, card_height = CARD_WIDTH, CARD_HEIGHT

    # Calculate total canvas size
    canvas_width = card_width + SHADOW_EXPAND * 2
    canvas_height = card_height + SHADOW_EXPAND * 2

    # Color RGB values
    gradient_start_rgb = hex_to_rgb(COLORS['gradient_start'])
    gradient_end_rgb = hex_to_rgb(COLORS['gradient_end'])
    accent_rgb = hex_to_rgb(COLORS['accent'])
    text_primary_rgb = hex_to_rgb(COLORS['text_primary'])
    text_secondary_rgb = hex_to_rgb(COLORS['text_secondary'])
    gold_rgb = hex_to_rgb(COLORS['gold'])

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

    # Paste shadow
    shadow_x = SHADOW_EXPAND - SHADOW_BLUR * 2
    shadow_y = SHADOW_EXPAND - SHADOW_BLUR * 2
    img.paste(shadow, (shadow_x, shadow_y), shadow)

    # Create card layer
    card = Image.new('RGBA', (card_width, card_height), (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card)

    if style == "nature":
        # Load nature background
        bg = get_unsplash_image(card_width, card_height)
        card.paste(bg, (0, 0))
        
        # Darkening overlay
        overlay = Image.new('RGBA', (card_width, card_height), (0, 0, 0, 100))
        card.alpha_composite(overlay)
        
        text_color = (255, 255, 255)
        secondary_text_color = (220, 220, 220)
        divider_color = (255, 255, 255, 120)  # Slightly more visible
    else:
        # Draw gradient background (warm orange gradient from top to bottom)
        for y in range(card_height):
            ratio = y / card_height
            r = int(gradient_start_rgb[0] + (gradient_end_rgb[0] - gradient_start_rgb[0]) * ratio)
            g = int(gradient_start_rgb[1] + (gradient_end_rgb[1] - gradient_start_rgb[1]) * ratio)
            b = int(gradient_start_rgb[2] + (gradient_end_rgb[2] - gradient_start_rgb[2]) * ratio)
            card_draw.line([(0, y), (card_width, y)], fill=(r, g, b, 255))
        
        text_color = text_primary_rgb
        secondary_text_color = text_secondary_rgb
        divider_color = (*gold_rgb, 180)

    # Apply rounded corner mask
    mask = create_rounded_rectangle_mask((card_width, card_height), CORNER_RADIUS)
    card.putalpha(mask)
    card_draw = ImageDraw.Draw(card)

    if style == "nature":
        # CSS-style glassmorphism: backdrop-filter blur + dark overlay
        # Panel starts higher to enclose the badge
        panel_margin = int(card_width * 0.04)
        panel_top = 50  # Start near top to enclose badge
        panel_rect = [panel_margin, panel_top, card_width - panel_margin, card_height - int(card_height * 0.08)]
        panel_radius = 60

        # Create rounded mask for the glass panel
        panel_mask = Image.new('L', (panel_rect[2] - panel_rect[0], panel_rect[3] - panel_rect[1]), 0)
        mask_draw = ImageDraw.Draw(panel_mask)
        mask_draw.rounded_rectangle([0, 0, panel_rect[2] - panel_rect[0], panel_rect[3] - panel_rect[1]], radius=panel_radius, fill=255)

        # Extract the background area and apply blur (backdrop-filter simulation)
        # OPTIMIZATION: Downsample before blur for speed, then upsample
        panel_bg = bg.crop((panel_rect[0], panel_rect[1], panel_rect[2], panel_rect[3]))
        panel_w, panel_h = panel_bg.size

        # Downsample to 1/4 size for faster blur
        small_size = (panel_w // 4, panel_h // 4)
        panel_small = panel_bg.resize(small_size, Image.LANCZOS)

        # Blur the small version (much faster!)
        panel_blur_small = panel_small.filter(ImageFilter.GaussianBlur(radius=10))

        # Upscale back to original size
        panel_blur = panel_blur_small.resize((panel_w, panel_h), Image.LANCZOS)

        # Darken the blurred background for contrast
        enhancer = ImageEnhance.Brightness(panel_blur)
        panel_blur = enhancer.enhance(0.65)

        # Paste the blurred background with rounded corners
        card.paste(panel_blur, (panel_rect[0], panel_rect[1]), panel_mask)

        # Build the glass overlay layer (dark tint only - no cheesy shine)
        glass_layer = Image.new('RGBA', (panel_rect[2] - panel_rect[0], panel_rect[3] - panel_rect[1]), (0, 0, 0, 0))
        g_draw = ImageDraw.Draw(glass_layer)

        # Base dark tint (semi-transparent)
        g_draw.rounded_rectangle([0, 0, panel_rect[2] - panel_rect[0], panel_rect[3] - panel_rect[1]], radius=panel_radius, fill=(15, 20, 35, 120))

        # Apply the glass layer using alpha_composite (proper blending)
        temp_canvas = card.crop((panel_rect[0], panel_rect[1], panel_rect[2], panel_rect[3]))
        temp_canvas = Image.alpha_composite(temp_canvas.convert('RGBA'), glass_layer)
        card.paste(temp_canvas, (panel_rect[0], panel_rect[1]), panel_mask)

        # Glass borders
        card_draw.rounded_rectangle(panel_rect, radius=panel_radius, outline=(255, 255, 255, 70), width=2)
        inner_rect = [panel_rect[0] + 3, panel_rect[1] + 3, panel_rect[2] - 3, panel_rect[3] - 3]
        card_draw.rounded_rectangle(inner_rect, radius=panel_radius - 2, outline=(255, 255, 255, 25), width=1)

    # Content margins - scaled for higher resolution
    margin_x = 120
    margin_top = 90
    margin_bottom = 120

    content_width = card_width - 2 * margin_x
    current_y = margin_top

    # Estimate content to determine if we need smaller fonts
    arabic_word_count = len(arabic_text.split())
    translation_word_count = len(translation_text.split()) if translation_text else 0

    # Responsive font sizing - scaled 1.5x for higher resolution
    if arabic_word_count > 30 or translation_word_count > 60:
        arabic_font_size = 84
        translation_font_size = 48
        scale = 0.8
    elif arabic_word_count > 20 or translation_word_count > 40:
        arabic_font_size = 96
        translation_font_size = 57
        scale = 0.9
    else:
        arabic_font_size = 108
        translation_font_size = 66
        scale = 1.0

    # Draw badge with surah name
    badge_font = get_font(int(42 * scale))
    
    # Construct refined badge text
    name_part = surah_english_name or (f"Surah {surah_number}")
    if surah_english_name and surah_translation:
        name_part = f"{surah_english_name} ({surah_translation})"
    
    ayah_part = f"Ayah {ayah_number}"
    if total_ayahs > 0:
        ayah_part = f"Ayah {ayah_number}/{total_ayahs}"
        
    badge_text = f"{name_part}  •  {ayah_part}"
    
    badge_bbox = card_draw.textbbox((0, 0), badge_text, font=badge_font)
    badge_width = badge_bbox[2] - badge_bbox[0]
    badge_height = badge_bbox[3] - badge_bbox[1]
    badge_x = (card_width - badge_width) // 2

    badge_padding_x = 42
    badge_padding_y = 18
    pill_height = badge_height + badge_padding_y * 2
    
    card_draw.rounded_rectangle(
        [(badge_x - badge_padding_x, current_y), 
         (badge_x + badge_width + badge_padding_x, current_y + pill_height)],
        radius=pill_height // 2,
        fill=(*accent_rgb, 255)
    )

    card_draw.text(
        (badge_x, current_y + badge_padding_y - 2), 
        badge_text, 
        fill=(255, 255, 255), 
        font=badge_font
    )
    current_y += pill_height + int(40 * scale)

    # Draw Arabic text
    arabic_font = get_arabic_font(arabic_font_size)
    arabic_lines = wrap_arabic_text(arabic_text, arabic_font, content_width, card_draw)
    arabic_line_height = int(arabic_font_size * 1.8)

    # Calculate translation
    translation_font = get_font(translation_font_size)
    trans_lines = []
    if translation_text:
        trans_lines = wrap_english_text(translation_text, translation_font, content_width, card_draw)

    # Calculate total content height for vertical centering
    arabic_block_height = len(arabic_lines) * arabic_line_height
    translation_line_height = int(translation_font_size * 1.5)
    translation_block_height = len(trans_lines) * translation_line_height if trans_lines else 0
    divider_spacing = int(80 * scale)  # More spacing for divider
    
    total_content = arabic_block_height + divider_spacing + translation_block_height
    available_height = card_height - current_y - margin_bottom - 50
    
    if total_content < available_height:
        current_y += (available_height - total_content) // 3

    # Draw Arabic text
    for line in arabic_lines:
        bbox = card_draw.textbbox((0, 0), line, font=arabic_font)
        line_width = bbox[2] - bbox[0]
        line_x = (card_width - line_width) // 2

        card_draw.text(
            (line_x, current_y), 
            line, 
            fill=text_color, 
            font=arabic_font
        )
        current_y += arabic_line_height

    # Draw separator with generous spacing
    current_y += int(100 * scale)  # Space before divider

    separator_padding = int(120 * scale)
    separator_thickness = 2
    
    # Draw gold/orange line
    card_draw.line(
        [(margin_x + separator_padding, current_y), 
         (card_width - margin_x - separator_padding, current_y)], 
        fill=divider_color, 
        width=separator_thickness
    )
    
    # Decorative dots
    dot_size = 4
    card_draw.ellipse(
        [(margin_x + separator_padding - dot_size, current_y - dot_size),
         (margin_x + separator_padding + dot_size, current_y + dot_size)],
        fill=divider_color
    )
    card_draw.ellipse(
        [(card_width - margin_x - separator_padding - dot_size, current_y - dot_size),
         (card_width - margin_x - separator_padding + dot_size, current_y + dot_size)],
        fill=divider_color
    )
    
    current_y += int(100 * scale)  # Space after divider

    # Draw translation - BIGGER text
    if translation_text and trans_lines:
        for line in trans_lines:
            bbox = card_draw.textbbox((0, 0), line, font=translation_font)
            line_width = bbox[2] - bbox[0]
            line_x = (card_width - line_width) // 2

            card_draw.text(
                (line_x, current_y), 
                line, 
                fill=secondary_text_color, 
                font=translation_font
            )
            current_y += translation_line_height

    # Draw footer branding - scaled for higher resolution
    footer_y = card_height - 75
    footer_font = get_font(30)
    
    footer_text = "Quran Reader  •  islam-llm.app"
    footer_bbox = card_draw.textbbox((0, 0), footer_text, font=footer_font)
    footer_width = footer_bbox[2] - footer_bbox[0]
    footer_x = (card_width - footer_width) // 2

    card_draw.text(
        (footer_x, footer_y), 
        footer_text, 
        fill=(*hex_to_rgb("#ffffff"), 150) if style == "nature" else (*text_secondary_rgb, 150), 
        font=footer_font
    )

    # Paste card onto canvas
    card_x = SHADOW_EXPAND
    card_y = SHADOW_EXPAND
    img.paste(card, (card_x, card_y), card)

    return img


def generate_ayah_image_bytes(
    arabic_text,
    translation_text,
    surah_name,
    surah_number,
    ayah_number,
    surah_english_name="",
    surah_translation="",
    total_ayahs=0,
    edition_name="",
    square=False,
    portrait=False,
    style="classic",
    format="png"
):
    """Generate the image and return it as bytes.
    
    Args:
        portrait: If True, generate 9:16 portrait for mobile stories (WhatsApp, Snapchat, etc.)
        style: 'classic' or 'nature'
    """
    img = generate_ayah_image(
        arabic_text,
        translation_text,
        surah_name,
        surah_number,
        ayah_number,
        surah_english_name=surah_english_name,
        surah_translation=surah_translation,
        total_ayahs=total_ayahs,
        edition_name=edition_name,
        square=square,
        portrait=portrait,
        style=style
    )
    
    buffer = BytesIO()
    
    if format.lower() == "jpg" or format.lower() == "jpeg":
        rgb_img = Image.new('RGB', img.size, (255, 247, 237))  # Light orange background
        rgb_img.paste(img, mask=img.split()[3])
        rgb_img.save(buffer, format='JPEG', quality=95)
    else:
        img.save(buffer, format='PNG', optimize=True)
    
    buffer.seek(0)
    return buffer.getvalue()

