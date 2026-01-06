# Puter AI Assistant - Modular Architecture

The extension has been refactored into a clean, modular architecture that makes it easy to add site-specific functionality.

## 📁 Project Structure

```
puter-assistant/
├── core/                      # Shared functionality
│   ├── ai-actions.js         # Generic AI action execution
│   ├── ui-builder.js         # Reusable UI components
│   └── README.md             # Core module documentation
│
├── sites/                     # Site-specific handlers
│   ├── reddit.js             # Reddit functionality
│   ├── _template.js          # Template for new handlers
│   └── README.md             # Handler development guide
│
├── content.js                 # Main dispatcher
├── helpers.js                 # Utility functions
├── background.js              # Service worker
├── manifest.json              # Extension config
└── styles.css                 # Global styles
```

## 🎯 How It Works

### 1. Dispatcher Pattern (content.js)

The main content script:

- Initializes the universal floating AI panel
- Registers all site handlers
- Activates handlers based on current URL
- Manages handler lifecycle

### 2. Site Handlers (sites/\*.js)

Each site handler exports:

```javascript
{
  shouldActivate: () => boolean,  // Detection
  init: async () => void,         // Setup
  cleanup: () => void             // Teardown
}
```

### 3. Core Modules (core/\*.js)

Shared utilities used by all handlers:

- **UIBuilder**: Creates consistent UI elements
- **AIActions**: Handles AI execution lifecycle

## 🚀 Adding a New Site

### Step 1: Create Handler File

```bash
# Copy template
cp sites/_template.js sites/youtube.js
```

### Step 2: Implement Handler

```javascript
// sites/youtube.js
const YouTubeHandler = {
  shouldActivate: () => {
    return window.location.hostname.includes('youtube.com');
  },

  init: async () => {
    waitForEach('ytd-watch-flexy', async videoPage => {
      if (videoPage.dataset.puterAttached) return;
      videoPage.dataset.puterAttached = '1';

      const metadata = YouTubeHandler.extractMetadata(videoPage);
      const ui = YouTubeHandler.buildUI(videoPage);
      YouTubeHandler.attachHandlers(ui, metadata, videoPage);
    });
  },

  extractMetadata: element => {
    const title = document.querySelector('h1.title')?.textContent;
    return { title };
  },

  buildUI: element => {
    const container = UIBuilder.createContainer('puter-content');
    const btn = UIBuilder.createActionButton('Summarize Video', 'summary-btn');
    const resultContainer = UIBuilder.createContainer('result-container');

    const toolbar = UIBuilder.createToolbar([btn]);
    container.append(resultContainer, toolbar);
    element.append(container);

    return { btn, resultContainer };
  },

  extractContent: element => {
    const description = document.querySelector('#description')?.textContent;
    return description || '';
  },

  attachHandlers: (ui, metadata, element) => {
    const getContext = async () => ({
      formattedContext: `Video: ${
        metadata.title
      }\nDescription: ${YouTubeHandler.extractContent(element)}`,
      images: [],
    });

    ui.btn.onclick = () =>
      AIActions.execute({
        type: 'tldr',
        buttonEl: ui.btn,
        containerEl: ui.resultContainer,
        getContext,
        buildInstruction: type => AIActions.instructions[type],
        buildOptions: () => ({ useWeb: false }),
      });
  },

  cleanup: () => {},
};

window.YouTubeHandler = YouTubeHandler;
```

### Step 3: Register Handler

```javascript
// content.js
const siteHandlers = [
  window.RedditHandler,
  window.YouTubeHandler, // Add here
];
```

### Step 4: Update Manifest

```json
// manifest.json
"js": [
  "marked.js",
  "helpers.js",
  "core/ui-builder.js",
  "core/ai-actions.js",
  "sites/reddit.js",
  "sites/youtube.js",  // Add here
  "content.js"
]
```

## 📋 Site Handler Methods

### Required

- **`shouldActivate()`**: Return `true` if handler should run on current page
- **`init()`**: Set up observers, attach UI to page elements

### Recommended

- **`extractMetadata(element)`**: Get title, author, etc.
- **`extractContent(element)`**: Get main content text
- **`buildUI(element)`**: Create buttons and containers
- **`attachHandlers(ui, metadata, element)`**: Wire up click events
- **`cleanup()`**: Remove listeners on page unload

### Optional

- **`extractImages(element)`**: Get images for vision models
- **`extractVideoCaptions(element)`**: Get video subtitles
- Custom extraction methods specific to the site

## 🔧 Available Utilities

### From UIBuilder

```javascript
UIBuilder.createActionButton(label, className);
UIBuilder.createContainer(className);
UIBuilder.createToolbar(buttons);
UIBuilder.renderResult(containerEl, markdown, duration);
UIBuilder.sanitize(html);
```

### From AIActions

```javascript
AIActions.execute(config);
AIActions.instructions.tldr;
AIActions.instructions.answer;
AIActions.instructions['fact-check'];
AIActions.buildSearchQuery(title, text, maxLength);
```

### From helpers.js

```javascript
askWithStopwatch(prompt, model, images, options);
fetchImageAsBase64(url);
waitForEach(selector, callback);
generateElements(html);
searchWeb(query, options);
getSecret(key);
```

## 🎨 Standard Action Flow

```javascript
ui.actionBtn.onclick = () =>
  AIActions.execute({
    type: 'tldr',                    // Action identifier
    buttonEl: ui.actionBtn,          // Button to manage
    containerEl: ui.resultContainer, // Where to show result

    getContext: async () => ({       // Gather data
      formattedContext: `...`,
      images: [...],
      content: '...'
    }),

    buildInstruction: (type) =>      // Get instruction template
      AIActions.instructions[type],

    buildOptions: (type, context) => ({ // Configure API call
      useWeb: type === 'answer',
      mode: type,
      searchQuery: context.content.slice(0, 200)
    })
  });
```

## 🧪 Testing Your Handler

1. Load unpacked extension in Chrome
2. Navigate to your target site
3. Open DevTools Console
4. Look for: `✅ Activated handler for [site]`
5. Verify UI appears on target elements
6. Test each action button
7. Check for errors in console

## 📚 Documentation

- **[Core Modules](core/README.md)**: Deep dive into shared utilities
- **[Site Handlers](sites/README.md)**: Complete handler development guide
- **[Template](sites/_template.js)**: Starter template with comments

## 🎯 Benefits of This Architecture

1. **Separation of Concerns**: Site logic isolated from core logic
2. **Easy to Extend**: Add new sites without touching existing code
3. **Maintainable**: Fix bugs in one place, benefits all sites
4. **Testable**: Each module can be tested independently
5. **Consistent UX**: All sites use same UI patterns
6. **DRY**: No repeated boilerplate code

## 🔄 Migration Notes

The old monolithic `content.js` has been split:

- Universal features (floating panel, chat) → Still in `content.js`
- Reddit-specific code → `sites/reddit.js`
- Shared UI patterns → `core/ui-builder.js`
- Action execution → `core/ai-actions.js`

No functionality was lost, only reorganized for clarity and extensibility.
