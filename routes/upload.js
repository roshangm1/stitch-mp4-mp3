const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');
const { combineVideoAudio, getMediaDuration, validateFFmpeg } = require('../utils/ffmpeg');

const router = express.Router();

// Check FFmpeg availability
router.get('/check-ffmpeg', async (req, res) => {
    try {
        const isAvailable = await validateFFmpeg();
        res.json({ 
            available: isAvailable,
            message: isAvailable ? 'FFmpeg is available' : 'FFmpeg is not installed or not in PATH'
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to check FFmpeg',
            message: error.message
        });
    }
});

// Upload and process files
router.post('/process', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
]), async (req, res) => {
    let tempFiles = [];
    
    try {
        // Validate files are uploaded
        if (!req.files || !req.files.video || !req.files.audio) {
            return res.status(400).json({
                error: 'Missing files',
                message: 'Both video (MP4) and audio (MP3) files are required'
            });
        }

        const videoFile = req.files.video[0];
        const audioFile = req.files.audio[0];
        
        tempFiles.push(videoFile.path, audioFile.path);

        // Validate file types
        if (!videoFile.originalname.toLowerCase().endsWith('.mp4')) {
            return res.status(400).json({
                error: 'Invalid video format',
                message: 'Video file must be in MP4 format'
            });
        }

        if (!audioFile.originalname.toLowerCase().endsWith('.mp3')) {
            return res.status(400).json({
                error: 'Invalid audio format',
                message: 'Audio file must be in MP3 format'
            });
        }

        console.log(`Processing files: ${videoFile.originalname} + ${audioFile.originalname}`);

        // Get durations of both files
        const videoDuration = await getMediaDuration(videoFile.path);
        const audioDuration = await getMediaDuration(audioFile.path);

        console.log(`Video duration: ${videoDuration}s, Audio duration: ${audioDuration}s`);

        // Generate output filename
        const outputFilename = `processed_${uuidv4()}.mp4`;
        const outputPath = path.join('output', outputFilename);
        tempFiles.push(outputPath);

        // Process the files
        await combineVideoAudio(
            videoFile.path,
            audioFile.path,
            outputPath,
            videoDuration,
            audioDuration
        );

        // Send progress update (in a real implementation, you might use WebSocket for real-time updates)
        console.log('Processing completed successfully');

        // Send response with download link
        res.json({
            success: true,
            message: 'Video processing completed successfully',
            downloadUrl: `/output/${outputFilename}`,
            filename: outputFilename,
            videoDuration: videoDuration,
            audioDuration: audioDuration,
            finalDuration: audioDuration
        });

    } catch (error) {
        console.error('Processing error:', error);
        
        res.status(500).json({
            error: 'Processing failed',
            message: error.message || 'An error occurred while processing the files'
        });
    } finally {
        // Clean up temporary upload files (but keep output file)
        tempFiles.forEach((filePath, index) => {
            // Don't delete the output file (last item)
            if (index < tempFiles.length - 1 && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up temporary file: ${filePath}`);
                } catch (cleanupError) {
                    console.error(`Failed to cleanup file ${filePath}:`, cleanupError);
                }
            }
        });
    }
});

// Download processed file
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join('output', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({
            error: 'File not found',
            message: 'The requested file does not exist or has been removed'
        });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
        console.log(`File downloaded: ${filename}`);
    });

    fileStream.on('error', (error) => {
        console.error('Download error:', error);
        res.status(500).json({
            error: 'Download failed',
            message: 'An error occurred while downloading the file'
        });
    });
});

// List processed files
router.get('/files', (req, res) => {
    try {
        const files = fs.readdirSync('output')
            .filter(file => file.endsWith('.mp4'))
            .map(file => {
                const filePath = path.join('output', file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    downloadUrl: `/output/${file}`
                };
            })
            .sort((a, b) => new Date(b.created) - new Date(a.created));

        res.json({
            success: true,
            files: files,
            count: files.length
        });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({
            error: 'Failed to list files',
            message: error.message
        });
    }
});

// Clean up old files
router.delete('/cleanup', (req, res) => {
    try {
        const files = fs.readdirSync('output');
        let deletedCount = 0;

        files.forEach(file => {
            const filePath = path.join('output', file);
            const stats = fs.statSync(filePath);
            const ageInDays = (Date.now() - stats.birthtime) / (1000 * 60 * 60 * 24);

            // Delete files older than 1 day
            if (ageInDays > 1) {
                fs.unlinkSync(filePath);
                deletedCount++;
                console.log(`Deleted old file: ${file}`);
            }
        });

        res.json({
            success: true,
            message: `Cleaned up ${deletedCount} old files`,
            deletedCount: deletedCount
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({
            error: 'Cleanup failed',
            message: error.message
        });
    }
});

module.exports = router;
