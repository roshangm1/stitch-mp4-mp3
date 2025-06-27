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

        let command = ffmpeg();

        // Input video (muted)
        command.input(videoPath);
        
        // Input audio
        command.input(audioPath);

        // Video processing based on duration comparison
        if (videoDuration < audioDuration) {
            // Video is shorter than audio - loop the video
            console.log('Video is shorter than audio - looping video');
            
            // Calculate how many times we need to loop
            const loopCount = Math.ceil(audioDuration / videoDuration);
            
            command
                .complexFilter([
                    // Loop the video to match audio duration
                    `[0:v]loop=loop=${loopCount - 1}:size=32767:start=0[looped_video]`,
                    // Combine the looped video with audio
                    '[looped_video][1:a]'
                ])
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac', 
                    '-strict experimental',
                    '-shortest', // Stop when shortest stream ends
                    '-avoid_negative_ts make_zero'
                ]);
        } else {
            // Video is longer than or equal to audio - trim video
            console.log('Video is longer than or equal to audio - trimming video');
            
            command
                .complexFilter([
                    // Use video without original audio, trim to audio length
                    '[0:v][1:a]'
                ])
                .outputOptions([
                    '-c:v libx264',
                    '-c:a aac',
                    '-strict experimental',
                    '-t', audioDuration.toString(), // Limit to audio duration
                    '-avoid_negative_ts make_zero'
                ]);
        }

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
