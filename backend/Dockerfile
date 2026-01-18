FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
# Note: Context should be the root of the project
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn uvicorn[standard]

# Create directory for audio (will be mounted)
RUN mkdir -p /app/quran-dump/audio

# Copy backend code
COPY backend/ .

# Copy database (53MB)
COPY quran-dump/quran.db /app/quran-dump/quran.db

# Expose the backend port
EXPOSE 8001

# Environment variables for paths
ENV DB_PATH=/app/quran-dump/quran.db
ENV AUDIO_PATH=/app/quran-dump/audio

# Run the application with Gunicorn
# --preload: Loads app before forking workers, enabling shared memory for model
# 1 worker for memory-constrained environments
CMD ["gunicorn", "main:app", "--workers", "1", "--preload", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8001"]
