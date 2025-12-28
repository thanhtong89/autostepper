#!/usr/bin/env python3
"""
StepMania Song Packager

Creates a complete StepMania/ITGMania song package ready for distribution.
Bundles audio file, .ssc chart, and optional assets into a properly structured folder.
"""

import shutil
import zipfile
from pathlib import Path
import click
import sys
from PIL import Image, ImageDraw, ImageFont


def sanitize_filename(name: str) -> str:
    """Sanitize filename by trimming spaces and replacing invalid characters"""
    name = name.strip()
    for char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        name = name.replace(char, '_')
    name = name.replace(' ', '_')
    while '__' in name:
        name = name.replace('__', '_')
    return name


def create_banner_image(song_title, artist_name, output_path):
    """Create a simple banner image for the song"""

    # StepMania banner size: 256x80 pixels
    banner = Image.new('RGB', (256, 80), color=(20, 20, 40))  # Dark blue background
    draw = ImageDraw.Draw(banner)

    try:
        font_title = ImageFont.load_default()
        font_artist = ImageFont.load_default()
    except:
        font_title = ImageFont.load_default()
        font_artist = ImageFont.load_default()

    # Draw title (larger, centered at top)
    title_bbox = draw.textbbox((0, 0), song_title, font=font_title)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (256 - title_width) // 2
    draw.text((title_x, 15), song_title, fill=(255, 255, 255), font=font_title)

    # Draw artist (smaller, centered at bottom)
    artist_bbox = draw.textbbox((0, 0), f"by {artist_name}", font=font_artist)
    artist_width = artist_bbox[2] - artist_bbox[0]
    artist_x = (256 - artist_width) // 2
    draw.text((artist_x, 50), f"by {artist_name}", fill=(180, 180, 180), font=font_artist)

    # Add some decorative elements
    draw.rectangle([10, 10, 246, 12], fill=(0, 150, 255))  # Top accent line
    draw.rectangle([10, 68, 246, 70], fill=(0, 150, 255))  # Bottom accent line

    banner.save(output_path)
    return True


def extract_song_info(chart_file_path):
    """Extract title and artist from .ssc file"""

    try:
        with open(chart_file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        title = "Unknown Title"
        artist = "Unknown Artist"

        for line in content.split('\n'):
            line = line.strip()
            if line.startswith('#TITLE:'):
                title = line[7:-1]  # Remove #TITLE: and ;
            elif line.startswith('#ARTIST:'):
                artist = line[8:-1]  # Remove #ARTIST: and ;

        return title.strip(), artist.strip()

    except Exception:
        return "Unknown Title", "Unknown Artist"


def create_song_package(audio_file, chart_file, output_dir="./stepmania_packages", include_banner=True):
    """
    Create a complete StepMania/ITGMania song package

    Args:
        audio_file: Path to the audio file
        chart_file: Path to the .ssc chart file
        output_dir: Where to create the package
        include_banner: Whether to generate a banner image

    Returns:
        Tuple of (package_dir, list of files added)
    """
    audio_path = Path(audio_file)
    chart_path = Path(chart_file)
    output_dir = Path(output_dir)

    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_file}")

    if not chart_path.exists():
        raise FileNotFoundError(f"Chart file not found: {chart_file}")

    # Extract song info from chart file
    song_title, artist_name = extract_song_info(chart_path)

    # Create safe folder name with trimmed spaces
    safe_title = sanitize_filename(song_title)
    safe_artist = sanitize_filename(artist_name)
    folder_name = f"{safe_artist}-{safe_title}"

    # Create package directory
    package_dir = output_dir / folder_name
    package_dir.mkdir(parents=True, exist_ok=True)

    print(f"Creating StepMania package: {folder_name}")

    # Track files we add to the package
    package_files = []

    # Copy audio file with sanitized name
    audio_dest_name = sanitize_filename(audio_path.stem) + audio_path.suffix
    audio_dest = package_dir / audio_dest_name
    shutil.copy2(audio_path, audio_dest)
    package_files.append(audio_dest)
    print(f"   Copied audio: {audio_dest_name}")

    # Copy chart file with sanitized name
    chart_dest_name = sanitize_filename(chart_path.stem) + chart_path.suffix
    chart_dest = package_dir / chart_dest_name
    shutil.copy2(chart_path, chart_dest)
    package_files.append(chart_dest)
    print(f"   Copied chart: {chart_dest_name}")

    # Create banner image
    if include_banner:
        try:
            banner_path = package_dir / "banner.png"
            create_banner_image(song_title, artist_name, banner_path)
            package_files.append(banner_path)
            print(f"   Generated banner: banner.png")
        except Exception as e:
            print(f"   Could not create banner: {e}")

    # Create a README for the package
    readme_content = f"""# {song_title} - {artist_name}

StepMania/ITGMania Song Package generated by AutoStepper MVP

## Installation:
1. Copy this entire folder to your StepMania/ITGMania Songs directory
2. Refresh your song cache (F5 in song selection)
3. The song should appear in your song list

## Package Contents:
- Audio: {audio_dest_name}
- Chart: {chart_dest_name} (all difficulties included)
- Banner: banner.png (if generated)

## Chart Information:
Generated using advanced beat detection with librosa and Python.
Contains Easy, Medium, Hard, and Challenge difficulty levels.

## Attribution:
- Python AutoStepper MVP (this implementation)
- Original concept by phr00t: https://github.com/phr00t/AutoStepper
"""

    readme_path = package_dir / "README.txt"
    readme_path.write_text(readme_content)
    package_files.append(readme_path)
    print(f"   Created README: README.txt")

    return package_dir, package_files


