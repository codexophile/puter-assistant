# Site Handlers

This directory contains site-specific functionality for the Puter AI Assistant.

## Structure

Each site handler is a self-contained module that:

1. Detects if it should run on the current page
2. Extracts content and metadata specific to that site
3. Builds appropriate UI elements
4. Handles user interactions with AI features

## Creating a New Site Handler

1. **Copy the template**: Use `_template.js` as your starting point
2. **Rename**: Name your file after the site (e.g., `youtube.js`, `twitter.js`)
3. **Implement required methods**:

   - `shouldActivate()` - Detection logic
   - `init()` - Initialization and element watching
   - `extractMetadata()` - Get title, author, etc.
   - `buildUI()` - Create buttons and containers
   - `extractContent()` - Get main content
   - `attachHandlers()` - Wire up click handlers

4. **Register in content.js**:

```javascript
const siteHandlers = [
  window.RedditHandler,
  window.YouTubeHandler, // Add your handler here
];
```

5. **Update manifest.json**:

```json
"js": [
  "marked.js",
  "helpers.js",
  "core/ui-builder.js",
  "core/ai-actions.js",
  "sites/reddit.js",
  "sites/youtube.js",  // Add your file here
  "content.js"
]
```

## Available Utilities

### Core Modules

- **UIBuilder**: Helpers for creating consistent UI

  - `createActionButton(label, className)`
  - `createContainer(className)`
  - `createToolbar(buttons)`
  - `renderResult(containerEl, markdown, duration)`
  - `sanitize(html)`

- **AIActions**: Generic AI action execution
  - `execute(config)` - Main action handler
  - `instructions` - Standard prompt templates
  - `buildSearchQuery(title, text, maxLength)` - Query builder

### Helpers (from helpers.js)

- `askWithStopwatch(prompt, model, images, options)` - AI API call
- `fetchImageAsBase64(url)` - Image fetching
- `waitForEach(selector, callback)` - DOM observer
- `generateElements(html)` - HTML string to element

## Example: Reddit Handler

See `reddit.js` for a complete implementation that:

- Watches for Reddit posts using `waitForEach`
- Extracts post metadata (title, subreddit, links)
- Handles text, images, and video captions
- Provides TL;DR, Answer, and Fact Check actions

## Best Practices

1. **Always check for existing attachments**:

```javascript
if (element.dataset.puterAttached) return;
element.dataset.puterAttached = '1';
```

2. **Use optional chaining for DOM queries**:

```javascript
const title = element.querySelector('.title')?.textContent?.trim();
```

3. **Filter images appropriately**:

```javascript
if (src && !src.includes('icon') && img.width > 200) {
  imageUrls.push(src);
}
```

4. **Provide contextual prompts**:

```javascript
const formattedContext = `
Platform: ${siteName}
Title: ${metadata.title}
Content: ${content}
`.trim();
```

5. **Handle errors gracefully**:

```javascript
try {
  // extraction logic
} catch (e) {
  console.error('Failed to extract:', e);
  return null;
}
```

## Testing

1. Load extension in Chrome
2. Navigate to your target site
3. Check console for handler activation message
4. Verify UI elements appear correctly
5. Test each action button

## Troubleshooting

- **Handler not activating**: Check `shouldActivate()` logic
- **Elements not found**: Use `waitForEach` for dynamic content
- **Images not loading**: Check CORS and image URLs
- **Prompt quality**: Adjust `formattedContext` structure
