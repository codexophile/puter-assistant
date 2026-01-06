// content.js

(async function () {
  const sanitize = html => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.querySelectorAll('script, style').forEach(el => el.remove());
    return wrapper.innerHTML;
  };

  const renderResult = (containerEl, markdown, duration) => {
    const parsed = marked.parse(markdown);
    containerEl.innerHTML = `${sanitize(
      parsed
    )}\n        <em>(Generated in ${Math.round(duration)} ms)</em>`;
  };

  waitForEach('shreddit-post', async postEl => {
    if (postEl.dataset.puterAttached) return;
    postEl.dataset.puterAttached = '1';

    const postTitleEl = postEl.querySelector('[id*="post-title"]');
    const postLink = postTitleEl?.href || location.href;
    const postTitle = postTitleEl?.textContent?.trim();
    const attachedLink = postEl.querySelector(
      '.post-link, [slot="post-media-container"] a'
    );
    const subredditName = postLink?.match(/\/r\/([^\/]+)/)?.[1];
    if (!postTitle || !subredditName) return;

    const puterEl = generateElements(`<div class="puter-content"></div>`);
    postEl.append(puterEl);

    const tldrContainerEl = generateElements(
      `<div class="tldr-container"></div>`
    );
    const answerContainerEl = generateElements(
      `<div class="answer-container"></div>`
    );
    const factCheckContainerEl = generateElements(
      `<div class="factcheck-container"></div>`
    );
    puterEl.append(tldrContainerEl, answerContainerEl, factCheckContainerEl);

    // Extract images from the post
    const extractPostImages = async () => {
      const imageUrls = [];

      // Look for post images in various Reddit elements
      const imgElements = postEl.querySelectorAll('img.non-lightboxed-content');
      imgElements.forEach(img => {
        const src = img.src;
        // Filter out icons, thumbnails, and very small images
        if (
          src &&
          !src.includes('icon') &&
          !src.includes('avatar') &&
          img.naturalWidth > 200 &&
          img.naturalHeight > 200
        ) {
          imageUrls.push(src);
        }
      });

      // Also check for gallery images and video thumbnails
      const galleryImages = postEl.querySelectorAll(
        'a[href*="preview.redd.it"], a[href*="i.redd.it"]'
      );
      galleryImages.forEach(link => {
        const href = link.href;
        if (
          href &&
          (href.includes('.jpg') ||
            href.includes('.png') ||
            href.includes('.jpeg'))
        ) {
          imageUrls.push(href);
        }
      });

      // Remove duplicates
      const uniqueUrls = [...new Set(imageUrls)];

      // Fetch and convert images to base64 (limit to first 3 to avoid token limits)
      const imagePromises = uniqueUrls
        .slice(0, 3)
        .map(url => fetchImageAsBase64(url));
      const images = await Promise.all(imagePromises);

      // Filter out failed fetches
      return images.filter(img => img !== null);
    };

    // Extract closed captions from the post
    const extractClosedCaptions = async () => {
      const player = postEl.querySelector('shreddit-player');
      if (!player) return null;

      // Access shadowRoot
      const shadowRoot = player.shadowRoot;
      if (!shadowRoot) return null;

      const mediaUI = shadowRoot.querySelector('shreddit-media-ui');
      if (!mediaUI) return null;

      const captionUrl = mediaUI.getAttribute('caption-url');
      if (!captionUrl) return null;

      try {
        const response = await fetch(captionUrl);
        if (!response.ok) return null;
        const text = await response.text();
        return text;
      } catch (e) {
        console.error('Failed to fetch captions', e);
        return null;
      }
    };

    const aiToolbarEl = generateElements(
      '<div class="ai-toolbar" style="margin-top: 8px;"> ✨</div>'
    );
    const tldrBtnEl = generateElements(
      '<button class="ai-button tldr-button">TL;DR</button>'
    );
    const answerBtnEl = generateElements(
      '<button class="ai-button answer-button">Answer</button>'
    );
    const factCheckBtnEl = generateElements(
      '<button class="ai-button factcheck-button">Fact Check</button>'
    );
    aiToolbarEl.append(tldrBtnEl, answerBtnEl, factCheckBtnEl);
    puterEl.appendChild(aiToolbarEl);

    const getSelfText = () => {
      const selfTextEl = postEl.querySelector(
        '.shreddit-post-selftext.userscript-code, shreddit-post-text-body'
      );
      return selfTextEl?.textContent || '';
    };

    const buildSearchQuery = bodyText => {
      const compactBody = (bodyText || '').replace(/\s+/g, ' ').trim();
      const joined = `${postTitle} ${compactBody}`.trim();
      return joined.slice(0, 240);
    };

    const handleAction = async (type, btnEl, containerEl) => {
      btnEl.disabled = true;
      const restoreText = btnEl.textContent;
      btnEl.textContent = 'Working…';
      containerEl.textContent = '';

      try {
        const selfText = getSelfText();
        const postImages = await extractPostImages();
        const captions = await extractClosedCaptions();

        const context = `
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${attachedLink}
${selfText}
${captions ? `\n\nVideo closed captions: ${captions}` : ''}
`.trim();

        let instruction = '';
        const options = { useWeb: false, mode: 'answer' };

        if (type === 'tldr') {
          instruction = `You are a helpful assistant tasked with summarizing social media content.
Provide a concise TL;DR for the Reddit post below.

1. Extract key points, highlight the most important points from the post.
Do the key point extraction only if the post contains sufficient detail.

2. Flag potentially biased content in post, only when appropriate.

3. Analyze if the post is sarcastic. Indicate this using the emoji 🙃 for sarcastic, or 🙂 for sincere.

4. Detect if original poster is genuinely asking for help or trolling.
Indicate this (whether they are trolling or not) using the emoji 🤔 for genuine, or 😈 for trolling.

5. Detect hidden agendas — Identify if someone's asking one thing but really wants validation for something else

If images are included, describe them and incorporate their content into the summary. If not don't say anything about images.

If the post is a joke in textual form, first try to summarize the joke without ruining the humor,
then explain the humor briefly.
The joke summary should still be read as a joke/story and should be entertaining on its own as a mini version of the original joke.
In this case ignore points 1, 2, 3, 4, and 5.`;
        } else if (type === 'answer') {
          instruction = `Read the Reddit post below. Also take note of the subreddit name.
If questions are asked, answer them concisely.
If no questions, offer a concise solution or advice for the situation.
Even if the post content is empty, use the title and subreddit context to inform your response.
If images are included, analyze them and incorporate their content into your response.
Always try to include relevant external links and images to support your answer.`;
          options.useWeb = true;
          options.mode = 'answer';
          options.searchQuery = buildSearchQuery(selfText);
          options.searchLimit = 6;
        } else if (type === 'fact-check') {
          instruction = `Read the Reddit post below. Also take note of the subreddit name.
Fact check the claims made in the post. Provide evidence-based verification or refutation.
If images are included, analyze them and incorporate their content into your fact check.`;
          options.useWeb = true;
          options.mode = 'fact-check';
          options.searchQuery = buildSearchQuery(selfText);
          options.searchLimit = 6;
        }

        const fullPrompt = `${instruction}\n\n${context}`;
        const { puterResText, duration } = await askWithStopwatch(
          fullPrompt,
          undefined,
          postImages,
          options
        );
        renderResult(containerEl, puterResText, duration);
      } catch (err) {
        console.error(err);
        containerEl.textContent =
          'Sorry, something went wrong. Please try again.';
      } finally {
        btnEl.disabled = false;
        btnEl.textContent = restoreText;
      }
    };

    tldrBtnEl.onclick = () => handleAction('tldr', tldrBtnEl, tldrContainerEl);
    answerBtnEl.onclick = () =>
      handleAction('answer', answerBtnEl, answerContainerEl);
    factCheckBtnEl.onclick = () =>
      handleAction('fact-check', factCheckBtnEl, factCheckContainerEl);
  });
})();
