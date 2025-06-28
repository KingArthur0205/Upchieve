# Deployment Guide for Summit MOL Annotation System

## Overview

This guide documents the fixes made to enable the upload features (codebook and transcript) to work when deployed to the Internet, along with deployment requirements and configuration.

## Issues Fixed

### 1. **File System Operations**
**Problem**: The original code used local file system operations (`writeFile`, `mkdir`, `readdir`) which don't work in serverless/cloud deployment environments.

**Solution**: Implemented cloud storage integration with Google Cloud Storage as the primary storage mechanism, with local file system as fallback for development.

### 2. **Direct File Access**
**Problem**: Client-side code accessed files directly from the `/public` directory (e.g., `/t001/transcript.csv`) which doesn't work in cloud deployments.

**Solution**: Created API endpoints to serve files from either cloud storage or local file system:
- New API: `/api/transcript/[id]?file=filename` serves transcript-related files
- Updated all client-side fetch calls to use the new API

### 3. **Request Size Limits**
**Problem**: No configuration for handling large file uploads in production.

**Solution**: Added proper configuration in `next.config.ts` for file upload limits and CORS headers.

## Architecture Changes

### Cloud Storage Integration
- **Primary Storage**: Google Cloud Storage for production deployments
- **Fallback Storage**: Local file system for development
- **File Structure**: 
  ```
  bucket/
  ├── transcripts/
  │   ├── t001/
  │   │   ├── transcript.csv
  │   │   ├── speakers.json
  │   │   ├── content.json
  │   │   └── images.json
  │   └── t002/...
  └── feature-definitions/
      ├── MOL_Roles_Features.xlsx
      └── feature-definitions.json
  ```

### API Endpoints Modified
1. **Upload APIs**:
   - `/api/upload-transcript` - Now saves to cloud storage
   - `/api/upload-feature-definition` - Now saves to cloud storage
   - `/api/upload-image` - Existing cloud storage integration maintained

2. **Data Serving APIs**:
   - `/api/transcript/[id]` - New API to serve transcript files
   - `/api/list-transcripts` - Updated to read from cloud storage
   - `/api/get-feature-categories` - Updated to read from cloud storage

3. **Client-Side Changes**:
   - All direct file access (`/t001/file.csv`) replaced with API calls (`/api/transcript/t001?file=file.csv`)

## Deployment Requirements

### Environment Variables
Set these environment variables for cloud storage functionality:

```bash
GOOGLE_CREDENTIALS_BASE64=<base64-encoded-service-account-json>
GOOGLE_CLOUD_BUCKET_NAME=<your-bucket-name>
```

### Google Cloud Storage Setup
1. **Create a Google Cloud Project**
2. **Enable Cloud Storage API**
3. **Create a Storage Bucket**
4. **Create a Service Account** with Storage Object Admin permissions
5. **Download Service Account Key** (JSON file)
6. **Base64 Encode the JSON** and set as `GOOGLE_CREDENTIALS_BASE64`

### Platform-Specific Deployment

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add GOOGLE_CREDENTIALS_BASE64
vercel env add GOOGLE_CLOUD_BUCKET_NAME

# Deploy
vercel --prod
```

#### Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Set environment variables in Netlify dashboard or CLI
netlify env:set GOOGLE_CREDENTIALS_BASE64 "your-base64-encoded-credentials"
netlify env:set GOOGLE_CLOUD_BUCKET_NAME "your-bucket-name"

# Deploy
netlify deploy --prod
```

#### AWS/Azure/Other Cloud Platforms
- Ensure environment variables are set
- Configure build command: `npm run build`
- Configure start command: `npm start`
- Set Node.js runtime version to 18+

## Fallback Behavior

The system is designed with graceful fallbacks:

1. **Cloud Storage Available**: All uploads and file serving use Google Cloud Storage
2. **Cloud Storage Unavailable**: 
   - Development: Falls back to local file system
   - Production: Upload features will show warnings but won't crash the application

## Testing Deployment

### Local Testing with Cloud Storage
```bash
# Set environment variables in .env.local
GOOGLE_CREDENTIALS_BASE64=your-base64-credentials
GOOGLE_CLOUD_BUCKET_NAME=your-bucket-name

# Test build
npm run build

# Test production mode
npm start
```

### Verification Steps
1. **Upload a transcript**: Should save to cloud storage
2. **Upload a codebook**: Should save to cloud storage and clear annotations
3. **View transcript**: Should load data from cloud storage
4. **Check browser network tab**: All file requests should go through `/api/transcript/` endpoints

## Performance Considerations

- **Caching**: API responses include cache headers for better performance
- **File Size Limits**: 10MB limit for uploads configured in Next.js
- **Concurrent Uploads**: Google Cloud Storage handles concurrent operations efficiently

## Security Considerations

- **CORS**: Configured for API endpoints (adjust for production domains)
- **File Validation**: Upload APIs validate file types and sizes
- **Access Control**: Service account has minimal required permissions
- **Environment Variables**: Sensitive credentials stored as environment variables

## Troubleshooting

### Common Issues

1. **Upload fails with "Cloud storage not configured"**
   - Check `GOOGLE_CREDENTIALS_BASE64` and `GOOGLE_CLOUD_BUCKET_NAME` environment variables
   - Verify service account permissions

2. **Files not loading in transcript view**
   - Check browser console for API errors
   - Verify files exist in cloud storage bucket

3. **Build errors**
   - Ensure all dependencies are installed: `npm install`
   - Check TypeScript errors: `npm run lint`

### Debug Mode
Enable debug logging by adding:
```bash
NODE_ENV=development
```

This will show detailed console logs for cloud storage operations.

## Migration from Local Storage

If you have existing local transcript data, you can migrate it:

1. **Backup existing data**: Copy the `/public` directory
2. **Deploy new version** with cloud storage
3. **Re-upload transcripts** using the upload interface
4. **Re-upload codebooks** using the upload interface

## Monitoring

Monitor your deployment:
- **Google Cloud Console**: Check storage usage and API calls
- **Application Logs**: Monitor for upload/download errors
- **Performance**: Track API response times

## Support

For deployment issues:
1. Check the console logs for detailed error messages
2. Verify environment variables are correctly set
3. Test cloud storage connectivity independently
4. Review Google Cloud Storage permissions and quotas 