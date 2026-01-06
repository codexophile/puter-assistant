// sites/_template.js - Template for creating new site handlers
// Copy this file and rename it to match your target site (e.g., youtube.js, twitter.js)

const TemplateHandler = {
  /**
   * Check if this handler should activate on the current page
   * @returns {boolean}
   */
  shouldActivate: () => {
    // Example: return window.location.hostname.includes('example.com');
    return false; // Change this
  },

  /**
   * Initialize the handler - called when shouldActivate returns true
   */
  init: async () => {
    console.log('🎯 Initializing Template handler');

    // Example: Use waitForEach to watch for elements appearing on the page
    // waitForEach('.your-selector', async (element) => {
    //   if (element.dataset.puterAttached) return;
    //   element.dataset.puterAttached = '1';
    //
    //   const metadata = TemplateHandler.extractMetadata(element);
    //   if (!metadata) return;
    //
    //   const ui = TemplateHandler.buildUI(element);
    //   TemplateHandler.attachHandlers(ui, metadata, element);
    // });
  },

  /**
   * Extract metadata from the page element
   * @param {HTMLElement} element - The element to extract metadata from
   * @returns {Object|null} - Metadata object or null if extraction fails
   */
  extractMetadata: element => {
    // Extract relevant information like title, author, etc.
    // Example:
    // const title = element.querySelector('.title')?.textContent?.trim();
    // const author = element.querySelector('.author')?.textContent?.trim();
    //
    // if (!title) return null;
    //
    // return { title, author };

    return null; // Implement this
  },

  /**
   * Build the UI elements for this site
   * @param {HTMLElement} element - The parent element to attach UI to
   * @returns {Object} - UI elements
   */
  buildUI: element => {
    const container = UIBuilder.createContainer('puter-content');
    element.append(container);

    const resultContainer = UIBuilder.createContainer('result-container');
    container.append(resultContainer);

    const actionBtn = UIBuilder.createActionButton('Analyze', 'analyze-button');
    const toolbar = UIBuilder.createToolbar([actionBtn]);
    container.appendChild(toolbar);

    return { actionBtn, resultContainer };
  },

  /**
   * Extract content from the page element
   * @param {HTMLElement} element - The element to extract content from
   * @returns {string} - Extracted content
   */
  extractContent: element => {
    // Extract the main content to send to AI
    // Example:
    // const contentEl = element.querySelector('.content');
    // return contentEl?.textContent || '';

    return '';
  },

  /**
   * Extract images specific to this site (optional)
   * @param {HTMLElement} element - The element to extract images from
   * @returns {Promise<Array>} - Array of image data objects
   */
  extractImages: async element => {
    const imageUrls = [];

    // Find images in the element
    // Example:
    // const imgs = element.querySelectorAll('img');
    // imgs.forEach(img => {
    //   if (img.src && img.width > 200) {
    //     imageUrls.push(img.src);
    //   }
    // });

    const uniqueUrls = [...new Set(imageUrls)];
    const imagePromises = uniqueUrls
      .slice(0, 3)
      .map(url => fetchImageAsBase64(url));
    const images = await Promise.all(imagePromises);

    return images.filter(img => img !== null);
  },

  /**
   * Attach event handlers to UI elements
   * @param {Object} ui - UI elements from buildUI
   * @param {Object} metadata - Metadata from extractMetadata
   * @param {HTMLElement} element - The source element
   */
  attachHandlers: (ui, metadata, element) => {
    const getContext = async () => {
      const content = TemplateHandler.extractContent(element);
      const images = await TemplateHandler.extractImages(element);

      const formattedContext = `
Title: ${metadata.title}
Content:
${content}
      `.trim();

      return { content, images, formattedContext };
    };

    const buildInstruction = type => {
      // You can use standard instructions or create custom ones
      return AIActions.instructions[type] || 'Analyze the following content:';
    };

    const buildOptions = (type, context) => {
      const options = { useWeb: false, mode: 'answer' };

      // Customize options based on action type
      if (type === 'analyze') {
        options.useWeb = true;
        options.searchQuery = AIActions.buildSearchQuery(
          metadata.title,
          context.content
        );
        options.searchLimit = 5;
      }

      return options;
    };

    ui.actionBtn.onclick = () =>
      AIActions.execute({
        type: 'analyze',
        buttonEl: ui.actionBtn,
        containerEl: ui.resultContainer,
        getContext,
        buildInstruction,
        buildOptions,
      });
  },

  /**
   * Cleanup function - called before page unload
   */
  cleanup: () => {
    console.log('🧹 Cleaning up Template handler');
    // Remove event listeners, observers, etc.
  },
};

// Export for content.js dispatcher
// window.TemplateHandler = TemplateHandler;
