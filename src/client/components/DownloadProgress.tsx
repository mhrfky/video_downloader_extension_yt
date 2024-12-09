import React from 'react';

interface ProgressBarProps {
    value: number;
    className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ value, className = '' }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
            className={`h-2.5 rounded-full ${className || 'bg-blue-600'}`}
            style={{ width: `${value}%` }}
        />
    </div>
);

interface DownloadProgressProps {
    progress: number;
    status: 'idle' | 'downloading' | 'completed' | 'error';
    errorMessage?: string;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({
                                                               progress,
                                                               status,
                                                               errorMessage
                                                           }) => {
    const getStatusMessage = () => {
        switch (status) {
            case 'idle':
                return 'Ready to download';
            case 'downloading':
                return `Downloading: ${progress}%`;
            case 'completed':
                return 'Download completed';
            case 'error':
                return errorMessage || 'Download failed';
            default:
                return '';
        }
    };

    const getProgressBarColor = () => {
        switch (status) {
            case 'completed':
                return 'bg-green-600';
            case 'error':
                return 'bg-red-600';
            default:
                return 'bg-blue-600';
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto mt-4 p-4 border rounded-lg shadow-sm">
            <div className="space-y-4">
                <div className="flex justify-between items-center">
          <span className="font-medium">
            {getStatusMessage()}
          </span>
                    {status === 'downloading' && (
                        <span className="text-sm text-gray-500">
              {progress}%
            </span>
                    )}
                </div>

                <ProgressBar
                    value={progress}
                    className={getProgressBarColor()}
                />
            </div>
        </div>
    );
};

export default DownloadProgress;