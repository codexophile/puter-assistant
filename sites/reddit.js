// sites/reddit.js - Reddit-specific functionality

const RedditHandler = {
  shouldActivate: () => {
    return window.location.hostname.includes('reddit.com');
  },

  init: async () => {
    console.log('🎯 Initializing Reddit handler');

    waitForEach('shreddit-post', async postEl => {
      if (postEl.dataset.puterAttached) return;
      postEl.dataset.puterAttached = '1';

      const metadata = RedditHandler.extractMetadata(postEl);
      if (!metadata) return;

      const ui = RedditHandler.buildUI(postEl);
      RedditHandler.attachHandlers(ui, metadata, postEl);
    });
  },

  extractMetadata: postEl => {
    const postTitleEl = postEl.querySelector('[id*="post-title"]');
    const postLink = postTitleEl?.href || location.href;
    const postTitle = postTitleEl?.textContent?.trim();
    const attachedLink = postEl.querySelector(
      '.post-link, [slot="post-media-container"] a'
    );
    const subredditName = postLink?.match(/\/r\/([^\/]+)/)?.[1];

    if (!postTitle || !subredditName) return null;

    return {
      title: postTitle,
      subreddit: subredditName,
      link: postLink,
      attachedLink: attachedLink?.href || '',
    };
  },

  buildUI: postEl => {
    const puterEl = UIBuilder.createContainer('puter-content');
    postEl.append(puterEl);

    const tldrContainer = UIBuilder.createContainer('tldr-container');
    const answerContainer = UIBuilder.createContainer('answer-container');
    const factCheckContainer = UIBuilder.createContainer('factcheck-container');
    puterEl.append(tldrContainer, answerContainer, factCheckContainer);

    const tldrBtn = UIBuilder.createActionButton('TL;DR', 'tldr-button');
    const answerBtn = UIBuilder.createActionButton('Answer', 'answer-button');
    const factCheckBtn = UIBuilder.createActionButton(
      'Fact Check',
      'factcheck-button'
    );

    const toolbar = UIBuilder.createToolbar([tldrBtn, answerBtn, factCheckBtn]);
    puterEl.appendChild(toolbar);

    return {
      tldrBtn,
      answerBtn,
      factCheckBtn,
      tldrContainer,
      answerContainer,
      factCheckContainer,
    };
  },

  extractContent: postEl => {
    const selfTextEl = postEl.querySelector(
      '.shreddit-post-selftext.userscript-code, shreddit-post-text-body'
    );
    return selfTextEl?.textContent || '';
  },

  extractPostImages: async postEl => {
    const imageUrls = [];

    const imgElements = postEl.querySelectorAll('img.non-lightboxed-content');
    imgElements.forEach(img => {
      const src = img.src;
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

    const uniqueUrls = [...new Set(imageUrls)];
    const imagePromises = uniqueUrls
      .slice(0, 3)
      .map(url => fetchImageAsBase64(url));
    const images = await Promise.all(imagePromises);

    return images.filter(img => img !== null);
  },

  extractClosedCaptions: async postEl => {
    const player = postEl.querySelector('shreddit-player');
    if (!player) return null;

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
  },

  attachHandlers: (ui, metadata, postEl) => {
    const getContext = async () => {
      const selfText = RedditHandler.extractContent(postEl);
      const images = await RedditHandler.extractPostImages(postEl);
      const captions = await RedditHandler.extractClosedCaptions(postEl);

      const formattedContext = `
Subreddit: ${metadata.subreddit}
Post Title: ${metadata.title}
Post Content:
${metadata.attachedLink}
${selfText}
${captions ? `\n\nVideo closed captions: ${captions}` : ''}
      `.trim();

      return { selfText, images, captions, formattedContext };
    };

    const buildInstruction = type => {
      return AIActions.instructions[type] || '';
    };

    const buildOptions = (type, context) => {
      const options = { useWeb: false, mode: 'answer' };

      if (type === 'answer' || type === 'fact-check') {
        options.useWeb = true;
        options.mode = type;
        options.searchQuery = AIActions.buildSearchQuery(
          metadata.title,
          context.selfText
        );
        options.searchLimit = 6;
      }

      return options;
    };

    ui.tldrBtn.onclick = () =>
      AIActions.execute({
        type: 'tldr',
        buttonEl: ui.tldrBtn,
        containerEl: ui.tldrContainer,
        getContext,
        buildInstruction,
        buildOptions,
      });

    ui.answerBtn.onclick = () =>
      AIActions.execute({
        type: 'answer',
        buttonEl: ui.answerBtn,
        containerEl: ui.answerContainer,
        getContext,
        buildInstruction,
        buildOptions,
      });

    ui.factCheckBtn.onclick = () =>
      AIActions.execute({
        type: 'fact-check',
        buttonEl: ui.factCheckBtn,
        containerEl: ui.factCheckContainer,
        getContext,
        buildInstruction,
        buildOptions,
      });
  },

  cleanup: () => {
    // Remove any event listeners or observers if needed
    console.log('🧹 Cleaning up Reddit handler');
  },
};

// Export for content.js dispatcher
window.RedditHandler = RedditHandler;
