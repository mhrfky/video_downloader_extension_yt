import { FileManager } from './fileManager.ts';
import { YoutubeStreamManager } from './youtubeStreamManager.ts';
import { MediaProcessor } from './mediaManager.ts';
interface DownloadOptions {
    // Video quality options
    quality?: 'highest' | 'lowest' | string;
    format?: string;

    // Processing options
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    fps?: number;

    // Output options
    outputFormat?: string;
}

// Simplified progress interface
interface DownloadProgress {
    state: 'downloading' | 'processing';
    downloadProgress?: number;  // Only present during downloading
}

export class YoutubeDownloader {
    private fileManager: FileManager;
    private streamManager: YoutubeStreamManager;
    private mediaProcessor: MediaProcessor;

    constructor() {
        this.fileManager = new FileManager();
        this.streamManager = new YoutubeStreamManager();
        this.mediaProcessor = new MediaProcessor(this.fileManager);
    }

    async downloadVideo(
        url: string,
        outputPath: string,
        options: DownloadOptions = {},
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<void> {
        try {
            const videoInfo = await this.streamManager.getVideoInfo(url);
            console.log(`Processing video: ${videoInfo.title} by ${videoInfo.author}`);

            // Create download streams with progress tracking
            const { videoStream, audioStream } = await this.streamManager.createStreams(
                url,
                options,
                (downloadProgress) => {
                    if (onProgress) {
                        onProgress({
                            state: 'downloading',
                            downloadProgress: downloadProgress.percentage
                        });
                    }
                }
            );

            // Once download is complete, switch to processing state
            if (onProgress) {
                onProgress({ state: 'processing' });
            }

            // Process the media with our MediaProcessor
            await this.mediaProcessor.processMedia(
                videoStream,
                audioStream,
                outputPath,
                {
                    videoCodec: options.videoCodec,
                    audioCodec: options.audioCodec,
                    outputFormat: options.outputFormat,
                    videoBitrate: options.videoBitrate,
                    audioBitrate: options.audioBitrate,
                    fps: options.fps
                }
            );

        } catch (error) {
            throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getVideoInfo(url: string) {
        return this.streamManager.getVideoInfo(url);
    }

    async getAvailableFormats(url: string) {
        return this.streamManager.getAvailableFormats(url);
    }
}