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

# Card dimensions - Balanced for speed and quality
CARD_WIDTH = 1600
CARD_HEIGHT = 900
SQUARE_CARD_SIZE = 1440
PORTRAIT_WIDTH = 1080  # 9:16 for mobile stories
PORTRAIT_HEIGHT = 1920

# Shadow and padding settings - scaled for resolution
# macOS-style: softer, more diffuse, lower opacity
SHADOW_EXPAND = 100
SHADOW_BLUR = 50
SHADOW_OPACITY = 40  # Lower opacity for softer look
SHADOW_OFFSET_Y = 10  # Minimal offset
SHADOW_OFFSET_X = 0
CORNER_RADIUS = 48


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
    """Fetch a random image from cache ONLY - no downloading."""
    cache_dir = Path(__file__).parent / 'bg_cache'

    # Get all cached images
    cached_images = list(cache_dir.glob("*.png")) if cache_dir.exists() else []

    if not cached_images:
        # Fallback: Create a nice dark gradient if no cache
        fallback = Image.new('RGBA', (width, height), (15, 23, 42, 255))
        draw = ImageDraw.Draw(fallback)
        for y in range(height):
            r, g, b = 15, 23, 42
            alpha = int(255 * (1 - y/height * 0.5))
            draw.line([(0, y), (width, y)], fill=(r, g, b, alpha))
        return fallback

    # Pick random cached image
    cache_path = random.choice(cached_images)
    try:
        return Image.open(cache_path).convert('RGBA').resize((width, height), Image.LANCZOS)
    except:
        # If corrupted, try another
        cached_images.remove(cache_path)
        if cached_images:
            cache_path = random.choice(cached_images)
            return Image.open(cache_path).convert('RGBA').resize((width, height), Image.LANCZOS)
        # Fallback
        fallback = Image.new('RGBA', (width, height), (15, 23, 42, 255))
        draw = ImageDraw.Draw(fallback)
        for y in range(height):
            r, g, b = 15, 23, 42
            alpha = int(255 * (1 - y/height * 0.5))
            draw.line([(0, y), (width, y)], fill=(r, g, b, alpha))
        return fallback


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

        # Downsample to 1/6 size for faster blur
        small_size = (panel_w // 6, panel_h // 6)
        panel_small = panel_bg.resize(small_size, Image.LANCZOS)

        # Blur the small version (much faster!)
        panel_blur_small = panel_small.filter(ImageFilter.GaussianBlur(radius=5))

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

    # Content margins - scaled for resolution
    margin_x = 80
    margin_top = 60
    margin_bottom = 80

    content_width = card_width - 2 * margin_x
    current_y = margin_top

    # Estimate content to determine if we need smaller fonts
    arabic_word_count = len(arabic_text.split())
    translation_word_count = len(translation_text.split()) if translation_text else 0

    # Responsive font sizing - scaled for resolution
    if arabic_word_count > 30 or translation_word_count > 60:
        arabic_font_size = 56
        translation_font_size = 32
        scale = 0.8
    elif arabic_word_count > 20 or translation_word_count > 40:
        arabic_font_size = 64
        translation_font_size = 38
        scale = 0.9
    else:
        arabic_font_size = 72
        translation_font_size = 44
        scale = 1.0

    # Draw badge with surah name
    badge_font = get_font(int(28 * scale))
    
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

    badge_padding_x = 28
    badge_padding_y = 12
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

    # Draw footer branding
    footer_y = card_height - 50
    footer_font = get_font(20)
    
    footer_text = "Quran Reader  •  2026"
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


def generate_og_image_bytes(format="png"):
    """Generate an Open Graph image for the homepage.

    Creates a beautiful promotional image for sharing the Quran Reader app.
    """
    # OG image dimensions (1200x630 is standard for Open Graph)
    width = 1200
    height = 630

    # Color RGB values
    text_primary_rgb = hex_to_rgb(COLORS['text_primary'])
    text_secondary_rgb = hex_to_rgb(COLORS['text_secondary'])

    # Create the image
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw gradient background (warm orange gradient from top to bottom)
    gradient_start_rgb = hex_to_rgb(COLORS['gradient_start'])
    gradient_end_rgb = hex_to_rgb(COLORS['gradient_end'])

    for y in range(height):
        ratio = y / height
        r = int(gradient_start_rgb[0] + (gradient_end_rgb[0] - gradient_start_rgb[0]) * ratio)
        g = int(gradient_start_rgb[1] + (gradient_end_rgb[1] - gradient_start_rgb[1]) * ratio)
        b = int(gradient_start_rgb[2] + (gradient_end_rgb[2] - gradient_start_rgb[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Draw Arabic "Quran Reader" text
    arabic_font = get_arabic_font(72)
    arabic_text = "القرآن الكريم"
    arabic_bbox = draw.textbbox((0, 0), arabic_text, font=arabic_font)
    arabic_width = arabic_bbox[2] - arabic_bbox[0]
    arabic_x = (width - arabic_width) // 2

    # Draw decorative divider above Arabic
    accent_rgb = hex_to_rgb(COLORS['accent'])
    draw.line(
        [(400, 160), (800, 160)],
        fill=(*accent_rgb, 255),
        width=3
    )

    # Draw Arabic text
    draw.text(
        (arabic_x, 190),
        arabic_text,
        fill=text_primary_rgb,
        font=arabic_font
    )

    # Draw English title
    title_font = get_font(56)
    title_text = "Quran Reader"
    title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (width - title_width) // 2

    draw.text(
        (title_x, 300),
        title_text,
        fill=text_primary_rgb,
        font=title_font
    )

    # Draw subtitle
    subtitle_font = get_font(32)
    subtitle_text = "Read and Listen to the Holy Quran"
    subtitle_bbox = draw.textbbox((0, 0), subtitle_text, font=subtitle_font)
    subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
    subtitle_x = (width - subtitle_width) // 2

    draw.text(
        (subtitle_x, 370),
        subtitle_text,
        fill=text_secondary_rgb,
        font=subtitle_font
    )

    # Draw features
    features_font = get_font(24)
    features = [
        "• 114 Surahs",
        "• Multiple Translations",
        "• Audio Recitations",
        "• Progress Tracking"
    ]

    # Center features horizontally
    feature_y = 440
    for feature in features:
        feature_bbox = draw.textbbox((0, 0), feature, font=features_font)
        feature_width = feature_bbox[2] - feature_bbox[0]
        feature_x = (width - feature_width) // 2
        draw.text(
            (feature_x, feature_y),
            feature,
            fill=text_secondary_rgb,
            font=features_font
        )
        feature_y += 32

    # Draw footer branding
    footer_y = height - 50
    footer_font = get_font(20)
    footer_text = "quran.hyperflash.uk"
    footer_bbox = draw.textbbox((0, 0), footer_text, font=footer_font)
    footer_width = footer_bbox[2] - footer_bbox[0]
    footer_x = (width - footer_width) // 2

    draw.text(
        (footer_x, footer_y),
        footer_text,
        fill=(*hex_to_rgb(COLORS['accent']), 200),
        font=footer_font
    )

    # Save to buffer
    buffer = BytesIO()

    if format.lower() == "jpg" or format.lower() == "jpeg":
        rgb_img = Image.new('RGB', img.size, (255, 247, 237))
        rgb_img.paste(img, mask=img.split()[3])
        rgb_img.save(buffer, format='JPEG', quality=95)
    else:
        img.save(buffer, format='PNG', optimize=True)

    buffer.seek(0)
    return buffer.getvalue()

