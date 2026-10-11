// Automated test suite for Genius Producers matching & normalization algorithms
const assert = require("assert");

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
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function normalizeString(str) {
    if (!str) return "";
    // Normalize Latin diacritics (e.g. é -> e, ü -> u, ñ -> n) while preserving Cyrillic (й, ё), Asian, etc.
    let s = str.replace(/[À-ž]/g, c => c.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    // Keep letters, numbers, and whitespace in any language
    return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function cleanBrackets(str) {
    if (!str) return "";
    let s = str;
    // Strip featuring patterns: (feat. X), [ft. X], (with X)
    s = s.replace(/[\(\[]\s*(?:feat\.?|ft\.?|with)\s+[^()\[\]]+[\)\]]/gi, "");
    // Strip remaster / version tags: (Remastered 2021), (2020 Remaster), - 2011 Remaster, [Deluxe Edition], (Live), (Acoustic)
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
        // Split by commas, semicolons, " & ", " feat. ", " ft. ", " with "
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

    // 1. Title matching check
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

    // Check remix consistency: if one title has "remix" and the other doesn't, reject false match
    const titleHasRemix = /\bremix\b/i.test(title);
    const candHasRemix = /\bremix\b/i.test(candidate.title);
    if (titleHasRemix !== candHasRemix) return false;

    // 2. Artist matching check
    const candidateArtists = [];
    if (candidate.primary_artist?.name) candidateArtists.push(candidate.primary_artist.name);
    if (Array.isArray(candidate.featured_artists)) {
        for (const fa of candidate.featured_artists) {
            if (fa.name) candidateArtists.push(fa.name);
        }
    }

    const testArtists = spotifyArtists.length > 0 ? spotifyArtists : [rawArtist];
    
    // Check if any candidate artist matches any Spotify artist
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

// TESTS
console.log("Running normalization tests...");
assert.strictEqual(normalizeString("Beyoncé"), "beyonce", "Beyoncé failed");
assert.strictEqual(normalizeString("Mötley Crüe"), "motley crue", "Mötley Crüe failed");
assert.strictEqual(normalizeString("Rosalía"), "rosalia", "Rosalía failed");
assert.strictEqual(normalizeString("Обійми"), "обійми", "Ukrainian Обійми failed");
assert.strictEqual(normalizeString("Ёлка"), "ёлка", "Russian Ёлка failed");
assert.strictEqual(normalizeString("夜に駆ける"), "夜に駆ける", "Japanese kanji failed");
console.log("✓ Normalization tests passed!");

console.log("Running bracket cleaning tests...");
assert.strictEqual(cleanBrackets("Stan (feat. Dido)"), "Stan");
assert.strictEqual(cleanBrackets("In The End - 2020 Remaster"), "In The End");
assert.strictEqual(cleanBrackets("Part 1 - The Beginning"), "Part 1 - The Beginning", "Should not strip non-remaster titles");
assert.strictEqual(cleanBrackets("Song [Live at Wembley]"), "Song");
assert.strictEqual(cleanBrackets("Song (Acoustic Version)"), "Song");
console.log("✓ Bracket cleaning tests passed!");

console.log("Running multi-artist collaboration match tests...");
const spotifyItem = {
    metadata: {
        title: "Creepin' (with The Weeknd & 21 Savage)",
        artist_name: "Metro Boomin, The Weeknd, 21 Savage"
    },
    artists: [
        { name: "Metro Boomin" },
        { name: "The Weeknd" },
        { name: "21 Savage" }
    ]
};
const artistsList = parseSpotifyArtists(spotifyItem);
assert.deepStrictEqual(artistsList, ["Metro Boomin", "The Weeknd", "21 Savage"]);

const geniusCandidate = {
    title: "Creepin'",
    primary_artist: { name: "Metro Boomin" },
    featured_artists: [{ name: "The Weeknd" }, { name: "21 Savage" }]
};
assert.strictEqual(isMatchingResult(geniusCandidate, spotifyItem.metadata.title, spotifyItem.metadata.artist_name, artistsList), true);

const unrelatedCandidate = {
    title: "Creepin'",
    primary_artist: { name: "Different Band" }
};
assert.strictEqual(isMatchingResult(unrelatedCandidate, spotifyItem.metadata.title, spotifyItem.metadata.artist_name, artistsList), false);

// Remix rejection test
const remixCandidate = {
    title: "Creepin' (Remix)",
    primary_artist: { name: "Metro Boomin" }
};
assert.strictEqual(isMatchingResult(remixCandidate, "Creepin'", "Metro Boomin", ["Metro Boomin"]), false, "Original song should not match remix");

console.log("✓ All matching tests passed successfully!");
