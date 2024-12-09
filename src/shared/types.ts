export interface VideoDetails {
    title: string;
    thumbnail: string;
    duration: string;
    author: string;
}

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error';

export interface VideoInfoResponse {
    videoDetails: VideoDetails;
}

export interface DownloadProgressResponse {
    progress: number;
    status: DownloadStatus;
}

export interface VideoDetails {
    title: string;
    thumbnail: string;
    duration: string;
    author: string;
}

export interface VideoFormat {
    itag: number;
    quality: string;
    hasAudio: boolean;
    hasVideo: boolean;
    container: string;
    contentLength: string;
}

export interface DownloadOptions {
    quality?: 'highest' | 'lowest' | string;
    filter?: 'audioandvideo' | 'videoonly' | 'audioonly';
}

export interface DownloadProgress {
    downloadedBytes: number;
    totalBytes: number;
    percentage: number;
}

