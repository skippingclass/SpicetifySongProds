// NAME: Genius Producers
// AUTHOR: pirkov
// DESCRIPTION: Shows track producers in the Spotify player using the Genius API
// VERSION: 1.1.0

(function GeniusProducers() {
    if (!Spicetify.Player || !Spicetify.Platform || !Spicetify.Menu || !Spicetify.PopupModal || !Spicetify.showNotification || !Spicetify.LocalStorage) {
        setTimeout(GeniusProducers, 100);
        return;
    }

    if (window.__geniusProducersLoaded) {
        console.log("[GeniusProducers] Already loaded, skipping re-init");
        return;
    }
    window.__geniusProducersLoaded = true;

    // --- OPTIONAL EMBEDDED FALLBACK TOKEN ---
    // If you want your token to NEVER be lost under any circumstances (even full browser data wipe),
    // you can paste it between the quotes below. The extension will automatically restore it into storage!
    const DEFAULT_TOKEN = "";

    // --- STRINGS (i18n) ---
    const STRINGS = {
        en: {
            noTitleOrArtist: "Missing track title or artist",
            needToken: "Please set your Genius Access Token in settings (Genius Producers Settings).",
            tokenAuthError: "Invalid Genius API Token (401). Please check your token in settings.",
            rateLimitError: "Genius API rate limit reached (429). Please wait a moment.",
            searchError: (code) => `Search error: ${code}`,
            trackNotFound: (q) => `Track not found on Genius: ${q}`,
            noProducers: "Genius has no producer credits for this track",
            networkError: (msg) => `Network error: ${msg}`,
            settingsTitle: "Genius Producers Settings",
            tokenLabel: "Genius API Access Token",
            tokenPlaceholder: "Enter your Genius API Access Token...",
            proxyLabel: "Proxy URL (Optional)",
            proxyPlaceholder: "https://your-proxy.com",
            enableLabel: "Enable Extension",
            disableLocalLabel: "Disable on local files",
            placementLabel: "Position in Player",
            placementAbove: "Above track title",
            placementBetween: "Between title & artist (Default)",
            placementBelow: "Below artist name",
            langLabel: "Language",
            testButton: "Test Search (Manual)",
            saveButton: "Save",
            settingsSaved: "Settings saved & synced!",
            exportButton: "Copy Backup",
            importButton: "Restore Backup",
            backupCopied: "Settings copied to clipboard!",
            backupRestored: "Settings successfully restored!",
            invalidBackup: "Invalid backup format.",
            searching: (title) => `Searching producers for ${title}...`,
            noTrackPlaying: "No track playing or data not found.",
            tokenInvalid: "Invalid Token format (must not contain spaces)",
            tokenValid: "Token format valid",
            testNoMatch: "Genius has no match for this track",
            songDetailsError: (code) => `Song details error: ${code}`
        },
        ru: {
            noTitleOrArtist: "Нет названия или артиста",
            needToken: "Пожалуйста, укажите Genius Access Token в настройках (Genius Producers Settings).",
            tokenAuthError: "Неверный Genius API Token (401). Проверьте токен в настройках.",
            rateLimitError: "Превышен лимит запросов к Genius API (429). Подождите немного.",
            searchError: (code) => `Ошибка поиска: ${code}`,
            trackNotFound: (q) => `Трек не найден на Genius: ${q}`,
            noProducers: "На Genius у этого трека не указаны продюсеры",
            networkError: (msg) => `Сетевая ошибка: ${msg}`,
            settingsTitle: "Настройки Genius Producers",
            tokenLabel: "Genius API Access Token",
            tokenPlaceholder: "Введите ваш Genius API Access Token...",
            proxyLabel: "URL Прокси (Опционально)",
            proxyPlaceholder: "https://your-proxy.com",
            enableLabel: "Включить расширение",
            disableLocalLabel: "Отключить для локальных файлов",
            placementLabel: "Позиция в плеере",
            placementAbove: "Над названием трека",
            placementBetween: "Между названием и артистом (по умолчанию)",
            placementBelow: "Под именем артиста",
            langLabel: "Язык",
            testButton: "Тестовый поиск (вручную)",
            saveButton: "Сохранить",
            settingsSaved: "Настройки сохранены и синхронизированы!",
            exportButton: "Скопировать бэкап",
            importButton: "Восстановить бэкап",
            backupCopied: "Бэкап скопирован в буфер обмена!",
            backupRestored: "Настройки успешно восстановлены!",
            invalidBackup: "Неверный формат бэкапа.",
            searching: (title) => `Ищем продюсеров для ${title}...`,
            noTrackPlaying: "Трек не играет или данные не найдены.",
            tokenInvalid: "Неверный токен (не должен содержать пробелов)",
            tokenValid: "Формат токена корректен",
            testNoMatch: "На Genius нет точного совпадения для этого трека",
            songDetailsError: (code) => `Ошибка деталей трека: ${code}`
        }
    };

    function getLang() {
        let lang = Spicetify.LocalStorage.get("genius_producers_lang") || "auto";
        if (lang === "auto") {
            const sysLang = (Spicetify.Locale?.getLocale?.() || navigator.language).substring(0, 2).toLowerCase();
            return STRINGS[sysLang] ? sysLang : "en";
        }
        return STRINGS[lang] ? lang : "en";
    }

    function _(key, ...args) {
        const lang = getLang();
        const val = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS["en"][key];
        return typeof val === "function" ? val(...args) : val;
    }

    // --- TIERED STORAGE ENGINE (IndexedDB + Marketplace DB + LocalStorage + Self-Healing) ---
    const DB_NAME = "genius_producers_db";
    const DB_STORE = "settings";
    const DB_VERSION = 1;

    function openDB() {
        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(null);
            try {
                const req = window.indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(DB_STORE)) {
                        db.createObjectStore(DB_STORE, { keyPath: "key" });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
                req.onblocked = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    async function idbGet(key) {
        const db = await openDB();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(DB_STORE, "readonly");
                const store = tx.objectStore(DB_STORE);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result ? req.result.value : null);
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    async function idbSet(key, value) {
        const db = await openDB();
        if (!db) return false;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(DB_STORE, "readwrite");
                const store = tx.objectStore(DB_STORE);
                const req = store.put({ key, value });
                req.onsuccess = () => resolve(true);
                req.onerror = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    async function marketplaceIdbGet(key) {
        if (!window.indexedDB) return null;
        return new Promise((resolve) => {
            try {
                const req = window.indexedDB.open("spicetify-marketplace", 1);
                req.onsuccess = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains("settings")) return resolve(null);
                    try {
                        const tx = db.transaction("settings", "readonly");
                        const storeReq = tx.objectStore("settings").get("marketplace:" + key);
                        storeReq.onsuccess = () => resolve(storeReq.result ? storeReq.result.value : null);
                        storeReq.onerror = () => resolve(null);
                    } catch {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    async function marketplaceIdbSet(key, value) {
        if (!window.indexedDB) return;
        try {
            const req = window.indexedDB.open("spicetify-marketplace", 1);
            req.onsuccess = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains("settings")) return;
                try {
                    const tx = db.transaction("settings", "readwrite");
                    tx.objectStore("settings").put({ key: "marketplace:" + key, value });
                } catch {}
            };
        } catch {}
    }

    const CONFIG_KEYS = [
        "genius_producers_token",
        "genius_producers_proxy",
        "genius_producers_lang",
        "genius_producers_enabled",
        "genius_producers_disable_local",
        "genius_producers_placement"
    ];

    // Self-healing synchronization across all storage layers
    async function initAndSyncConfig() {
        for (const key of CONFIG_KEYS) {
            let val = Spicetify.LocalStorage.get(key);
            
            // If missing in LocalStorage, check dedicated IndexedDB
            if (!val && val !== "") {
                val = await idbGet(key);
            }
            // If missing, check Marketplace IndexedDB
            if (!val && val !== "") {
                val = await marketplaceIdbGet(key);
            }
            // Fallback for token if user supplied DEFAULT_TOKEN in script
            if (key === "genius_producers_token" && (!val || !val.trim()) && DEFAULT_TOKEN && DEFAULT_TOKEN.trim()) {
                val = DEFAULT_TOKEN.trim();
            }

            if (val !== null && val !== undefined) {
                // Replicate to all tiers
                try { Spicetify.LocalStorage.set(key, val); } catch {}
                idbSet(key, val);
                marketplaceIdbSet(key, val);
            }
        }
    }

    function saveAllConfig(config) {
        for (const [key, value] of Object.entries(config)) {
            try { Spicetify.LocalStorage.set(key, value); } catch {}
            idbSet(key, value);
            marketplaceIdbSet(key, value);
        }
    }

    // Initialize tiered storage
    initAndSyncConfig().catch(e => console.warn("[GeniusProducers] Config sync warning:", e));

    // --- CONFIG & STATE ---
    const TITLE_SELECTORS = [
        '.main-trackInfo-name',
        '[data-testid="context-item-info-title"]',
        '[data-testid="nowplaying-track-link"]'
    ];

    let currentSongUri = null;
    let currentProducersText = "";
    let activeAbortController = null;
    let lastRequestTime = 0;

    // --- CACHING WITH QUOTA SAFETY ---
    const CACHE_KEY = "genius_producers_cache";
    const MAX_CACHE_SIZE = 300;
    const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
    const NEGATIVE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

    function getCache() {
        try {
            return JSON.parse(Spicetify.LocalStorage.get(CACHE_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function saveCache(cache) {
        try {
            Spicetify.LocalStorage.set(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
            console.warn("[GeniusProducers] Cache storage quota reached, evicting oldest half:", e);
            try {
                const keys = Object.keys(cache);
                keys.sort((a, b) => cache[a].ts - cache[b].ts);
                const half = Math.floor(keys.length / 2);
                for (let i = 0; i < half; i++) {
                    delete cache[keys[i]];
                }
                Spicetify.LocalStorage.set(CACHE_KEY, JSON.stringify(cache));
            } catch {}
        }
    }

    function getFromCache(uri) {
        const cache = getCache();
        const entry = cache[uri];
        if (entry) {
            const ttl = entry.negative ? NEGATIVE_CACHE_TTL : CACHE_TTL;
            if ((Date.now() - entry.ts) < ttl) {
                return entry.text;
            } else {
                delete cache[uri];
                saveCache(cache);
            }
        }
        return null;
    }

    function setToCache(uri, text) {
        const cache = getCache();
        cache[uri] = { text, ts: Date.now(), negative: !text };
        
        const keys = Object.keys(cache);
        if (keys.length > MAX_CACHE_SIZE) {
            keys.sort((a, b) => cache[a].ts - cache[b].ts);
            for (let i = 0; i < keys.length - MAX_CACHE_SIZE; i++) {
                delete cache[keys[i]];
            }
        }
        saveCache(cache);
    }

    // --- STRING NORMALIZATION & MATCHING ---
    function levenshtein(a, b) {
        if (a.length === 0) return b.length; 
        if (b.length === 0) return a.length; 
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[b.length][a.length];
    }

    function normalizeString(str) {
        if (!str) return "";
        // Normalize Latin accented characters (é -> e, ü -> u, ñ -> n) while preserving Cyrillic (й, ё), Asian, etc.
        let s = str.replace(/[À-ž]/g, c => c.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
        // Keep letters and numbers in any language Unicode (\p{L}, \p{N})
        return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    }

    function cleanBrackets(str) {
        if (!str) return "";
        let s = str;
        // Strip featuring tags
        s = s.replace(/[\(\[]\s*(?:feat\.?|ft\.?|with)\s+[^()\[\]]+[\)\]]/gi, "");
        // Strip remaster, live, acoustic, instrumental tags without destroying original titles
        s = s.replace(/[\(\[]\s*(?:(?:\d{4}\s+)?remaster(?:ed)?(?:\s*\d+)?|live|acoustic|instrumental|deluxe(?:\s*edition)?|bonus\s*track|anniversary(?:\s*edition)?|radio\s*edit|extended\s*mix|mono|stereo)[^()\[\]]*[\)\]]/gi, "");
        s = s.replace(/\s*-\s*(?:(?:\d{4}\s+)?remaster(?:ed)?(?:\s*\d+)?|live|acoustic|instrumental|deluxe|bonus|single\s*version|radio\s*edit).*$/gi, "");
        return s.trim();
    }

    function parseSpotifyArtists(item) {
        const list = [];
        if (item.artists && Array.isArray(item.artists)) {
            for (const a of item.artists) {
                if (a.name) list.push(a.name.trim());
            }
        }
        const metaArtist = item.metadata?.artist_name;
        if (metaArtist) {
            const parts = metaArtist.split(/[,;&]|\s+(?:feat\.?|ft\.?|with)\s+/i);
            for (const p of parts) {
                const trimmed = p.trim();
                if (trimmed && !list.includes(trimmed)) {
                    list.push(trimmed);
                }
            }
        }
        return list.length > 0 ? list : [metaArtist || ""];
    }

    function isMatchingResult(candidate, title, rawArtist, spotifyArtists = []) {
        const origNormTitle = normalizeString(title);
        const cleanNormTitle = normalizeString(cleanBrackets(title));
        const candNormTitle = normalizeString(candidate.title);
        const candCleanNormTitle = normalizeString(cleanBrackets(candidate.title));

        // 1. Title match
        const titleDist = Math.min(
            levenshtein(cleanNormTitle, candCleanNormTitle),
            levenshtein(cleanNormTitle, candNormTitle),
            levenshtein(origNormTitle, candNormTitle)
        );
        const titleLen = Math.max(1, Math.min(cleanNormTitle.length, candCleanNormTitle.length));
        const titleThreshold = Math.max(2, titleLen * 0.25);
        const isTitleMatch = titleDist <= titleThreshold || 
                             candCleanNormTitle.includes(cleanNormTitle) || 
                             cleanNormTitle.includes(candCleanNormTitle);

        if (!isTitleMatch) return false;

        // Remix guard
        const titleHasRemix = /\bremix\b/i.test(title);
        const candHasRemix = /\bremix\b/i.test(candidate.title);
        if (titleHasRemix !== candHasRemix) return false;

        // 2. Artist match (supports multi-artist collabs and featured artists)
        const candidateArtists = [];
        if (candidate.primary_artist?.name) candidateArtists.push(candidate.primary_artist.name);
        if (Array.isArray(candidate.featured_artists)) {
            for (const fa of candidate.featured_artists) {
                if (fa.name) candidateArtists.push(fa.name);
            }
        }

        const testArtists = spotifyArtists.length > 0 ? spotifyArtists : [rawArtist];
        for (const candArt of candidateArtists) {
            const normCand = normalizeString(candArt);
            for (const spotArt of testArtists) {
                const normSpot = normalizeString(spotArt);
                if (!normCand || !normSpot) continue;

                const artDist = levenshtein(normCand, normSpot);
                const maxDist = Math.max(2, Math.min(normCand.length, normSpot.length) * 0.3);
                if (artDist <= maxDist || normCand.includes(normSpot) || normSpot.includes(normCand)) {
                    return true;
                }
            }
        }

        return false;
    }

    // --- FETCHING WITH ROBUST TIMEOUT & CANCELLATION ---
    async function fetchProducers(title, rawArtist, spotifyArtists = [], isManual = false) {
        if (!title || !rawArtist) return { text: "", error: _("noTitleOrArtist") };

        const token = (Spicetify.LocalStorage.get("genius_producers_token") || DEFAULT_TOKEN || "").trim();
        if (!token) return { text: "", error: _("needToken") };

        const proxyUrl = (Spicetify.LocalStorage.get("genius_producers_proxy") || "").trim();

        // Cancel any in-flight request immediately BEFORE throttle wait
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }

        // Throttling: min 1 sec between requests
        const now = Date.now();
        if (!isManual && now - lastRequestTime < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - (now - lastRequestTime)));
        }
        lastRequestTime = Date.now();

        activeAbortController = new AbortController();
        const signal = activeAbortController.signal;

        let cleanTitle = cleanBrackets(title);
        const primaryArtist = spotifyArtists[0] || rawArtist;
        const query = encodeURIComponent(`${cleanTitle} ${primaryArtist}`);

        let timeoutId = null;
        try {
            timeoutId = setTimeout(() => {
                if (activeAbortController) activeAbortController.abort();
            }, 10000); // 10s timeout
            
            let searchReqUrl = `https://api.genius.com/search?q=${query}&access_token=${token}`;
            let fetchOpts = { signal };

            if (proxyUrl) {
                searchReqUrl = `${proxyUrl}/search?q=${query}`;
                fetchOpts.headers = { "Authorization": `Bearer ${token}` };
            }

            const searchRes = await fetch(searchReqUrl, fetchOpts);
            if (!searchRes.ok) {
                if (searchRes.status === 401) return { text: "", error: _("tokenAuthError") };
                if (searchRes.status === 429) return { text: "", error: _("rateLimitError") };
                return { text: "", error: _("searchError", searchRes.status) };
            }

            const searchData = await searchRes.json();
            
            let matchedHit = null;
            if (searchData.response?.hits) {
                for (let i = 0; i < Math.min(6, searchData.response.hits.length); i++) {
                    const hit = searchData.response.hits[i].result;
                    if (isMatchingResult(hit, title, rawArtist, spotifyArtists)) {
                        matchedHit = hit;
                        break;
                    }
                }
            }

            if (!matchedHit) {
                return { text: "", error: isManual ? _("testNoMatch") : "" };
            }

            const songId = matchedHit.id;
            let songReqUrl = `https://api.genius.com/songs/${songId}?access_token=${token}`;
            if (proxyUrl) {
                songReqUrl = `${proxyUrl}/songs/${songId}`;
            }

            const songRes = await fetch(songReqUrl, fetchOpts);
            if (!songRes.ok) {
                if (songRes.status === 401) return { text: "", error: _("tokenAuthError") };
                if (songRes.status === 429) return { text: "", error: _("rateLimitError") };
                return { text: "", error: _("songDetailsError", songRes.status) };
            }

            const songData = await songRes.json();
            const song = songData.response?.song;
            const producerList = [];

            // Primary: producer_artists
            if (song?.producer_artists && Array.isArray(song.producer_artists)) {
                for (const p of song.producer_artists) {
                    if (p.name && !producerList.includes(p.name.trim())) {
                        producerList.push(p.name.trim());
                    }
                }
            }

            // Fallback: custom_performances (e.g. Producers, Produced By, Co-Producer)
            if (producerList.length === 0 && song?.custom_performances && Array.isArray(song.custom_performances)) {
                for (const cp of song.custom_performances) {
                    const label = (cp.label || "").toLowerCase();
                    if (/produc/i.test(label) && Array.isArray(cp.artists)) {
                        for (const a of cp.artists) {
                            if (a.name && !producerList.includes(a.name.trim())) {
                                producerList.push(a.name.trim());
                            }
                        }
                    }
                }
            }

            if (producerList.length > 0) {
                const names = producerList.join(', ');
                return { text: `(prod. by ${names})`, error: "" };
            } else {
                return { text: "", error: _("noProducers") };
            }
        } catch (e) {
            if (e.name === 'AbortError' || signal.aborted) {
                return { text: "", error: "Aborted", aborted: true };
            }
            return { text: "", error: _("networkError", proxyUrl ? "Proxy unavailable or " + e.message : "CORS or " + e.message) };
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    // --- DOM LOGIC WITH POSITIONING & ELLIPSIS ---
    function findTitleElement() {
        for (const selector of TITLE_SELECTORS) {
            const el = document.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

    let searchAttempts = 0;

    function injectDOM() {
        const titleEl = findTitleElement();
        if (!titleEl) {
            if (searchAttempts < 10) {
                searchAttempts++;
                setTimeout(injectDOM, 500);
            } else if (searchAttempts === 10) {
                console.warn("[GeniusProducers] Could not find track title element");
                searchAttempts++;
            }
            return;
        }
        searchAttempts = 0;

        const parent = titleEl.parentNode;
        if (!parent) return;

        let producerEl = document.getElementById("genius-producer-info");
        
        if (!currentProducersText) {
            if (producerEl) producerEl.remove();
            return;
        }

        // Create element if not exists or if detached by React re-render
        if (!producerEl || producerEl.parentNode !== parent) {
            if (producerEl) producerEl.remove();

            producerEl = document.createElement("div");
            producerEl.id = "genius-producer-info";
            producerEl.style.fontSize = "0.75rem";
            producerEl.style.color = "var(--text-subdued, #b3b3b3)";
            producerEl.style.marginTop = "2px";
            producerEl.style.marginBottom = "2px";
            producerEl.style.lineHeight = "1.2";
            producerEl.style.width = "100%";
            producerEl.style.maxWidth = "100%";
            producerEl.style.overflow = "hidden";
            producerEl.style.textOverflow = "ellipsis";
            producerEl.style.whiteSpace = "nowrap";
            producerEl.style.display = "block";
            producerEl.style.boxSizing = "border-box";
            
            const placement = Spicetify.LocalStorage.get("genius_producers_placement") || "between";
            if (placement === "above") {
                parent.insertBefore(producerEl, titleEl);
            } else if (placement === "below") {
                // Insert after artist container if found, else append to parent
                const artistEl = parent.querySelector('.main-trackInfo-artists') || titleEl.nextSibling;
                if (artistEl && artistEl.nextSibling) {
                    parent.insertBefore(producerEl, artistEl.nextSibling);
                } else {
                    parent.appendChild(producerEl);
                }
            } else {
                // "between" (default)
                parent.insertBefore(producerEl, titleEl.nextSibling);
            }
        }
        producerEl.innerText = currentProducersText;
        producerEl.title = currentProducersText; // Full list on hover tooltip
    }

    function getCurrentTrack() {
        if (Spicetify.Player.data) {
            if (Spicetify.Player.data.item) return Spicetify.Player.data.item;
            if (Spicetify.Player.data.track) return Spicetify.Player.data.track;
        }
        if (typeof Spicetify.Player.getTrack === 'function') return Spicetify.Player.getTrack();
        return null;
    }

    async function update(showToast = false, forceRefresh = false) {
        const isEnabled = Spicetify.LocalStorage.get("genius_producers_enabled") !== "false";
        if (!isEnabled) {
            currentProducersText = "";
            injectDOM();
            return;
        }

        const item = getCurrentTrack();
        if (!item) {
            if (showToast) Spicetify.showNotification(_("noTrackPlaying"));
            return;
        }

        const type = item.type || item.track_type;
        const uri = item.uri || "";
        const isLocal = uri.startsWith("spotify:local:") || item.is_local;
        const isAd = uri.startsWith("spotify:ad:") || type === "ad";

        if (isAd) return;

        if (type && type !== "track" && type !== "local" && type !== "song") {
            return;
        }

        const disableLocal = Spicetify.LocalStorage.get("genius_producers_disable_local") !== "false";
        if (isLocal && disableLocal) {
            currentProducersText = "";
            injectDOM();
            return;
        }

        let title = item.metadata?.title || item.name;
        let rawArtist = item.metadata?.artist_name || (item.artists && item.artists[0]?.name);
        const spotifyArtists = parseSpotifyArtists(item);

        if (!title || !rawArtist) {
            if (showToast) Spicetify.showNotification(_("noTitleOrArtist"));
            return;
        }

        if (!forceRefresh && uri === currentSongUri && currentProducersText) {
            injectDOM();
            if (showToast) Spicetify.showNotification(currentProducersText);
            return;
        }

        if (forceRefresh) {
            const cache = getCache();
            delete cache[uri];
            saveCache(cache);
        }

        currentSongUri = uri;
        
        const cached = getFromCache(uri);
        if (!forceRefresh && cached !== null) {
            currentProducersText = cached;
            injectDOM();
            if (showToast && cached) Spicetify.showNotification(cached);
            return;
        }

        if (showToast) {
            Spicetify.showNotification(_("searching", title));
        }

        currentProducersText = ""; 
        injectDOM(); 

        const res = await fetchProducers(title, rawArtist, spotifyArtists, showToast);
        if (res.aborted) {
            // Clean exit on abort; superseded by newer request
            return;
        }
        
        if (currentSongUri === uri) {
            currentProducersText = res.text;
            setToCache(uri, res.text);
            injectDOM();
            if (showToast) {
                if (res.text) {
                    Spicetify.showNotification(res.text);
                } else if (res.error) {
                    Spicetify.showNotification(res.error);
                }
            }
        }
    }

    // --- SETTINGS UI ---
    function injectSettingsCSS() {
        if (document.getElementById("genius-settings-css")) return;
        const style = document.createElement("style");
        style.id = "genius-settings-css";
        style.innerHTML = `
            .genius-settings-container { display: flex; flex-direction: column; gap: 14px; }
            .genius-settings-label { font-weight: bold; color: var(--spice-text); display: flex; flex-direction: column; gap: 5px; }
            .genius-settings-input, .genius-settings-select { width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--spice-button-disabled); background: var(--spice-main-elevated); color: var(--spice-text); box-sizing: border-box; }
            .genius-settings-btn { padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; color: var(--spice-text); font-weight: bold; }
            .genius-settings-btn-primary { background: var(--spice-button); color: var(--spice-main, #000); }
            .genius-settings-btn-secondary { background: var(--spice-button-disabled); color: var(--spice-text); }
            .genius-settings-btn-sm { padding: 4px 10px; font-size: 0.8rem; border-radius: 12px; }
            .genius-settings-row { display: flex; align-items: center; justify-content: space-between; }
            .genius-settings-hint { font-size: 0.8em; color: var(--spice-subtext); }
            .genius-settings-link { color: var(--spice-button); text-decoration: none; }
        `;
        document.head.appendChild(style);
    }

    function openSettings() {
        injectSettingsCSS();
        const container = document.createElement("div");
        container.className = "genius-settings-container";

        // Enable Toggle
        const enableRow = document.createElement("div");
        enableRow.className = "genius-settings-row";
        enableRow.innerHTML = `<span style="color: var(--spice-text); font-weight: bold;">${_("enableLabel")}</span>`;
        const enableCheck = document.createElement("input");
        enableCheck.type = "checkbox";
        enableCheck.checked = Spicetify.LocalStorage.get("genius_producers_enabled") !== "false";
        enableRow.appendChild(enableCheck);
        container.appendChild(enableRow);

        // Disable on Local Toggle
        const localRow = document.createElement("div");
        localRow.className = "genius-settings-row";
        localRow.innerHTML = `<span style="color: var(--spice-text); font-weight: bold;">${_("disableLocalLabel")}</span>`;
        const localCheck = document.createElement("input");
        localCheck.type = "checkbox";
        localCheck.checked = Spicetify.LocalStorage.get("genius_producers_disable_local") !== "false";
        localRow.appendChild(localCheck);
        container.appendChild(localRow);

        // Placement Select
        const placementLabel = document.createElement("label");
        placementLabel.className = "genius-settings-label";
        placementLabel.innerText = _("placementLabel");
        const placementSelect = document.createElement("select");
        placementSelect.className = "genius-settings-select";
        const placements = [
            { v: "between", t: _("placementBetween") },
            { v: "above", t: _("placementAbove") },
            { v: "below", t: _("placementBelow") }
        ];
        const currentPlacement = Spicetify.LocalStorage.get("genius_producers_placement") || "between";
        placements.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.v;
            opt.innerText = p.t;
            if (p.v === currentPlacement) opt.selected = true;
            placementSelect.appendChild(opt);
        });
        placementLabel.appendChild(placementSelect);
        container.appendChild(placementLabel);

        // Language Select
        const langLabel = document.createElement("label");
        langLabel.className = "genius-settings-label";
        langLabel.innerText = _("langLabel");
        const langSelect = document.createElement("select");
        langSelect.className = "genius-settings-select";
        const langs = [
            { v: "auto", t: "Auto" },
            { v: "en", t: "English" },
            { v: "ru", t: "Русский" }
        ];
        const currentLang = Spicetify.LocalStorage.get("genius_producers_lang") || "auto";
        langs.forEach(l => {
            const opt = document.createElement("option");
            opt.value = l.v;
            opt.innerText = l.t;
            if (l.v === currentLang) opt.selected = true;
            langSelect.appendChild(opt);
        });
        langLabel.appendChild(langSelect);
        container.appendChild(langLabel);

        // Token Input
        const tokenLabel = document.createElement("label");
        tokenLabel.className = "genius-settings-label";
        tokenLabel.innerHTML = `<span>${_("tokenLabel")}</span><span class="genius-settings-hint"><a href="https://genius.com/api-clients" target="_blank" class="genius-settings-link">How to get a Genius API token</a></span>`;
        const tokenInput = document.createElement("input");
        tokenInput.className = "genius-settings-input";
        tokenInput.type = "password";
        tokenInput.value = Spicetify.LocalStorage.get("genius_producers_token") || DEFAULT_TOKEN || "";
        tokenInput.placeholder = _("tokenPlaceholder");
        tokenLabel.appendChild(tokenInput);
        
        const tokenStatus = document.createElement("div");
        tokenStatus.style.fontSize = "0.8em";
        tokenStatus.style.marginTop = "4px";
        tokenLabel.appendChild(tokenStatus);
        
        function validateToken() {
            const val = tokenInput.value.trim();
            if (!val || val.includes(' ')) {
                tokenStatus.innerText = _("tokenInvalid");
                tokenStatus.style.color = "#E22134";
            } else {
                tokenStatus.innerText = _("tokenValid");
                tokenStatus.style.color = "#1DB954";
            }
        }
        tokenInput.addEventListener('input', validateToken);
        if (tokenInput.value) validateToken();
        container.appendChild(tokenLabel);

        // Proxy Input
        const proxyLabel = document.createElement("label");
        proxyLabel.className = "genius-settings-label";
        proxyLabel.innerHTML = `<span>${_("proxyLabel")}</span><span class="genius-settings-hint">Required only if your network or ISP blocks genius.com directly</span>`;
        const proxyInput = document.createElement("input");
        proxyInput.className = "genius-settings-input";
        proxyInput.type = "text";
        proxyInput.value = Spicetify.LocalStorage.get("genius_producers_proxy") || "";
        proxyInput.placeholder = _("proxyPlaceholder");
        proxyLabel.appendChild(proxyInput);
        container.appendChild(proxyLabel);

        // Backup / Restore Row
        const backupRow = document.createElement("div");
        backupRow.className = "genius-settings-row";
        backupRow.style.marginTop = "5px";

        const exportBtn = document.createElement("button");
        exportBtn.className = "genius-settings-btn genius-settings-btn-secondary genius-settings-btn-sm";
        exportBtn.innerText = _("exportButton");
        exportBtn.onclick = () => {
            const backupData = {
                token: tokenInput.value.trim(),
                proxy: proxyInput.value.trim(),
                lang: langSelect.value,
                placement: placementSelect.value,
                enabled: enableCheck.checked,
                disableLocal: localCheck.checked
            };
            const json = JSON.stringify(backupData);
            if (Spicetify.Platform?.ClipboardAPI?.copy) {
                Spicetify.Platform.ClipboardAPI.copy(json);
            } else if (navigator.clipboard) {
                navigator.clipboard.writeText(json);
            }
            Spicetify.showNotification(_("backupCopied"));
        };

        const importBtn = document.createElement("button");
        importBtn.className = "genius-settings-btn genius-settings-btn-secondary genius-settings-btn-sm";
        importBtn.innerText = _("importButton");
        importBtn.onclick = () => {
            const raw = prompt("Paste your backup JSON:");
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                if (parsed.token !== undefined) tokenInput.value = parsed.token;
                if (parsed.proxy !== undefined) proxyInput.value = parsed.proxy;
                if (parsed.lang !== undefined) langSelect.value = parsed.lang;
                if (parsed.placement !== undefined) placementSelect.value = parsed.placement;
                if (parsed.enabled !== undefined) enableCheck.checked = !!parsed.enabled;
                if (parsed.disableLocal !== undefined) localCheck.checked = !!parsed.disableLocal;
                validateToken();
                Spicetify.showNotification(_("backupRestored"));
            } catch {
                Spicetify.showNotification(_("invalidBackup"));
            }
        };

        backupRow.appendChild(exportBtn);
        backupRow.appendChild(importBtn);
        container.appendChild(backupRow);

        // Action Buttons
        const buttonsDiv = document.createElement("div");
        buttonsDiv.style.display = "flex";
        buttonsDiv.style.justifyContent = "flex-end";
        buttonsDiv.style.gap = "10px";
        buttonsDiv.style.marginTop = "10px";

        const testBtn = document.createElement("button");
        testBtn.className = "genius-settings-btn genius-settings-btn-secondary";
        testBtn.innerText = _("testButton");
        testBtn.onclick = () => {
            saveAllConfig({
                genius_producers_token: tokenInput.value.trim(),
                genius_producers_proxy: proxyInput.value.trim(),
                genius_producers_lang: langSelect.value,
                genius_producers_placement: placementSelect.value,
                genius_producers_enabled: enableCheck.checked ? "true" : "false",
                genius_producers_disable_local: localCheck.checked ? "true" : "false"
            });
            update(true, true);
        };

        const saveBtn = document.createElement("button");
        saveBtn.className = "genius-settings-btn genius-settings-btn-primary";
        saveBtn.innerText = _("saveButton");
        saveBtn.onclick = () => {
            saveAllConfig({
                genius_producers_token: tokenInput.value.trim(),
                genius_producers_proxy: proxyInput.value.trim(),
                genius_producers_lang: langSelect.value,
                genius_producers_placement: placementSelect.value,
                genius_producers_enabled: enableCheck.checked ? "true" : "false",
                genius_producers_disable_local: localCheck.checked ? "true" : "false"
            });
            Spicetify.PopupModal.hide();
            Spicetify.showNotification(_("settingsSaved"));
            // Force re-inject to reflect any placement changes
            const el = document.getElementById("genius-producer-info");
            if (el) el.remove();
            update(false);
        };

        buttonsDiv.appendChild(testBtn);
        buttonsDiv.appendChild(saveBtn);
        container.appendChild(buttonsDiv);

        Spicetify.PopupModal.display({
            title: _("settingsTitle"),
            content: container,
            isLarge: false
        });
    }

    const menuItem = new Spicetify.Menu.Item(
        "Genius Producers Settings",
        false,
        openSettings,
        `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
    );
    menuItem.register();

    // --- LIFECYCLE & OBSERVER ---
    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
        // Skip mutations caused by our own element
        let relevant = false;
        for (const m of mutations) {
            if (m.target?.id === "genius-producer-info" || m.target?.parentElement?.id === "genius-producer-info") {
                continue;
            }
            relevant = true;
            break;
        }
        if (!relevant) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const titleEl = findTitleElement();
            if (titleEl) {
                const producerEl = document.getElementById("genius-producer-info");
                if ((!producerEl || producerEl.parentNode !== titleEl.parentNode) && currentProducersText) {
                    injectDOM();
                }
            }
        }, 200);
    });

    function startObserver() {
        const playbar = document.querySelector('.main-nowPlayingBar-container') || document.body;
        observer.observe(playbar, { childList: true, subtree: true });
    }

    const initInterval = setInterval(() => {
        if (document.querySelector('.main-nowPlayingBar-container')) {
            clearInterval(initInterval);
            startObserver();
            update(false);
        }
    }, 500);

    let songChangeDebounce;
    function onSongChange() {
        clearTimeout(songChangeDebounce);
        songChangeDebounce = setTimeout(() => update(false), 250);
    }
    Spicetify.Player.addEventListener("songchange", onSongChange);

    // CLEANUP EXPORT (for hot-reload testing)
    window.__geniusProducersCleanup = () => {
        try { observer.disconnect(); } catch (e) {}
        try { clearInterval(initInterval); } catch (e) {}
        try { clearTimeout(debounceTimer); } catch (e) {}
        try { clearTimeout(songChangeDebounce); } catch (e) {}
        try { Spicetify.Player.removeEventListener("songchange", onSongChange); } catch (e) {}
        try { menuItem.deregister?.(); } catch (e) { console.warn("[GeniusProducers] menu cleanup failed", e); }
        try {
            const el = document.getElementById("genius-producer-info");
            if (el) el.remove();
        } catch (e) {}
        delete window.__geniusProducersLoaded;
    };

})();
