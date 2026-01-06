// core/ui-builder.js - Reusable UI components

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

const createActionButton = (label, className = '') => {
  return generateElements(
    `<button class="ai-button ${className}">${label}</button>`
  );
};

const createContainer = className => {
  return generateElements(`<div class="${className}"></div>`);
};

const createToolbar = (buttons = []) => {
  const toolbar = generateElements(
    '<div class="ai-toolbar" style="margin-top: 8px;"> ✨</div>'
  );
  buttons.forEach(btn => toolbar.append(btn));
  return toolbar;
};

// Export for use in site modules
window.UIBuilder = {
  sanitize,
  renderResult,
  createActionButton,
  createContainer,
  createToolbar,
};
