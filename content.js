function generateDoc(html) {
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

async function puterWithStopwatch(prompt, model = 'gemini-3-pro-preview') {
  let duration;
  const puterRes = await puter.ai.chat(prompt, {
    model: model,
  });
  const puterResText = puterRes.content;
  duration = performance.now() - performance.now();
  return { puterResText, duration };
}

// Initialize observer for self-text elements
waitForEach('.shreddit-post-selftext.userscript-code', async selfTextEl => {
  const puterEl = generateElements(`<div class=puter-content></div>`);
  selfTextEl.parentElement.after(puterEl);

  const postTitle =
    selfTextEl.parentElement.querySelector('[id*="post-title"]').textContent;
  const selfTextPlain = selfTextEl.textContent;
  const charCount = postTitle.length + selfTextPlain.length;

  const prompt = `
You are a helpful assistant tasked with summarizing social media content.
Please provide a concise TL;DR for the Reddit post provided below.
Post Title: ${postTitle}
Post Content:
${selfTextPlain}
`;

  if (charCount >= 700) {
    chrome.runtime.sendMessage(
      { action: 'get_tldr', text: prompt },
      response => {
        if (response.success) {
          console.log(response.data);
          puterEl.textContent = response.data;
        } else {
          puterEl.textContent = 'Error: ' + response.error;
        }
      }
    );
  }
});
