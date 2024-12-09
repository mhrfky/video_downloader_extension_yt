import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import {  Readable, PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    VideoDetails,
    VideoFormat,
    DownloadOptions,
    DownloadProgress
} from '../../shared/types';

export class YouTubeDownloader {
    static validateUrl(url: string): boolean {
        if (!url) {
            throw new Error("URL cannot be empty or undefined");
        }
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return youtubeRegex.test(url);
    }

    static async getVideoInfo(url: string): Promise<VideoDetails> {
        try {
            if (!this.validateUrl(url)) {
                throw new Error("Invalid YouTube URL provided");
            }
            const info = await ytdl.getBasicInfo(url);
            if (!info?.videoDetails) {
                throw new Error("Failed to fetch video details");
            }
            return {
                title: info.videoDetails.title,
                thumbnail: info.videoDetails.thumbnails[0]?.url ?? '',
                duration: info.videoDetails.lengthSeconds,
                author: info.videoDetails.author.name
            };
        } catch (error) {
            throw new Error(`Failed to get video info: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async getVideoFormats(url: string): Promise<VideoFormat[]> {
        try {
            if (!this.validateUrl(url)) {
                throw new Error("Invalid YouTube URL provided");
            }
            const info = await ytdl.getInfo(url);
            if (!info?.formats) {
                throw new Error("No formats available for this video");
            }
            return info.formats.map(format => ({
                itag: format.itag,
                quality: format.qualityLabel,
                hasAudio: format.hasAudio,
                hasVideo: format.hasVideo,
                container: format.container,
                contentLength: format.contentLength
            }));
        } catch (error) {
            throw new Error(`Failed to get video formats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private static async cleanupStreams(...streams: (Readable | PassThrough | null)[]) {
        try {
            for (const stream of streams) {
                if (stream?.destroy) {
                    stream.destroy();
                }
            }
        } catch (error) {
            console.error('Stream cleanup error:', error);
        }
    }

    private static async cleanupTempFiles(files: string[], directory: string) {
        try {
            for (const file of files) {
                if (fs.existsSync(file)) {
                    try {
                        const stream = fs.createReadStream(file);
                        stream.destroy();
                        await fs.promises.unlink(file);
                    } catch (error) {
                        console.error(`Error cleaning up file ${file}:`, error);
                    }
                }
            }
            if (fs.existsSync(directory)) {
                try {
                    await fs.promises.rmdir(directory);
                } catch (error) {
                    console.error(`Error removing directory ${directory}:`, error);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    static async createDownloadStream(
        url: string,
        options: DownloadOptions = {},
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<Readable> {
        if (!this.validateUrl(url)) {
            throw new Error("Invalid YouTube URL provided");
        }

        const info = await ytdl.getInfo(url);
        const outputStream = new PassThrough();

        // Create temporary directory and file paths
        const tempDir = path.join(os.tmpdir(), 'ytdownload_' + Date.now());
        try {
            await fs.promises.mkdir(tempDir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create temporary directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const tempVideoPath = path.join(tempDir, 'temp_video.mp4');
        const tempAudioPath = path.join(tempDir, 'temp_audio.aac');

        // Stream declarations
        let videoStream: PassThrough | null = null;
        let audioStream: PassThrough | null = null;
        let videoDownload: Readable | null = null;
        let audioDownload: Readable | null = null;

        try {
            // Get formats
            const videoFormats = info.formats.filter(f => f.hasVideo);
            const audioFormats = info.formats.filter(f => f.hasAudio);

            if (videoFormats.length === 0) throw new Error("No video formats available");
            if (audioFormats.length === 0) throw new Error("No audio formats available");

            const videoFormat = ytdl.chooseFormat(videoFormats, {
                quality: options.quality || 'highest'
            });
            const audioFormat = ytdl.chooseFormat(audioFormats, {
                quality: 'highestaudio'
            });

            let totalBytes = 0;
            let downloadedBytes = 0;

            if (videoFormat.contentLength) totalBytes += parseInt(videoFormat.contentLength);
            if (audioFormat.contentLength) totalBytes += parseInt(audioFormat.contentLength);

            // Download video
            videoStream = new PassThrough();
            videoDownload = ytdl(url, { format: videoFormat });

            if (!videoDownload) throw new Error("Failed to create video download stream");

            if (onProgress) {
                videoDownload.on('data', (chunk) => {
                    try {
                        downloadedBytes += chunk.length;
                        onProgress({
                            downloadedBytes,
                            totalBytes,
                            percentage: (downloadedBytes / totalBytes) * 100
                        });
                    } catch (error) {
                        console.error('Progress callback error:', error);
                    }
                });
            }

            videoDownload.pipe(videoStream);
            await new Promise<void>((resolve, reject) => {
                try {
                    if (!videoStream) throw new Error("Video stream is null or undefined");

                    ffmpeg(videoStream)
                        .videoCodec('copy')
                        .save(tempVideoPath)
                        .on('end', () => {
                            try {
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        })
                        .on('error', (error) => {
                            reject(new Error(`Video processing failed: ${error.message}`));
                        });
                } catch (error) {
                    reject(error);
                }
            });

            // Download audio
            audioStream = new PassThrough();
            audioDownload = ytdl(url, { format: audioFormat });

            if (!audioDownload) throw new Error("Failed to create audio download stream");

            if (onProgress) {
                audioDownload.on('data', (chunk) => {
                    try {
                        downloadedBytes += chunk.length;
                        onProgress({
                            downloadedBytes,
                            totalBytes,
                            percentage: (downloadedBytes / totalBytes) * 100
                        });
                    } catch (error) {
                        console.error('Progress callback error:', error);
                    }
                });
            }

            audioDownload.pipe(audioStream);
            await new Promise<void>((resolve, reject) => {
                try {
                    if (!audioStream) throw new Error("Audio stream is null or undefined");

                    ffmpeg(audioStream)
                        .audioCodec('aac')
                        .save(tempAudioPath)
                        .on('end', () => {
                            try {
                                resolve();
                            } catch (error) {
                                reject(error);
                            }
                        })
                        .on('error', (error) => {
                            reject(new Error(`Audio processing failed: ${error.message}`));
                        });
                } catch (error) {
                    reject(error);
                }
            });

            // Verify temporary files exist
            if (!fs.existsSync(tempVideoPath)) throw new Error("Video file not created");
            if (!fs.existsSync(tempAudioPath)) throw new Error("Audio file not created");

            // Combine streams
            ffmpeg()
                .input(tempVideoPath)
                .input(tempAudioPath)
                .outputOptions('-c:v copy')
                .outputOptions('-c:a copy')
                .format('matroska')
                .stream(outputStream)
                .on('end', () => {
                    try {
                        this.cleanupStreams(videoStream, audioStream, videoDownload, audioDownload);
                        this.cleanupTempFiles([tempVideoPath, tempAudioPath], tempDir);
                    } catch (error) {
                        console.error('Cleanup error after successful processing:', error);
                    }
                })
                .on('error', (error) => {
                    try {
                        this.cleanupStreams(videoStream, audioStream, videoDownload, audioDownload);
                        this.cleanupTempFiles([tempVideoPath, tempAudioPath], tempDir);
                        outputStream.destroy(new Error(`FFmpeg processing failed: ${error.message}`));
                    } catch (cleanupError) {
                        console.error('Cleanup error after processing failure:', cleanupError);
                        outputStream.destroy(error);
                    }
                });

            return outputStream;
        } catch (error) {
            try {
                await this.cleanupStreams(videoStream, audioStream, videoDownload, audioDownload);
                await this.cleanupTempFiles([tempVideoPath, tempAudioPath], tempDir);
            } catch (cleanupError) {
                console.error('Cleanup error in catch block:', cleanupError);
            }
            throw new Error(`Download stream creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

// [Previous YouTubeDownloader class code remains exactly the same...]

export async function testYouTubeDownloader(): Promise<string> {
    const testResults: { [key: string]: boolean } = {
        urlValidation: false,
        videoInfo: false,
        formats: false,
        stream: false
    };

    let currentTest = "not started";

    try {
        console.log('Starting YouTube Downloader tests...\n');
        const testUrl = 'https://www.youtube.com/watch?v=AgyvqMYmAG8';

        // Test 1: URL Validation
        try {
            currentTest = "URL validation";
            console.log('1. Testing URL validation...');

            // Test valid URL
            const isValid = YouTubeDownloader.validateUrl(testUrl);
            console.log('Valid URL result:', isValid);

            // Test invalid URL
            const invalidResult = YouTubeDownloader.validateUrl('https://invalid-url.com');
            if (!isValid || invalidResult) {
                throw new Error('URL validation failed');
            }

            testResults.urlValidation = true;
        } catch (error) {
            console.error(`URL validation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }

        // Test 2: Video Info Retrieval
        try {
            currentTest = "video info retrieval";
            console.log('\n2. Testing video info retrieval...');
            const videoInfo = await YouTubeDownloader.getVideoInfo(testUrl);

            // Validate video info
            if (!videoInfo.title || !videoInfo.duration) {
                throw new Error('Incomplete video info received');
            }

            console.log('Video Info:', JSON.stringify(videoInfo, null, 2));
            testResults.videoInfo = true;
        } catch (error) {
            console.error(`Video info test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }

        // Test 3: Format Retrieval
        try {
            currentTest = "format retrieval";
            console.log('\n3. Testing format retrieval...');
            const formats = await YouTubeDownloader.getVideoFormats(testUrl);

            // Validate formats
            if (!formats.length) {
                throw new Error('No formats received');
            }

            console.log('Number of available formats:', formats.length);
            console.log('Sample format:', JSON.stringify(formats[0], null, 2));
            testResults.formats = true;
        } catch (error) {
            console.error(`Format retrieval test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }

        // Test 4: Stream Creation
        try {
            currentTest = "stream creation";
            console.log('\n4. Testing stream creation...');
            const stream = await YouTubeDownloader.createDownloadStream(
                testUrl,
                { quality: 'highest' },
                (progress) => {
                    try {
                        console.log(`Download progress: ${progress.percentage.toFixed(2)}%`);
                    } catch (error) {
                        console.error('Progress callback error:', error);
                    }
                }
            );

            // Test stream by reading a small portion
            await new Promise<void>((resolve, reject) => {
                let dataReceived = false;
                const timeout = setTimeout(() => {
                    if (!dataReceived) {
                        stream.destroy(new Error('Stream timeout - no data received'));
                        reject(new Error('Stream timeout - no data received'));
                    }
                }, 5000);

                stream.on('data', () => {
                    if (!dataReceived) {
                        dataReceived = true;
                        clearTimeout(timeout);
                        try {
                            stream.destroy();
                            testResults.stream = true;
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }
                });

                stream.on('error', (error) => {
                    clearTimeout(timeout);
                    try {
                        stream.destroy(error);
                        reject(error);
                    } catch (destroyError) {
                        reject(destroyError);
                    }
                });
            });
        } catch (error) {
            console.error(`Stream creation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }

        const summary = `\nTest Summary:\n${Object.entries(testResults)
            .map(([test, passed]) => `${test}: ${passed ? '✓' : '✗'}`)
            .join('\n')}`;

        return `All tests completed successfully!\n${summary}`;
    } catch (error) {
        const failedTest = currentTest !== "not started" ? ` (failed at ${currentTest})` : '';
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Test suite failed${failedTest}: ${errorMessage}`);
    }
}