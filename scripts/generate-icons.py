import os
from PIL import Image, ImageOps, ImageDraw

def generate():
    src_logo = os.path.abspath('assets/images/logoitamya.png')
    res_dir = os.path.abspath('android/app/src/main/res')
    pwa_dir = os.path.abspath('assets/images')

    if not os.path.exists(src_logo):
        print("Logo not found:", src_logo)
        return

    logo = Image.open(src_logo).convert('RGBA')

    # Color palette
    bg_color = (15, 23, 42, 255) # Deep navy #0f172a

    # 1. PWA Icons
    print("Generating PWA icons...")
    for size in [192, 512]:
        pwa_icon = Image.new('RGBA', (size, size), bg_color)
        # Pad logo nicely inside
        inner_size = int(size * 0.75)
        resized_logo = logo.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
        offset = ((size - inner_size) // 2, (size - inner_size) // 2)
        pwa_icon.paste(resized_logo, offset, resized_logo)
        pwa_path = os.path.join(pwa_dir, f'icon-{size}.png')
        pwa_icon.save(pwa_path, 'PNG')
        print(f"  Saved {pwa_path}")

    # Maskable PWA icon (smaller padding for safe circle)
    maskable = Image.new('RGBA', (512, 512), bg_color)
    inner_m = int(512 * 0.65)
    r_m = logo.resize((inner_m, inner_m), Image.Resampling.LANCZOS)
    maskable.paste(r_m, ((512 - inner_m) // 2, (512 - inner_m) // 2), r_m)
    maskable.save(os.path.join(pwa_dir, 'icon-maskable.png'), 'PNG')
    print("  Saved icon-maskable.png")

    # Play Store icon (512x512)
    playstore_icon = os.path.join(res_dir, '..', '..', '..', 'playstore-icon.png')
    pwa_icon.save(playstore_icon, 'PNG')
    print(f"  Saved Play Store icon: {playstore_icon}")

    # 2. Android Mipmap Icons
    mipmap_sizes = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }

    print("Generating Android mipmap icons...")
    for folder, (std_size, fg_size) in mipmap_sizes.items():
        target_folder = os.path.join(res_dir, folder)
        os.makedirs(target_folder, exist_ok=True)

        # Standard launcher icon
        std_img = Image.new('RGBA', (std_size, std_size), bg_color)
        pad = int(std_size * 0.78)
        std_logo = logo.resize((pad, pad), Image.Resampling.LANCZOS)
        std_img.paste(std_logo, ((std_size - pad) // 2, (std_size - pad) // 2), std_logo)
        std_img.save(os.path.join(target_folder, 'ic_launcher.png'), 'PNG')

        # Round launcher icon
        round_mask = Image.new('L', (std_size, std_size), 0)
        draw = ImageDraw.Draw(round_mask)
        draw.ellipse((0, 0, std_size, std_size), fill=255)
        round_img = Image.new('RGBA', (std_size, std_size), (0,0,0,0))
        round_img.paste(std_img, (0, 0), round_mask)
        round_img.save(os.path.join(target_folder, 'ic_launcher_round.png'), 'PNG')

        # Adaptive foreground icon
        fg_img = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        fg_logo_size = int(fg_size * 0.60)
        fg_logo = logo.resize((fg_logo_size, fg_logo_size), Image.Resampling.LANCZOS)
        fg_img.paste(fg_logo, ((fg_size - fg_logo_size) // 2, (fg_size - fg_logo_size) // 2), fg_logo)
        fg_img.save(os.path.join(target_folder, 'ic_launcher_foreground.png'), 'PNG')

        print(f"  Generated icons for {folder}")

    # 3. Android Splash Screens
    splash_screens = {
        'drawable-port-mdpi': (320, 480),
        'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280),
        'drawable-port-xxhdpi': (960, 1600),
        'drawable-port-xxxhdpi': (1280, 1920),
        'drawable-land-mdpi': (480, 320),
        'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720),
        'drawable-land-xxhdpi': (1600, 960),
        'drawable-land-xxxhdpi': (1920, 1280),
        'drawable': (480, 800)
    }

    print("Generating Android splash screens...")
    for folder, (w, h) in splash_screens.items():
        splash_folder = os.path.join(res_dir, folder)
        os.makedirs(splash_folder, exist_ok=True)

        splash = Image.new('RGBA', (w, h), bg_color)
        # Splash logo size (max 40% of smallest dimension)
        min_dim = min(w, h)
        logo_splash_dim = int(min_dim * 0.42)
        sp_logo = logo.resize((logo_splash_dim, logo_splash_dim), Image.Resampling.LANCZOS)
        offset = ((w - logo_splash_dim) // 2, (h - logo_splash_dim) // 2)
        splash.paste(sp_logo, offset, sp_logo)
        splash.save(os.path.join(splash_folder, 'splash.png'), 'PNG')
        print(f"  Generated splash for {folder} ({w}x{h})")

    print("\n[SUCCESS] All Android and PWA assets successfully generated.")

if __name__ == '__main__':
    generate()
