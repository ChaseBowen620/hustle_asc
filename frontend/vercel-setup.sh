#!/bin/bash

# Quick setup script for Vercel deployment
# This script helps prepare the frontend for Vercel deployment

echo "🚀 Vercel Deployment Setup"
echo "=========================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
else
    echo "✅ Vercel CLI is already installed"
fi

echo ""
echo "📋 Next steps:"
echo "1. Make sure your code is pushed to GitHub/GitLab/Bitbucket"
echo "2. Go to https://vercel.com/new and import your repository"
echo "3. Set Root Directory to 'frontend' (if frontend is in a subdirectory)"
echo "4. Add environment variable: VITE_API_URL=http://52.8.4.183:8000"
echo "5. Deploy!"
echo ""
echo "Or use the CLI:"
echo "  cd frontend"
echo "  vercel"
echo "  vercel --prod  # for production"
echo ""
echo "📖 See VERCEL_DEPLOYMENT.md for detailed instructions"

