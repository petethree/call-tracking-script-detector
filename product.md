# Product Requirements Document
## Call Tracking Detector - Chrome Extension

**Version:** 1.0  
**Date:** November 3, 2025  
**Product Owner:** CEO/Founder  

---

## Executive Summary

A Chrome extension that detects, analyzes, and optionally blocks call tracking scripts on websites. The tool helps marketers, agencies, and businesses audit call tracking implementations, identify providers, compare original vs. swapped phone numbers, and test tracking behavior across different traffic sources.

**Value Proposition:** Save hours of manual inspection by instantly revealing call tracking setups and testing their behavior across different ad platforms.

---

## Problem Statement

Call tracking implementations are invisible to the naked eye, making it difficult to:
- Verify call tracking is working correctly
- Identify which provider is being used
- Compare original phone numbers vs. tracking numbers
- Test tracking behavior across different traffic sources (Google Ads, Facebook, etc.)
- Audit competitor call tracking strategies
- Troubleshoot tracking issues

---

## Target Users

1. **Digital Marketing Agencies** - Auditing client implementations
2. **SEO/PPC Specialists** - Verifying tracking setups
3. **Business Owners** - Monitoring their own tracking
4. **Competitive Intelligence** - Analyzing competitor strategies
5. **Web Developers** - Debugging tracking implementations

---

## Core Features

### 1. Call Tracking Detection Engine

**Requirements:**
- Scan page DOM and network requests for call tracking scripts
- Identify tracking provider by domain/script signature
- Detect both static and dynamic number insertions
- Monitor for JavaScript-based number swaps in real-time
- Support for multiple numbers on a single page

**Initial Provider Library:**
- CallRail (calltrk.com)
- Marchex (marchex.io)
- WhatConverts (ksrndkehqnwntyxlhgto.com)
- Invoca (invocacdn.com)
- 800.com (api.800.com)
- Ozentel (ozonetel.com)
- CallRevu (callrevu.com)
- Ringba (ringba.com)
- Call Box / Car Wars (callmeasurement.com)
- Google Ads Call Tracking (gstatic.com/call-tracking/)

**Auto-Learning System:**
- Detect unknown call tracking patterns
- Identify new providers by script behavior
- Flag suspicious number swapping for review
- Allow user to add custom providers to library

### 2. Phone Number Analysis

**Display for Each Detected Number:**
```
✓ Original Number: (555) 123-4567
→ Tracking Number: (888) 999-8888
📊 Provider: CallRail
🔗 Script: calltrk.com/ls.js
📍 Location: Header, Footer, Contact Form
```

**Requirements:**
- Capture original phone number before swap
- Monitor DOM changes to catch dynamic swaps
- Track number changes on page interactions
- Show all instances across the page
- Format numbers consistently for comparison

### 3. Script Blocking Feature

**Functionality:**
- Toggle to enable/disable tracking script blocking
- Block scripts via Chrome's declarativeNetRequest API
- Refresh page to show original numbers only
- Visual indicator when blocking is active
- Persist blocking preferences per domain

**User Flow:**
1. User enables "Block Tracking Scripts"
2. Page auto-refreshes
3. Only original phone numbers display
4. Badge shows "Blocking Active"

### 4. Traffic Source Simulation

**Ad Platform Parameters:**
- **Google Ads:** ?gclid=test123
- **Facebook/Instagram:** ?fbclid=test123
- **Microsoft Ads:** ?msclkid=test123
- **TikTok Ads:** ?ttclid=test123
- **Pinterest Ads:** ?epik=test123
- **Snapchat Ads:** ?ScCid=test123
- **Twitter/X Ads:** ?twclid=test123
- **LinkedIn Ads:** ?li_fat_id=test123
- **YouTube Ads:** ?yclid=test123
- **Bing Ads:** ?msclkid=test123

**Features:**
- Quick-select dropdown for common sources
- One-click to append parameter and reload
- Custom parameter builder
- Clear all parameters button
- Compare tracking numbers across sources

### 5. Cookie Management

**Capabilities:**
- Clear all cookies for current domain
- Clear specific tracking cookies only
- View active cookies
- Reset testing environment
- Preserve user preferences

---

## User Interface Design

### Extension Popup (Primary Interface)

