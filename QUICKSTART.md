# Quick Start: Adding YouTube Support

Let's add YouTube support as an example of how easy it is to add new sites.

## Create the Handler

Create `sites/youtube.js`:

```javascript
const YouTubeHandler = {
  shouldActivate: () => {
    return window.location.hostname.includes('youtube.com');
  },

  init: async () => {
    console.log('🎯 Initializing YouTube handler');

    // Wait for video pages to load
    waitForEach('#primary-inner', async videoArea => {
      if (videoArea.dataset.puterAttached) return;
      videoArea.dataset.puterAttached = '1';

      const metadata = YouTubeHandler.extractMetadata();
      if (!metadata) return;

      const ui = YouTubeHandler.buildUI(videoArea);
      YouTubeHandler.attachHandlers(ui, metadata);
    });
  },

  extractMetadata: () => {
    const title = document
      .querySelector('h1.ytd-watch-metadata yt-formatted-string')
      ?.textContent?.trim();
    const channel = document
      .querySelector('ytd-channel-name a')
      ?.textContent?.trim();

    if (!title) return null;

    return { title, channel: channel || 'Unknown' };
  },

  buildUI: container => {
    // Create our UI container
    const puterContainer = UIBuilder.createContainer('puter-content');

    // Create buttons
    const summarizeBtn = UIBuilder.createActionButton(
      '📝 Summarize',
      'summarize-button'
    );
    const keyPointsBtn = UIBuilder.createActionButton(
      '🎯 Key Points',
      'keypoints-button'
    );

    // Create result containers
    const summarizeContainer = UIBuilder.createContainer('summarize-container');
    const keyPointsContainer = UIBuilder.createContainer('keypoints-container');

    puterContainer.append(summarizeContainer, keyPointsContainer);

    // Create toolbar
    const toolbar = UIBuilder.createToolbar([summarizeBtn, keyPointsBtn]);
    puterContainer.appendChild(toolbar);

    // Insert after description
    const description = document.querySelector('#description-inline-expander');
    if (description) {
      description.after(puterContainer);
    }

    return {
      summarizeBtn,
      keyPointsBtn,
      summarizeContainer,
      keyPointsContainer,
    };
  },

  extractContent: () => {
    // Get video description
    const description =
      document.querySelector(
        '#description-inline-expander yt-attributed-string'
      )?.textContent || '';

    // Try to get transcript if available
    const transcriptBtn = document.querySelector(
      '[aria-label*="transcript" i]'
    );

    return description;
  },

  attachHandlers: (ui, metadata) => {
    const getContext = async () => {
      const content = YouTubeHandler.extractContent();

      return {
        formattedContext: `
Video Title: ${metadata.title}
Channel: ${metadata.channel}
Description:
${content}
        `.trim(),
        images: [],
        content,
      };
    };

    const buildInstruction = type => {
      if (type === 'summarize') {
        return `Summarize this YouTube video based on its title and description. 
Focus on the main topics covered and key takeaways.`;
      } else if (type === 'keypoints') {
        return `Extract the key points from this YouTube video's description as a bullet list.
Highlight the most important information viewers should know.`;
      }
      return AIActions.instructions[type];
    };

    const buildOptions = (type, context) => ({
      useWeb: false,
      mode: 'answer',
    });

    ui.summarizeBtn.onclick = () =>
      AIActions.execute({
        type: 'summarize',
        buttonEl: ui.summarizeBtn,
        containerEl: ui.summarizeContainer,
        getContext,
        buildInstruction,
        buildOptions,
      });

    ui.keyPointsBtn.onclick = () =>
      AIActions.execute({
        type: 'keypoints',
        buttonEl: ui.keyPointsBtn,
        containerEl: ui.keyPointsContainer,
        getContext,
        buildInstruction,
        buildOptions,
      });
  },

  cleanup: () => {
    console.log('🧹 Cleaning up YouTube handler');
  },
};

window.YouTubeHandler = YouTubeHandler;
```

## Register the Handler

Edit `content.js` around line 410:

```javascript
const siteHandlers = [
  window.RedditHandler,
  window.YouTubeHandler, // Add this line
];
```

## Update Manifest

Edit `manifest.json`:

```json
"js": [
  "marked.js",
  "helpers.js",
  "core/ui-builder.js",
  "core/ai-actions.js",
  "sites/reddit.js",
  "sites/youtube.js",  // Add this line
  "content.js"
]
```

## Test It

1. Save all files
2. Go to `chrome://extensions`
3. Click "Reload" on your extension
4. Navigate to any YouTube video
5. Look for the ✨ toolbar below the description
6. Click "📝 Summarize" or "🎯 Key Points"

## That's It! 🎉

You just added YouTube support in ~100 lines of code. The modular architecture handles:

- ✅ Loading states
- ✅ Error handling
- ✅ UI rendering
- ✅ AI API calls
- ✅ Response formatting

All you did was define:

1. When to activate (YouTube URLs)
2. What to extract (title, channel, description)
3. Where to put UI (after description)
4. What actions to offer (summarize, key points)

---

## Add More Sites

Follow the same pattern for:

- **Twitter/X**: Summarize threads, fact-check claims
- **GitHub**: Explain code, review PRs
- **Stack Overflow**: Generate better answers
- **Medium**: Summarize articles
- **Amazon**: Analyze reviews
- **LinkedIn**: Improve posts

Each site is independent and doesn't affect the others!
