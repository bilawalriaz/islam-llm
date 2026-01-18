import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'uk.hyperflash.quran',
    appName: 'Quran Reader',
    webDir: 'dist',
    server: {
        // Use the production backend URL
        url: 'https://quran.hyperflash.uk',
        cleartext: false
    },
    android: {
        // Allow mixed content for API calls if needed
        allowMixedContent: false,
    }
};

export default config;