**Layout:**
```
┌─────────────────────────────────────┐
│ 🔍 Call Tracking Detector           │
├─────────────────────────────────────┤
│ ⚡ Status: 2 Trackers Detected      │
│                                     │
│ 📞 Phone Numbers Found (3)          │
│ ┌─────────────────────────────────┐ │
│ │ Original: (555) 123-4567        │ │
│ │ Tracking: (888) 999-8888        │ │
│ │ Provider: CallRail              │ │
│ │ Location: Header                │ │
│ │ [Details ▼]                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🛡️ Script Blocking                  │
│ [ Toggle ] Block All Tracking      │
│                                     │
│ 🧪 Test Traffic Source              │
│ [Dropdown: Select Platform ▼]      │
│ [Apply] [Clear]                    │
│                                     │
│ 🍪 Cookie Management                │
│ [Clear Domain Cookies]             │
│                                     │
│ 📚 Provider Library (10)            │
│ [Manage Providers]                 │
└─────────────────────────────────────┘
```

### Badge Indicators
- **Green Badge:** Tracking detected (shows count)
- **Red Badge:** Blocking active
- **Gray Badge:** No tracking found
- **Yellow Badge:** New provider detected

### Context Menu Items
- Right-click phone number → "Add to Tracking Library"
- Right-click page → "Scan for Call Tracking"

---

## Technical Requirements

### Chrome Extension Architecture

**Manifest V3 Specifications:**
```json
{
  "manifest_version": 3,
  "name": "Call Tracking Detector",
  "permissions": [
    "activeTab",
    "storage",
    "cookies",
    "declarativeNetRequest",
    "scripting",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

**Components:**

1. **Background Service Worker**
   - Monitor network requests
   - Manage blocking rules
   - Handle messaging between components
   - Store provider database

2. **Content Script**
   - Scan DOM for phone numbers
   - Monitor DOM mutations
   - Detect script injections
   - Report findings to popup

3. **Popup Interface**
   - Display findings
   - Control toggles
   - Manage testing features

4. **Storage**
   - Provider library (JSON)
   - User preferences
   - Blocked domains
   - Learning data for new providers

### Detection Algorithm

**Phase 1: Script Detection**
```javascript
// Pseudocode
1. Monitor network requests for known tracking domains
2. Scan page <script> tags for tracking sources
3. Check for tracking script patterns (async loads, CDN references)
4. Flag suspicious external scripts
```

**Phase 2: Number Detection**
```javascript
// Pseudocode
1. Extract all phone numbers from HTML (regex patterns)
2. Store original numbers before any DOM changes
3. Set up MutationObserver on document
4. Detect when numbers are replaced
5. Link replacement to tracking script
6. Format and compare original vs. tracking
```

**Phase 3: Provider Identification**
```javascript
// Pseudocode
1. Match script domain to known providers
2. Check for unique script signatures
3. Analyze API endpoints being called
4. Identify by script behavior patterns
5. Flag unknown providers for learning
```

### Performance Requirements
- Initial scan: <2 seconds
- DOM monitoring: Minimal CPU impact
- Memory footprint: <50MB
- No impact on page load speed when not blocking

---

## Traffic Source Parameters

### Complete UTM & Click ID Reference

| Platform | Parameter | Example |
|----------|-----------|---------|
| Google Ads | gclid | ?gclid=Cj0KCQ... |
| Facebook/IG | fbclid | ?fbclid=IwAR2... |
| Microsoft Ads | msclkid | ?msclkid=abc123 |
| TikTok | ttclid | ?ttclid=xyz789 |
| Pinterest | epik | ?epik=dj0yJnU9... |
| Snapchat | ScCid | ?ScCid=snap123 |
| Twitter/X | twclid | ?twclid=tw123 |
| LinkedIn | li_fat_id | ?li_fat_id=abc |
| YouTube | yclid | ?yclid=yt123 |
| Reddit | rdt_cid | ?rdt_cid=reddit |
| Quora | qclid | ?qclid=quora123 |

**Custom Parameters:**
- Allow users to add custom parameters
- Support multiple parameters simultaneously
- Preserve existing URL parameters

---

## Auto-Learning System

### Intelligent Provider Detection

**Machine Learning Approach:**

1. **Pattern Recognition**
   - Script loading patterns
   - API endpoint structures
   - Cookie naming conventions
   - Number swap behaviors

2. **User Confirmation Loop**
   ```
   New Provider Detected!
   Domain: newtracker.com
   Pattern: Dynamic number swap via API
   
   [✓ Add to Library] [✗ Ignore] [Report False Positive]
   ```

3. **Confidence Scoring**
   - High (90%+): Auto-add to library
   - Medium (70-89%): Request confirmation
   - Low (<70%): Flag for manual review

4. **Crowdsourced Database**
   - Optional: Share discoveries with community
   - Receive updates from other users
   - Privacy-first: No site URLs shared, only providers

---

## Data Display & Export

### Detailed View Per Number

```
📞 Phone Number Analysis
────────────────────────────
Original Number:
  Format: (555) 123-4567
  Found in HTML: Line 47, 156, 342
  Original Element: <a href="tel:+15551234567">

