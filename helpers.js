async function askWithStopwatch(prompt, model = 'gemma-3-27b-it', images = []) {
  let duration, puterResText;
  const startTime = performance.now();
  const apiKey = await getSecret('apiKey');

  try {
    // Use vision model if images are provided
    // const selectedModel = images.length > 0 ? 'gemini-1.5-flash' : model;
    const selectedModel = model;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

    // Build parts array with text and images
    const parts = [{ text: prompt }];

    // Add images if provided
    for (const imageData of images) {
      parts.push({
        inline_data: {
          mime_type: imageData.mimeType,
          data: imageData.base64,
        },
      });
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    });

    const endTime = performance.now();
    duration = endTime - startTime;

    const result = await response.json();

    if (result.candidates && result.candidates[0].content.parts[0].text) {
      puterResText = result.candidates[0].content.parts[0].text;
    } else {
      throw new Error(result.error?.message || 'Unknown error');
    }
  } catch (error) {
    puterResText = 'Error: ' + error.message;
  }

  return { puterResText, duration };
}

async function getSecret(valueKey = 'apiKey') {
  // 1. Try to get the value from chrome local storage
  const result = await chrome.storage.local.get([valueKey]);
  let secretValue = result[valueKey];

  if (secretValue) return secretValue;

  // 2. If not found, prompt the user
  secretValue = prompt(`Please enter your ${valueKey} value:`);

  // 3. If the user provided a value, save it and return it
  if (secretValue) {
    await chrome.storage.local.set({ [valueKey]: secretValue });
    return secretValue;
  }

  return null;
}

// Fetch image from URL and convert to base64
async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve({
          base64,
          mimeType: blob.type || 'image/jpeg',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to fetch image:', imageUrl, error);
    return null;
  }
}

// Convert image file to base64
async function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Extract base64 data (remove data:image/jpeg;base64, prefix)
      const base64 = reader.result.split(',')[1];
      resolve({
        base64,
        mimeType: file.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CentralObserverManager = (function () {
  // Private properties
  let mainObserver = null;
  const callbacks = new Map(); // Maps selectors to arrays of callback functions
  const processedElements = new Map(); // Maps selectors to Sets of processed elements

  // Process mutations for all registered callbacks
  function processMutations(mutations) {
    // Check for added nodes
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        // Process added nodes
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          // Check this node against all registered selectors
          callbacks.forEach((callbackArray, selector) => {
            // Check if the node itself matches
            if (node.matches(selector)) {
              executeCallbacks(node, selector, callbackArray);
            }

            // Check if any of its children match
            if (node.querySelector(selector)) {
              node.querySelectorAll(selector).forEach(element => {
                executeCallbacks(element, selector, callbackArray);
              });
            }
          });
        });

        // Handle removed nodes (if needed)
        mutation.removedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          // Implementation for tracking removed nodes if needed
        });
      }
    });

    // Also check for all newly added elements that might match existing selectors
    // (this ensures we don't miss elements added through innerHTML or other means)
    callbacks.forEach((callbackArray, selector) => {
      document.querySelectorAll(selector).forEach(element => {
        executeCallbacks(element, selector, callbackArray);
      });
    });
  }

  // Execute callbacks for a matched element
  function executeCallbacks(element, selector, callbackArray) {
    // Get or create the Set of processed elements for this selector
    let processed = processedElements.get(selector);
    if (!processed) {
      processed = new Set();
      processedElements.set(selector, processed);
    }

    // Skip if already processed
    if (processed.has(element)) return;

    // Mark as processed and execute callbacks
    processed.add(element);
    callbackArray.forEach(callback => callback(element));
  }

  // Initialize the main observer
  function initializeObserver() {
    if (mainObserver) return; // Already initialized

    mainObserver = new MutationObserver(processMutations);
    mainObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Process existing elements on page
    callbacks.forEach((callbackArray, selector) => {
      document.querySelectorAll(selector).forEach(element => {
        executeCallbacks(element, selector, callbackArray);
      });
    });
  }

  return {
    // Register a callback for a specific selector
    observe: function (selector, callback, processExisting = true) {
      // Create or retrieve callback array for this selector
      if (!callbacks.has(selector)) {
        callbacks.set(selector, []);
        processedElements.set(selector, new Set());
      }

      callbacks.get(selector).push(callback);

      // Initialize observer if not already done
      initializeObserver();

      // Process existing elements if requested
      if (processExisting) {
        document.querySelectorAll(selector).forEach(element => {
          executeCallbacks(element, selector, callbacks.get(selector));
        });
      }

      // Return a function to remove this specific callback
      return function unobserve() {
        const callbackArray = callbacks.get(selector);
        if (callbackArray) {
          const index = callbackArray.indexOf(callback);
          if (index !== -1) {
            callbackArray.splice(index, 1);
          }

          // Remove the selector entry if no callbacks remain
          if (callbackArray.length === 0) {
            callbacks.delete(selector);
            processedElements.delete(selector);
          }
        }
      };
    },

    // Reset tracking for a specific selector
    resetSelector: function (selector) {
      if (processedElements.has(selector)) {
        processedElements.get(selector).clear();
      }
    },

    // Disconnect and clean up everything
    disconnect: function () {
      if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
      }
      callbacks.clear();
      processedElements.clear();
    },
  };
})();

function waitForEach(selector, callback, options = {}) {
  const { once = false } = options;

  // Register with observer manager
  const unobserve = CentralObserverManager.observe(selector, callback);

  // If once is true, unobserve after processing existing elements
  if (once) {
    setTimeout(unobserve, 0);
  }

  return {
    unobserve,
    reload: () => {
      CentralObserverManager.resetSelector(selector);
    },
  };
}

function generateDoc(html, returnTrusted) {
  let escapeHTMLPolicy;

  escapeHTMLPolicy = trustedTypes.createPolicy('forceInner', {
    createHTML: to_escape => to_escape,
  });

  const template = document.createElement('template');
  document.body.prepend(template);

  template.innerHTML = escapeHTMLPolicy.createHTML(html.trim());

  const templateContent = template.content;
  template.remove();
  return templateContent;
  // return template.content;
}

function generateElements(html, parent, returnTrusted) {
  const doc = generateDoc(html, returnTrusted);
  const children = doc.children;
  let returnChildren = [...children];
  if (parent) {
    returnChildren.length = 0;
    for (const child of children) {
      returnChildren.push(parent.appendChild(child));
    }
  }
  return returnChildren.length === 1 ? returnChildren[0] : returnChildren;
}
