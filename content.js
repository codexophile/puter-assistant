// content.js

(async function () {
  // Initialize observer for self-text elements
  waitForEach('.shreddit-post-selftext.userscript-code', async selfTextEl => {
    const puterEl = generateElements(`<div class=puter-content></div>`);
    selfTextEl.parentElement.after(puterEl);

    const postTitle =
      selfTextEl.parentElement.querySelector('[id*="post-title"]').textContent;
    const selfTextPlain = selfTextEl.textContent;
    const charCount = postTitle.length + selfTextPlain.length;

    const prompt = `
You are a helpful assistant tasked with summarizing social media content.
Please provide a concise TL;DR for the Reddit post provided below.
Post Title: ${postTitle}
Post Content:
${selfTextPlain}
`;

    if (charCount >= 700) {
      try {
        const { puterResText, duration } = await askWithStopwatch(prompt);
        const htmlFromMarkdown = marked.parse(puterResText);
        puterEl.innerHTML = `
        ${htmlFromMarkdown}
        <em>(Generated in ${Math.round(duration)} ms)</em>
      `;
      } catch (err) {
        console.error(err);
      }
    }
  });
})();