def create_zip_package(package_dir, package_files=None):
    """
    Create a zip file of the song package

    Args:
        package_dir: Path to package directory
        package_files: Optional list of specific files to include.
                      If None, includes all files in the directory.
    """
    package_path = Path(package_dir)
    zip_path = package_path.with_suffix('.zip')

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        if package_files:
            # Only zip the specific files we created
            for file_path in package_files:
                file_path = Path(file_path)
                if file_path.exists():
                    arcname = file_path.relative_to(package_path.parent)
                    zip_file.write(file_path, arcname)
        else:
            # Fallback: zip everything (for manual CLI usage)
            for file_path in package_path.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(package_path.parent)
                    zip_file.write(file_path, arcname)

    print(f"Created zip package: {zip_path}")
    return zip_path


@click.command()
@click.option('--audio', '-a', required=True, help='Path to audio file')
@click.option('--chart', '-c', required=True, help='Path to .ssc chart file')
@click.option('--output', '-o', default='./stepmania_packages', help='Output directory')
@click.option('--zip', '-z', is_flag=True, help='Create zip file for distribution')
@click.option('--banner/--no-banner', default=True, help='Generate banner image')
def main(audio, chart, output, zip, banner):
    """Package StepMania/ITGMania song with audio and chart for distribution"""

    print("StepMania Song Packager")
    print("=" * 40)

    audio_path = Path(audio)
    chart_path = Path(chart)

    if not audio_path.exists():
        click.echo(f"Audio file not found: {audio}", err=True)
        sys.exit(1)

    if not chart_path.exists():
        click.echo(f"Chart file not found: {chart}", err=True)
        sys.exit(1)

    try:
        # Create the package
        package_dir, package_files = create_song_package(
            audio_file=audio_path,
            chart_file=chart_path,
            output_dir=output,
            include_banner=banner
        )

        # Create zip if requested
        zip_path = None
        if zip:
            zip_path = create_zip_package(package_dir, package_files)

        # Show completion message
        print(f"\nPackage created successfully!")
        print(f"Folder: {package_dir}")
        if zip_path:
            print(f"Zip file: {zip_path}")

        print(f"\nTo share with other StepMania/ITGMania users:")
        if zip_path:
            print(f"   1. Send them: {zip_path.name}")
            print(f"   2. They extract to StepMania/Songs/")
        else:
            print(f"   1. Send them the folder: {package_dir.name}")
            print(f"   2. They copy to StepMania/Songs/")
        print(f"   3. They refresh (F5)")

    except Exception as e:
        click.echo(f"Packaging failed: {e}", err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
