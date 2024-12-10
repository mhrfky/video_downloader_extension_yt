import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { FileManager } from './fileManager.ts';

// We'll define interfaces for our processing options
interface ProcessingOptions {
    videoCodec?: string;
    audioCodec?: string;
    outputFormat?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    fps?: number;
}

// Interface for processing progress updates
interface ProcessingProgress {
    stage: 'video' | 'audio' | 'combining';
    percent: number;
    timemark?: string;
}

export class MediaProcessor {
    private fileManager: FileManager;

    constructor(fileManager: FileManager) {
        this.fileManager = fileManager;
        // We inject FileManager as a dependency to handle all file operations
    }

    /**
     * Processes a video stream with FFmpeg
     * This method handles video-specific processing tasks
     */
    async processVideoStream(
        videoStream: Readable,
        outputPath: string,
        options: ProcessingOptions = {},
        onProgress?: (progress: ProcessingProgress) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const command = ffmpeg(videoStream)
                .videoCodec(options.videoCodec || 'copy')
                .videoBitrate(options.videoBitrate || '1000k')
                .fps(options.fps || 30);

            if (onProgress) {
                command.on('progress', (progress) => {
                    onProgress({
                        stage: 'video',
                        percent: progress.percent || 0,
                        timemark: progress.timemark
                    });
                });
            }

            command
                .on('end', () => {
                    console.log('Video processing completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error processing video:', err);
                    reject(new Error(`Video processing failed: ${err.message}`));
                })
                .save(outputPath);
        });
    }

    /**
     * Processes an audio stream with FFmpeg
     * Handles audio-specific processing and encoding
     */
    async processAudioStream(
        audioStream: Readable,
        outputPath: string,
        options: ProcessingOptions = {},
        onProgress?: (progress: ProcessingProgress) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const command = ffmpeg(audioStream)
                .audioCodec(options.audioCodec || 'aac')
                .audioBitrate(options.audioBitrate || '128k');

            if (onProgress) {
                command.on('progress', (progress) => {
                    onProgress({
                        stage: 'audio',
                        percent: progress.percent || 0,
                        timemark: progress.timemark
                    });
                });
            }

            command
                .on('end', () => {
                    console.log('Audio processing completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error processing audio:', err);
                    reject(new Error(`Audio processing failed: ${err.message}`));
                })
                .save(outputPath);
        });
    }

    /**
     * Combines processed video and audio files into a single output file
     * This is the final step in our processing pipeline
     */
    async combineStreams(
        videoPath: string,
        audioPath: string,
        outputPath: string,
        options: ProcessingOptions = {},
        onProgress?: (progress: ProcessingProgress) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const command = ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .outputOptions('-c:v copy')  // Copy video without re-encoding
                .outputOptions('-c:a copy')  // Copy audio without re-encoding
                .format(options.outputFormat || 'matroska');

            if (onProgress) {
                command.on('progress', (progress) => {
                    onProgress({
                        stage: 'combining',
                        percent: progress.percent || 0,
                        timemark: progress.timemark
                    });
                });
            }

            command
                .on('start', (commandLine) => {
                    console.log('Started FFmpeg with command:', commandLine);
                })
                .on('end', () => {
                    console.log('Combining streams completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error combining streams:', err);
                    reject(new Error(`Stream combination failed: ${err.message}`));
                })
                .save(outputPath);
        });
    }

    /**
     * Main processing pipeline that handles the entire workflow
     * This method orchestrates the complete process from streams to final output
     */
    async processMedia(
        videoStream: Readable,
        audioStream: Readable,
        finalOutputPath: string,
        options: ProcessingOptions = {},
        onProgress?: (progress: ProcessingProgress) => void
    ): Promise<void> {
        // Create temporary paths for intermediate files
        const tempPaths = await this.fileManager.createTemporaryPaths();

        try {
            // Process video and audio streams in parallel
            await Promise.all([
                this.processVideoStream(
                    videoStream,
                    tempPaths.videoPath,
                    options,
                    onProgress
                ),
                this.processAudioStream(
                    audioStream,
                    tempPaths.audioPath,
                    options,
                    onProgress
                )
            ]);

            // Verify temporary files were created successfully
            await this.fileManager.verifyTemporaryFiles(tempPaths);

            // Combine processed streams into final output
            await this.combineStreams(
                tempPaths.videoPath,
                tempPaths.audioPath,
                finalOutputPath,
                options,
                onProgress
            );

            // Verify final output file exists
            await this.fileManager.verifyOutputFile(finalOutputPath);

        } catch (error) {
            // If anything fails, ensure we clean up temporary files
            await this.fileManager.cleanupTemporaryFiles(tempPaths);
            throw error;
        }

        // Clean up temporary files after successful processing
        await this.fileManager.cleanupTemporaryFiles(tempPaths);
    }
}