// content.js - Universal AI Assistant

(async function () {
  // Prevent multiple instances
  if (window.puterAssistantLoaded) return;
  window.puterAssistantLoaded = true;

  const sanitize = html => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.querySelectorAll('script, style').forEach(el => el.remove());
    return wrapper.innerHTML;
  };

  // Create floating assistant button
  const createFloatingButton = () => {
    const button = document.createElement('button');
    button.id = 'puter-assistant-btn';
    button.innerHTML = '✨ AI';
    button.title = 'Open Puter AI Assistant';
    document.body.appendChild(button);
    return button;
  };

  // Load and apply theme
  const loadTheme = async () => {
    const { puterTheme = 'dark' } = await chrome.storage.local.get(
      'puterTheme'
    );
    if (puterTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  };

  // Toggle theme
  const toggleTheme = async () => {
    const { puterTheme = 'dark' } = await chrome.storage.local.get(
      'puterTheme'
    );
    const newTheme = puterTheme === 'dark' ? 'light' : 'dark';
    await chrome.storage.local.set({ puterTheme: newTheme });

    if (newTheme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  };

  // Create chat panel
  const createChatPanel = () => {
    const panel = document.createElement('div');
    panel.id = 'puter-assistant-panel';
    panel.innerHTML = `
      <div class="puter-header">
        <h3>✨ AI Assistant</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="puter-theme-toggle" title="Toggle dark/light mode" style="background: rgba(255, 255, 255, 0.2); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; line-height: 1;">🌙</button>
          <button class="puter-close" title="Close">×</button>
        </div>
      </div>
      <div class="puter-tabs">
        <button class="puter-tab active" data-tab="chat">Chat</button>
        <button class="puter-tab" data-tab="page">Analyze Page</button>
        <button class="puter-tab" data-tab="selection">Selection</button>
      </div>
      <div class="puter-content">
        <div class="puter-tab-content active" data-content="chat">
          <div class="puter-messages" id="puter-messages"></div>
          <div class="puter-input-container">
            <textarea id="puter-input" placeholder="Ask me anything..." rows="3"></textarea>
            <button id="puter-send">Send</button>
          </div>
        </div>
        <div class="puter-tab-content" data-content="page">
          <div class="puter-page-actions">
            <button class="puter-action-btn" data-action="summarize">📝 Summarize Page</button>
            <button class="puter-action-btn" data-action="key-points">🎯 Key Points</button>
            <button class="puter-action-btn" data-action="explain">💡 Explain</button>
            <button class="puter-action-btn" data-action="translate">🌐 Translate</button>
          </div>
          <div class="puter-page-result" id="puter-page-result"></div>
        </div>
        <div class="puter-tab-content" data-content="selection">
          <div class="puter-selection-info">Select text on the page and right-click for quick AI actions, or paste text below:</div>
          <textarea id="puter-selection-text" placeholder="Paste or type text here..." rows="5"></textarea>
          <div class="puter-selection-actions">
            <button class="puter-action-btn" data-action="explain-selection">Explain</button>
            <button class="puter-action-btn" data-action="summarize-selection">Summarize</button>
            <button class="puter-action-btn" data-action="simplify-selection">Simplify</button>
            <button class="puter-action-btn" data-action="fact-check-selection">Fact Check</button>
          </div>
          <div class="puter-selection-result" id="puter-selection-result"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    return panel;
  };

  // Extract page content
  const extractPageContent = () => {
    const title = document.title;
    const url = window.location.href;

    // Get main content, try to avoid headers, footers, navs
    const mainContent =
      document.querySelector('main')?.innerText ||
      document.querySelector('article')?.innerText ||
      document.querySelector('[role="main"]')?.innerText ||
      document.body.innerText;

    const contentPreview = mainContent.slice(0, 3000); // Limit content size

    return {
      title,
      url,
      content: contentPreview,
    };
  };

  // Extract images from page
  const extractPageImages = async (limit = 3) => {
    const imageUrls = [];
    const images = document.querySelectorAll('img');

    for (const img of images) {
      if (imageUrls.length >= limit) break;

      const src = img.src || img.dataset.src;
      if (
        src &&
        !src.includes('icon') &&
        !src.includes('logo') &&
        !src.includes('avatar') &&
        img.width > 200 &&
        img.height > 200
      ) {
        imageUrls.push(src);
      }
    }

    const uniqueUrls = [...new Set(imageUrls)];
    const imagePromises = uniqueUrls
      .slice(0, limit)
      .map(url => fetchImageAsBase64(url));
    const imageData = await Promise.all(imagePromises);

    return imageData.filter(img => img !== null);
  };

  // Add message to chat
  const addMessage = (text, isUser = false, isLoading = false) => {
    const messagesContainer = document.getElementById('puter-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `puter-message ${isUser ? 'user' : 'assistant'} ${
      isLoading ? 'loading' : ''
    }`;

    if (isLoading) {
      messageDiv.innerHTML = '<div class="puter-loader"></div>';
    } else {
      const parsed = marked.parse(text);
      messageDiv.innerHTML = sanitize(parsed);
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
  };

  // Handle chat message
  const handleChatMessage = async message => {
    if (!message.trim()) return;

    const input = document.getElementById('puter-input');
    const sendBtn = document.getElementById('puter-send');

    input.disabled = true;
    sendBtn.disabled = true;

    addMessage(message, true);
    const loadingMsg = addMessage('', false, true);

    try {
      const pageContext = extractPageContent();
      const prompt = `Context: User is on "${pageContext.title}" (${pageContext.url})

User question: ${message}

Provide a helpful and concise response. If the question is about the current page, use the page context appropriately.`;

      const { puterResText } = await askWithStopwatch(
        prompt,
        'gemma-3-27b-it',
        [],
        {
          useWeb: true,
          mode: 'answer',
          searchQuery: message,
          searchLimit: 5,
        }
      );

      loadingMsg.remove();
      addMessage(puterResText);
    } catch (err) {
      console.error(err);
      loadingMsg.remove();
      addMessage('Sorry, something went wrong. Please try again.', false);
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.value = '';
      input.focus();
    }
  };

  // Handle page actions
  const handlePageAction = async action => {
    const resultDiv = document.getElementById('puter-page-result');
    resultDiv.innerHTML = '<div class="puter-loader"></div>';

    try {
      const pageData = extractPageContent();
      const images = await extractPageImages();

      let prompt = '';

      switch (action) {
        case 'summarize':
          prompt = `Summarize the following web page concisely, highlighting the main points:\n\nTitle: ${pageData.title}\nURL: ${pageData.url}\n\nContent:\n${pageData.content}`;
          break;
        case 'key-points':
          prompt = `Extract the key points from this web page as a bullet list:\n\nTitle: ${pageData.title}\n\nContent:\n${pageData.content}`;
          break;
        case 'explain':
          prompt = `Explain the content of this web page in simple terms:\n\nTitle: ${pageData.title}\n\nContent:\n${pageData.content}`;
          break;
        case 'translate':
          prompt = `Translate the main content of this page to English (if it's not already in English, otherwise translate to Spanish):\n\nTitle: ${pageData.title}\n\nContent:\n${pageData.content}`;
          break;
      }

      const { puterResText } = await askWithStopwatch(
        prompt,
        'gemma-3-27b-it',
        images,
        {
          useWeb: false,
        }
      );

      const parsed = marked.parse(puterResText);
      resultDiv.innerHTML = sanitize(parsed);
    } catch (err) {
      console.error(err);
      resultDiv.innerHTML =
        '<div class="puter-error">Sorry, something went wrong. Please try again.</div>';
    }
  };

  // Handle selection actions
  const handleSelectionAction = async action => {
    const selectionText = document.getElementById('puter-selection-text').value;
    const resultDiv = document.getElementById('puter-selection-result');

    if (!selectionText.trim()) {
      resultDiv.innerHTML =
        '<div class="puter-error">Please enter some text first.</div>';
      return;
    }

    resultDiv.innerHTML = '<div class="puter-loader"></div>';

    try {
      let prompt = '';
      let options = { useWeb: false };

      switch (action) {
        case 'explain-selection':
          prompt = `Explain the following text in simple terms:\n\n${selectionText}`;
          break;
        case 'summarize-selection':
          prompt = `Provide a concise summary of the following text:\n\n${selectionText}`;
          break;
        case 'simplify-selection':
          prompt = `Rewrite the following text in simpler language that's easier to understand:\n\n${selectionText}`;
          break;
        case 'fact-check-selection':
          prompt = `Fact check the claims made in the following text:\n\n${selectionText}`;
          options = {
            useWeb: true,
            mode: 'fact-check',
            searchQuery: selectionText.slice(0, 200),
            searchLimit: 5,
          };
          break;
      }

      const { puterResText } = await askWithStopwatch(
        prompt,
        'gemma-3-27b-it',
        [],
        options
      );

      const parsed = marked.parse(puterResText);
      resultDiv.innerHTML = sanitize(parsed);
    } catch (err) {
      console.error(err);
      resultDiv.innerHTML =
        '<div class="puter-error">Sorry, something went wrong. Please try again.</div>';
    }
  };

  // Listen for messages from context menu
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processSelection') {
      const selectionTextArea = document.getElementById('puter-selection-text');
      const panel = document.getElementById('puter-assistant-panel');

      // Open panel and switch to selection tab
      panel.classList.add('open');
      document.querySelector('[data-tab="selection"]').click();

      // Set the selected text
      selectionTextArea.value = request.text;

      // Trigger the appropriate action
      if (request.task) {
        handleSelectionAction(request.task);
      }
    }
  });

  // Initialize UI
  const floatingBtn = createFloatingButton();
  const chatPanel = createChatPanel();

  // Load theme on startup
  await loadTheme();

  // Toggle panel
  floatingBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('open');
  });

  // Close button
  chatPanel.querySelector('.puter-close').addEventListener('click', () => {
    chatPanel.classList.remove('open');
  });

  // Theme toggle button
  chatPanel
    .querySelector('.puter-theme-toggle')
    .addEventListener('click', async e => {
      e.stopPropagation();
      await toggleTheme();
      const { puterTheme = 'dark' } = await chrome.storage.local.get(
        'puterTheme'
      );
      const btn = e.target;
      btn.textContent = puterTheme === 'dark' ? '🌙' : '☀️';
    });

  // Set initial theme toggle button icon
  const { puterTheme = 'dark' } = await chrome.storage.local.get('puterTheme');
  const themeBtn = chatPanel.querySelector('.puter-theme-toggle');
  themeBtn.textContent = puterTheme === 'dark' ? '🌙' : '☀️';

  // Tab switching
  chatPanel.querySelectorAll('.puter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update active tab
      chatPanel
        .querySelectorAll('.puter-tab')
        .forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active content
      chatPanel
        .querySelectorAll('.puter-tab-content')
        .forEach(c => c.classList.remove('active'));
      chatPanel
        .querySelector(`[data-content="${tabName}"]`)
        .classList.add('active');
    });
  });

  // Send message
  const sendMessage = () => {
    const input = document.getElementById('puter-input');
    handleChatMessage(input.value);
  };

  document.getElementById('puter-send').addEventListener('click', sendMessage);
  document.getElementById('puter-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Page action buttons
  chatPanel
    .querySelectorAll('.puter-page-actions .puter-action-btn')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        handlePageAction(btn.dataset.action);
      });
    });

  // Selection action buttons
  chatPanel
    .querySelectorAll('.puter-selection-actions .puter-action-btn')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        handleSelectionAction(btn.dataset.action);
      });
    });

  // Add welcome message
  addMessage(
    "👋 Hello! I'm your AI assistant. I can help you with:\n\n- Answering questions\n- Summarizing web pages\n- Explaining complex text\n- Fact-checking information\n- And much more!\n\nHow can I help you today?"
  );
})();
