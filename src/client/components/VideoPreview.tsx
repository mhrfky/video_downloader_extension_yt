// VideoPreview.tsx
import React from 'react';

export interface VideoDetails {
    title: string;
    thumbnail: string;
    duration: string;
    author: string;
}

interface VideoPreviewProps {
    videoDetails: VideoDetails | null;
    isLoading: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ videoDetails, isLoading }) => {
    if (isLoading) {
        return <div className="text-center p-4">Loading video details...</div>;
    }

    if (!videoDetails) {
        return null;  // Don't show anything if no video details yet
    }
    //it is one video preview representation
    return (
        <div className="max-w-xl mx-auto p-4 border rounded-lg shadow-sm">
            <div className="space-y-4">
                <img
                    src={videoDetails.thumbnail}
                    alt={videoDetails.title}
                    className="w-full rounded-lg"
                />
                <h2 className="text-xl font-semibold">{videoDetails.title}</h2>
                <div className="flex justify-between text-gray-600">
                    <span>{videoDetails.author}</span>
                    <span>{videoDetails.duration}</span>
                </div>
            </div>
        </div>
    );
};

export default VideoPreview;