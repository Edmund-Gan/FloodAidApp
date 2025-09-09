# Environment Setup for FloodAid App

This guide explains how to set up environment variables for the FloodAid app to protect API keys and other sensitive configuration.

## Quick Setup

1. **Copy the environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local` with your actual API keys**:
   ```bash
   # Open in your favorite editor
   nano .env.local
   # or
   code .env.local
   ```

3. **Get your Google Maps API Key**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Maps API services
   - Create credentials (API Key)
   - Replace `your_google_maps_api_key_here` with your actual key

4. **Run the app**:
   ```bash
   npm start
   ```

## Environment Variables

### Required Variables

- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key for geocoding and map services

### Optional Variables

- `OPEN_METEO_API_URL`: Open Meteo API endpoint (defaults to https://api.open-meteo.com/v1)
- `NODE_ENV`: Environment mode (development/production)

## File Structure

```
FloodAidApp/
├── .env.example          # Template for environment variables (committed)
├── .env.local           # Your actual environment variables (NOT committed)
├── app.config.js        # Expo configuration using environment variables
└── ENVIRONMENT_SETUP.md # This documentation
```

## Security Best Practices

### API Key Restrictions (Google Cloud Console)

1. **Application Restrictions**:
   - Android: Restrict to package name `com.floodaid.malaysia`
   - iOS: Restrict to bundle ID `com.floodaid.malaysia`

2. **API Restrictions**:
   - Enable only required APIs:
     - Maps SDK for Android/iOS
     - Geocoding API
     - Places API (if using places search)

3. **HTTP Referrer Restrictions** (for web builds):
   - Add your domain to allowed referrers

### Rate Limiting

The app includes built-in rate limiting and caching to minimize API usage:
- Location requests are cached for 30 minutes
- Geocoding results are cached
- Search requests are debounced (300ms delay)

## Troubleshooting

### "API key not configured" errors

1. Verify `.env.local` exists and contains your API key
2. Restart the Expo development server (`npm start`)
3. Clear Metro cache: `npx expo r -c`

### Build errors

1. Ensure `app.config.js` is properly configured
2. Check that environment variables are properly imported
3. Verify dotenv is installed: `npm install dotenv`

### Git issues

If you accidentally committed your API key:
1. Remove it from the files immediately
2. Add the files to `.gitignore`
3. Consider regenerating the API key in Google Cloud Console
4. Use `git filter-branch` to remove from git history (advanced)

## Development vs Production

- **Development**: Use `.env.local` for local development
- **Production**: Configure environment variables in your deployment platform
- **Team sharing**: Only share `.env.example`, never `.env.local`

## Team Setup

When new team members join:
1. They copy `.env.example` to `.env.local`
2. They get their own Google Maps API key
3. They configure the key with same restrictions
4. They never commit `.env.local` to version control

## Support

If you encounter issues with environment setup:
1. Check that all required packages are installed
2. Verify file permissions on `.env.local`
3. Ensure your API key has correct permissions in Google Cloud Console
4. Check Expo documentation for additional troubleshooting