// background.js - Service Worker for Spotify Extension (Module)

import { CLIENT_ID } from './config.js'; // Import Client ID

// const CLIENT_ID = "43b27dea9f754658b91360d2fe2a27d2"; // No longer defined here
const REDIRECT_URI = chrome.identity.getRedirectURL(); // e.g., https://<extension-id>.chromiumapp.org/
const SCOPES = [
    "user-read-private", "user-read-email", "playlist-read-private",
    "user-library-read", "streaming", "user-read-playback-state",
    "user-modify-playback-state", "user-read-recently-played",
    "user-library-modify"
].join(" ");

// --- PKCE Helper Functions ---
// Generates a random string for the code verifier
function generateCodeVerifier(length = 64) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Hashes the code verifier using SHA256
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
}

// Base64 URL encodes the ArrayBuffer (hash)
function base64urlencode(a) {
    // Convert buffer to byte array
    const uint8Array = new Uint8Array(a);
    // Convert byte array to string
    const str = String.fromCharCode.apply(null, uint8Array);
    // Base64 encode
    const base64 = btoa(str);
    // Base64 URL encode (replace +, /, remove =)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generates the code challenge from the code verifier
async function generateCodeChallenge(verifier) {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
}
// --- End PKCE Helpers ---

let spotify_access_token = null;
let spotify_token_expiry = null;
let spotify_refresh_token = null;
let sdkDeviceId = null; // Store the Device ID from the SDK player
let creatingOffscreenDocument = false; // Flag to prevent race conditions
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Function to get token, checking expiry
async function getToken() {
    if (spotify_access_token && spotify_token_expiry && Date.now() < spotify_token_expiry) {
        return spotify_access_token;
    }
    // Check storage
    const data = await chrome.storage.local.get(['spotify_access_token', 'spotify_token_expiry', 'spotify_refresh_token']);
    if (data.spotify_access_token && data.spotify_token_expiry && Date.now() < data.spotify_token_expiry) {
        spotify_access_token = data.spotify_access_token;
        spotify_token_expiry = data.spotify_token_expiry;
        spotify_refresh_token = data.spotify_refresh_token; // Keep refresh token
        console.log("Token retrieved from storage.");
        return spotify_access_token;
    }
    // TODO: Implement token refresh using data.spotify_refresh_token if available
    console.log("No valid token found or token expired.");
    spotify_access_token = null;
    spotify_token_expiry = null;
    // Don't clear refresh token here unless refresh fails
    // await chrome.storage.local.remove(['spotify_access_token', 'spotify_token_expiry']);
    return null;
}

// Function to exchange authorization code for token
async function exchangeCodeForToken(code, codeVerifier) {
    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('code_verifier', codeVerifier);

    console.log("Exchanging code for token...");
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error(`Token Exchange Error ${response.status}:`, errorData);
            throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorData.error_description || errorData.message}`);
        }

        const tokenData = await response.json();
        console.log("Token data received:", tokenData);

        if (!tokenData.access_token || !tokenData.expires_in) {
            throw new Error("Invalid token data received from Spotify");
        }

        spotify_access_token = tokenData.access_token;
        spotify_token_expiry = Date.now() + tokenData.expires_in * 1000;
        spotify_refresh_token = tokenData.refresh_token; // Store refresh token

        await chrome.storage.local.set({
            spotify_access_token: spotify_access_token,
            spotify_token_expiry: spotify_token_expiry,
            spotify_refresh_token: spotify_refresh_token
        });

        console.log("Token stored successfully (Access & Refresh).");
        return spotify_access_token;

    } catch (error) {
        console.error("Error during token exchange:", error);
        // Clear potentially bad tokens if exchange failed
        spotify_access_token = null;
        spotify_token_expiry = null;
        spotify_refresh_token = null;
        await chrome.storage.local.remove(['spotify_access_token', 'spotify_token_expiry', 'spotify_refresh_token']);
        throw error; // Re-throw error to be caught by authenticate caller
    }
}

// Function to initiate authentication (using PKCE)
async function authenticate(interactive = true) {
    if (CLIENT_ID === "YOUR_SPOTIFY_CLIENT_ID") {
        throw new Error("Client ID not set");
    }
    if (!REDIRECT_URI) {
        throw new Error("Redirect URI not available");
    }

    // 1. Generate PKCE codes
    const codeVerifier = generateCodeVerifier();
    // Store verifier temporarily to use after redirect
    // Using session storage which clears when browser closes, suitable for verifier
    await chrome.storage.session.set({ spotify_code_verifier: codeVerifier });
    console.log("Generated Code Verifier (stored in session storage)");
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // 2. Construct Auth URL with PKCE params
    const authUrlParams = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: String(interactive)
    });
    const AUTH_URL = `https://accounts.spotify.com/authorize?${authUrlParams.toString()}`;

    console.log("Attempting PKCE auth flow with URL:", AUTH_URL);

    // 3. Launch Web Auth Flow
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
            url: AUTH_URL,
            interactive: interactive
        }, async (redirectUrl) => {
            if (chrome.runtime.lastError || !redirectUrl) {
                console.error("OAuth Error:", chrome.runtime.lastError);
                await chrome.storage.session.remove('spotify_code_verifier'); // Clean up verifier
                reject(chrome.runtime.lastError?.message || "Authentication failed or cancelled.");
                return;
            }

            console.log("PKCE OAuth redirect URL received:", redirectUrl);

            // 4. Extract Authorization Code
            try {
                const url = new URL(redirectUrl);
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    console.error("Error returned in redirect URL:", error);
                    await chrome.storage.session.remove('spotify_code_verifier');
                    reject(`Authorization error: ${error}`);
                    return;
                }

                if (!code) {
                    console.error("Could not extract authorization code from redirect URL.", redirectUrl);
                    await chrome.storage.session.remove('spotify_code_verifier');
                    reject("Authorization code extraction failed");
                    return;
                }

                // Retrieve the code verifier
                const { spotify_code_verifier } = await chrome.storage.session.get('spotify_code_verifier');
                await chrome.storage.session.remove('spotify_code_verifier'); // Clean up immediately after retrieval

                if (!spotify_code_verifier) {
                     console.error("Could not retrieve code verifier from session storage.");
                     reject("Code verifier missing for token exchange");
                     return;
                }

                // 5. Exchange Code for Token
                console.log("Extracted authorization code:", code);
                const accessToken = await exchangeCodeForToken(code, spotify_code_verifier);
                resolve(accessToken);

            } catch (err) {
                console.error("Error processing redirect or exchanging token:", err);
                await chrome.storage.session.remove('spotify_code_verifier'); // Ensure cleanup on error
                reject(err instanceof Error ? err.message : String(err));
            }
        });
    });
}

