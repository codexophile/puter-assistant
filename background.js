chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchWeb') {
    handleSearchWeb(request.query, request.options)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});

async function handleSearchWeb(
  query,
  { limit = 5, provider = 'duckduckgo', timeoutMs = 8000 } = {}
) {
  if (!query) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let results = [];

    if (provider === 'duckduckgo') {
      const encodedQuery = encodeURIComponent(query);
      const endpoint = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `q=${encodedQuery}&b=&kl=wt-wt`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const html = await response.text();
      results = parseDuckDuckGoHTML(html, limit);
    } else if (provider === 'serper') {
      const result = await chrome.storage.local.get(['serperApiKey']);
      const searchKey = result.serperApiKey;
      if (!searchKey) return [];

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': searchKey,
        },
        body: JSON.stringify({ q: query, num: limit }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const data = await response.json();
      const organic = Array.isArray(data?.organic) ? data.organic : [];

      results = organic
        .slice(0, limit)
        .map(item => ({
          title: (item.title || '').trim() || item.link,
          url: item.link,
          snippet:
            item.snippet ||
            (Array.isArray(item.snippet_highlighted_words)
              ? item.snippet_highlighted_words.join(' ')
              : ''),
        }))
        .filter(entry => entry.url && entry.snippet);
    } else {
      throw new Error(`Unsupported search provider: ${provider}`);
    }

    return results;
  } catch (error) {
    console.error('searchWeb failed', error);
    clearTimeout(timeout);
    return [];
  }
}

function parseDuckDuckGoHTML(html, limit = 5) {
  const results = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const resultElements = doc.querySelectorAll('.result');

  for (let i = 0; i < Math.min(resultElements.length, limit); i++) {
    const resultEl = resultElements[i];

    const titleLink = resultEl.querySelector('.result__a');
    const title = titleLink?.textContent?.trim() || '';
    const url = titleLink?.getAttribute('href') || '';

    const snippetEl = resultEl.querySelector('.result__snippet');
    const snippet = snippetEl?.textContent?.trim() || '';

    if (url && snippet) {
      results.push({
        title: title || url,
        url: url.startsWith('//') ? 'https:' + url : url,
        snippet,
      });
    }
  }

  return results;
}
