const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

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

function combineForKKVideos(videoPath, audioPath, outputPath, videoDuration, audioDuration) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('\n=== Starting Video Processing ===');
            console.log(`Input Video Path: ${videoPath}`);
            console.log(`Input Audio Path: ${audioPath}`);
            console.log(`Output Path: ${outputPath}`);
            console.log(`Video Duration: ${videoDuration}s`);
            console.log(`Audio Duration: ${audioDuration}s`);

            // Use the shorter duration for final output
            const finalDuration = Math.min(videoDuration, audioDuration);
            console.log(`Final video duration will be: ${finalDuration}s (shorter of the two)\n`);

            // Verify input files exist
            if (!fs.existsSync(videoPath)) {
                throw new Error(`Video file not found: ${videoPath}`);
            }
            if (!fs.existsSync(audioPath)) {
                throw new Error(`Audio file not found: ${audioPath}`);
            }

            let command = ffmpeg();

            // Input video and audio
            command.input(videoPath);
            command.input(audioPath);
        
            console.log('Setting up FFmpeg filters for 9:16 portrait video with padding...');
            // Apply padding to maintain aspect ratio
            command
                .complexFilter([
                    // Scale video to fit within 720x1280 while maintaining aspect ratio
                    // Then pad to 720x1280 with black bars as needed
                    '[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2[final_video]'
                ])
                .output(outputPath)
                .outputOptions([
                    '-map', '[final_video]',
                    '-map', '1:a',
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-t', finalDuration.toString()
                ])
                .on('start', (commandLine) => {
                    console.log('\n=== FFmpeg Command ===');
                    console.log(commandLine);
                    console.log('\n=== Processing Started ===');
                })
                .on('progress', (progress) => {
                    const percent = Math.round(progress.percent || 0);
                    const timemark = progress.timemark || '00:00:00';
                    console.log(`Progress: ${percent}% complete (Time: ${timemark})`);
                    if (progress.currentFps) {
                        console.log(`Current FPS: ${progress.currentFps}`);
                    }
                })
                .on('end', async () => {
                    try {
                        console.log('\n=== Video Processing Complete ===');
                        const fileStats = fs.statSync(outputPath);
                        console.log(`Output file size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
                        
                        // Read the processed file as binary
                        console.log('Reading processed file...');
                        const processedVideo = await fs.promises.readFile(outputPath);
                        console.log('File read successfully');
                        resolve(processedVideo);
                    } catch (error) {
                        console.error('\n=== Error Reading Output File ===');
                        console.error('Error details:', error);
                        reject(new Error(`Failed to read processed video: ${error.message}`));
                    }
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('\n=== FFmpeg Processing Error ===');
                    console.error('Error:', err.message);
                    if (stdout) {
                        console.error('\nFFmpeg stdout:', stdout);
                    }
                    if (stderr) {
                        console.error('\nFFmpeg stderr:', stderr);
                    }
                    reject(new Error(`Video processing failed: ${err.message}`));
                })
                .run();
        } catch (error) {
            console.error('\n=== Processing Setup Error ===');
            console.error('Error details:', error);
            reject(new Error(`Processing setup failed: ${error.message}`));
        }
    });
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
 * Returns the processed video as binary data
 */
function combineVideoAudio(videoPath, audioPath, outputPath, videoDuration, audioDuration) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`Combining video (${videoDuration}s) with audio (${audioDuration}s)`);

            // Use the shorter duration for final output
            const finalDuration = Math.min(videoDuration, audioDuration);
            console.log(`Final video duration will be: ${finalDuration}s (shorter of the two)`);

            let command = ffmpeg();

            // Input video and audio
            command.input(videoPath);
            command.input(audioPath);
        
            // Apply simple video enhancement and bounce effect
            command
                .complexFilter([
                    // Basic video enhancement
                    '[0:v]scale=1280:720[scaled]',
                    '[scaled]eq=brightness=0.2:contrast=1.5:saturation=1.8[enhanced]',
                    // Simple bounce effect
                    '[enhanced]scale=1280:720,setpts=PTS-STARTPTS[final_video]'
                ])
                .output(outputPath)
                .outputOptions([
                    '-map', '[final_video]',
                    '-map', '1:a',
                    '-c:v libx264',
                    '-c:a aac',
                    '-preset fast',
                    '-crf 23',
                    '-t', finalDuration.toString()
                ])
                .on('start', (commandLine) => {
                    console.log('FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    console.log(`Processing: ${Math.round(progress.percent || 0)}% done`);
                })
                .on('end', async () => {
                    try {
                        console.log('Video processing completed successfully');
                        // Read the processed file as binary
                        const processedVideo = await fs.promises.readFile(outputPath);
                        resolve(processedVideo);
                    } catch (error) {
                        reject(new Error(`Failed to read processed video: ${error.message}`));
                    }
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(new Error(`Video processing failed: ${err.message}`));
                })
                .run();
        } catch (error) {
            reject(new Error(`Processing setup failed: ${error.message}`));
        }
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
    muteVideo,
    combineForKKVideos
};
