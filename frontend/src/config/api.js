// API URL for EC2 deployment
// Set VITE_API_URL environment variable or it defaults to domain
// Using nginx proxy on port 443 (HTTPS)
export const API_URL = import.meta.env.VITE_API_URL || 'https://hustledashboard.com'