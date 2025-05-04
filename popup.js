// popup.js - Logic for the extension popup

document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup DOM fully loaded and parsed");
    const contentDiv = document.getElementById('content');
    const statusDiv = document.getElementById('status');

    function showLogin() {
        contentDiv.innerHTML = `
            <button id="loginButton">Login with Spotify</button>
            <p id="loginError" style="color: red; display: none;"></p>
        `;
        if (statusDiv) statusDiv.textContent = ''; // Clear status text instead

        // Add centering styles directly or via a container
        const loginButtonContainer = document.createElement('div');
        loginButtonContainer.style.textAlign = 'center';
        loginButtonContainer.style.marginTop = '20px'; // Add some space

        const loginButton = document.getElementById('loginButton');
        const loginError = document.getElementById('loginError');

        // Move button and error into the container
        if (loginButton) loginButtonContainer.appendChild(loginButton);
        if (loginError) loginButtonContainer.appendChild(loginError);
        contentDiv.innerHTML = ''; // Clear original content
        contentDiv.appendChild(loginButtonContainer); // Add the container

        if (loginButton) {
            loginButton.addEventListener('click', () => {
                console.log("Login button clicked");
                loginButton.disabled = true;
                loginButton.textContent = 'Logging in...';
                loginError.style.display = 'none';
                chrome.runtime.sendMessage({ type: "LOGIN" }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending login message:", chrome.runtime.lastError);
                        loginError.textContent = `Login failed: ${chrome.runtime.lastError.message}`;
                        loginError.style.display = 'block';
                        loginButton.disabled = false;
                        loginButton.textContent = 'Login with Spotify';
                    } else if (response && response.success) {
                        console.log("Login successful:", response);
                        showAuthenticated();
                    } else {
                        console.error("Login failed:", response);
                        loginError.textContent = `Login failed: ${response?.error || 'Unknown error'}`;
                        loginError.style.display = 'block';
                        loginButton.disabled = false;
                        loginButton.textContent = 'Login with Spotify';
                    }
                });
            });
        }
    }

    function showAuthenticated() {
        // New Structure: Place user menu container directly in body or a dedicated header?
        // For simplicity, let's add it *before* the main content div for now.
        // NOTE: This assumes a structure where #user-menu-container is OUTSIDE #content
        // If it should be inside #content, adjust the innerHTML target.

        const userMenuContainerHTML = `
          <div id="user-menu-container">
            <div id="user-menu-trigger">
              <!-- Populated by JS -->
              <span id="user-display-name">Loading...</span>
            </div>
            <div id="user-dropdown">
              <a id="profile-link" href="#" target="_blank">Open Profile</a>
              <button id="dropdown-logout-button">Logout</button>
            </div>
          </div>
        `;
        // Add user menu container to the body (or a specific header div if you have one)
        // Adjust this selector if needed
        const existingMenu = document.getElementById('user-menu-container');
        if (!existingMenu) {
             document.body.insertAdjacentHTML('afterbegin', userMenuContainerHTML);
        } else {
            // If called again, just update content - this part needs refinement
            // For now, assume it's only added once.
        }

        // --- Player Controls HTML ---
        const playerControlsHTML = `
            <div id="playerControls">
                <div class="artwork-bg"></div>
                <!-- <h4>Player Controls</h4> --> <!-- REMOVED H4 -->
                <!-- START: Move Section Toggle Buttons HERE -->
                <div id="sectionToggles">
                    <button id="togglePlaylistsIconBtn" title="Toggle Playlists"><img src="icons/playlist.png" alt="Playlists"></button>
                    <button id="toggleSearchIconBtn" title="Toggle Search"><img src="icons/search.png" alt="Search"></button>
                </div>
                <!-- END: Move Section Toggle Buttons HERE -->
                <div id="nowPlaying">-</div>
                <div id="playerError" style="color: red; font-size: 0.8em; min-height: 1em;"></div>
                <div class="playback-buttons">
                    <button id="shuffleButton" title="Toggle Shuffle"><img src="icons/shuffle-off.png" alt="Shuffle"></button>
                    <button id="prevButton"><img src="icons/previous.png" alt="Previous"></button>
                    <button id="playPauseButton"><img id="playPauseIcon" src="icons/play.png" alt="Play"></button>
                    <button id="nextButton"><img src="icons/next.png" alt="Next"></button>
                    <button id="repeatButton" title="Toggle Repeat"><img id="repeatIcon" src="icons/repeat-off.png" alt="Repeat"></button>
                </div>
                <div class="volume-like-container">
                    <div id="volumeControl">
                        <input type="range" id="volumeSlider" min="0" max="1" step="0.05" value="0.5">
                    </div>
                    <button id="likeButton" title="Save to Your Library"><img id="likeIcon" src="icons/heart-outline.png" alt="Like"></button>
                </div>
            </div>
        `;

        // --- Playlist & Search Sections HTML ---
        const listSectionsHTML = `
            <div id="playlistContainer" class="collapsible">
                <div id="playlistError" style="color: red; font-size: 0.8em;"></div>
                <span id="playlistSpinner" style="display: none; margin-left: 5px;"></span>
                <ul id="playlistList"></ul>
            </div>
            <div id="searchContainer" class="collapsible">
                <div id="search">
                    <div>
                        <input type="text" id="searchInput" placeholder="Search Spotify...">
                        <button id="searchButton">Search</button>
                    </div>
                    <span id="searchSpinner" style="display: none; margin-left: 5px;"></span>
                    <div id="searchStatus" style="font-size: 0.8em; min-height: 1em;"></div>
                    <ul id="searchResultList"></ul>
                </div>
            </div>
        `;

        // Set Player Controls into #content
        contentDiv.innerHTML = playerControlsHTML;
        // Insert List Sections after #content
        contentDiv.insertAdjacentHTML('afterend', listSectionsHTML);

        if (statusDiv) statusDiv.textContent = ''; 

        // Get elements AFTER they have been added to the DOM
        const userMenuTrigger = document.getElementById('user-menu-trigger');
        const userDisplayName = document.getElementById('user-display-name');
        const profileLink = document.getElementById('profile-link');
        const dropdownLogoutButton = document.getElementById('dropdown-logout-button');
        const userDropdown = document.getElementById('user-dropdown'); // Get the dropdown element
        const playlistContainer = document.getElementById('playlistContainer');
        const playlistList = document.getElementById('playlistList');
        const playlistError = document.getElementById('playlistError');
        const playlistSpinner = document.getElementById('playlistSpinner');
        const togglePlaylistsButton = document.getElementById('togglePlaylistsButton');
        const searchContainer = document.getElementById('searchContainer');
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const searchResultList = document.getElementById('searchResultList');
        const searchStatus = document.getElementById('searchStatus');
        const searchSpinner = document.getElementById('searchSpinner');
        const toggleSearchButton = document.getElementById('toggleSearchButton');
        const playPauseButton = document.getElementById('playPauseButton');
        const nextButton = document.getElementById('nextButton');
        const prevButton = document.getElementById('prevButton');
        const shuffleButton = document.getElementById('shuffleButton');
        const repeatButton = document.getElementById('repeatButton');
        const nowPlayingDiv = document.getElementById('nowPlaying');
        const playerErrorDiv = document.getElementById('playerError');
        const volumeSlider = document.getElementById('volumeSlider');
        const playPauseIcon = document.getElementById('playPauseIcon'); 
        const repeatIcon = document.getElementById('repeatIcon'); 
        const likeButton = document.getElementById('likeButton');
        const likeIcon = document.getElementById('likeIcon');
        const playerControlsDiv = document.getElementById('playerControls');
        const artworkBgDiv = playerControlsDiv ? playerControlsDiv.querySelector('.artwork-bg') : null;

        // --- Get New Icon Buttons ---
        const togglePlaylistsIconBtn = document.getElementById('togglePlaylistsIconBtn');
        const toggleSearchIconBtn = document.getElementById('toggleSearchIconBtn');

        // --- Attach listeners --- 
        // Add logout listener to the button IN THE DROPDOWN
        if(dropdownLogoutButton) {
             dropdownLogoutButton.addEventListener('click', handleLogout);
        } else {
            console.error("Dropdown logout button not found!");
        }
        if (togglePlaylistsIconBtn && playlistContainer) {
            togglePlaylistsIconBtn.addEventListener('click', () => {
                const isExpanding = !playlistContainer.classList.contains('expanded');
                playlistContainer.classList.toggle('expanded');
                togglePlaylistsIconBtn.classList.toggle('active', isExpanding);
                // Optionally close search if opening playlists
                if (isExpanding && searchContainer.classList.contains('expanded')) {
                    searchContainer.classList.remove('expanded');
                    if (toggleSearchIconBtn) toggleSearchIconBtn.classList.remove('active');
                }
                // Fetch if expanding and list is empty
                if (isExpanding && playlistList.innerHTML === '') {
                     fetchPlaylists(); 
                }
            });
        } else {
            console.error("Could not attach listener: Playlist Icon Button or Container element NOT found!");
        }

        if (toggleSearchIconBtn && searchContainer) {
            toggleSearchIconBtn.addEventListener('click', () => {
                const isExpanding = !searchContainer.classList.contains('expanded');
                searchContainer.classList.toggle('expanded');
                toggleSearchIconBtn.classList.toggle('active', isExpanding);
                // Optionally close playlists if opening search
                if (isExpanding && playlistContainer.classList.contains('expanded')) {
                    playlistContainer.classList.remove('expanded');
                     if (togglePlaylistsIconBtn) togglePlaylistsIconBtn.classList.remove('active');
                }
            });
        } else {
            console.error("Could not attach listener: Search Icon Button or Container not found!");
        }

        if (searchButton && searchInput) {
            searchButton.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        } else {
            console.error("Could not attach listener: Search Button or Input not found!");
        }

        let playerStateInterval = null;
        let currentTrackUri = null;
        let isPlaying = false;
        let currentShuffleState = false;
        let currentRepeatState = 'off';
        let currentVolume = 0.5;
        let albumArtUrl = null;
        let isCurrentTrackLiked = false;

        // Keep track of the current view in the playlist section
        let currentPlaylistView = 'playlists'; // 'playlists' or 'tracks'
        let currentlyDisplayedPlaylist = null;

        function displayPlaylistError(message) { 
             if(playlistError) {
                  playlistError.textContent = message; 
                  playlistError.style.display = message ? 'block' : 'none'; 
             } else { console.error("playlistError element not found"); }
        }
        function displaySearchStatus(message, isError = false) { 
            if(searchStatus) {
                 searchStatus.textContent = message; 
                 searchStatus.style.color = isError ? 'red' : '#555';
            } else { console.error("searchStatus element not found"); }
        }
        function displayPlayerError(message) { playerErrorDiv.textContent = message; playerErrorDiv.style.display = message ? 'block' : 'none'; }

        // Fetch User Profile and Populate Menu
        chrome.runtime.sendMessage({ type: "GET_USER_PROFILE" }, (response) => {
             if (!userMenuTrigger || !userDisplayName || !profileLink) {
                  console.error("User menu elements not found for population.");
                  return; 
             }
             if (response && response.success && response.profile) {
                const profile = response.profile;
                const imageUrl = profile.images?.[0]?.url;
                const profileUrl = profile.external_urls?.spotify || 'https://open.spotify.com/';
                
                // Populate trigger
                let triggerHTML = '';
                if (imageUrl) {
                     triggerHTML += `<img src="${imageUrl}" alt="Profile pic">`;
                } else {
                     triggerHTML += '<span style="margin-right:8px;">👤</span>'; // Icon if no image
                }
                triggerHTML += `<span id="user-display-name">${profile.display_name || 'User'}</span>`;
                userMenuTrigger.innerHTML = triggerHTML;

                // Populate dropdown link
                profileLink.href = profileUrl;

            } else {
                 console.error("Error fetching user profile:", response?.error);
                 // Fallback display in trigger
                 userMenuTrigger.innerHTML = '<span style="margin-right:8px;">👤</span><span id="user-display-name">Error</span>';
                 // Disable profile link?
                 profileLink.href = '#'; 
                 profileLink.style.pointerEvents = 'none';
                 profileLink.style.opacity = '0.5';

                 if (response?.error?.includes("Unauthorized")) { showLogin(); }
            }
        });

        function handleLogout() {
            if (playerStateInterval) clearInterval(playerStateInterval);
            chrome.runtime.sendMessage({ type: "LOGOUT" }, () => {
                showLogin();
            });
        }

        function playItem(trackUri = null, contextUri = null, trackUris = null, offsetIndex = null) {
             displayPlayerError('');
             console.log("Sending PLAY command", { trackUri, contextUri, trackUris, offsetIndex });
        
             let playParams = { type: "PLAY" };
             if (contextUri) {
                playParams.contextUri = contextUri;
                if (trackUri) {
                     // If we have both context and track, play track within context using offset URI
                     playParams.offset = { uri: trackUri }; 
                }
             } else if (trackUris && offsetIndex !== null) {
                 // If we have a list of URIs and an offset index
                 playParams.trackUris = trackUris;
                 playParams.offset = { position: offsetIndex }; // Use position offset
             } else if (trackUri) {
                 // If only track URI, play it directly (fallback, less common now)
                 playParams.trackUris = [trackUri];
             } else {
                 // If neither, just send PLAY (resume)
                 console.log("Sending generic PLAY (resume) command");
             }
        
             chrome.runtime.sendMessage(playParams, (playResponse) => { // Send modified params
                 if (!playResponse?.success) {
                     displayPlayerError(`Play failed: ${playResponse?.error || 'Unknown error'}`);
                 }
                 // Always update state after trying to play
                 setTimeout(() => updatePlayerState(true), 500); 
             });
        }

        function updatePlayerState(showSpinner = false) {
            console.log("updatePlayerState called");
            chrome.runtime.sendMessage({ type: "GET_PLAYER_STATE" }, (response) => {
                console.log("GET_PLAYER_STATE response received:", response);
                 let previousTrackUri = currentTrackUri;
                 let trackChanged = false;

                 if (response && response.success) {
                    displayPlayerError('');
                    const state = response.state;
                    let logSuffix = "";

                    if (state && state.item) {
                        const track = state.item;
                        // NEW: Use innerHTML with spans for Now Playing
                        nowPlayingDiv.innerHTML = `
                            <span class="now-playing-title">${track.name}</span>
                            <span class="now-playing-artist">${track.artists.map(a => a.name).join(', ')}</span>
                        `;
                        currentTrackUri = track.uri;
                        isPlaying = state.is_playing;
                        if (playPauseIcon) {
                            playPauseIcon.src = isPlaying ? 'icons/pause.png' : 'icons/play.png';
                            playPauseIcon.alt = isPlaying ? 'Pause' : 'Play';
                        } else { console.error("playPauseIcon is null in updatePlayerState"); }
                        playPauseButton.disabled = false; // Enable the button

                        currentShuffleState = state.shuffle_state;
                        currentRepeatState = state.repeat_state;
                        shuffleButton.classList.toggle('active', currentShuffleState);
                        repeatButton.classList.remove('active', 'active-track');
                        if (repeatIcon) {
                            if (currentRepeatState === 'context') {
                                repeatButton.classList.add('active');
                                repeatIcon.src = 'icons/repeat.png';
                                repeatIcon.alt = 'Repeat Context';
                            } else if (currentRepeatState === 'track') {
                                repeatButton.classList.add('active', 'active-track');
                                repeatIcon.src = 'icons/repeat-track.png';
                                repeatIcon.alt = 'Repeat Track';
                            } else {
                                repeatIcon.src = 'icons/repeat-off.png';
                                repeatIcon.alt = 'Repeat Off';
                            }
                        } else { console.error("repeatIcon is null in updatePlayerState"); }

                        if (state.device) {
                            currentVolume = state.device.volume_percent / 100;
                            volumeSlider.value = currentVolume;
                            console.log("Set volume slider based on fetched state (approx):", currentVolume);
                        }

                        logSuffix = ` Track: ${track.name}`; 
                        if (track.album && track.album.images && track.album.images.length > 0) {
                            albumArtUrl = track.album.images[0].url;
                            logSuffix += `, Art URL found: ${albumArtUrl}`;
                        } else {
                             logSuffix += ", No album art data in state.item.album.images.";
                        }

                        trackChanged = (currentTrackUri !== previousTrackUri);
                    } else {
                        nowPlayingDiv.innerHTML = '-';
                        currentTrackUri = null;
                        isPlaying = false;
                        if (playPauseIcon) {
                            playPauseIcon.src = 'icons/play.png';
                            playPauseIcon.alt = 'Play';
                        }
                        playPauseButton.disabled = true; // Disable the button
                        shuffleButton.classList.remove('active');
                        if (repeatIcon) {
                            repeatIcon.src = 'icons/repeat-off.png';
                            repeatIcon.alt = 'Repeat Off';
                        }
                        volumeSlider.value = currentVolume;
                        albumArtUrl = null;
                        trackChanged = (currentTrackUri !== previousTrackUri);
                    }
                    console.log("updatePlayerState:" + logSuffix);

                    // Reset now playing if no track info
                    if (!currentTrackUri && nowPlayingDiv.innerHTML !== '-') {
                         nowPlayingDiv.innerHTML = '-';
                    }

                    if (artworkBgDiv) {
                         if (albumArtUrl) {
                             const currentBg = artworkBgDiv.style.backgroundImage;
                             if (!currentBg || !currentBg.includes(albumArtUrl)) {
                                console.log("Setting new background art:", albumArtUrl);
                                const img = new Image();
                                img.onload = () => {
                                   if (artworkBgDiv) {
                                        artworkBgDiv.style.backgroundImage = `url(${albumArtUrl})`;
                                        artworkBgDiv.style.opacity = '1';
                                        console.log("Background art loaded and applied.");
                                   }
                                };
                                img.onerror = () => {
                                     console.error("Error loading background art image:", albumArtUrl);
                                     if (artworkBgDiv) artworkBgDiv.style.opacity = '0';
                                };
                                img.src = albumArtUrl;
                            } else {
                                console.log("Background art URL unchanged, ensuring opacity is 1.");
                                artworkBgDiv.style.opacity = '1'; // Ensure it's visible if URL didn't change
                            }
                        } else {
                             console.log("No album art URL, fading out background.");
                             artworkBgDiv.style.opacity = '0';
                         }
                    } else {
                         console.warn("artworkBgDiv element not found!");
                    }

                    if (trackChanged || !currentTrackUri) {
                        isCurrentTrackLiked = false;
                        if (likeButton) {
                           likeButton.disabled = !currentTrackUri;
                           likeButton.classList.remove('active');
                        }
                        if (likeIcon) likeIcon.src = 'icons/heart-outline.png';
                    }

                    if (currentTrackUri && trackChanged) {
                        const trackId = currentTrackUri.split(':').pop();
                        console.log(`Track changed, checking liked status for ID: ${trackId}`);
                        chrome.runtime.sendMessage({ type: "CHECK_TRACK_LIKED", trackId: trackId }, handleTrackLikedStatus);
                    } else if (!currentTrackUri) {
                        if (likeButton) likeButton.disabled = true;
                    }
                 } else {
                     console.error("Failed to get player state or no active state:", response?.error);
                     // Clear current playback display
                     nowPlayingDiv.innerHTML = '-';
                     currentTrackUri = null;
                     isPlaying = false;
                     if (playPauseIcon) {
                         playPauseIcon.src = 'icons/play.png';
                         playPauseIcon.alt = 'Play';
                     }
                     playPauseButton.disabled = true; // Also disable on API error
                     shuffleButton.classList.remove('active');
                     if (repeatIcon) {
                         repeatIcon.src = 'icons/repeat-off.png';
                         repeatIcon.alt = 'Repeat Off';
                     }
                     // volumeSlider.value = currentVolume; // Keep last volume maybe?
                     albumArtUrl = null;
                     if (artworkBgDiv) artworkBgDiv.style.opacity = '0';

                     // Attempt to get the most recently played track
                     console.log("No active state, requesting recently played track...");
                     chrome.runtime.sendMessage({ type: "GET_RECENTLY_PLAYED" }, handleRecentTrackResponse);

                     // Ensure like button is disabled if state fails
                     if (likeButton) likeButton.disabled = true;
                 }
            });
        }

        // --- NEW: Handle response for recently played track ---
        function handleRecentTrackResponse(response) {
            if (response && response.success && response.track) {
                const track = response.track;
                console.log("Received recently played track:", track);
                // Only update if nothing is currently displayed as playing
                if (nowPlayingDiv.innerHTML === '-') {
                    // Use new structure for recently played, maybe add prefix
                    nowPlayingDiv.innerHTML = `
                        <span class="now-playing-title">Last: ${track.name}</span> 
                        <span class="now-playing-artist">${track.artists.map(a => a.name).join(', ')}</span>
                    `;
                }
            } else {
                console.log("No recently played track found or error:", response?.error);
            }
        }

        // --- NEW: Handle response for track liked status ---
        function handleTrackLikedStatus(response) {
            if (!likeButton || !likeIcon) return;
            if (response && response.success) {
                isCurrentTrackLiked = response.isLiked;
                console.log(`Track Liked Status: ${isCurrentTrackLiked}`);
                likeButton.classList.toggle('active', isCurrentTrackLiked);
                likeIcon.src = isCurrentTrackLiked ? 'icons/heart-filled.png' : 'icons/heart-outline.png';
                likeButton.title = isCurrentTrackLiked ? 'Remove from Your Library' : 'Save to Your Library';
                likeButton.disabled = false; // Ensure enabled after check
            } else {
                 console.error("Failed to check track liked status:", response?.error);
                 // Keep button disabled or in default state if check fails?
                 likeButton.disabled = true; 
            }
        }

        // --- NEW: Handle like button click ---
        function handleLikeToggle() {
             if (!currentTrackUri || !likeButton) {
                 console.warn("Cannot toggle like: No current track URI or button missing.");
                 return;
             }
            const trackId = currentTrackUri.split(':').pop();
            const actionType = isCurrentTrackLiked ? "UNLIKE_TRACK" : "LIKE_TRACK";
            console.log(`${actionType} requested for track ID: ${trackId}`);

            // Disable button temporarily to prevent rapid clicks
            likeButton.disabled = true;

            chrome.runtime.sendMessage({ type: actionType, trackId: trackId }, (response) => {
                if (response && response.success) {
                    console.log(`Track ${actionType} successful.`);
                    // Update state locally immediately for responsiveness
                    isCurrentTrackLiked = !isCurrentTrackLiked;
                    likeButton.classList.toggle('active', isCurrentTrackLiked);
                    likeIcon.src = isCurrentTrackLiked ? 'icons/heart-filled.png' : 'icons/heart-outline.png';
                    likeButton.title = isCurrentTrackLiked ? 'Remove from Your Library' : 'Save to Your Library';
                    likeButton.disabled = false; // Re-enable
                } else {
                    console.error(`Failed to ${actionType}:`, response?.error);
                    displayPlayerError(`Failed to ${isCurrentTrackLiked ? 'unlike' : 'like'} track`);
                    // Re-enable button even if it failed
                    likeButton.disabled = false; 
                }
            });
        }

        function handlePlaybackAction(actionType, params = {}) {
            console.log(`${actionType} requested`, params);
            displayPlayerError('');
            chrome.runtime.sendMessage({ type: actionType, ...params }, (response) => {
                 if (!response?.success) {
                    console.error(`${actionType} failed:`, response?.error);
                    displayPlayerError(`${actionType.replace("_", " ")} failed: ${response?.error || 'Unknown error'}`);
                 }
                 setTimeout(() => updatePlayerState(true), 500);
            });
        }

        playPauseButton.addEventListener('click', () => {
            handlePlaybackAction(isPlaying ? "PAUSE" : "PLAY");
        });
        nextButton.addEventListener('click', () => handlePlaybackAction("NEXT_TRACK"));
        prevButton.addEventListener('click', () => handlePlaybackAction("PREVIOUS_TRACK"));

        shuffleButton.addEventListener('click', () => {
            const newState = !currentShuffleState;
            handlePlaybackAction("SET_SHUFFLE", { shuffleState: newState });
        });

        repeatButton.addEventListener('click', () => {
            let nextState;
            if (currentRepeatState === 'off') {
                nextState = 'context';
            } else if (currentRepeatState === 'context') {
                nextState = 'track';
            } else {
                nextState = 'off';
            }
            handlePlaybackAction("SET_REPEAT", { repeatState: nextState });
        });

        volumeSlider.addEventListener('input', (event) => {
            const newVolume = parseFloat(event.target.value);
            currentVolume = newVolume;
            console.log(`Volume slider changed, sending SET_VOLUME: ${newVolume}`);
            chrome.runtime.sendMessage({ type: "SET_VOLUME", volumeLevel: newVolume }, (response) => {
                if (!response?.success) {
                    console.error("SET_VOLUME failed:", response?.error);
                    displayPlayerError(`Volume change failed: ${response?.error}`);
                }
            });
        });

        function renderPlaylists(playlists) {
             playlistList.innerHTML = ''; // Clear current list
             // --- START: Add Liked Songs Item ---
             const likedSongsLi = document.createElement('li');
             likedSongsLi.textContent = 'Liked Songs'; // Add a heart icon
             likedSongsLi.dataset.type = 'liked-songs'; // Special identifier
             likedSongsLi.title = 'View your liked songs';
             likedSongsLi.style.fontWeight = 'bold'; // Make it stand out slightly
             likedSongsLi.addEventListener('click', fetchAndDisplayLikedSongs); // Use direct call
             playlistList.appendChild(likedSongsLi);
             // --- END: Add Liked Songs Item ---

             if (playlists.length > 0) {
                 playlists.forEach(playlist => {
                     const li = document.createElement('li');
                     li.textContent = playlist.name;
                     li.dataset.id = playlist.id; // Use ID for fetching tracks
                     li.dataset.name = playlist.name;
                     li.dataset.uri = playlist.uri; // Store URI here
                     li.title = `View tracks in ${playlist.name}`;
                     li.addEventListener('click', () => {
                         // Pass ID, name, and URI
                         fetchAndDisplayPlaylistTracks(playlist.id, playlist.name, playlist.uri);
                     });
                     playlistList.appendChild(li);
                 });
             } else {
                 playlistList.innerHTML = '<li>No playlists found.</li>';
             }
             currentPlaylistView = 'playlists';
             currentlyDisplayedPlaylist = null;
             // Remove 'Back' button if it exists when viewing playlists
             const backButton = playlistContainer.querySelector('.back-to-playlists');
             if (backButton) backButton.remove();
        }

        function fetchPlaylists() {
            if (!playlistList || !playlistSpinner || !playlistError) {
                console.error("Playlist elements not found for fetching.");
                return;
            }
            console.log("Fetching playlists...");
            playlistSpinner.style.display = 'inline';
            displayPlaylistError('');
            playlistList.innerHTML = '';

            chrome.runtime.sendMessage({ type: "GET_PLAYLISTS" }, (response) => {
                playlistSpinner.style.display = 'none';
                if (response && response.success && response.playlists) {
                    console.log("Playlists received:", response.playlists);
                    renderPlaylists(response.playlists);
                } else {
                    console.error("Error fetching playlists:", response?.error);
                    displayPlaylistError(`Failed to load playlists: ${response?.error || 'Unknown error'}`);
                }
            });
        }

        function renderPlaylistTracks(tracks, playlistName, playlistUri) {
            playlistList.innerHTML = ''; // Clear current list (which was playlists)
             if (tracks.length > 0) {
                 tracks.forEach(item => {
                    // Check if item and item.track exist (API can return null tracks for local files etc.)
                    if (!item || !item.track) {
                         console.warn("Skipping invalid track item:", item);
                         return; 
                    }
                    const track = item.track;
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="list-track-title">${track.name}</span>
                        <span class="list-track-artist">${track.artists.map(a => a.name).join(', ')}</span>
                    `;
                    li.dataset.uri = track.uri;
                    li.title = `Click to play ${track.name}`;
                    li.addEventListener('click', () => {
                        console.log(`Track clicked: ${track.name} (${track.uri}) in context ${playlistUri}`);
                        // Pass context URI and track URI for offset
                        playItem(track.uri, playlistUri);
                    });
                    playlistList.appendChild(li);
                 });
             } else {
                 playlistList.innerHTML = '<li>No tracks found in this playlist.</li>';
             }
            currentPlaylistView = 'tracks';
            currentlyDisplayedPlaylist = playlistName;
            // Add 'Back' button if it doesn't exist
            if (!playlistContainer.querySelector('.back-to-playlists')) {
                 const backButton = document.createElement('button');
                 backButton.textContent = 'Back to Playlists'; // Removed arrow
                 backButton.classList.add('back-to-playlists'); // Add class for styling/selection
                 backButton.style.marginBottom = '5px'; // Add some spacing
                 backButton.addEventListener('click', fetchPlaylists); // Re-fetch playlists on click
                 playlistContainer.insertBefore(backButton, playlistList); // Add before the list
            }
        }

        function fetchAndDisplayPlaylistTracks(playlistId, playlistName, playlistUri) {
             if (!playlistList || !playlistSpinner || !playlistError) {
                 console.error("Playlist elements not found for fetching tracks.");
                 return;
             }
             console.log(`Fetching tracks for playlist: ${playlistName} (ID: ${playlistId})`);
             playlistSpinner.style.display = 'inline';
             displayPlaylistError('');
             playlistList.innerHTML = ''; // Clear playlist list while loading tracks

             chrome.runtime.sendMessage({ type: "GET_PLAYLIST_TRACKS", playlistId: playlistId }, (response) => {
                 playlistSpinner.style.display = 'none';
                 if (response && response.success && response.tracks) {
                     console.log("Tracks received:", response.tracks);
                     renderPlaylistTracks(response.tracks, playlistName, playlistUri);
                 } else {
                     console.error("Error fetching tracks:", response?.error);
                     displayPlaylistError(`Failed to load tracks for ${playlistName}: ${response?.error || 'Unknown error'}`);
                     // Go back to playlist view on error after trying to load tracks
                     fetchPlaylists(); // Go back to the main list
                     displayPlaylistError(`Failed to load tracks for ${playlistName}.`); // Simplified error message
                 }
             });
        }

        function fetchAndDisplayLikedSongs() {
            if (!playlistList || !playlistSpinner || !playlistError) {
                console.error("Playlist elements not found for fetching liked songs.");
                return;
            }
            console.log(`Fetching Liked Songs...`);
            playlistSpinner.style.display = 'inline';
            displayPlaylistError('');
            playlistList.innerHTML = ''; // Clear playlist list while loading tracks

            chrome.runtime.sendMessage({ type: "GET_LIKED_SONGS" }, (response) => {
                playlistSpinner.style.display = 'none';
                if (response && response.success && response.tracks) {
                    console.log("Liked songs received:", response.tracks);
                    renderLikedSongs(response.tracks); // Use a dedicated render function
                } else {
                    console.error("Error fetching liked songs:", response?.error);
                    displayPlaylistError(`Failed to load liked songs: ${response?.error || 'Unknown error'}`);
                    // Optionally go back if loading fails
                    fetchPlaylists(); // Go back to playlist view on error
                }
            });
        }

        function renderLikedSongs(tracks) {
            playlistList.innerHTML = ''; // Clear current list
            const trackUris = []; // Array to hold all track URIs

            if (tracks.length > 0) {
                tracks.forEach(item => {
                    if (!item || !item.track) {
                        console.warn("Skipping invalid liked song item:", item);
                        return;
                    }
                    const track = item.track;
                    trackUris.push(track.uri); // Add URI to our list
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="list-track-title">${track.name}</span>
                        <span class="list-track-artist">${track.artists.map(a => a.name).join(', ')}</span>
                    `;
                    li.dataset.uri = track.uri;
                    li.title = `Click to play ${track.name}`;

                    // Add listener to play this track within the context of all loaded liked songs
                    li.addEventListener('click', (event) => {
                        const clickedUri = event.currentTarget.dataset.uri;
                        const allUris = JSON.parse(playlistList.dataset.uris || '[]'); // Get all URIs stored on the list
                        const index = allUris.indexOf(clickedUri);
                        
                        if (index !== -1) {
                            console.log(`Liked Song clicked: ${track.name} (${clickedUri}) at index ${index}. Playing full list.`);
                            playItem(null, null, allUris, index); // Pass full list and index
                        } else {
                            console.error("Could not find clicked URI in the list. Playing track directly.", clickedUri);
                            playItem(clickedUri); // Fallback: play just the single track
                        }
                    });
                    playlistList.appendChild(li);
                });
            } else {
                playlistList.innerHTML = '<li>No liked songs found.</li>';
            }

            // Store the full list of URIs on the UL element itself
            playlistList.dataset.uris = JSON.stringify(trackUris);

            currentPlaylistView = 'liked-songs'; // Update view state
            currentlyDisplayedPlaylist = 'Liked Songs'; // Update display name
            // Add 'Back' button if it doesn't exist
            if (!playlistContainer.querySelector('.back-to-playlists')) {
                 const backButton = document.createElement('button');
                 backButton.textContent = 'Back to Playlists';
                 backButton.classList.add('back-to-playlists');
                 backButton.style.marginBottom = '5px';
                 backButton.addEventListener('click', fetchPlaylists); // Re-fetch playlists on click
                 playlistContainer.insertBefore(backButton, playlistList);
            }
        }

        function performSearch() {
            const query = searchInput.value.trim();
            if (!query) {
                displaySearchStatus("Please enter a search term.", true);
                return;
            }
            if (!searchResultList || !searchSpinner || !searchStatus) {
                 console.error("Search elements not found for performing search.");
                 return;
            }

            console.log(`Performing search for: ${query}`);
            searchSpinner.style.display = 'inline';
            displaySearchStatus('Searching...');
            searchResultList.innerHTML = ''; // Clear previous results

            chrome.runtime.sendMessage({ type: "SEARCH_TRACKS", query: query }, (response) => {
                searchSpinner.style.display = 'none';
                if (response && response.success && response.tracks) {
                    console.log("Search results received:", response.tracks);
                    if (response.tracks.length > 0) {
                        displaySearchStatus(''); // Clear status
                        response.tracks.forEach(track => {
                            const li = document.createElement('li');
                            li.innerHTML = `
                                <span class="list-track-title">${track.name}</span>
                                <span class="list-track-artist">${track.artists.map(a => a.name).join(', ')}</span>
                            `;
                            li.dataset.uri = track.uri; // Store URI
                            li.title = `Click to play ${track.name}`;
                            li.addEventListener('click', () => {
                                console.log(`Track clicked: ${track.name} (${track.uri})`);
                                playItem(track.uri); // Play the selected track
                            });
                            searchResultList.appendChild(li);
                        });
                    } else {
                        displaySearchStatus('No tracks found for your search.');
                    }
                } else {
                    console.error("Error searching tracks:", response?.error);
                    displaySearchStatus(`Search failed: ${response?.error || 'Unknown error'}`, true);
                }
            });
        }

        if (likeButton) {
             likeButton.addEventListener('click', handleLikeToggle);
             likeButton.disabled = true; // Disable initially until state is known
        } else {
             console.error("Like button not found!");
        }

        // Add click listener for the user menu trigger
        if (userMenuTrigger && userDropdown) {
            userMenuTrigger.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent click from immediately closing menu via window listener
                userDropdown.classList.toggle('show');
            });
        } else {
            console.error("User menu trigger or dropdown not found for click listener.");
        }

        // Close dropdown if user clicks outside of it
        window.addEventListener('click', (event) => {
            if (userDropdown && userDropdown.classList.contains('show')) {
                // Check if the click was outside the dropdown and its trigger
                if (!userDropdown.contains(event.target) && !userMenuTrigger.contains(event.target)) {
                    userDropdown.classList.remove('show');
                }
            }
        });

        updatePlayerState(true);
        playerStateInterval = setInterval(updatePlayerState, 5000);
    }

    statusDiv.textContent = 'Checking status...';
    chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
             console.error("Error checking auth status:", chrome.runtime.lastError);
             statusDiv.textContent = 'Error checking status.';
             showLogin();
        } else if (response && response.isAuthenticated) {
            console.log("User is authenticated.");
            showAuthenticated();
        } else {
            console.log("User is not authenticated.");
            showLogin();
        }
    });

    window.addEventListener('unload', () => {
         if (playerStateInterval) {
             clearInterval(playerStateInterval);
             console.log("Popup closed, stopped player state polling.");
         }
    });
});