Tracking Number:
  Format: (888) 999-8888
  Swapped by: CallRail
  Swap Method: JavaScript (DOM manipulation)
  Swap Time: 234ms after page load

Provider Details:
  Name: CallRail
  Script URL: //cdn.calltrk.com/ls.js
  API Endpoint: calltrk.com/track
  Company Pool: Detected (5 numbers in rotation)

Page Locations:
  • Header navigation (1)
  • Footer (2)
  • Contact form (1)
  • Sidebar widget (1)

[Copy Original] [Copy Tracking] [Export JSON]
```

### Export Options
- JSON format for all findings
- CSV for spreadsheet analysis
- Screenshot of comparison
- Shareable report URL

---

## Success Metrics

### Product KPIs
- Active users (DAU/MAU)
- Scans per user per session
- Provider detection accuracy (>95%)
- Time saved vs. manual inspection
- User retention rate

### Feature Usage
- Most used traffic source tests
- Blocking feature adoption
- New provider submissions
- Export/report generation

### Quality Metrics
- False positive rate (<5%)
- Detection speed (<2s)
- Extension rating (target 4.5+)
- Bug reports per 1000 users

---

## Development Phases

### Phase 1: MVP (Weeks 1-4)
**Core Functionality:**
- Detect top 5 call tracking providers
- Show original vs. tracking numbers
- Basic popup interface
- Manual provider selection

**Deliverable:** Working Chrome extension with basic detection

### Phase 2: Enhanced Detection (Weeks 5-6)
**Add:**
- All 10 initial providers
- Script blocking functionality
- Cookie clearing
- Badge indicators

**Deliverable:** Full detection suite with blocking

### Phase 3: Traffic Testing (Weeks 7-8)
**Add:**
- Traffic source simulation
- Parameter injection
- Multi-source comparison
- Testing workflows

**Deliverable:** Complete testing toolkit

### Phase 4: Auto-Learning (Weeks 9-12)
**Add:**
- Pattern recognition engine
- New provider detection
- User confirmation loop
- Provider library management

**Deliverable:** Self-improving detection system

### Phase 5: Polish & Distribution (Weeks 13-14)
**Add:**
- Export functionality
- Advanced reporting
- User onboarding
- Chrome Web Store optimization

**Deliverable:** Production-ready extension

---

## Go-to-Market Strategy

### Target Channels
1. **Chrome Web Store**
   - SEO-optimized listing
   - Video demo
   - Screenshots of key features

2. **Marketing Communities**
   - ProductHunt launch
   - /r/PPC, /r/marketing
   - Digital marketing Facebook groups
   - LinkedIn marketing communities

3. **Content Marketing**
   - "How to Detect Call Tracking" guide
   - YouTube tutorial
   - Comparison blog posts
   - Case studies

4. **Partnerships**
   - Marketing agencies
   - Call tracking review sites
   - Marketing tool directories

### Monetization Options
1. **Free Version:** Basic detection (5 providers)
2. **Pro Version ($9.99/mo):**
   - All providers
   - Auto-learning
   - Export features
   - Priority support
3. **Team Plan ($49/mo):**
   - Shared provider library
   - Team dashboards
   - Bulk exports

---

## Competitive Advantage

**Why This Wins:**
1. **Only tool specifically for call tracking detection**
2. **Auto-learning makes it future-proof**
3. **Testing capabilities save hours of work**
4. **Simple, focused interface**
5. **Free tier gets users hooked**

**Moat:**
- Growing provider database
- Pattern recognition improves with usage
- Network effects from community contributions
- First-mover advantage in this niche

---

## Risk Assessment

### Technical Risks
- **Risk:** Call tracking providers change scripts frequently
- **Mitigation:** Auto-learning system adapts automatically

- **Risk:** Heavy DOM monitoring impacts performance
- **Mitigation:** Optimize observers, throttle checks, use efficient selectors

### Market Risks
- **Risk:** Small addressable market
- **Mitigation:** Expand to general marketing script detection

- **Risk:** Call tracking providers block detection
- **Mitigation:** Multiple detection methods, obfuscation techniques

### Compliance Risks
- **Risk:** Chrome Web Store policy violations
- **Mitigation:** Follow Manifest V3, no data collection without consent

---

## Future Enhancements (Post-MVP)

### Additional Features
- **Multi-page scanning:** Crawl entire site
- **Historical tracking:** Compare numbers over time
- **API access:** Integrate with other tools
- **Competitor comparison:** Side-by-side analysis
- **Alert system:** Notify when tracking breaks
- **Mobile app:** iOS/Android versions
- **Analytics tracking detection:** Expand beyond call tracking
- **Form tracking detection:** Identify form tracking scripts
- **Chat widget detection:** Find live chat tracking

### Integrations
- Slack notifications
- Google Sheets export
- CRM integrations (HubSpot, Salesforce)
- Marketing dashboards

---

## Development Requirements

### Team Needs
- **1 Chrome Extension Developer** (8-12 weeks)
- **1 UI/UX Designer** (2-3 weeks)
- **QA/Testing** (ongoing)
- **Marketing/Launch** (2-4 weeks)

### Technology Stack
- **Frontend:** HTML/CSS/JavaScript (Vanilla or React)
- **Storage:** Chrome Storage API
- **Pattern Matching:** Regex + ML library (TensorFlow.js optional)
- **Build Tools:** Webpack/Vite
- **Testing:** Jest, Chrome Extension Testing Library

### Budget Estimate (Rough)
- Development: $15,000 - $25,000
- Design: $2,000 - $3,000
- Chrome Web Store: $5 one-time
- Marketing/Launch: $1,000 - $5,000
- **Total: ~$20,000 - $35,000**

---

## Launch Checklist

**Pre-Launch:**
- [ ] All MVP features tested
- [ ] Chrome Web Store listing prepared
- [ ] Marketing site/landing page live
- [ ] Video demo recorded
- [ ] Documentation written
- [ ] Beta testers recruited (50-100 users)
- [ ] Analytics tracking setup
- [ ] Support system ready

**Launch Week:**
- [ ] Submit to Chrome Web Store
- [ ] ProductHunt launch
- [ ] Social media announcements
- [ ] Email marketing partners
- [ ] Post in marketing communities
- [ ] Press release to marketing publications

**Post-Launch:**
- [ ] Monitor reviews and ratings
- [ ] Respond to user feedback quickly
- [ ] Fix critical bugs within 24 hours
- [ ] Weekly feature updates
- [ ] Build provider library aggressively

---

## Success Definition

**6 Months Post-Launch:**
- 5,000+ active users
- 4.5+ Chrome Web Store rating
- 20+ providers in database
- 200+ new providers discovered by community
- Profitable (if monetized)

**12 Months:**
- 20,000+ active users
- Industry-recognized tool
- 50+ providers in database
- Partnership deals with agencies
- Sustainable revenue stream

---

## Appendix A: Provider Detection Patterns

### Common Call Tracking Script Patterns

```javascript
// Pattern 1: External script load
<script src="https://cdn.calltracker.com/track.js"></script>

