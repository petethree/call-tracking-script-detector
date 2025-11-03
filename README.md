# Call Tracking Detector - Chrome Extension

A Chrome extension that detects, analyzes, and optionally blocks call tracking scripts on websites. This tool helps marketers, agencies, and businesses audit call tracking implementations, identify providers, compare original vs. swapped phone numbers, and test tracking behavior across different traffic sources.

## Version 1.0.0 - MVP

This is the first version (MVP) of the Call Tracking Detector Chrome extension.

## Features

### Core Detection
- ✅ Detect top 5 call tracking providers:
  - CallRail
  - Marchex
  - WhatConverts
  - Invoca
  - 800.com
- ✅ Show original vs. tracking phone numbers
- ✅ Real-time DOM monitoring for number swaps
- ✅ Identify tracking script sources

### User Interface
- ✅ Clean, intuitive popup interface
- ✅ Badge indicators showing detected trackers
- ✅ Detailed view of all phone numbers found
- ✅ Number swap detection and comparison

### Testing Tools
- ✅ Traffic source simulation (Google Ads, Facebook, etc.)
- ✅ Cookie management for testing
- ✅ Script blocking capability
- ✅ Manual rescan functionality

## Installation

### Development Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd call-tracking-script-detector
   ```

2. **Add Extension Icons**

   Before loading the extension, you need to add icon files to the `icons/` directory:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

   You can create simple icons using any image editor or use placeholder icons for testing.

3. **Load the Extension in Chrome**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked"
   - Select the `call-tracking-script-detector` folder
   - The extension should now appear in your extensions list

4. **Pin the Extension**

   - Click the Extensions icon (puzzle piece) in the Chrome toolbar
   - Find "Call Tracking Detector" and click the pin icon
   - The extension icon will now appear in your toolbar

## Usage

### Basic Detection

1. Navigate to any website
2. Click the Call Tracking Detector icon in your toolbar
3. The extension will automatically scan for:
   - Call tracking scripts
   - Phone numbers on the page
   - Number swaps (original → tracking)

### Testing Traffic Sources

1. Open the extension popup
2. In the "Test Traffic Source" section, select a platform (e.g., "Google Ads")
3. Click "Apply" - the page will reload with the tracking parameter
4. Observe how the tracking numbers change based on the traffic source

### Blocking Tracking Scripts

1. Open the extension popup
2. Toggle "Block Tracking Scripts" on
3. The page will reload with all tracking scripts blocked
4. You should now see only the original phone numbers

### Clearing Cookies

1. Open the extension popup
2. Click "Clear Domain Cookies"
3. The page will reload with a fresh session

## File Structure

```
call-tracking-script-detector/
├── manifest.json           # Chrome extension manifest (Manifest V3)
├── background.js          # Service worker for network monitoring
├── content.js             # Content script for DOM scanning
├── popup.html             # Popup interface HTML
├── popup.js               # Popup logic
├── popup.css              # Popup styling
├── utils.js               # Utility functions for phone detection
├── providers.json         # Provider library (top 5 providers)
├── rules.json             # Blocking rules for declarativeNetRequest
├── icons/                 # Extension icons (you need to add these)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── product.md             # Product requirements document
└── README.md              # This file
```

## Technical Details

### Permissions

The extension requires the following permissions:
- `activeTab` - Access to the current tab
- `storage` - Store detection results
- `cookies` - Clear cookies for testing
- `declarativeNetRequest` - Block tracking scripts
- `scripting` - Inject content scripts
- `tabs` - Access tab information
- `<all_urls>` - Scan any website

### Detection Method

The extension uses multiple detection methods:

1. **Script Detection**: Scans all `<script>` tags for known tracking domains
2. **Network Monitoring**: Monitors network requests for tracking script loads
3. **Signature Detection**: Looks for provider-specific JavaScript signatures
4. **Phone Number Extraction**: Uses regex to find phone numbers in the DOM
5. **DOM Observation**: Monitors for changes to detect number swaps

### Provider Library

The provider library (`providers.json`) contains detection patterns for each tracking provider:
- Domain patterns
- Script URL patterns
- JavaScript signatures

## Known Limitations (MVP)

- Icon files need to be added manually
- Limited to top 5 providers (more can be added to `providers.json`)
- No auto-learning system (planned for Phase 4)
- No export functionality (planned for Phase 5)
- Basic error handling

## Development Roadmap

See `product.md` for the full product roadmap. This MVP represents Phase 1 (Weeks 1-4):

- [x] Phase 1: MVP - Core detection and basic UI
- [ ] Phase 2: Enhanced Detection - All 10 providers, script blocking
- [ ] Phase 3: Traffic Testing - Advanced traffic source simulation
- [ ] Phase 4: Auto-Learning - Pattern recognition for new providers
- [ ] Phase 5: Polish & Distribution - Export, reporting, Chrome Web Store

## Testing

To test the extension:

1. Visit a website with call tracking (e.g., a site using CallRail)
2. Open the extension popup
3. Verify that:
   - Tracking scripts are detected
   - Phone numbers are found
   - Number swaps are identified (if applicable)
4. Try the traffic source testing feature
5. Test the blocking functionality

### Test Sites

Look for websites that use call tracking services. Common industries:
- Home services (plumbing, HVAC, roofing)
- Legal services
- Healthcare providers
- Auto dealerships
- Real estate agencies

## Contributing

This is version 1.0.0 (MVP). Contributions are welcome!

## Support

For issues, questions, or feature requests, please open an issue on the repository.

## License

Copyright 2025 - All Rights Reserved

## Credits

Developed by PETE3 for pete3.com

---

**Note**: This is an MVP release. Some features from the product.md specification are planned for future releases.
