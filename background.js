// Import the local library (allowed in MV3 service workers)
importScripts('puter.js');

// Listen for messages from the content script (Reddit page)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ANALYZE_TEXT") {
    
    // Perform the AI request here. 
    // Since we are in the background, Reddit's CSP does not exist here.
    puter.ai.chat(request.text)
      .then(response => {
        sendResponse({ success: true, data: response });
      })
      .catch(error => {
        console.error(error);
        sendResponse({ success: false, error: error.toString() });
      });

    // Return true to indicate we will send a response asynchronously
    return true; 
  }
});