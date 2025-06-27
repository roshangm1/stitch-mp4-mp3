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
        
        // Apply bass-reactive visual effects synchronized with audio
        command
            .complexFilter([
                // Create audio visualization bars (frequency spectrum)
                '[1:a]showfreqs=mode=bar:cmode=separate:size=640x360:colors=0x00ff00|0xff0000|0x0000ff:fscale=log:win_func=blackman[freq_viz]',
                // Scale and enhance the video
                '[0:v]scale=1280:720,eq=brightness=0.05:contrast=1.1:saturation=1.2[enhanced_video]',
                // Overlay frequency visualization on video with transparency
                '[enhanced_video][freq_viz]overlay=W-w-10:H-h-10:alpha=0.3[final_video]'
            ])
            .outputOptions([
                '-map', '[final_video]',     // Use processed video with effects
                '-map', '1:a',               // Audio from second input
                '-c:v libx264',
                '-c:a aac',
                '-strict experimental',
                '-t', finalDuration.toString(), // Limit to shorter duration
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
