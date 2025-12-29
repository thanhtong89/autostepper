"""
AWS Lambda handler for downloading YouTube audio and uploading to S3.

This function:
1. Receives a YouTube URL
2. Downloads the audio using yt-dlp
3. Uploads the MP3 to S3
4. Returns a pre-signed URL for the browser to download
"""

import json
import boto3
import subprocess
import os
import uuid
import tempfile
from urllib.parse import urlparse, parse_qs

s3 = boto3.client('s3')
BUCKET = os.environ.get('S3_BUCKET', 'autostepper-audio-temp')


def validate_youtube_url(url: str) -> bool:
    """Validate that the URL is a legitimate YouTube URL."""
    if not url:
        return False

    parsed = urlparse(url)
    valid_hosts = [
        'youtube.com', 'www.youtube.com', 'm.youtube.com',
        'youtu.be', 'www.youtu.be',
        'youtube-nocookie.com', 'www.youtube-nocookie.com'
    ]

    return parsed.netloc in valid_hosts


def handler(event, context):
    """Main Lambda handler."""
    # Handle CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': ''
        }

    try:
        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)

        youtube_url = body.get('url', '').strip()

        # Validate URL
        if not youtube_url:
            return error_response(400, 'Missing URL parameter')

        if not validate_youtube_url(youtube_url):
            return error_response(400, 'Invalid YouTube URL')

        # Generate unique song ID
        song_id = str(uuid.uuid4())

        # Use /tmp for Lambda's writable filesystem
        output_path = f'/tmp/{song_id}.mp3'

        # First, get video metadata
        metadata_result = subprocess.run(
            [
                'yt-dlp',
                '--dump-json',
                '--no-download',
                '--js-runtimes', 'deno:/usr/bin/deno',
                '--remote-components', 'ejs:github',
                youtube_url
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if metadata_result.returncode != 0:
            return error_response(400, f'Failed to fetch video info: {metadata_result.stderr}')

        metadata = json.loads(metadata_result.stdout)

        # Download audio with yt-dlp
        download_result = subprocess.run(
            [
                'yt-dlp',
                '-x',                      # Extract audio
                '--audio-format', 'mp3',   # Convert to MP3
                '--audio-quality', '0',    # Best quality
                '-o', output_path,         # Output path
                '--no-playlist',           # Don't download playlists
                '--max-filesize', '50m',   # Limit file size
                '--js-runtimes', 'deno:/usr/bin/deno',
                '--remote-components', 'ejs:github',
                youtube_url
            ],
            capture_output=True,
            text=True,
            timeout=120  # 2 minute timeout
        )

        if download_result.returncode != 0:
            return error_response(500, f'Download failed: {download_result.stderr}')

        # Check if file exists and get size
        if not os.path.exists(output_path):
            # yt-dlp might add extension, try with .mp3
            possible_paths = [
                output_path,
                f'/tmp/{song_id}.mp3',
                f'/tmp/{song_id}.m4a',
                f'/tmp/{song_id}.webm'
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    output_path = path
                    break
            else:
                return error_response(500, 'Downloaded file not found')

        file_size = os.path.getsize(output_path)

        # Upload to S3
        s3_key = f'audio/{song_id}.mp3'
        s3.upload_file(
            output_path,
            BUCKET,
            s3_key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )

        # Clean up temp file
        os.remove(output_path)

        # Generate pre-signed URL (1 hour expiry)
        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )

        # Extract useful metadata
        response_data = {
            'id': song_id,
            'title': metadata.get('title', 'Unknown'),
            'artist': metadata.get('uploader', metadata.get('channel', 'Unknown')),
            'duration': metadata.get('duration', 0),
            'thumbnail': metadata.get('thumbnail', ''),
            'downloadUrl': presigned_url,
            'fileSize': file_size
        }

        return success_response(response_data)

    except subprocess.TimeoutExpired:
        return error_response(504, 'Download timed out')
    except json.JSONDecodeError as e:
        return error_response(400, f'Invalid JSON: {str(e)}')
    except Exception as e:
        return error_response(500, f'Internal error: {str(e)}')


def success_response(data: dict) -> dict:
    """Return a successful response."""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps(data)
    }


def error_response(status_code: int, message: str) -> dict:
    """Return an error response."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'body': json.dumps({'error': message})
    }
