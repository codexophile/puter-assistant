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
      const imgElements = postEl.querySelectorAll('img[src]');
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

    const runAction = async (containerEl, buttonEl, promptBuilder) => {
      buttonEl.disabled = true;
      const restoreText = buttonEl.textContent;
      buttonEl.textContent = 'Working…';
      containerEl.textContent = '';
      try {
        const prompt = promptBuilder();

        // Extract images from the post
        const postImages = await extractPostImages();

        const { puterResText, duration } = await askWithStopwatch(
          prompt,
          undefined,
          postImages
        );
        renderResult(containerEl, puterResText, duration);
      } catch (err) {
        console.error(err);
        containerEl.textContent =
          'Sorry, something went wrong. Please try again.';
      } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = restoreText;
      }
    };

    const buildPrompt = template => {
      const selfTextEl = postEl.querySelector(
        '.shreddit-post-selftext.userscript-code, shreddit-post-text-body'
      );
      const selfTextPlain = selfTextEl?.textContent || '';
      return template(selfTextPlain);
    };

    tldrBtnEl.onclick = () =>
      runAction(tldrContainerEl, tldrBtnEl, () =>
        buildPrompt(
          content => `
You are a helpful assistant tasked with summarizing social media content.
Provide a concise TL;DR for the Reddit post below.
Extract key points, highlight the most important points from the post.
Do the key point extraction only if the post contains sufficient detail.
Flag potentially biased content in post, only when appropriate.
If images are included, describe them and incorporate their content into the summary.
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${attachedLink}
${content}
`
        )
      );

    answerBtnEl.onclick = () =>
      runAction(answerContainerEl, answerBtnEl, () =>
        buildPrompt(
          content => `
Read the Reddit post below. Also take note of the subreddit name.
If questions are asked, answer them concisely.
If no questions, offer a concise solution or advice for the situation.
Even if the post content is empty, use the title and subreddit context to inform your response.
If images are included, analyze them and incorporate their content into your response.
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${attachedLink}
${content}
`
        )
      );
    factCheckBtnEl.onclick = () =>
      runAction(factCheckContainerEl, factCheckBtnEl, () =>
        buildPrompt(
          content => `
Read the Reddit post below. Also take note of the subreddit name.
Fact check the claims made in the post. Provide evidence-based verification or refutation.
If images are included, analyze them and incorporate their content into your fact check.
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${attachedLink}
${content}
`
        )
      );
  });
})();
