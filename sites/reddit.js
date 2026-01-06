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
    const author =
      postEl.getAttribute('author') ||
      postEl.querySelector('a[href^="/user/"]')?.textContent?.trim();

    if (!postTitle || !subredditName) return null;

    return {
      title: postTitle,
      subreddit: subredditName,
      author: author || 'unknown_user',
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
    const analyzeUserContainer = UIBuilder.createContainer(
      'analyze-user-container'
    );
    puterEl.append(
      tldrContainer,
      answerContainer,
      factCheckContainer,
      analyzeUserContainer
    );

    const tldrBtn = UIBuilder.createActionButton('TL;DR', 'tldr-button');
    const answerBtn = UIBuilder.createActionButton('Answer', 'answer-button');
    const factCheckBtn = UIBuilder.createActionButton(
      'Fact Check',
      'factcheck-button'
    );
    const analyzeUserBtn = UIBuilder.createActionButton(
      'Profile User',
      'analyze-user-button'
    );

    const toolbar = UIBuilder.createToolbar([
      tldrBtn,
      answerBtn,
      factCheckBtn,
      analyzeUserBtn,
    ]);
    puterEl.appendChild(toolbar);

    return {
      tldrBtn,
      answerBtn,
      factCheckBtn,
      analyzeUserBtn,
      tldrContainer,
      answerContainer,
      factCheckContainer,
      analyzeUserContainer,
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

  fetchUserHistory: async (username, postLimit = 60, commentLimit = 60) => {
    const fetchEndpoint = async (type, limit) => {
      try {
        const response = await fetch(
          `https://www.reddit.com/user/${username}/${type}.json?limit=${limit}`
        );
        if (!response.ok) throw new Error(`Failed to fetch user ${type}`);
        const data = await response.json();
        return data?.data?.children || [];
      } catch (error) {
        console.error(`Error fetching user ${type}:`, error);
        return [];
      }
    };

    try {
      const [posts, comments] = await Promise.all([
        fetchEndpoint('submitted', postLimit),
        fetchEndpoint('comments', commentLimit),
      ]);

      const combined = [...posts, ...comments];

      const items = combined
        .map(child => {
          const d = child.data;
          return {
            type: child.kind === 't1' ? 'comment' : 'post',
            subreddit: d.subreddit,
            title: d.title || '',
            body: d.selftext || d.body || '',
            score: d.score,
            created_utc: d.created_utc,
          };
        })
        .sort((a, b) => b.created_utc - a.created_utc);

      const postCount = items.filter(i => i.type === 'post').length;
      const commentCount = items.filter(i => i.type === 'comment').length;
      const timestamps = items.map(i => i.created_utc).filter(t => t);
      const oldestActivity = timestamps.length
        ? new Date(Math.min(...timestamps) * 1000).toLocaleDateString()
        : 'Unknown';
      const newestActivity = timestamps.length
        ? new Date(Math.max(...timestamps) * 1000).toLocaleDateString()
        : 'Unknown';

      return {
        items,
        metadata: {
          postCount,
          commentCount,
          totalItems: items.length,
          oldestActivity,
          newestActivity,
          username,
        },
      };
    } catch (error) {
      console.error('Error fetching user history:', error);
      return { items: [], metadata: {} };
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

    ui.analyzeUserBtn.onclick = () =>
      AIActions.execute({
        type: 'analyze-user',
        buttonEl: ui.analyzeUserBtn,
        containerEl: ui.analyzeUserContainer,
        getContext: async () => {
          const baseContext = await getContext(); // get selfText etc. if needed, but we mostly need user history
          const { items: history, metadata: analysisMetadata } =
            await RedditHandler.fetchUserHistory(metadata.author);

          if (!history || history.length === 0) {
            alert(
              'Could not fetch user history or user has no public history.'
            );
            throw new Error('No user history');
          }

          const historyText = history
            .map(
              h =>
                `[${h.type.toUpperCase()}] r/${h.subreddit} (Score: ${
                  h.score
                }): ${h.title} ${h.body}`
            )
            .join('\n---\n');

          const metadataSection = `**Analysis Metadata:**
- Total Items Analyzed: ${analysisMetadata.totalItems}
- Posts: ${analysisMetadata.postCount}
- Comments: ${analysisMetadata.commentCount}
- Activity Range: ${analysisMetadata.oldestActivity} to ${analysisMetadata.newestActivity}`;

          const formattedContext = `Target User: ${metadata.author}

${metadataSection}

User History Data:
${historyText}`.trim();

          return { ...baseContext, formattedContext };
        },
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
