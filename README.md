# Genius Producers

Shows track producers above the song title in the Spotify player using the Genius API. The extension uses strict title/artist matching to avoid displaying incorrect credits for remixed, live, or similarly named tracks.

![Genius Producers Preview](assets/preview.gif)

## Installation

### Via Spicetify Marketplace
*Once published:*
1. Open Spicetify Marketplace.
2. Search for `Genius Producers`.
3. Click Install.

### Manual Installation
1. Download `genius-producers.js`.
2. Place it in your Spicetify `Extensions` folder.
3. Run the following commands:
   ```bash
   spicetify config extensions genius-producers.js
   spicetify apply
   ```

## How to get a Genius API Access Token
To use this extension, you need a free Genius API Access Token:
1. Go to [https://genius.com/api-clients](https://genius.com/api-clients) and log in.
2. Click "New API Client".
3. Fill in any App Name and App Website URL (e.g. `https://example.com`), then save.
4. Click "Generate Access Token".
5. Copy the generated token and paste it into the "Genius API Access Token" field in the extension's settings.

## Extension Settings
You can access the settings by clicking your profile picture and selecting **Genius Producers Settings**.
- **Enable Extension:** Toggle the extension on or off.
- **Disable on local files:** By default, the extension won't search for local files to avoid inaccurate matches. You can toggle this on or off.
- **Position in Player:** Choose where to display producer credits:
  - *Between title & artist* (Default)
  - *Above track title*
  - *Below artist name*
- **Language:** Choose between English and Russian (or Auto).
- **Genius API Access Token:** Paste your token here. The extension utilizes a multi-tiered storage engine (IndexedDB + Spicetify Marketplace DB + LocalStorage) to keep your token safe across Spotify and Spicetify updates.
- **Copy Backup / Restore Backup:** Export or restore your settings in one click.
- **Proxy URL (Optional):** If your network or ISP restricts access to `genius.com`, provide a custom proxy URL.

### Permanent Token Fallback (Optional)
If you want to ensure your token is NEVER lost under any circumstances (even after formatting or wiping all browser cache):
Open `genius-producers.js` and set your token in the `DEFAULT_TOKEN` constant near the top:
```javascript
const DEFAULT_TOKEN = "your_token_here";
```
The extension will automatically restore it into all storage tiers upon launch.

## Features
- **Strict & Smart Matching:** High accuracy matching with Unicode support for Latin accents, Cyrillic, and Asian scripts.
- **Multi-Artist Support:** Handles collaborations, featured artists, and split artist names automatically.
- **Self-Healing Storage:** Token and preferences are automatically synced across IndexedDB and LocalStorage.
- **Responsive Layout:** Text ellipsis truncation with full hover tooltips prevents overflowing Spotify's player bar.

## Known Limitations
- **Content Types:** Does not work for podcasts or ads.
- **Genius Data:** The extension relies on Genius. If producers are missing on Genius, they won't appear in Spotify.

## Troubleshooting
- **Nothing is showing up:** 
  - Ensure your Genius Access Token is correct.
  - Check if the track has producers listed on Genius and if the title matches exactly.
  - If you are trying to view a podcast or an ad, it will be ignored.
- **Network / CORS Errors:** Try using a proxy URL in the settings.

## License
See [LICENSE](LICENSE) for more information.