// Helper function for making authenticated API calls
async function spotifyApiCall(endpoint, method = 'GET', body = null) {
    let token = await getToken();

    // TODO: Add automatic token refresh logic here

    if (!token) {
        console.log("API call failed: No valid token available.");
        throw new Error("Not authenticated or token expired");
    }

    const url = `https://api.spotify.com/v1${endpoint}`;
    console.log(`Making API call: ${method} ${url}`);

    const headers = {
        'Authorization': `Bearer ${token}`
        // Content-Type added conditionally below
    };
    const options = {
        method: method,
        headers: headers
    };

    if (body) {
        options.body = JSON.stringify(body);
        headers['Content-Type'] = 'application/json'; // Set Content-Type only when body exists
    }

    try {
        const response = await fetch(url, options);

        // Handle common errors first
        if (response.status === 401) {
            console.log("API call received 401, token likely expired.");
            spotify_access_token = null;
            spotify_token_expiry = null;
            await chrome.storage.local.remove(['spotify_access_token', 'spotify_token_expiry']);
            throw new Error("Unauthorized - Token likely expired");
        }

        if (!response.ok) {
            // Try to get error details from body, but handle cases where it's not JSON
            let errorDetails = `Status: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorDetails = errorData.error?.message || JSON.stringify(errorData);
            } catch (e) {
                // If parsing fails, use the text body if available
                try {
                     const textError = await response.text();
                     errorDetails += ` - ${textError}`; 
                } catch (textE) { /* Ignore further errors */ }
            }
            console.error(`API Error Response: ${errorDetails}`);
            throw new Error(`API request failed: ${errorDetails}`);
        }

        // Handle successful responses based on status code and method
        // For commands that don't necessarily return content (POST, PUT, DELETE)
        // if the status is OK (2xx), treat as success without parsing body.
        if ( (method === 'POST' || method === 'PUT' || method === 'DELETE') && 
             response.status >= 200 && response.status < 300 ) 
        {
            console.log(`API Command (${method}) successful with status ${response.status}`);
            return { success: true, status: response.status };
        }
        
        // For other successful responses (primarily GET), attempt to parse JSON
        // This also covers potential edge cases where PUT/POST might return JSON
        try {
             // Check content type? Maybe just try/catch is enough.
             const textBody = await response.clone().text(); // Clone to read text without consuming body
             if (!textBody || textBody.trim() === "") {
                  console.log(`API call (${method}) successful with status ${response.status} but empty body.`);
                  // Treat empty body on success like 204 No Content
                  return (method === 'GET') ? null : { success: true, status: response.status }; 
             }
             const jsonData = await response.json();
             return jsonData;
        } catch (e) {
             console.error(`Failed to parse JSON response (${method} ${endpoint}, status ${response.status}):`, e);
             // If GET failed parsing a seemingly successful response, return null to indicate no data
             if (method === 'GET') {
                  return null;
             }
             // For other methods, this is more unexpected
             throw new Error(`Failed to parse successful response body: ${e.message}`);
        } 

    } catch (error) {
        // Log the error caught either from fetch() or thrown above
        console.error(`spotifyApiCall Error (${method} ${endpoint}):`, error);
        // Re-throw the original error object (which should be an Error instance)
        throw error;
    }
}

// --- Offscreen Document Management ---
async function hasOffscreenDocument() {
    // Check all windows controlled by the service worker to see if one
    // is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
}

async function setupOffscreenDocument() {
    if (creatingOffscreenDocument) {
        console.log("Already attempting to create offscreen document.");
        return;
    }
    if (await hasOffscreenDocument()) {
        console.log("Offscreen document already exists.");
        return;
    }

    console.log("Creating offscreen document...");
    creatingOffscreenDocument = true;
    try {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
            justification: 'Required for Spotify Web Playback SDK to play audio.',
        });
        console.log("Offscreen document created successfully.");
    } catch (error) {
        console.error("Failed to create offscreen document:", error);
    } finally {
        creatingOffscreenDocument = false;
    }
}

// Ensure offscreen document exists when needed (e.g., on startup if authenticated)
async function ensureOffscreenDocument() {
    const hasDoc = await hasOffscreenDocument();
    if (!hasDoc) {
        await setupOffscreenDocument();
    }
}

// Call setup on service worker startup if authenticated maybe?
// Or just call ensureOffscreenDocument() before sending first SDK command.

// --- Message Sending to Offscreen Document ---
async function sendCommandToSdk(command) {
    await ensureOffscreenDocument(); // Make sure document exists
    console.log(`Sending command to SDK: ${command.type}`, command);
    try {
        const response = await chrome.runtime.sendMessage(command);
        console.log(`Response from SDK for ${command.type}:`, response);
        if (!response || !response.success) {
             console.warn(`SDK command ${command.type} failed or received no/error response`, response?.error);
        }
        return response;
    } catch (error) {
        // This catches errors if the offscreen document is closed or unreachable
        console.error(`Error sending message to offscreen document for command ${command.type}:`, error);
        // Maybe try recreating the document?
        if (String(error).includes("Could not establish connection")) {
            console.log("Connection error, attempting to recreate offscreen document...");
            sdkDeviceId = null; // Assume SDK device is gone
            await setupOffscreenDocument(); // Try recreating it
        }
        // Return an error structure similar to other failed responses
        return { success: false, error: `Failed to send command to SDK: ${error.message}` };
    }
}

// Listen for messages from the popup or other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received message:", request, "from:", sender.url);

    // --- SDK Lifecycle/Info Messages (From Offscreen) ---
    if (request.type === "GET_ACCESS_TOKEN") {
        getToken().then(token => {
            if (token) {
                sendResponse({ success: true, token: token });
            } else {
                sendResponse({ success: false, error: "Not authenticated or token expired"});
            }
        }).catch(e => sendResponse({ success: false, error: e.message }));
        return true; // Async
    }
    if (request.type === "SDK_READY") {
        sdkDeviceId = request.deviceId;
        console.log("Background script received SDK Device ID:", sdkDeviceId);
        // Maybe notify popup that SDK player is ready?
        sendResponse({success: true});
        return false; // No async needed
    }
    if (request.type === "SDK_NOT_READY") {
         console.warn("Background script notified SDK Device ID gone offline:", request.deviceId);
         if (sdkDeviceId === request.deviceId) {
             sdkDeviceId = null;
         }
         // Maybe notify popup?
         sendResponse({success: true});
         return false;
    }
     if (request.type === "SDK_AUTH_ERROR" || request.type === "SDK_ACCOUNT_ERROR") {
        console.error(`Received SDK Error from offscreen: ${request.type}`, request.message);
        // TODO: Notify popup user about the issue (e.g., needs premium, login expired)
        sdkDeviceId = null; // Assume SDK unusable
        sendResponse({success: true});
        return false;
    }
    if (request.type === "WEB_API_PLAY") {
        // Received from Offscreen doc - use Web API to start playback on the SDK device
        console.log("Routing PLAY command via Web API for SDK Device ID:", request.options.device_id);
        const body = {
             uris: request.options.uris,
             context_uri: request.options.context_uri,
             offset: request.options.offset // Add offset here
        };
        // Remove null/undefined keys from body before sending
        Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);

        spotifyApiCall(`/me/player/play?device_id=${request.options.device_id}`, 'PUT', body)
             .then(data => sendResponse({ success: true }))
             .catch(error => {
                 console.error("Web API Play Error (for SDK target):", error);
                 sendResponse({ success: false, error: String(error) });
             });
        return true; // Async
    }

    // --- General Extension Messages (From Popup) ---
    if (request.type === "LOGIN") {
        console.log("Login request received (PKCE).");
        authenticate(true)
            .then(token => sendResponse({ success: true, token: token }))
            .catch(error => {
                // Ensure error is a string for sendResponse
                const errorMessage = error instanceof Error ? error.message : String(error);
                sendResponse({ success: false, error: errorMessage });
            });
        return true; // Async
    }
    else if (request.type === "LOGOUT") {
        // Also disconnect SDK player if it exists
        if (sdkDeviceId) {
             sendCommandToSdk({ type: "SDK_DISCONNECT" });
             sdkDeviceId = null;
        }
        console.log("Logout request received. Clearing tokens...");
        spotify_access_token = null;
        spotify_token_expiry = null;
        spotify_refresh_token = null;
        
        // Use async/await to ensure removal before responding
        (async () => {
            try {
                await chrome.storage.local.remove(['spotify_access_token', 'spotify_token_expiry', 'spotify_refresh_token']);
                console.log("Tokens successfully removed from storage.");
                sendResponse({success: true});
            } catch (error) {
                 console.error("Error removing tokens from storage during logout:", error);
                 sendResponse({success: false, error: "Failed to clear stored tokens"});
            }
        })();

        return true; // Async response
    }
    else if (request.type === "GET_AUTH_STATUS"){
        getToken().then(token => {
            sendResponse({ isAuthenticated: !!token });
        });
        return true; // Async
    }
    else if (request.type === "GET_USER_PROFILE") {
        spotifyApiCall('/me')
            .then(data => sendResponse({ success: true, profile: data }))
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "GET_PLAYLISTS") {
        spotifyApiCall('/me/playlists?limit=50') // Get up to 50 playlists
            .then(data => sendResponse({ success: true, playlists: data.items }))
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "GET_PLAYLIST_TRACKS") {
        if (!request.playlistId) {
            sendResponse({ success: false, error: "Playlist ID required" });
            return false;
        }
        const fields = 'items(track(name,uri,artists(name),album(name)))';
        spotifyApiCall(`/playlists/${request.playlistId}/tracks?fields=${fields}&limit=100`)
            .then(data => sendResponse({ success: true, tracks: data.items }))
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "GET_LIKED_SONGS") {
        // Fetch first 50 liked songs (max limit per request)
        spotifyApiCall('/me/tracks?limit=50')
            .then(data => sendResponse({ success: true, tracks: data.items }))
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "SEARCH_TRACKS") {
        if (!request.query || request.query.trim() === "") {
            sendResponse({ success: false, error: "Search query cannot be empty" });
            return false; // Sync response
        }
        const query = encodeURIComponent(request.query);
        spotifyApiCall(`/search?q=${query}&type=track&limit=20`) // Get 20 tracks
            .then(data => sendResponse({ success: true, tracks: data.tracks.items }))
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "GET_RECENTLY_PLAYED") {
        console.log("Handling GET_RECENTLY_PLAYED");
        spotifyApiCall('/me/player/recently-played?limit=1')
            .then(data => {
                if (data && data.items && data.items.length > 0 && data.items[0].track) {
                    console.log("Success - recently played:", data.items[0].track.name);
                    sendResponse({ success: true, track: data.items[0].track });
                } else {
                    console.log("No recently played tracks found.");
                    sendResponse({ success: false, error: "No recently played tracks found." });
                }
            })
            .catch(error => {
                 console.error("Error fetching recently played:", error);
                 sendResponse({ success: false, error: String(error) });
            });
        return true; // Async
    }
    else if (request.type === "GET_PLAYER_STATE") {
        spotifyApiCall('/me/player')
            .then(data => {
                // Note: API returns 204 No Content if no player is active/available
                 if (data) {
                    sendResponse({ success: true, state: data });
                 } else {
                     sendResponse({ success: true, state: null }); // Indicate no active player
                 }
            })
            .catch(error => {
                // If the error indicates no active device, treat it as success with null state
                if (String(error).includes("No active device")) {
                     sendResponse({ success: true, state: null });
                } else {
                    sendResponse({ success: false, error: String(error) });
                }
            });
        return true; // Async
    }

    // --- Playback Control Messages (From Popup - Route to SDK or Web API) ---
    else if (request.type === "PLAY") {
        // User clicked Play/Resume in popup
        console.log("Handling PLAY request:", request);
        (async () => {
            try {
                // 1. Get available devices
                console.log("Fetching available devices...");
                const devicesResponse = await spotifyApiCall('/me/player/devices');
                const devices = devicesResponse?.devices || [];
                console.log("Available devices:", devices);

                let targetDeviceId = null;

                // 2. Determine target device ID
                const activeDevice = devices.find(d => d.is_active);
                const sdkDeviceInList = sdkDeviceId ? devices.find(d => d.id === sdkDeviceId) : null;

                if (sdkDeviceInList) {
                    console.log("SDK device found in list.");
                    targetDeviceId = sdkDeviceId;
                } else if (activeDevice) {
                    console.log(`Using active device: ${activeDevice.name} (${activeDevice.id})`);
                    targetDeviceId = activeDevice.id;
                } else if (sdkDeviceId) {
                     // SDK device exists but wasn't in the active list, attempt transfer
                     console.log("SDK device ID exists but is not active/listed. Will attempt transfer.");
                     targetDeviceId = sdkDeviceId; // Target it for the play command, potentially transferring
                } else if (devices.length > 0) {
                    console.warn(`No active device and no SDK device. Picking first available: ${devices[0].name}`);
                    targetDeviceId = devices[0].id;
                } else {
                    console.error("No Spotify devices found or available.");
                    throw new Error("No available Spotify device found. Please start Spotify on another device.");
                }

                // 3. Construct endpoint and body
                let endpoint = `/me/player/play?device_id=${targetDeviceId}`;
                let body = {}; // Always include body, even if empty for resume on specific device

                if (request.contextUri) {
                    body.context_uri = request.contextUri;
                    if (request.offset && request.offset.uri) { // Offset by URI for context
                        body.offset = request.offset;
                    }
                } else if (request.trackUris) {
                    body.uris = request.trackUris;
                    if (request.offset && request.offset.position !== undefined) { // Offset by position for URIs list
                        body.offset = request.offset;
                    }
                } else {
                     // Resume command - Spotify API requires empty body {} for resume on specific device, not null
                     console.log("Resume requested on device:", targetDeviceId);
                }

                // 4. Make the PLAY call
                console.log(`Attempting to play on device ${targetDeviceId}. Endpoint: ${endpoint}, Body:`, body);
                await spotifyApiCall(endpoint, 'PUT', body);
                console.log("Play command successful.");
                sendResponse({ success: true });

            } catch (error) {
                 console.error("Error during PLAY handling:", error);
                 // Try to activate SDK device if the error suggests no active device and SDK exists
                 if (String(error).includes("No active device") && sdkDeviceId) {
                      console.warn("Play failed (No active device). Attempting to transfer playback to SDK device...");
                      try {
                          await spotifyApiCall('/me/player', 'PUT', { device_ids: [sdkDeviceId], play: false }); // Transfer playback
                          console.log("Successfully transferred playback to SDK device. User may need to press play again.");
                          // Inform user that transfer happened, they might need to click play again
                          sendResponse({ success: false, error: "Playback transferred to extension. Please press play again.", needsRetry: false });
                      } catch (transferError) {
                           console.error("Failed to transfer playback to SDK device:", transferError);
                           sendResponse({ success: false, error: `Play failed: ${error.message} (Transfer attempt failed: ${transferError.message})` });
                      }
                 } else {
                      // General error
                      sendResponse({ success: false, error: error.message || String(error) });
                 }
            }
        })(); // End async IIFE

        return true; // Async
    }
    else if (request.type === "PAUSE") {
         // User clicked Pause in popup
         sendCommandToSdk({ type: "SDK_PAUSE" })
            .then(sendResponse);
         return true; // Async
    }
    else if (request.type === "NEXT_TRACK") {
         /* // OLD: Sending to SDK via offscreen
         sendCommandToSdk({ type: "SDK_NEXT_TRACK" })
            .then(sendResponse);
         */
         // NEW: Using Web API directly
         console.log("Handling NEXT_TRACK via Web API POST /me/player/next");
         spotifyApiCall('/me/player/next', 'POST')
            .then(() => sendResponse({ success: true })) // 204 No Content on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "PREVIOUS_TRACK") {
         /* // OLD: Sending to SDK via offscreen
         sendCommandToSdk({ type: "SDK_PREVIOUS_TRACK" })
            .then(sendResponse);
         */
         // NEW: Using Web API directly
         console.log("Handling PREVIOUS_TRACK via Web API POST /me/player/previous");
         spotifyApiCall('/me/player/previous', 'POST')
            .then(() => sendResponse({ success: true })) // 204 No Content on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "SET_SHUFFLE") {
        if (typeof request.shuffleState !== 'boolean') {
            sendResponse({ success: false, error: "Boolean shuffleState required" });
            return false;
        }
        spotifyApiCall(`/me/player/shuffle?state=${request.shuffleState}`, 'PUT')
            .then(() => sendResponse({ success: true })) // 204 No Content on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "SET_REPEAT") {
        const validStates = ['track', 'context', 'off'];
        if (!request.repeatState || !validStates.includes(request.repeatState)) {
            sendResponse({ success: false, error: "Invalid repeatState required (track, context, or off)" });
            return false;
        }
         spotifyApiCall(`/me/player/repeat?state=${request.repeatState}`, 'PUT')
            .then(() => sendResponse({ success: true })) // 204 No Content on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "SET_VOLUME") {
        if (typeof request.volumeLevel !== 'number' || request.volumeLevel < 0 || request.volumeLevel > 1) {
            sendResponse({ success: false, error: "Invalid volumeLevel required (0.0 to 1.0)" });
            return false;
        }
        // Use Web API for volume too for consistency
        const volumePercent = Math.round(request.volumeLevel * 100);
        console.log(`Handling SET_VOLUME via Web API PUT /me/player/volume - ${volumePercent}%`);
        spotifyApiCall(`/me/player/volume?volume_percent=${volumePercent}`, 'PUT')
            .then(() => sendResponse({ success: true })) // 204 No Content on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }

    // --- Check/Modify Library ---
    else if (request.type === "CHECK_TRACK_LIKED") {
        if (!request.trackId) return sendResponse({ success: false, error: "Track ID required" });
        spotifyApiCall(`/me/tracks/contains?ids=${request.trackId}`)
            .then(data => {
                // API returns an array of booleans
                sendResponse({ success: true, isLiked: data?.[0] ?? false });
            })
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "LIKE_TRACK") {
        if (!request.trackId) return sendResponse({ success: false, error: "Track ID required" });
        spotifyApiCall(`/me/tracks?ids=${request.trackId}`, 'PUT')
            .then(() => sendResponse({ success: true })) // 200 OK on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }
    else if (request.type === "UNLIKE_TRACK") {
        if (!request.trackId) return sendResponse({ success: false, error: "Track ID required" });
        spotifyApiCall(`/me/tracks?ids=${request.trackId}`, 'DELETE')
            .then(() => sendResponse({ success: true })) // 200 OK on success
            .catch(error => sendResponse({ success: false, error: String(error) }));
        return true; // Async
    }

    console.warn("Unhandled message type in background:", request.type);
    sendResponse({success: false, error: `Unknown message type: ${request.type}`});
    return false; // Indicate sync response for unknown types
});

// Check/create offscreen doc on startup if authenticated
chrome.runtime.onStartup.addListener(async () => {
    console.log("Extension startup, checking token and offscreen doc...");
    const token = await getToken();
    if (token) {
        await ensureOffscreenDocument();
    }
});

// Check/create offscreen doc on install/update if authenticated
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log(`Extension ${details.reason}, checking token and offscreen doc...`);
    const token = await getToken();
    if (token) {
        await ensureOffscreenDocument();
    }
});

console.log("Background service worker module started (PKCE + Offscreen SDK flow enabled)."); 