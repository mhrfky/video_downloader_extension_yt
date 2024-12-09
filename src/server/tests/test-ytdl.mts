import { testYouTubeDownloader } from '../utils/ytdl';

console.log('Starting YouTube Downloader tests...\n');

testYouTubeDownloader()
    .then(() => {
        console.log('\nAll tests completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\nTest failed:', error);
        process.exit(1);
    });