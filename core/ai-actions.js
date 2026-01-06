// core/ai-actions.js - Generic AI action handlers

const AIActions = {
  /**
   * Execute an AI action with loading state management
   * @param {Object} config - Action configuration
   * @param {string} config.type - Action type ('tldr', 'answer', 'fact-check', etc.)
   * @param {HTMLElement} config.buttonEl - Button element to disable during action
   * @param {HTMLElement} config.containerEl - Container to show results
   * @param {Function} config.getContext - Function that returns context object
   * @param {Function} config.buildInstruction - Function that builds instruction from type
   * @param {Function} config.buildOptions - Function that builds API options
   * @param {Function} config.onRender - Optional custom render function
   */
  async execute({
    type,
    buttonEl,
    containerEl,
    getContext,
    buildInstruction,
    buildOptions,
    onRender = null,
  }) {
    buttonEl.disabled = true;
    const restoreText = buttonEl.textContent;
    buttonEl.textContent = 'Working…';
    containerEl.textContent = '';

    try {
      const context = await getContext();
      const instruction = buildInstruction(type);
      const options = buildOptions(type, context);

      const fullPrompt = `${instruction}\n\n${context.formattedContext}`;

      const { puterResText, duration } = await askWithStopwatch(
        fullPrompt,
        undefined,
        context.images || [],
        options
      );

      if (onRender) {
        onRender(containerEl, puterResText, duration);
      } else {
        UIBuilder.renderResult(containerEl, puterResText, duration);
      }
    } catch (err) {
      console.error(err);
      containerEl.textContent =
        'Sorry, something went wrong. Please try again.';
    } finally {
      buttonEl.disabled = false;
      buttonEl.textContent = restoreText;
    }
  },

  /**
   * Standard instruction templates
   */
  instructions: {
    tldr: `You are a helpful assistant tasked with summarizing social media content.
Provide a concise TL;DR for the post below.

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
In this case ignore points 1, 2, 3, 4, and 5.`,

    answer: `Read the post below. Also take note of the context.
If questions are asked, answer them concisely.
If no questions, offer a concise solution or advice for the situation.
Even if the post content is empty, use the title and context to inform your response.
If images are included, analyze them and incorporate their content into your response.
Always try to include relevant external links and images to support your answer.`,

    'fact-check': `Read the post below. Also take note of the context.
Fact check the claims made in the post. Provide evidence-based verification or refutation.
If images are included, analyze them and incorporate their content into your fact check.`,

    'analyze-user': `You are an expert behavioural analyst and profiler.
Analyze the provided Reddit user history (posts and comments) to generate a comprehensive psychometric and demographic profile.
The goal is analytical curiosity and understanding discussion patterns in a research context.

Based *strictly* on the provided content:

1. **Linguistic & Behavioral Patterns**:
    - Analyze writing style, vocabulary complexity, emotional tone, and consistency.

2. **Demographic Inference** (Probabilistic):
    - Estimate age range, location/timezone, education level, and socioeconomic status based on content clues.
    - Determine the person's ethnic/cultural background.
    - Note: State confidence levels for these inferences.

3. **Psychographic Profile**:
    - Infer personality traits (e.g., Big Five), values, interests, and political/ideological leanings.

4. **Community Engagement**:
    - Analyze content topics, engagement style (confrontational vs. collaborative), and obsessions.

**Format the output as a detailed markdown report.**
Include a disclaimer at the start: "This profile is an AI-generated probabilistic analysis based on public activity and may not be accurate."`,
  },

  /**
   * Build search query from text
   */
  buildSearchQuery: (title, bodyText, maxLength = 240) => {
    const compactBody = (bodyText || '').replace(/\s+/g, ' ').trim();
    const joined = `${title} ${compactBody}`.trim();
    return joined.slice(0, maxLength);
  },
};

// Export globally
window.AIActions = AIActions;