// Pattern 2: Async script injection
var s = document.createElement('script');
s.src = '//tracking.com/js';
document.head.appendChild(s);

// Pattern 3: Phone number swap function
function swapPhoneNumber(original, tracking) {
  document.querySelectorAll('[href*="tel:"]').forEach(el => {
    el.href = el.href.replace(original, tracking);
    el.textContent = tracking;
  });
}

// Pattern 4: Dynamic number pool
fetch('https://api.tracker.com/number?session=xyz')
  .then(r => r.json())
  .then(data => swapNumber(data.tracking_number));
```

### Detection Signatures

| Provider | Primary Domain | Secondary Indicators |
|----------|----------------|---------------------|
| CallRail | calltrk.com | swap_number(), CR.track() |
| Invoca | invocacdn.com | invoca.js, Invoca.PNAPI |
| Marchex | marchex.io | marchex_track(), MTK object |

---

## Appendix B: Testing Scenarios

### Test Cases for QA

1. **Single Number Detection**
   - Page with one phone number
   - Verify original capture
   - Verify tracking number detection
   - Verify provider identification

2. **Multiple Numbers**
   - Page with 5+ phone numbers
   - Different formats: (555) 123-4567, 555-123-4567, +1 555 123 4567
   - Verify all captured correctly

3. **Dynamic Loading**
   - SPA (React/Vue/Angular) sites
   - AJAX-loaded content
   - Modal/popup phone numbers

4. **Blocking Functionality**
   - Enable blocking
   - Verify scripts blocked
   - Verify original numbers shown
   - Verify no tracking numbers appear

5. **Traffic Source Testing**
   - Test each ad platform parameter
   - Verify correct appending
   - Verify tracking response changes
   - Test multiple parameters together

6. **Edge Cases**
   - No tracking present (don't false positive)
   - Unknown provider (flag for learning)
   - Multiple providers on one page
   - Tracking script fails to load

---

## Contact & Support

**Product Owner:** Pete Petersen  
**Development Team:** PETE3
**Support:** pete3.com

**Documentation:** [Wiki/Docs URL]  
**Bug Reports:** [GitHub Issues URL]  
**Feature Requests:** [Feedback Form URL]

---

*This PRD is a living document and will be updated as the product evolves.*
