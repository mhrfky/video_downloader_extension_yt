import ytdl from '@distube/ytdl-core';
import { Readable } from 'stream';

// Types for video information
interface VideoInfo {
    title: string;
    thumbnail: string;
    duration: string;
    author: string;
}

// Types for format information
interface FormatInfo {
    itag: number;
    quality: string;
    hasAudio: boolean;
    hasVideo: boolean;
    container: string;
    contentLength: string;
}

// Types for download options
interface DownloadOptions {
    quality?: string;
    format?: string;
}

// Types for download progress
interface DownloadProgress {
    downloadedBytes: number;
    totalBytes: number;
    percentage: number;
}

export class YoutubeStreamManager {
    /**
     * Validates if a given URL is a valid YouTube URL
     * Uses a regex pattern to match various YouTube URL formats
     */
    private static validateUrl(url: string): boolean {
        if (!url) {
            throw new Error("URL cannot be empty or undefined");
        }
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        return youtubeRegex.test(url);
    }

    /**
     * Retrieves basic information about a YouTube video
     * This includes title, thumbnail, duration, and author
     */
    async getVideoInfo(url: string): Promise<VideoInfo> {
        try {
            if (!YoutubeStreamManager.validateUrl(url)) {
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

    /**
     * Gets available formats for a YouTube video
     * Useful for letting users choose specific quality/format
     */
    async getAvailableFormats(url: string): Promise<FormatInfo[]> {
        try {
            if (!YoutubeStreamManager.validateUrl(url)) {
                throw new Error("Invalid YouTube URL provided");
            }

            const info = await ytdl.getInfo(url);

            if (!info?.formats) {
                throw new Error("No formats available for this video");
            }

            return info.formats.map(format => ({
                itag: format.itag,
                quality: format.qualityLabel || 'unknown',
                hasAudio: format.hasAudio || false,
                hasVideo: format.hasVideo || false,
                container: format.container || 'unknown',
                contentLength: format.contentLength || '0'
            }));
        } catch (error) {
            throw new Error(`Failed to get video formats: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Creates separate streams for video and audio content
     * This is the core functionality that provides streams for processing
     */
    async createStreams(
        url: string,
        options: DownloadOptions = {},
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<{ videoStream: Readable; audioStream: Readable; totalBytes: number }> {
        try {
            if (!YoutubeStreamManager.validateUrl(url)) {
                throw new Error("Invalid YouTube URL provided");
            }

            const info = await ytdl.getInfo(url);

            // Get best formats for video and audio
            const videoFormat = ytdl.chooseFormat(info.formats.filter(f => f.hasVideo), {
                quality: options.quality || 'highest'
            });
            const audioFormat = ytdl.chooseFormat(info.formats.filter(f => f.hasAudio), {
                quality: 'highestaudio'
            });

            if (!videoFormat || !audioFormat) {
                throw new Error("Could not find suitable video/audio formats");
            }

            // Calculate total bytes for progress tracking
            const totalBytes = parseInt(videoFormat.contentLength || '0') +
                parseInt(audioFormat.contentLength || '0');

            // Create streams with progress tracking
            const videoStream = this.createProgressTrackingStream(
                url,
                videoFormat,
                totalBytes,
                onProgress
            );

            const audioStream = this.createProgressTrackingStream(
                url,
                audioFormat,
                totalBytes,
                onProgress
            );

            return { videoStream, audioStream, totalBytes };
        } catch (error) {
            throw new Error(`Failed to create streams: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Creates a stream that tracks download progress
     * Wraps the ytdl stream with progress monitoring
     */
    private createProgressTrackingStream(
        url: string,
        format: ytdl.videoFormat,
        totalBytes: number,
        onProgress?: (progress: DownloadProgress) => void
    ): Readable {
        let downloadedBytes = 0;
        const stream = ytdl(url, { format });

        if (onProgress) {
            stream.on('data', (chunk: Buffer) => {
                downloadedBytes += chunk.length;
                onProgress({
                    downloadedBytes,
                    totalBytes,
                    percentage: (downloadedBytes / totalBytes) * 100
                });
            });
        }

        return stream;
    }
}