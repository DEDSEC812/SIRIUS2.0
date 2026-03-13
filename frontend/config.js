// Configuration Supabase
const SUPABASE_CONFIG = {
    url: 'https://qijugwzvozshmzdyasjy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.vA6rAD9Eo1TCuGNQgI_Aw_dfZdvX3aF1U3qC5Y2n2OY'
};

// Configuration de l'application
const APP_CONFIG = {
    name: 'TDA NETWORK',
    version: '1.0.0',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    postsPerPage: 10,
    storiesExpiry: 24 * 60 * 60 * 1000, // 24 heures
    nameChangeCooldown: 72 * 60 * 60 * 1000 // 72 heures
};
