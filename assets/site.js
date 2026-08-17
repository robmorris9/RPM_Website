(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('site-ready');
  var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function readStoredTheme() {
    try {
      return localStorage.getItem('rpm-theme');
    } catch (error) {
      return null;
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem('rpm-theme', theme);
    } catch (error) {}
  }

  var themeToggle = document.getElementById('theme-toggle');
  var themeLabel = document.getElementById('theme-label');
  var themeColor = document.getElementById('theme-color');

  function applyTheme(theme, source) {
    root.dataset.theme = theme;
    root.dataset.themeSource = source;

    var dark = theme === 'dark';
    if (themeLabel) themeLabel.textContent = dark ? '◑ Light Mode' : '◐ Dark Mode';
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeToggle.setAttribute('aria-pressed', String(dark));
    }
    if (themeColor) themeColor.content = dark ? '#0B0F1C' : '#F9F7F2';
  }

  applyTheme(root.dataset.theme || (darkModeQuery.matches ? 'dark' : 'light'), root.dataset.themeSource || 'system');

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      writeStoredTheme(next);
      applyTheme(next, 'user');
    });
  }

  function syncSystemTheme(event) {
    if (!readStoredTheme()) applyTheme(event.matches ? 'dark' : 'light', 'system');
  }

  if (darkModeQuery.addEventListener) darkModeQuery.addEventListener('change', syncSystemTheme);

  window.addEventListener('storage', function (event) {
    if (event.key !== 'rpm-theme') return;
    var stored = readStoredTheme();
    applyTheme(stored || (darkModeQuery.matches ? 'dark' : 'light'), stored ? 'user' : 'system');
  });

  var navList = document.querySelector('.top-nav-list');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('main.panel-right > section[id]'));

  function setActiveSection(id) {
    var activeLink = null;

    navLinks.forEach(function (link) {
      var active = link.getAttribute('href') === '#' + id;
      link.classList.toggle('active', active);
      if (active) {
        link.setAttribute('aria-current', 'location');
        activeLink = link;
      } else {
        link.removeAttribute('aria-current');
      }
    });

    if (!activeLink || !navList || navList.scrollWidth <= navList.clientWidth) return;

    var left = activeLink.offsetLeft - (navList.clientWidth - activeLink.offsetWidth) / 2;
    var maxLeft = navList.scrollWidth - navList.clientWidth;
    var target = Math.max(0, Math.min(left, maxLeft));

    if (typeof navList.scrollTo === 'function') {
      navList.scrollTo({ left: target, behavior: reducedMotionQuery.matches ? 'auto' : 'smooth' });
    } else {
      navList.scrollLeft = target;
    }
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      setActiveSection(link.getAttribute('href').slice(1));
    });
  });

  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      });
    }, { rootMargin: '-18% 0px -68% 0px', threshold: 0 });

    sections.forEach(function (section) { sectionObserver.observe(section); });
  }

  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reducedMotionQuery.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (item) { item.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealItems.forEach(function (item) { revealObserver.observe(item); });
  }

  var microAnimations = Array.prototype.slice.call(document.querySelectorAll('.micro-anim'));
  if (!reducedMotionQuery.matches && 'IntersectionObserver' in window) {
    var microObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-playing');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2 });

    microAnimations.forEach(function (item) { microObserver.observe(item); });
  }

  var chatPanel = document.getElementById('chat-panel');
  var chatBackdrop = document.getElementById('chat-backdrop');
  var chatLaunchers = Array.prototype.slice.call(document.querySelectorAll('.js-chat-open'));
  var chatClose = chatPanel && chatPanel.querySelector('.chat-close-btn');
  var chatMessages = document.getElementById('chat-messages');
  var chatForm = document.getElementById('chat-form');
  var chatInput = document.getElementById('chat-input');
  var chatSend = document.getElementById('chat-send');
  var chatOpen = false;
  var chatBusy = false;
  var chatHistory = [];
  var chatHistoryMaxMessages = 9;
  var chatMessageMaxChars = 1600;
  var chatHistoryMaxChars = 6000;
  var chatRequestMaxBytes = 12000;
  var lastFocusedElement = null;
  var backdropTimer = 0;

  function focusableChatElements() {
    if (!chatPanel) return [];
    return Array.prototype.slice.call(chatPanel.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
      .filter(function (element) { return !element.hasAttribute('hidden'); });
  }

  function openChat(trigger) {
    if (!chatPanel || chatOpen) return;
    chatOpen = true;
    lastFocusedElement = trigger || document.activeElement;
    window.clearTimeout(backdropTimer);
    if (chatBackdrop) chatBackdrop.hidden = false;
    chatPanel.removeAttribute('inert');
    chatPanel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('chat-open');
    chatLaunchers.forEach(function (launcher) { launcher.setAttribute('aria-expanded', 'true'); });

    window.requestAnimationFrame(function () {
      if (chatBackdrop) chatBackdrop.classList.add('open');
      chatPanel.classList.add('open');
      window.setTimeout(function () { if (chatInput) chatInput.focus(); }, reducedMotionQuery.matches ? 0 : 280);
    });
  }

  function closeChat(returnFocus) {
    if (!chatPanel || !chatOpen) return;
    chatOpen = false;
    chatPanel.classList.remove('open');
    if (chatBackdrop) chatBackdrop.classList.remove('open');
    chatPanel.setAttribute('aria-hidden', 'true');
    chatPanel.setAttribute('inert', '');
    document.body.classList.remove('chat-open');
    chatLaunchers.forEach(function (launcher) { launcher.setAttribute('aria-expanded', 'false'); });

    backdropTimer = window.setTimeout(function () {
      if (chatBackdrop && !chatOpen) chatBackdrop.hidden = true;
    }, reducedMotionQuery.matches ? 0 : 350);

    if (returnFocus !== false && lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  chatLaunchers.forEach(function (launcher) {
    launcher.addEventListener('click', function () { openChat(launcher); });
  });
  if (chatClose) chatClose.addEventListener('click', function () { closeChat(true); });
  if (chatBackdrop) chatBackdrop.addEventListener('click', function () { closeChat(true); });

  document.addEventListener('keydown', function (event) {
    if (!chatOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeChat(true);
      return;
    }

    if (event.key !== 'Tab') return;
    var focusable = focusableChatElements();
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function appendMessage(role, text) {
    var wrapper = document.createElement('div');
    wrapper.className = 'chat-msg ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
  }

  function appendTyping() {
    var wrapper = document.createElement('div');
    wrapper.className = 'chat-msg assistant chat-typing-row';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-label', 'RobBot is responding');
    wrapper.innerHTML = '<div class="chat-typing" aria-hidden="true"><span class="chat-dot"></span><span class="chat-dot"></span><span class="chat-dot"></span></div>';
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return wrapper;
  }

  function setChatBusy(busy) {
    chatBusy = busy;
    if (chatSend) chatSend.disabled = busy;
    if (chatInput) chatInput.setAttribute('aria-busy', String(busy));
  }

  function serializeChatRequest() {
    var messages = chatHistory.slice(-chatHistoryMaxMessages);
    if (messages.length && messages[0].role !== 'user') messages.shift();

    while (messages.length > 1) {
      var totalChars = messages.reduce(function (total, item) {
        return total + item.content.length;
      }, 0);
      var messagesWithinLimit = messages.every(function (item) {
        return item.content.length <= chatMessageMaxChars;
      });
      var payload = JSON.stringify({ messages: messages });

      if (messagesWithinLimit && totalChars <= chatHistoryMaxChars && new Blob([payload]).size <= chatRequestMaxBytes) {
        return payload;
      }

      messages.splice(0, 2);
    }

    return JSON.stringify({ messages: messages });
  }

  async function sendMessage() {
    if (chatBusy || !chatInput || !chatMessages) return;
    var message = chatInput.value.trim();
    if (!message) return;

    appendMessage('user', message);
    chatHistory.push({ role: 'user', content: message });
    chatInput.value = '';
    chatInput.style.height = 'auto';
    var typing = appendTyping();
    setChatBusy(true);

    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 15000);

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serializeChatRequest(),
        signal: controller.signal
      });
      var data = await response.json();
      if (!response.ok || !data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error('RobBot request failed');
      }

      typing.remove();
      var reply = data.reply.trim();
      chatHistory.push({ role: 'assistant', content: reply });
      chatHistory = chatHistory.slice(-8);
      appendMessage('assistant', reply);
    } catch (error) {
      typing.remove();
      chatHistory.pop();
      appendMessage('assistant', chatPanel.dataset.errorMessage);
    } finally {
      window.clearTimeout(timeout);
      setChatBusy(false);
    }
  }

  if (chatForm) {
    chatForm.addEventListener('submit', function (event) {
      event.preventDefault();
      sendMessage();
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    chatInput.addEventListener('input', function () {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
  }
}());
