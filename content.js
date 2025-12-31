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
    const postLink = postTitleEl?.href;
    const postTitle = postTitleEl?.textContent?.trim();
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
    puterEl.append(tldrContainerEl, answerContainerEl);

    const aiToolbarEl = generateElements(
      '<div class="ai-toolbar" style="margin-top: 8px;"> ✨</div>'
    );
    const tldrBtnEl = generateElements(
      '<button class="ai-button tldr-button">TL;DR</button>'
    );
    const answerBtnEl = generateElements(
      '<button class="ai-button answer-button">Answer</button>'
    );
    aiToolbarEl.append(tldrBtnEl, answerBtnEl);
    puterEl.appendChild(aiToolbarEl);

    const runAction = async (containerEl, buttonEl, promptBuilder) => {
      buttonEl.disabled = true;
      const restoreText = buttonEl.textContent;
      buttonEl.textContent = 'Working…';
      containerEl.textContent = '';
      try {
        const prompt = promptBuilder();
        const { puterResText, duration } = await askWithStopwatch(prompt);
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
        '.shreddit-post-selftext.userscript-code'
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
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
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
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${content}
`
        )
      );
  });
})();
