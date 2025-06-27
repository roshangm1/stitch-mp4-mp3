const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Validate that FFmpeg is available on the system
 */
async function validateFFmpeg() {
    try {
        await execPromise('ffmpeg -version');
        return true;
    } catch (error) {
        console.error('FFmpeg not found:', error.message);
        return false;
    }
}

/**
 * Get the duration of a media file in seconds
 */
function getMediaDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(new Error(`Failed to get duration: ${err.message}`));
                return;
            }

            const duration = metadata.format.duration;
            if (!duration) {
                reject(new Error('Could not determine file duration'));
                return;
            }

            resolve(parseFloat(duration));
        });
    });
}

/**
 * Combine video and audio, adjusting video length to match audio
 */
function combineVideoAudio(videoPath, audioPath, outputPath, videoDuration, audioDuration) {
    return new Promise((resolve, reject) => {
        console.log(`Combining video (${videoDuration}s) with audio (${audioDuration}s)`);

        // Use the shorter duration for final output
        const finalDuration = Math.min(videoDuration, audioDuration);
        console.log(`Final video duration will be: ${finalDuration}s (shorter of the two)`);

        let command = ffmpeg();

        // Input video and audio
        command.input(videoPath);
        command.input(audioPath);
        
        // Apply simpler bass-reactive effects that work reliably
        command
            .complexFilter([
                // Create spectrum visualization
                '[1:a]showspectrum=mode=separate:color=rainbow:scale=log:size=600x60[spectrum]',
                // Scale and enhance video
                '[0:v]scale=1280:720,eq=brightness=0.08:contrast=1.15:saturation=1.25[enhanced_video]',
                // Overlay spectrum at bottom
                '[enhanced_video][spectrum]overlay=(W-w)/2:H-h-20[final_video]'
            ])
            .outputOptions([
                '-map', '[final_video]',
                '-map', '1:a',
                '-c:v libx264',
                '-c:a aac',
                '-strict experimental',
                '-t', finalDuration.toString(),
                '-avoid_negative_ts make_zero'
            ]);

        // Set output format and quality
        command
            .output(outputPath)
            .outputOptions([
                '-preset fast',
                '-crf 23', // Good quality/size balance
                '-movflags +faststart' // Optimize for web streaming
            ])
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                console.log(`Processing: ${Math.round(progress.percent || 0)}% done`);
            })
            .on('end', () => {
                console.log('Video processing completed successfully');
                resolve();
            })
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                reject(new Error(`Video processing failed: ${err.message}`));
            })
            .run();
    });
}

/**
 * Get media file information
 */
function getMediaInfo(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(new Error(`Failed to get media info: ${err.message}`));
                return;
            }
            resolve(metadata);
        });
    });
}

/**
 * Extract audio from video file
 */
function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(audioPath)
            .noVideo()
            .audioCodec('mp3')
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

/**
 * Mute video (remove audio track)
 */
function muteVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .output(outputPath)
            .noAudio()
            .videoCodec('copy') // Copy video without re-encoding
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
}

module.exports = {
    validateFFmpeg,
    getMediaDuration,
    combineVideoAudio,
    getMediaInfo,
    extractAudio,
    muteVideo
};
