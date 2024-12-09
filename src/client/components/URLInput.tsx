import React, { useState } from 'react';

interface URLInputProps {
    onURLSubmit: (url: string) => void;
}


const URLInput: React.FC<URLInputProps> = ({ onURLSubmit }) => {
    const [url, setUrl] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Basic YouTube URL validation
        if (!url.includes('youtube.com/') && !url.includes('youtu.be/')) {
            setError('Please enter a valid YouTube URL');
            return;
        }

        setError('');
        onURLSubmit(url);
    };

    return (
        <div className="max-w-xl mx-auto p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="youtube-url"
                        className="block text-sm font-medium mb-2"
                    >
                        Enter YouTube URL
                    </label>
                    <input
                        id="youtube-url"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                )}
                <button
                    type="submit"
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors"
                >
                    Download
                </button>
            </form>
        </div>
    );
};

export default URLInput;