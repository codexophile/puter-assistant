const originalFetch = window.fetch;

window.fetch = async function (input, init) {
  const url = typeof input === 'object' && input.url ? input.url : input;

  // Only proxy Puter requests
  if (
    typeof url === 'string' &&
    (url.includes('puter.com') || url.includes('puter.io'))
  ) {
    // Prepare the request object for the background script
    // (We can't pass complex objects like Buffers directly easily)
    const proxyInit = {
      method: init?.method || 'GET',
      headers: init?.headers || {},
      body: init?.body,
    };

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'PROXY_FETCH',
          url: url,
          init: proxyInit,
        },
        response => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          if (!response.success) {
            return reject(new Error(response.error));
          }

          // Convert the Base64 data back to a Blob
          fetch(response.data)
            .then(res => res.blob())
            .then(blob => {
              const realResponse = new Response(blob, {
                status: response.status,
                statusText: response.statusText,
              });
              // Fix 'ok' property
              Object.defineProperty(realResponse, 'ok', {
                value: response.status >= 200 && response.status < 300,
              });
              resolve(realResponse);
            });
        }
      );
    });
  }

  return originalFetch(input, init);
};
