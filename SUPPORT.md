# Support & Documentation

## Supported Call Tracking Providers

The Call Tracking Detector currently supports detection for the following providers:

### Currently Supported (v1.0.0)

| Provider | Domain(s) | Status | Notes |
|----------|-----------|--------|-------|
| **CallRail** | calltrk.com, cdn.calltrk.com | ✅ Active | Detects via script patterns and swap_number() signatures |
| **Marchex** | marchex.io, cdn.marchex.io | ✅ Active | Detects via MTK object and marchex_track() |
| **WhatConverts** | ksrndkehqnwntyxlhgto.com, whatconverts.com | ✅ Active | Detects via unique domain pattern |
| **Invoca** | invocacdn.com, invoca.net | ✅ Active | Detects via Invoca.PNAPI signature |
| **800.com** | api.800.com, app.800.com | ✅ Active | Detects via 800SessionId signature and specific API endpoints |

### Detection Methods

Each provider is detected using multiple methods:

1. **Script Domain Matching** - Identifies tracking scripts by their CDN/API domains
2. **Script Pattern Matching** - Looks for specific URL patterns in script sources
3. **JavaScript Signature Detection** - Scans for provider-specific function names and objects
4. **Network Request Monitoring** - Tracks API calls to tracking services

### Planned Additions

The following providers are planned for future releases:

- Ozentel (ozonetel.com)
- CallRevu (callrevu.com)
- Ringba (ringba.com)
- Call Box / Car Wars (callmeasurement.com)
- Google Ads Call Tracking (gstatic.com/call-tracking/)

## Getting Help

### Common Issues

**Extension not detecting tracking:**
- Make sure you're on a page that actually uses call tracking
- Try clicking the "🔄 Rescan Page" button
- Some tracking scripts load after a delay - wait a few seconds and rescan
- Check if the provider is in our supported list above

**Side panel not opening:**
- Make sure you've granted all required permissions
- Try reloading the extension in chrome://extensions/
- Check the browser console for errors

**Numbers not being detected:**
- Our phone number detection supports US format numbers
- Numbers must be in formats like: (555) 123-4567, 555-123-4567, +1 555 123 4567
- International numbers may not be detected in this version

### Reporting Issues

If you encounter a bug or issue:

1. Visit our [GitHub Issues page](https://github.com/petethree/call-tracking-script-detector/issues)
2. Check if the issue already exists
3. If not, create a new issue with:
   - Extension version
   - Chrome version
   - URL where the issue occurs (if applicable)
   - Steps to reproduce
   - Expected vs actual behavior

### Feature Requests

Have an idea for a new feature? We'd love to hear it!

Submit your feature request here: [Feature Request Form](https://docs.google.com/forms/d/e/1FAIpQLSeBxDix5LOQY_nxflpipyLUBlLI_11Ac0WyMs0yYLeZJIPrOg/viewform?usp=dialog)

### Request a New Provider

If you'd like us to add support for a specific call tracking provider:

1. Submit via our [Feature Request Form](https://docs.google.com/forms/d/e/1FAIpQLSeBxDix5LOQY_nxflpipyLUBlLI_11Ac0WyMs0yYLeZJIPrOg/viewform?usp=dialog)
2. Include:
   - Provider name
   - Example website using the provider
   - Any documentation about their tracking implementation (if available)

## Privacy & Security

### What Data We Collect

**None.** This extension:
- Does NOT send any data to external servers
- Does NOT collect or store personal information
- Does NOT track your browsing history
- Operates entirely locally in your browser

### Permissions Explained

- **activeTab** - Read the current page to detect tracking scripts
- **storage** - Save detection results temporarily for the side panel
- **cookies** - Allow you to clear cookies for testing (only when you click the button)
- **declarativeNetRequest** - Block tracking scripts when you enable blocking
- **scripting** - Inject our content script to scan pages
- **tabs** - Know which tab is active to show the right results
- **sidePanel** - Display our side panel interface
- **<all_urls>** - Scan any website you visit (doesn't send data anywhere)

## Technical Support

### Browser Requirements

- **Chrome Version**: 114 or higher (for side panel support)
- **Manifest V3**: This extension uses the latest Chrome extension architecture

### Known Limitations

- Only supports US phone number formats
- Limited to top 5 providers (more coming soon)
- Requires JavaScript to be enabled
- May not detect heavily obfuscated tracking code

## Contributing

Want to contribute to the project?

- View our [GitHub repository](https://github.com/petethree/call-tracking-script-detector)
- Submit pull requests for bug fixes or new features
- Help improve our provider detection patterns

## Version History

### v1.0.0 (Current)
- ✅ Initial release
- ✅ Support for top 5 call tracking providers
- ✅ Side panel interface
- ✅ Traffic source simulation
- ✅ Script blocking
- ✅ Cookie management

## Contact

- **Repository**: https://github.com/petethree/call-tracking-script-detector
- **Issues**: https://github.com/petethree/call-tracking-script-detector/issues
- **Feature Requests**: [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSeBxDix5LOQY_nxflpipyLUBlLI_11Ac0WyMs0yYLeZJIPrOg/viewform?usp=dialog)

---

*Last Updated: November 5, 2025*
