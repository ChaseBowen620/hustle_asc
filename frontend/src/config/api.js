// API URL for EC2 deployment
// Set VITE_API_URL environment variable or it defaults to EC2 IP
export const API_URL = import.meta.env.VITE_API_URL || 'http://52.8.4.183:8000'