import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function downloadAndCombine(url: string, outputPath: string) {
    try {
        const info = await ytdl.getInfo(url);

        // Create temporary file paths
        const tempDir = path.join(os.tmpdir(), 'ytdownload_' + Date.now());
        fs.mkdirSync(tempDir);
        const tempVideoPath = path.join(tempDir, 'temp_video.mp4');
        const tempAudioPath = path.join(tempDir, 'temp_audio.aac');

        // Get formats
        const videoFormat = ytdl.chooseFormat(info.formats.filter(f => f.hasVideo), {
            quality: 'highest'
        });
        const audioFormat = ytdl.chooseFormat(info.formats.filter(f => f.hasAudio), {
            quality: 'highestaudio'
        });

        console.log('Downloading video...');
        // Download video
        const videoStream = new PassThrough();
        ytdl(url, { format: videoFormat }).pipe(videoStream);
        await new Promise<void>((resolve, reject) => {
            ffmpeg(videoStream)
                .videoCodec('copy')
                .save(tempVideoPath)
                .on('end', () => resolve())
                .on('error', reject);
        });

        console.log('Downloading audio...');
        // Download audio
        const audioStream = new PassThrough();
        ytdl(url, { format: audioFormat }).pipe(audioStream);
        await new Promise<void>((resolve, reject) => {
            ffmpeg(audioStream)
                .audioCodec('aac')
                .save(tempAudioPath)
                .on('end', () => resolve())
                .on('error', reject);
        });

        console.log('Combining streams...');
        // Combine video and audio
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(tempVideoPath)
                .input(tempAudioPath)
                .outputOptions('-c:v copy')
                .outputOptions('-c:a copy')
                .save(outputPath)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        console.log('Processing:', progress.percent.toFixed(2) + '%');
                    }
                })
                .on('end', () => {
                    // Cleanup temp files
                    fs.unlinkSync(tempVideoPath);
                    fs.unlinkSync(tempAudioPath);
                    fs.rmdirSync(tempDir);
                    console.log('Finished processing');
                    resolve();
                })
                .on('error', (error) => {
                    // Attempt cleanup even on error
                    try {
                        fs.unlinkSync(tempVideoPath);
                        fs.unlinkSync(tempAudioPath);
                        fs.rmdirSync(tempDir);
                    } catch (e) {
                        console.error('Cleanup error:', e);
                    }
                    reject(error);
                });
        });

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    }
}

// Test it
const videoUrl = 'https://www.youtube.com/watch?v=AgyvqMYmAG8';
downloadAndCombine(videoUrl, 'output.mkv')
    .then(() => console.log('Download completed'))
    .catch(console.error);