# Smolfy Extension

![Logo](icons/icon128.png) <!-- Assuming logo path -->

So you're tired of juggling between tabs just to skip a song or adjust the volume on Spotify? 😩 Fear not because **Smolfy** is here to save your day and your sanity This Chrome extension lets you control Spotify playback and access library features right from your browser toolbar No more keeping that Spotify tab open like it's glued to your browser Free up that space for memes or something 🎤✨

---

## Why Smolfy Exists 😔➡️😎

We’ve all been there switching between devices faster than a caffeinated DJ trying to keep the music flowing seamlessly But opening a new Spotify tab every time you want to pause skip or shuffle feels like punishment 🙄  

And let’s be real sometimes you just don’t want to leave what you’re doing to switch apps or tabs Who wants to interrupt their workflow or Netflix binge just to queue up the next track Not us That’s why Smolfy was born It’s designed for people who want quick easy access to Spotify controls without ever needing to open the app or a web player tab Play directly from the extension It’s like having a mini Spotify remote in your browser 🚀  

**One quick note though (Spotify) If you’re not happy with this please contact me and I’ll remove it entirely I’m just a fan trying to make life easier for fellow music lovers All rights are reserved for the amazing folks at Spotify Their API makes this possible and I’m forever grateful to them Spotify please don’t sue me 😭😭😭**

---

## What Can Smolfy Do For You 🎶🔥

Here’s the lowdown on what this little powerhouse can do  

Login Securely Use Spotify’s fancy PKCE flow to log in safely No passwords floating around in the void of the internet Just pure secure vibes  
See What’s Playing Current track and artist info right at your fingertips No more guessing if that’s really The Weeknd or just someone who sounds suspiciously like him  
Play Directly from the Extension No need to open the Spotify app or a web player tab Smolfy lets you play pause and control playback entirely from the extension It’s like magic but better ✨  
Basic Playback Controls Play Pause Next Previous Because sometimes you just need to hit Skip on life’s awkward moments or songs  
Advanced Controls Shuffle Repeat Off Context Track Perfect for when you’re stuck in an endless loop of Dancing Queen  
Volume Control Turn it down for your Zoom call or crank it up for your living room dance party 🕺💃  
Like Unlike Tracks Love it or leave it Add songs to your Liked Songs with one click  
Playlists Liked Songs Access your playlists and Liked Songs directly No more scrolling through Spotify’s labyrinthine UI  
Search Spotify Find tracks and play them instantly Because who has time to hunt for that obscure 90s banger  
User Menu Profile picture if you’ve got one name profile link and logout button All tucked neatly into a dropdown menu  
Blurred Album Art Background Aesthetic AF Your currently playing track’s album art gets a dreamy blur effect behind the controls Mood set  

---

## Setup

To use this extension locally you'll need to set it up with your own Spotify API credentials  

### Prerequisites  

- Google Chrome or a Chromium based browser Edge Brave etc  
- A Spotify account Premium might be required for some playback control features via the API  

### Steps  

- **Clone or Download**  
  - Clone this repository git clone <repository url>  
  - OR Download the source code ZIP and extract it  

- **Get a Spotify Client ID**  
  - Go to the Spotify Developer Dashboard  
  - Log in with your Spotify account  
  - Click Create App or similar  
  - Give your app a name e g Smolfy Local and a brief description  
  - Agree to the terms  
  - Once created you'll see your Client ID Copy this ID  
  - Go to the app settings  
  - Find the Redirect URIs section  
  - You need to add the specific Redirect URI for your Chrome extension To find this  
    - Temporarily load the unpacked extension into Chrome see Step 4  
    - Go to chrome://extensions/  
    - Find the loaded Smolfy Extension  
    - Copy its Extension ID a long string of letters  
    - Construct the Redirect URI https://<YOUR_EXTENSION_ID>.chromiumapp.org/ replace <YOUR_EXTENSION_ID> with the ID you copied  
    - IMPORTANT Go back to the Spotify Developer Dashboard paste this exact Redirect URI into the settings and click Add then Save  

- **Create config.js**  
  - In the root directory of the project where manifest.json is create a new file named config.js  
  - Add the following content to the file replacing the placeholder with the Client ID you copied from the Spotify Dashboard  
    ```javascript
    // config.js
    export const CLIENT_ID = "YOUR_SPOTIFY_CLIENT_ID_HERE";
    ```  
  - Do NOT commit config.js to Git The .gitignore file created in the previous step should prevent this if set up correctly  

- **Load the Extension**  
  - Open Chrome and navigate to chrome://extensions/  
  - Enable Developer mode using the toggle switch usually in the top right  
  - Click the Load unpacked button  
  - Select the root directory of the project the folder containing manifest.json  
  - The Smolfy Extension icon should appear in your toolbar  

- **Login**  
  - Click the extension icon  
  - Click the Login with Spotify button  
  - A Spotify authorization window will appear Grant permission  
  - You should be redirected back and the extension popup should now show the player controls  

---

## Usage

- Click the extension icon to open the popup  
- Use the player controls as expected  
- Click the Playlist or Search icons below the volume slider to expand those sections  
- Click your profile picture name in the top right to access the profile link and logout button  

Screenshots Coming Soon 📸  

Stay tuned for some visual goodies to show off Smolfy’s sleek design and functionality Spoiler alert it’s gonna look chef’s kiss 👨‍🍳💋  

---

## Wrapping It Up 🎁

So there you have it Smolfy your new best friend for seamless Spotify control Whether you’re a multitasking wizard or just someone who loves convenience this extension has your back Now go forth and conquer your playlist like the music maestro you are 🎤✨  

P S If you find any bugs I would be more than happy if you contact me or commit your changes Your feedback helps make Smolfy even better 😉