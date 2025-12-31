// content.js

(async function () {
  // Initialize observer for self-text elements
  waitForEach('.shreddit-post-selftext.userscript-code', async selfTextEl => {
    const puterEl = generateElements(`<div class=puter-content></div>`);
    selfTextEl.parentElement.after(puterEl);
    const tldrContainerEl = generateElements(
      `<div class="tldr-container" ></div>`
    );
    const answerContainerEl = generateElements(
      `<div class="answer-container" ></div>`
    );
    puterEl.append(tldrContainerEl, answerContainerEl);

    const aiToolbarEl = generateElements(`
      <div class="ai-toolbar" style="margin-top: 8px;"> ✨
      </div>
    `);
    const tldrBtnEl = generateElements(`
        <button class="ai-button tldr-button">TL;DR</button>
      `);
    const answerBtnEl = generateElements(
      `<button class="ai-button answer-button">Answer</button>`
    );
    aiToolbarEl.append(tldrBtnEl, answerBtnEl);
    puterEl.appendChild(aiToolbarEl);

    const postTitle =
      selfTextEl.parentElement.querySelector('[id*="post-title"]').textContent;
    const selfTextPlain = selfTextEl.textContent;
    const subredditName = selfTextEl.parentElement
      .querySelector(`[id*="post-title"]`)
      .href.match(/\/r\/([^\/]+)/)[1];

    tldrBtnEl.onclick = async () => {
      const prompt = `
You are a helpful assistant tasked with summarizing social media content.
Please provide a concise TL;DR for the Reddit post provided below.
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${selfTextPlain}
`;

      try {
        const { puterResText, duration } = await askWithStopwatch(prompt);
        const htmlFromMarkdown = marked.parse(puterResText);
        tldrContainerEl.innerHTML = `
        ${htmlFromMarkdown}
        <em>(Generated in ${Math.round(duration)} ms)</em>
      `;
      } catch (err) {
        console.error(err);
      }
    };
    answerBtnEl.onclick = async () => {
      const prompt = `
Please read the Reddit post provided below. If the original poster has asked any questions in the post content,
please provide clear and concise answers to those questions. If there are no questions asked,
but you are able to provide a solution to the situation described, please do so.
Remember concision is important.
Subreddit: ${subredditName}
Post Title: ${postTitle}
Post Content:
${selfTextPlain}
`;
      try {
        const { puterResText, duration } = await askWithStopwatch(prompt);
        const htmlFromMarkdown = marked.parse(puterResText);
        answerContainerEl.innerHTML = `
        ${htmlFromMarkdown}
        <em>(Generated in ${Math.round(duration)} ms)</em>
      `;
      } catch (err) {
        console.error(err);
      }
    };
  });
})();
