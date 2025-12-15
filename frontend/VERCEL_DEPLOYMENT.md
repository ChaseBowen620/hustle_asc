# Vercel Deployment Guide

This guide will help you deploy the Hustle ASC frontend to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. The Vercel CLI installed (optional, for CLI deployment)
3. Your backend API URL

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub/GitLab/Bitbucket**
   - Make sure your frontend code is in a Git repository
   - The frontend directory should be at the root or in a subdirectory

2. **Import Project to Vercel**
   - Go to https://vercel.com/new
   - Import your Git repository
   - If your frontend is in a subdirectory, set the **Root Directory** to `frontend`

3. **Configure Build Settings**
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (should auto-detect)
   - **Output Directory**: `dist` (should auto-detect)
   - **Install Command**: `npm install` (should auto-detect)

4. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add the following variable:
     - **Name**: `VITE_API_URL`
     - **Value**: `http://52.8.4.183:8000` (or your backend URL)
   - Make sure to add it for all environments (Production, Preview, Development)

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked for environment variables, add `VITE_API_URL=http://52.8.4.183:8000`

5. **For production deployment**
   ```bash
   vercel --prod
   ```

## Environment Variables

Make sure to set the following environment variable in Vercel:

- `VITE_API_URL`: Your backend API URL (e.g., `http://52.8.4.183:8000`)

**Important**: In Vercel, environment variables starting with `VITE_` are automatically exposed to the frontend build.

## Updating Backend CORS Settings

After deploying to Vercel, you'll need to update your backend CORS settings to allow your Vercel domain:

1. Go to your backend `settings.py`
2. Add your Vercel domain to `CORS_ALLOWED_ORIGINS`:
   ```python
   CORS_ALLOWED_ORIGINS = [
       "http://localhost:5173",
       "http://52.8.4.183",
       "https://your-project.vercel.app",  # Add your Vercel URL here
       "https://your-project-*.vercel.app",  # For preview deployments
   ]
   ```

   Or use a wildcard pattern:
   ```python
   CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://52.8.4.183,https://*.vercel.app').split(',')
   ```

3. Restart your backend service:
   ```bash
   sudo systemctl restart hustle-backend.service
   ```

## Custom Domain (Optional)

If you want to use a custom domain:

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow the DNS configuration instructions
5. Update your backend CORS settings to include the custom domain

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure Node.js version is compatible (Vercel uses Node 18.x by default)
- Check build logs in Vercel dashboard

### API Calls Fail
- Verify `VITE_API_URL` is set correctly in Vercel environment variables
- Check backend CORS settings include your Vercel domain
- Ensure backend is accessible from the internet

### Routing Issues
- The `vercel.json` file includes a rewrite rule for SPA routing
- All routes should redirect to `index.html` for client-side routing

## Continuous Deployment

Vercel automatically deploys when you push to your Git repository:
- **Production**: Deploys from your main/master branch
- **Preview**: Creates preview deployments for pull requests

Each deployment gets a unique URL, so you can test changes before merging.

