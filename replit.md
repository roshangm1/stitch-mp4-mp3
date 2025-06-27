# Video Audio Combiner

## Overview

This is a Node.js web application that combines MP4 video files with MP3 audio files using FFmpeg. The application provides a web interface for users to upload video and audio files, processes them server-side, and returns a combined video with bass-reactive visual effects synchronized to the audio's low-end frequencies. The final video duration matches the shorter of the two input files. The system handles file validation, media duration analysis, and automatic cleanup of temporary files.

## System Architecture

The application follows a traditional three-tier architecture:

**Frontend**: Static HTML/CSS/JavaScript served by Express, using Bootstrap for responsive design and drag-and-drop file upload functionality.

**Backend**: Express.js RESTful API with modular route handling, file upload middleware, and media processing utilities.

**File Processing**: FFmpeg integration for media manipulation, with duration detection and video-audio synchronization capabilities.

## Key Components

### Server Core (`server.js`)
- Express.js application with CORS enabled
- Static file serving for frontend and processed outputs
- Automatic directory creation for uploads, temp, and output folders
- Global error handling with automatic file cleanup
- Health check endpoint for monitoring

### Upload Middleware (`middleware/upload.js`)
- Multer configuration for handling multipart form data
- File type validation (MP4 for video, MP3 for audio)
- Unique filename generation using UUID
- File size limits and storage management

### Media Processing (`utils/ffmpeg.js`)
- FFmpeg availability validation
- Media duration extraction using ffprobe
- Video-audio combination with bass-reactive visual effects
- Real-time frequency spectrum visualization overlay
- Enhanced video scaling and color adjustment
- Final duration matches the shorter of the two input files

### API Routes (`routes/upload.js`)
- `/api/check-ffmpeg` - Validates FFmpeg installation
- `/api/process` - Handles file upload and media processing
- Comprehensive error handling and temporary file cleanup
- File type validation and processing status updates

### Frontend (`public/index.html`)
- Drag-and-drop file upload interface
- Real-time processing progress indicators
- File preview and validation feedback
- Download links for processed videos
- Bootstrap-based responsive design

## Data Flow

1. **File Upload**: User selects/drops MP4 video and MP3 audio files
2. **Validation**: Client-side and server-side file type/size validation
3. **Storage**: Files stored in uploads directory with unique names
4. **Analysis**: FFmpeg extracts duration metadata from both files
5. **Processing**: Video and audio combined with duration synchronization
6. **Output**: Combined video saved to output directory
7. **Cleanup**: Temporary uploaded files automatically deleted
8. **Delivery**: Download link provided to user

## External Dependencies

### Core Dependencies
- **express** (v5.1.0): Web framework for API and static file serving
- **multer** (v2.0.1): Multipart form data handling for file uploads
- **fluent-ffmpeg** (v2.1.3): FFmpeg wrapper for media processing
- **uuid** (v11.1.0): Unique identifier generation for files
- **cors** (v2.8.5): Cross-origin resource sharing support

### System Requirements
- **FFmpeg**: Required for media processing (validated at runtime)
- **Node.js 20**: Specified in .replit configuration

### Frontend Dependencies (CDN)
- Bootstrap 5.1.3 for UI components
- Font Awesome 6.0.0 for icons

## Deployment Strategy

The application is configured for Replit deployment with:

- **Runtime**: Node.js 20 module
- **Port**: Configurable (defaults to 8000, fallback from PORT env var)
- **Auto-installation**: Dependencies installed via workflow
- **File Structure**: Organized with separate directories for uploads, temp files, and outputs
- **Process Management**: Workflow-based startup with port monitoring

The deployment uses a parallel workflow that installs dependencies and starts the server, with automatic port detection on 5000 (though server defaults to 8000).

## Changelog

- June 27, 2025: Initial setup with Express server, FFmpeg integration, and web interface
- June 27, 2025: Fixed FFmpeg filter syntax error - replaced complex filter with stream_loop for video looping
- June 27, 2025: Added video color inversion effect using negate filter and changed duration logic to use shorter of two files
- June 27, 2025: Replaced color inversion with bass-reactive frequency visualization overlay synchronized to audio

## User Preferences

Preferred communication style: Simple, everyday language.