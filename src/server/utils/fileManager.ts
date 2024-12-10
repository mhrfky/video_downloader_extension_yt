import fs from 'fs';
import path from 'path';
import os from 'os';

// Separate interfaces for different types of paths to make their purposes clear
interface TemporaryPaths {
    tempDir: string;
    videoPath: string;
    audioPath: string;
}

interface ProcessingPaths extends TemporaryPaths {
    outputPath: string;
}
class CleanupError extends Error {
    public errors: Error[];

    constructor(errors: Error[]) {
        const message = `Multiple errors occurred during cleanup:\n${errors.map(e => `- ${e.message}`).join('\n')}`;
        super(message);
        this.name = 'CleanupError';
        this.errors = errors;
    }
}

export class FileManager {
    private readonly timestamp: number;
    private readonly baseTempDir: string;

    constructor(prefix: string = 'ytdownload') {
        this.timestamp = Date.now();
        this.baseTempDir = path.join(os.tmpdir(), `${prefix}_${this.timestamp}`);
    }

    /**
     * Creates and manages temporary working directory and files
     * @returns TemporaryPaths object containing paths for temporary processing
     * @throws Error if directory creation fails
     */
    async createTemporaryPaths(): Promise<TemporaryPaths> {
        try {
            // Create the temporary directory
            await fs.promises.mkdir(this.baseTempDir, { recursive: true });

            if (!fs.existsSync(this.baseTempDir)) {
                throw new Error(`Failed to create temporary directory: ${this.baseTempDir}`);
            }

            // Return only temporary paths
            return {
                tempDir: this.baseTempDir,
                videoPath: path.join(this.baseTempDir, `temp_video_${this.timestamp}.mp4`),
                audioPath: path.join(this.baseTempDir, `temp_audio_${this.timestamp}.aac`)
            };
        } catch (error) {
            throw new Error(`Failed to create temporary paths: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Prepares the output directory and combines it with temporary paths
     * @param outputPath Path where the final file should be saved
     * @param tempPaths Existing temporary paths
     * @returns ProcessingPaths object containing both temporary and output paths
     */
    async prepareOutputPath(outputPath: string, tempPaths: TemporaryPaths): Promise<ProcessingPaths> {
        try {
            // Ensure the output directory exists
            const outputDir = path.dirname(outputPath);
            await fs.promises.mkdir(outputDir, { recursive: true });

            // Combine temporary paths with output path
            return {
                ...tempPaths,
                outputPath
            };
        } catch (error) {
            throw new Error(`Failed to prepare output path: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Verifies existence of temporary processing files
     * @param paths TemporaryPaths object to verify
     * @throws Error if any temporary files are missing
     */
    async verifyTemporaryFiles(paths: TemporaryPaths): Promise<void> {
        const filesToCheck = [
            { path: paths.videoPath, name: 'Temporary video file' },
            { path: paths.audioPath, name: 'Temporary audio file' }
        ];

        for (const file of filesToCheck) {
            if (!fs.existsSync(file.path)) {
                throw new Error(`${file.name} not found at ${file.path}`);
            }
        }
    }

    /**
     * Verifies existence of the output file
     * @param outputPath Path to the output file
     * @throws Error if output file is missing
     */
    async verifyOutputFile(outputPath: string): Promise<void> {
        if (!fs.existsSync(outputPath)) {
            throw new Error(`Output file not found at ${outputPath}`);
        }
    }

    /**
     * Cleans up temporary files and directories, leaving output file intact
     * @param paths TemporaryPaths object containing paths to clean
     * @returns Promise that resolves when cleanup is complete
     */
    async cleanupTemporaryFiles(paths: TemporaryPaths): Promise<void> {
        const errors: Error[] = [];

        // Delete temporary files
        for (const filePath of [paths.videoPath, paths.audioPath]) {
            try {
                if (fs.existsSync(filePath)) {
                    await fs.promises.unlink(filePath);
                }
            } catch (error) {
                errors.push(new Error(`Failed to delete temporary file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        }

        // Remove temporary directory
        try {
            if (fs.existsSync(paths.tempDir)) {
                const dirContents = await fs.promises.readdir(paths.tempDir);

                if (dirContents.length > 0) {
                    await fs.promises.rm(paths.tempDir, { recursive: true, force: true });
                } else {
                    await fs.promises.rmdir(paths.tempDir);
                }
            }
        } catch (error) {
            errors.push(new Error(`Failed to remove temporary directory ${paths.tempDir}: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }

        if (errors.length > 0) {
            throw new CleanupError(errors);
        }
    }

    /**
     * Gets the size of a file in bytes
     * @param filePath Path to the file
     * @returns Promise resolving to file size in bytes
     */
    async getFileSize(filePath: string): Promise<number> {
        try {
            const stats = await fs.promises.stat(filePath);
            return stats.size;
        } catch (error) {
            throw new Error(`Failed to get file size for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Creates a write stream to a file
     * @param filePath Path to create the write stream for
     * @returns WriteStream
     */
    createWriteStream(filePath: string): fs.WriteStream {
        return fs.createWriteStream(filePath);
    }

    /**
     * Creates a read stream from a file
     * @param filePath Path to create the read stream from
     * @returns ReadStream
     */
    createReadStream(filePath: string): fs.ReadStream {
        return fs.createReadStream(filePath);
    }
}