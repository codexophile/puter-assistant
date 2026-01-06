# Core Modules

Shared functionality used across all site handlers.

## ui-builder.js

Provides consistent UI components and rendering utilities.

### Functions

#### `sanitize(html)`

Removes dangerous elements (scripts, styles) from HTML.

```javascript
const safe = UIBuilder.sanitize(userGeneratedHtml);
```

#### `renderResult(containerEl, markdown, duration)`

Parses markdown and renders it safely with generation time.

```javascript
UIBuilder.renderResult(containerEl, responseText, 1250);
// Outputs: [rendered markdown] (Generated in 1250 ms)
```

#### `createActionButton(label, className)`

Creates a styled button element.

```javascript
const btn = UIBuilder.createActionButton('Summarize', 'summary-button');
```

#### `createContainer(className)`

Creates a div container with specified class.

```javascript
const container = UIBuilder.createContainer('results-container');
```

#### `createToolbar(buttons)`

Creates a toolbar with AI icon and buttons.

```javascript
const toolbar = UIBuilder.createToolbar([btn1, btn2, btn3]);
```

---

## ai-actions.js

Generic AI action execution framework.

### Main Function

#### `AIActions.execute(config)`

Executes an AI action with full lifecycle management.

**Config object:**

```javascript
{
  type: 'tldr',              // Action type identifier
  buttonEl: HTMLElement,      // Button to disable during execution
  containerEl: HTMLElement,   // Container for results
  getContext: async () => {   // Function returning context
    return {
      formattedContext: 'Post Title: ...',
      images: [...],
      selfText: '...'
    };
  },
  buildInstruction: (type) => '...', // Function returning instruction
  buildOptions: (type, context) => ({ // Function returning API options
    useWeb: true,
    mode: 'answer',
    searchQuery: '...',
    searchLimit: 5
  }),
  onRender: (containerEl, text, duration) => {} // Optional custom renderer
}
```

**What it does:**

1. Disables button, sets "Working…" state
2. Calls `getContext()` to gather data
3. Builds instruction from `type`
4. Builds API options
5. Combines instruction + context into full prompt
6. Calls `askWithStopwatch()`
7. Renders result (custom or default)
8. Restores button state
9. Handles errors gracefully

### Standard Instructions

Pre-built instruction templates for common actions.

#### `AIActions.instructions.tldr`

Comprehensive summarization with bias detection, sarcasm analysis, etc.

#### `AIActions.instructions.answer`

Answers questions or provides solutions with web research support.

#### `AIActions.instructions['fact-check']`

Verifies claims with evidence-based checking.

**Usage:**

```javascript
const instruction = AIActions.instructions[type];
```

### Utilities

#### `AIActions.buildSearchQuery(title, bodyText, maxLength = 240)`

Creates compact search query from title and body.

```javascript
const query = AIActions.buildSearchQuery(
  'How to fix CORS errors?',
  'I am getting CORS errors when...',
  200
);
// Returns: "How to fix CORS errors? I am getting CORS errors when... [truncated]"
```

---

## Usage Example

Here's how Reddit handler uses these modules:

```javascript
// 1. Build UI
const ui = {
  tldrBtn: UIBuilder.createActionButton('TL;DR', 'tldr-button'),
  tldrContainer: UIBuilder.createContainer('tldr-container'),
};

const toolbar = UIBuilder.createToolbar([ui.tldrBtn]);

// 2. Set up context getter
const getContext = async () => {
  const text = element.textContent;
  const images = await extractImages(element);

  return {
    formattedContext: `Title: ${title}\nContent: ${text}`,
    images,
    text,
  };
};

// 3. Instruction builder
const buildInstruction = type => AIActions.instructions[type];

// 4. Options builder
const buildOptions = (type, context) => ({
  useWeb: type === 'answer',
  mode: type,
  searchQuery:
    type === 'answer'
      ? AIActions.buildSearchQuery(title, context.text)
      : undefined,
  searchLimit: 5,
});

// 5. Attach handler
ui.tldrBtn.onclick = () =>
  AIActions.execute({
    type: 'tldr',
    buttonEl: ui.tldrBtn,
    containerEl: ui.tldrContainer,
    getContext,
    buildInstruction,
    buildOptions,
  });
```

---

## Benefits of This Architecture

1. **DRY**: No repeated loading states, error handling, or rendering logic
2. **Consistency**: All site handlers behave the same way
3. **Maintainability**: Fix once in core, benefits all sites
4. **Extensibility**: Easy to add new action types
5. **Testing**: Core logic isolated and testable
6. **Customization**: Site handlers can override any part via config

---

## Adding New Action Types

1. **Add instruction template** to `AIActions.instructions`:

```javascript
AIActions.instructions.translate = `Translate the following content to English...`;
```

2. **Use in site handler**:

```javascript
translateBtn.onclick = () =>
  AIActions.execute({
    type: 'translate',
    buttonEl: translateBtn,
    containerEl: translateContainer,
    getContext,
    buildInstruction,
    buildOptions,
  });
```

3. **Customize options** in `buildOptions`:

```javascript
const buildOptions = (type, context) => {
  if (type === 'translate') {
    return { useWeb: false, model: 'gemma-3-27b-it' };
  }
  // ... other types
};
```
