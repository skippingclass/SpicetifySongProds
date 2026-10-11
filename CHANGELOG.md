# Changelog

## 1.1.1
- **Instant Auto-Detection:** Eliminated negative cache poisoning so songs are never permanently locked out from automatic searches.
- **Cache Sanitization:** Automatic startup cleanup of corrupted/empty cache entries from earlier versions.
- **Multi-Trigger Track Change:** Added listeners for `onplaypause`, DOM track title changes, and a 1-second heartbeat monitor ensuring track transitions are always caught immediately.
- **Cascade Genius Search:** 3-phase fallback search (clean title + artist, clean title only, full title) boosting automatic match success.
- **Zero-Latency Network Dispatch:** Removed artificial 1000ms throttling sleep and reduced debounce to 30ms for instant fetching.
- **Author Update:** Updated author metadata to `skippingclass`.

## 1.1.0
- **Tiered Storage Engine:** Added IndexedDB and Spicetify Marketplace database persistence with automatic self-healing synchronization so access tokens never reset across Spotify/Spicetify updates.
- **Embedded Token Fallback:** Added optional `DEFAULT_TOKEN` constant in script for permanent persistence even after full cache wipe.
- **Settings Backup & Restore:** Added 1-click clipboard export/import in Settings UI.
- **Unicode Smart Normalization:** Added full Unicode character support (`\p{L}`, `\p{N}`) and diacritics stripping (`À-ž`), fixing matching for Latin accents, Cyrillic, Ukrainian, and Asian scripts.
- **Multi-Artist & Collab Matching:** Full support for collaborations, featured artists, and split artist names.
- **Remaster & Bracket Filter Upgrade:** Refined bracket cleaning to avoid stripping legitimate track title words.
- **Genius Metadata Fallback:** Fallback inspection of `custom_performances` when `producer_artists` is empty on Genius.
- **Network & Throttling Fixes:** Fixed race condition when rapidly skipping tracks; guaranteed timeout clearing in `finally` block; removed broken abort retry loops; added specific HTTP 401/429 error messages.
- **DOM & UI Polish:** Added configurable placement (Above title / Between title and artist / Below artist), text ellipsis overflow protection, and hover tooltip (`title`) showing full producer list.
- **Cache Quota Safety:** Added try-catch and LRU half-eviction for `saveCache` to prevent `QuotaExceededError`.

## 1.0.0
- Initial stable release.
- Added localization (i18n) for English and Russian.
- Introduced strict matching (Levenshtein distance) to prevent false positives for track titles and artists.
- Added options for custom Proxy URL to avoid CORS errors with Genius API.
- Re-architected caching and throttling.
- Upgraded DOM resilience with fallback selectors and debounced observer.
- Fully implemented extension lifecycle management and cleanup.
- Refined Settings UI with new configurations (Enable, Language, Disable on Local files).
