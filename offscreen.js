// offscreen.js - Handles Spotify Web Playback SDK in the offscreen document

let player;
let currentAccessToken;
let currentDeviceId;

console.log("Offscreen document script loaded.");

// Wait for the SDK to be ready
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("Spotify SDK is ready.");

    player = new Spotify.Player({
        name: 'Smolfy Chrome Extension Player',
        getOAuthToken: cb => {
            // Request a fresh token from the background script when SDK needs it
            console.log("SDK requesting OAuth token...");
            chrome.runtime.sendMessage({ type: "GET_ACCESS_TOKEN" }, response => {
                if (response && response.token) {
                    console.log("Token received from background script for SDK.");
                    currentAccessToken = response.token;
                    cb(response.token);
                } else {
                    console.error("Failed to get access token from background script for SDK.", response?.error);
                    // Handle error - maybe disconnect player?
                    cb(null); // Indicate failure to get token
                }
            });
        },
        volume: 0.5 // Start with reasonable volume
    });

    // Error handling
    player.addListener('initialization_error', ({ message }) => { console.error('SDK Init Error:', message); });
    player.addListener('authentication_error', async ({ message }) => {
        console.error('SDK Auth Error:', message);
        // Token likely expired or invalid. Notify background?
        // Background should ideally handle refresh automatically upon API 401,
        // but SDK might detect expiry first.
        // For now, just log it. A robust solution would trigger re-auth or refresh.
        chrome.runtime.sendMessage({ type: "SDK_AUTH_ERROR" });
    });
    player.addListener('account_error', ({ message }) => {
         console.error('SDK Account Error:', message);
         // Likely non-premium user. Notify background/user.
         chrome.runtime.sendMessage({ type: "SDK_ACCOUNT_ERROR", message: message });
    });
    player.addListener('playback_error', ({ message }) => { console.error('SDK Playback Error:', message); });

    // Playback status updates
    player.addListener('player_state_changed', state => {
        if (!state) {
            console.warn("SDK player state is null.");
            return;
        }
        console.log('SDK Player state changed:', state);
        // Optionally send state updates to background/popup
        // chrome.runtime.sendMessage({ type: "SDK_STATE_UPDATE", state: state });
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('SDK Player Ready with Device ID', device_id);
        currentDeviceId = device_id;
        // Send device ID to background script so it can target this player
        chrome.runtime.sendMessage({ type: "SDK_READY", deviceId: device_id });
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
        console.log('SDK Device ID has gone offline', device_id);
        if (currentDeviceId === device_id) {
            currentDeviceId = null;
        }
         chrome.runtime.sendMessage({ type: "SDK_NOT_READY", deviceId: device_id });
    });

    // Connect to the player!
    player.connect().then(success => {
        if (success) {
            console.log('The Web Playback SDK successfully connected to Spotify!');
        } else {
            console.error('The Web Playback SDK failed to connect to Spotify.');
        }
    });
};

// Listen for commands from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Offscreen received message:", request);
    if (!player) {
        console.error("Player not initialized yet.");
        sendResponse({ success: false, error: "Player not initialized" });
        return false;
    }

    switch (request.type) {
        case 'SDK_PLAY':
            if (!currentDeviceId) {
                 console.error("Cannot play, SDK device ID not available.");
                 sendResponse({ success: false, error: "SDK Player not ready"});
                 return false;
            }

            // Attempt direct SDK play
            const sdkPlayOptions = {
                uris: request.trackUris ? (Array.isArray(request.trackUris) ? request.trackUris : [request.trackUris]) : undefined,
                context_uri: request.contextUri ? request.contextUri : undefined
            };
            console.log("Attempting SDK player.play() with options:", sdkPlayOptions);
            player.play(sdkPlayOptions).then(() => {
                console.log("SDK player.play() command sent successfully.");
                sendResponse({ success: true });
            }).catch(e => {
                console.error("SDK player.play() Error:", e);
                sendResponse({ success: false, error: e.message });
            });
            return true; // Indicate async response

        case 'SDK_PAUSE':
            player.pause().then(() => {
                console.log('SDK Toggled pause');
                sendResponse({ success: true });
            }).catch(e => {
                console.error("SDK Pause Error:", e);
                sendResponse({ success: false, error: e.message });
            });
            return true; // Async

        case 'SDK_RESUME':
             player.resume().then(() => {
                console.log('SDK Resumed playback');
                sendResponse({ success: true });
            }).catch(e => {
                console.error("SDK Resume Error:", e);
                sendResponse({ success: false, error: e.message });
            });
            return true;

        case 'SDK_NEXT_TRACK':
            player.nextTrack().then(() => {
                console.log('SDK Skipped to next track');
                sendResponse({ success: true });
            }).catch(e => {
                console.error("SDK Next Track Error:", e);
                sendResponse({ success: false, error: e.message });
            });
            return true; // Async

        case 'SDK_PREVIOUS_TRACK':
            player.previousTrack().then(() => {
                console.log('SDK Skipped to previous track');
                sendResponse({ success: true });
            }).catch(e => {
                console.error("SDK Previous Track Error:", e);
                sendResponse({ success: false, error: e.message });
            });
            return true; // Async

        case 'SDK_DISCONNECT':
            if (player) {
                player.disconnect();
                console.log("SDK Player disconnected.");
            }
            sendResponse({ success: true });
            return false;

        case 'SDK_SET_VOLUME':
            if (typeof request.volume !== 'number') {
                console.error("Invalid volume received:", request.volume);
                sendResponse({ success: false, error: "Invalid volume level type" });
                return false;
            }
            const volume = Math.max(0, Math.min(1, request.volume)); // Clamp between 0 and 1
            player.setVolume(volume).then(() => {
                console.log("SDK Volume set to", volume);
                sendResponse({ success: true });
            }).catch(e => {
                console.error("SDK Set Volume Error:", e);
                sendResponse({ success: false, error: e.message });
            });
            return true; // Async

        default:
            console.warn("Unhandled message type in offscreen:", request.type);
            return false;
    }
}); 