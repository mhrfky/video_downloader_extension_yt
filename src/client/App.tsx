import React, { useState } from 'react';
import URLInput from './components/URLInput';
import VideoPreview from './components/VideoPreview';
import DownloadProgress from './components/DownloadProgress';
import { VideoDetails, DownloadStatus } from '../shared/types';

const App: React.FC = () => {
    const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
    const [downloadProgress, setDownloadProgress] = useState<number>(0);

    const handleURLSubmit = async (url: string) => {
        setIsLoading(true);

        try {
            // Updated API endpoint path
            const response = await fetch('/api/video-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) throw new Error('Failed to fetch video info');

            const data = await response.json();
            setVideoDetails(data);
            startDownload();
        } catch (err) {
            console.error('Error fetching video info:', err);
            setVideoDetails(null);
        } finally {
            setIsLoading(false);
        }
    };

    const startDownload = () => {
        setDownloadStatus('downloading');
        setDownloadProgress(0);

        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setDownloadStatus('completed');
                    return 100;
                }
                return prev + 10;
            });
        }, 1000);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-8 text-center">
                YouTube Video Downloader
            </h1>

            <URLInput onURLSubmit={handleURLSubmit} />

            <VideoPreview
                videoDetails={videoDetails}
                isLoading={isLoading}
            />

            {downloadStatus !== 'idle' && (
                <DownloadProgress
                    progress={downloadProgress}
                    status={downloadStatus}
                />
            )}
        </div>
    );
};

export default App;