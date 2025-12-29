# Lambda container image with yt-dlp, ffmpeg, and Deno
FROM public.ecr.aws/lambda/python:3.11-arm64

# Install ffmpeg (required by yt-dlp for audio extraction)
RUN dnf install -y ffmpeg unzip && dnf clean all

# Install Deno (required by yt-dlp for YouTube JS challenges)
# Using the official install script for ARM64
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh && \
    ln -sf /usr/local/bin/deno /usr/bin/deno

# Verify Deno installation
RUN deno --version

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy handler code
COPY handler.py .

# Set the handler
CMD ["handler.handler"]
