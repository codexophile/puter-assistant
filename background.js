// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PROXY_FETCH') {
    // Perform the actual fetch from the privileged background context
    fetch(request.url, request.init)
      .then(async response => {
        // We must serialize the response body to send it back
        const blob = await response.blob();

        // Convert blob to base64 string to pass via message
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({
            success: true,
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()),
            data: reader.result, // This is the base64 string
          });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.toString() });
      });

    return true; // Indicates async response
  }
});
