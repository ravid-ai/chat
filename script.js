
document.addEventListener('DOMContentLoaded', () => {
  // --- Constants & API Key ---
  const COMET_API_KEY = "sk-OtiNbjY3B9e6rIFJRLifvBa1DNoJF6UjFZdHi0tJ2hXuF9SG"; // ← کلید واقعی شما
  const API_URL = 'https://api.cometapi.com/v1/chat/completions';
  const CHAT_HISTORY_STORAGE_KEY = 'ravidAIChatHistory'; // Key for local storage

  // --- DOM Element Selection ---
  const chatArea = document.getElementById('chatArea');
  const userInput = document.getElementById('userInput');
  const sendButton = document.getElementById('sendButton');
  const themeToggle = document.getElementById('themeToggle');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const sidebarCloseBtn = document.querySelector('.sidebar-close-btn');
  const overlay = document.getElementById('overlay');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const imageInput = document.getElementById('imageInput');
  const attachFileBtn = document.getElementById('attachFileBtn');
  const voiceInputBtn = document.getElementById('voiceInputBtn');
  const webSearchToggle = document.getElementById('webSearchToggle');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const modelSelect = document.getElementById('modelSelect');
  const modelAvatar = document.getElementById('modelAvatar');
  const modelNameHeader = document.getElementById('modelNameHeader');
  const tempRange = document.getElementById('tempRange');
  const tempValueSpan = document.getElementById('tempValue');
  const exportChatBtn = document.getElementById('exportChat');
  const clearHistoryBtn = document.getElementById('clearHistory'); // New clear history button
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const previewImage = document.getElementById('previewImage');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const welcomeContainer = document.getElementById('welcomeContainer');
  const advancedSettingsToggle = document.getElementById('advancedSettingsToggle'); // Advanced settings toggle button
  const advancedSettingsSection = document.querySelector('.advanced-settings'); // Advanced settings section
  const topPRange = document.getElementById('topPRange'); // Top P range input
  const topPValueSpan = document.getElementById('topPValue'); // Top P value span
  const presencePenaltyRange = document.getElementById('presencePenaltyRange'); // Presence Penalty range input
  const presencePenaltyValueSpan = document.getElementById('presencePenaltyValue'); // Presence Penalty value span
  // const maxTokensInput = document.getElementById('maxTokensInput'); // Max Tokens input (commented out in HTML as well)

  // --- State Variables ---
  let attachedImageBase64 = null;
  let webSearchEnabled = false;
  let isSidebarOpen = false;
  let isRecognizingSpeech = false;
  let speechRecognition = null;
  let conversationHistory = loadChatHistory(); // Load from local storage on init

  // --- Initialize Showdown and Prism ---
  const markdownConverter = new showdown.Converter({
    tables: true,
    simplifiedAutoLink: true,
    strikethrough: true,
    tasklists: true,
    emoji: true,
    ghCompatibleHeaderId: true,
    parseImgDimensions: true,
    literalMidWordUnderscores: true,
  });

  // --- Helper Functions ---

  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const updateRangeValue = (range, valueSpan) => {
    if (!range || !valueSpan) return;
    const value = parseFloat(range.value).toFixed(2); // Show 2 decimal places for Top P and Presence Penalty
    valueSpan.textContent = value;
    // Update slider background gradient fill
    const percentage = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.backgroundSize = `${percentage}% 100%`;
  };

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const iconColor = type === 'success' ? 'var(--success)' : (type === 'warning' ? 'var(--warning)' : 'var(--error)'); // Add warning type
    toast.innerHTML = `<i class="fas ${iconClass}" style="color: ${iconColor};"></i> ${message}`;
    document.body.appendChild(toast);

    // Force reflow to trigger animation
    void toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300); // Wait for fade out transition
    }, 3500); // Slightly longer display duration
  };

  const scrollToBottom = () => {
    // Use timeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const addCodeCopyButtons = (container) => {
      const pres = container.querySelectorAll('pre');
      pres.forEach(pre => {
          // Avoid adding button if it already exists
          if (pre.querySelector('.copy-code-btn')) return;

          const code = pre.querySelector('code');
          if (!code) return;

          const button = document.createElement('button');
          button.className = 'copy-code-btn';
          button.innerHTML = '<i class="fas fa-copy"></i> کپی';
          button.setAttribute('aria-label', 'کپی کردن کد');

          button.addEventListener('click', () => {
              navigator.clipboard.writeText(code.innerText).then(() => {
                  button.innerHTML = '<i class="fas fa-check"></i> کپی شد!';
                  button.classList.add('copied');
                  setTimeout(() => {
                      button.innerHTML = '<i class="fas fa-copy"></i> کپی';
                      button.classList.remove('copied');
                  }, 2000);
              }).catch(err => {
                  console.error('Failed to copy code:', err);
                  button.textContent = 'خطا';
              });
          });
          pre.appendChild(button);
      });
  };

  const addMessage = (content, isUser, imageUrl = null) => {
    // Remove welcome message on first interaction
    if (welcomeContainer && !welcomeContainer.classList.contains('fade-out')) {
        welcomeContainer.classList.add('fade-out');
        setTimeout(() => welcomeContainer.remove(), 300);
    }

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';

    if (isUser && imageUrl) {
      // User message with image preview (different from input preview)
      const imgElement = document.createElement('img');
      imgElement.src = imageUrl;
      imgElement.alt = "تصویر پیوست شده";
      imgElement.style.maxWidth = '200px'; // Limit display size in chat
      imgElement.style.borderRadius = 'var(--border-radius-sm)';
      imgElement.style.marginBottom = content ? '0.5rem' : '0';
      messageContentDiv.appendChild(imgElement);
    }

    if (content) {
        if (isUser) {
            // Simple text for user messages
            const p = document.createElement('p');
            p.textContent = content;
            messageContentDiv.appendChild(p);
        } else {
            // Convert Markdown for bot messages
            const htmlContent = markdownConverter.makeHtml(content);
            messageContentDiv.innerHTML += htmlContent; // Append if image was already added
        }
    } else if (!imageUrl) {
        // Handle cases where content might be empty unexpectedly
        messageContentDiv.innerHTML = '<p><i>پیام خالی</i></p>';
    }

    // Add timestamp
    const timeElement = document.createElement('span');
    timeElement.className = 'message-time';
    timeElement.textContent = getCurrentTime();
    messageContentDiv.appendChild(timeElement);

    messageWrapper.appendChild(messageContentDiv);
    chatArea.appendChild(messageWrapper);

    // Highlight code blocks if it's a bot message
    if (!isUser && typeof Prism !== 'undefined') {
      // Ensure Prism highlights AFTER content is added
      setTimeout(() => {
        Prism.highlightAllUnder(messageContentDiv);
        addCodeCopyButtons(messageContentDiv); // Add copy buttons after highlighting
      }, 0);
    }

    // Update conversation history
    updateConversationHistory(isUser ? 'user' : 'assistant', content || (imageUrl ? '[Image Sent]' : ''));


    scrollToBottom();
    return messageWrapper; // Return the created element if needed
  };


  const showLoading = (show) => {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'flex' : 'none';
    }
    sendButton.disabled = show;
    userInput.disabled = show;
    attachFileBtn.disabled = show;
    voiceInputBtn.disabled = show;
  };

  const showTypingIndicator = () => {
      // Remove previous typing indicator if exists
      const existingIndicator = document.getElementById('typingIndicator');
      if (existingIndicator) existingIndicator.remove();

      const typingWrapper = document.createElement('div');
      typingWrapper.className = 'message bot-message'; // Use message structure
      typingWrapper.id = 'typingIndicator'; // Assign ID for easy removal

      const typingContent = document.createElement('div');
      typingContent.className = 'typing-indicator'; // Specific class for dots styling
      typingContent.innerHTML = `
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
      `;

      typingWrapper.appendChild(typingContent);
      chatArea.appendChild(typingWrapper);
      scrollToBottom();
      return typingWrapper;
  };

  const removeTypingIndicator = () => {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Return only the Base64 part
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const displayImagePreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      imagePreviewContainer.style.display = 'block';
      attachFileBtn.disabled = true; // Disable attaching another while one is previewed
    }
    reader.readAsDataURL(file);
  };

  const removeAttachedImage = () => {
    attachedImageBase64 = null;
    imageInput.value = ''; // Clear the file input
    imagePreviewContainer.style.display = 'none';
    previewImage.src = '#';
    attachFileBtn.disabled = false;
    userInput.placeholder = 'پیام خود را بنویسید یا تصویر پیوست کنید...';
  };

  const formatModelName = (modelKey) => {
      const names = {
        'gpt-4o-all': 'GPT-4o All',
        'gpt-4o-mini': 'GPT-4o Mini',
        'o4-mini': 'o4-mini',
        'deepseek-r1': 'Deepseek R1',
        'gpt-4.1': 'GPT-4.1',
        'gpt-4.1-mini': 'GPT-4.1 Mini',
        'gpt-4.1-nano': 'GPT-4.1 Nano',
        'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
        'grok-3-mini': 'Grok 3 Mini',
        'llama-4-maverick': 'LLaMA 4 Maverick'
      };
      return names[modelKey] || modelKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Fallback formatting
  };

  const updateModelUI = () => {
      const selectedModel = modelSelect.value;
      const selectedOption = modelSelect.options[modelSelect.selectedIndex];
      const modelAvatarSrc = selectedOption.getAttribute('data-avatar') || 'default-avatar.png'; // Get avatar from data attribute
      const modelExists = modelSelect.querySelector(`option[value="${selectedModel}"]`);

      if (modelExists) {
          const modelDisplayName = formatModelName(selectedModel);
          // Update Header Text
          if (modelNameHeader) modelNameHeader.textContent = modelDisplayName;
          // Update Avatar Image
          if (modelAvatar) {
              modelAvatar.src = modelAvatarSrc;
              modelAvatar.alt = `${modelDisplayName} Avatar`;
              modelAvatar.onerror = () => { modelAvatar.src = 'default-avatar.png'; }; // Fallback avatar
          }
      } else {
          console.warn(`Selected model value "${selectedModel}" not found in options.`);
          // Handle fallback if needed
          if (modelNameHeader) modelNameHeader.textContent = "انتخاب مدل";
          if (modelAvatar) modelAvatar.src = 'default-avatar.png';
      }
  };

  // --- Local Storage for Chat History ---
  function saveChatHistory() {
      localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(conversationHistory));
  }

  function loadChatHistory() {
      const history = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      return history ? JSON.parse(history) : [];
  }

  function clearChatHistory() {
      conversationHistory = [];
      saveChatHistory();
  }

  function updateConversationHistory(role, content) {
      conversationHistory.push({ role: role, content: content });
      saveChatHistory(); // Save after each message
      // Optional: Limit history length - if needed, implement history trimming here
  }


  // --- API Call Function ---
  const callCometAPI = async (prompt, model, imageBase64) => {
    showLoading(true);
    const typingIndicator = showTypingIndicator();

    try {
      let userContent = [];
      if (prompt) {
        userContent.push({ type: 'text', text: prompt });
      }
      if (imageBase64) {
        userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
      }
      if (userContent.length === 0) {
          throw new Error("Cannot send an empty message.");
      }

      const systemPrompt = `📌 Your Role: Advanced AI Assistant (Ravid AI)
You are a highly capable AI assistant powered by models like GPT-4o, Claude 3.5, etc., integrated into the Ravid AI chat interface. Your goal is to provide accurate, helpful, and engaging responses in Persian (Farsi) or English, adapting to the user's language.

Key Capabilities & Instructions:
1.  🗣️ Language: Primarily respond in the user's language (detect automatically). Your Persian should be fluent and natural.
2.  📸 Image Analysis: You CAN see and analyze images sent by the user. Describe objects, read text (including Persian), understand context. NEVER claim you cannot see images.
3.  🌐 Web Search (${webSearchEnabled ? 'ACTIVE' : 'INACTIVE'}): ${webSearchEnabled ? 'You MUST proactively use your web search tool for current events, real-time data (prices, news), or when asked to "search the web".' : 'Web search is currently disabled. Rely on your internal knowledge.'}
4.  🖋️ Tone: Adapt your tone (professional, casual, creative, humorous) based on the user's input and the topic. Default to a helpful and friendly tone.
5.  🧠 Context: Remember previous messages in the current conversation for relevant follow-up.
6.   G Formatting: Use Markdown (lists, bold, italics, tables, code blocks) for clarity. For code blocks, specify the language (e.g., \`\`\`python).
7.  💡 Helpfulness: Go beyond simple answers. Provide explanations, examples, or ask clarifying questions if needed.
8.  🔒 Safety: Avoid generating harmful, unethical, or inappropriate content. Politely decline unsafe requests. Add disclaimers for sensitive topics (medical, financial).
9.  🎭 Persona: Be Ravid AI – intelligent, versatile, and approachable.
10. ✨ Quality: Aim for high-quality, well-structured, and informative responses.`;

      // Prepare messages array including simple history
      const messages = [
          { role: 'system', content: systemPrompt },
          // Include recent history (e.g., last 4 messages) - adjust as needed
          ...conversationHistory.slice(-4),
          { role: 'user', content: userContent }
      ];

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COMET_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages, // Send history + new message
          temperature: parseFloat(tempRange?.value ?? 0.7),
          top_p: parseFloat(topPRange?.value ?? 0.95), // Include top_p
          presence_penalty: parseFloat(presencePenaltyRange?.value ?? 0.0), // Include presence_penalty
          // max_tokens: parseInt(maxTokensInput.value), // Optional: set max tokens if needed (commented out in UI)
        })
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Try to parse error
        throw new Error(`خطای API ${response.status}: ${errorData?.error?.message || response.statusText}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
          throw new Error("پاسخ نامعتبر از API دریافت شد.");
      }

      return data.choices[0].message.content;

    } catch (error) {
      console.error('خطا در فراخوانی Comet API:', error);
      removeTypingIndicator();
      showLoading(false); // Ensure loading stops on error
      // Display error message in chat
      addMessage(`متاسفانه مشکلی پیش آمد: ${error.message}`, false);
      return null; // Indicate failure
    } finally {
       // No need to call showLoading(false) here if response is successful,
       // as it's handled after addMessage in sendMessage
    }
  };

  // --- Speech Recognition Setup ---
  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      speechRecognition = new SpeechRecognition();
      speechRecognition.continuous = false;
      speechRecognition.interimResults = false;
      speechRecognition.lang = 'fa-IR'; // Set to Persian

      speechRecognition.onstart = () => {
        isRecognizingSpeech = true;
        voiceInputBtn.classList.add('recording');
        voiceInputBtn.innerHTML = '<i class="fas fa-stop"></i>';
        voiceInputBtn.setAttribute('aria-label', 'توقف ضبط صدا');
      };

      speechRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        // Trigger input event for auto-resize
        userInput.dispatchEvent(new Event('input'));
        userInput.focus();
      };

      speechRecognition.onerror = (event) => {
        console.error('خطای تشخیص گفتار:', event.error);
        showToast(`خطای گفتار: ${event.error}`, 'error');
        // Reset state even on error
         isRecognizingSpeech = false;
         voiceInputBtn.classList.remove('recording');
         voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
         voiceInputBtn.setAttribute('aria-label', 'ورودی صوتی');
      };

      speechRecognition.onend = () => {
        isRecognizingSpeech = false;
        voiceInputBtn.classList.remove('recording');
        voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceInputBtn.setAttribute('aria-label', 'ورودی صوتی');
      };

    } else {
      console.warn('تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود.');
      if (voiceInputBtn) voiceInputBtn.style.display = 'none'; // Hide the button
    }
  };

  const toggleSpeechRecognition = () => {
    if (!speechRecognition) return;
    if (isRecognizingSpeech) {
      speechRecognition.stop();
    } else {
      try {
        speechRecognition.start();
      } catch (error) {
        console.error("خطا در شروع تشخیص گفتار:", error);
        showToast("امکان شروع ورودی صوتی وجود ندارد.", "error");
         // Ensure UI resets if start fails immediately
         isRecognizingSpeech = false;
         voiceInputBtn.classList.remove('recording');
         voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
         voiceInputBtn.setAttribute('aria-label', 'ورودی صوتی');
      }
    }
  };


  // --- Event Handlers ---

  const handleSendMessage = async () => {
    const messageText = userInput.value.trim();

    // Require either text or an image
    if (!messageText && !attachedImageBase64) {
        showToast("لطفاً پیام بنویسید یا تصویر پیوست کنید.", "warning");
        return;
    }

    // Display user message (with image if attached)
    const userMessageContent = messageText || (attachedImageBase64 ? "تصویر ارسال شد" : "");
    const userImageSrc = attachedImageBase64 ? `data:image/jpeg;base64,${attachedImageBase64}` : null;
    addMessage(userMessageContent, true, userImageSrc);

    // Store current state and clear input/preview
    const currentImageBase64 = attachedImageBase64;
    const currentModel = modelSelect.value;
    userInput.value = '';
    userInput.style.height = 'auto'; // Reset height
    userInput.dispatchEvent(new Event('input')); // Trigger resize check
    removeAttachedImage(); // Clear preview and state AFTER getting value

    // Call API
    const botResponse = await callCometAPI(messageText, currentModel, currentImageBase64);

    // Display bot response if successful
    if (botResponse) {
        addMessage(botResponse, false);
    }
    // Loading indicator is handled within callCometAPI and after bot message is added
     showLoading(false); // Ensure UI is re-enabled
     userInput.focus();
  };


  const handleImageInputChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Basic validation (optional: add size limit)
    if (!file.type.startsWith('image/')) {
      showToast('لطفاً یک فایل تصویر انتخاب کنید.', 'error');
      return;
    }

    showLoading(true); // Show loading while processing image
    try {
      attachedImageBase64 = await convertImageToBase64(file);
      displayImagePreview(file);
      userInput.placeholder = 'توضیحی برای تصویر بنویسید (اختیاری)...';
      userInput.focus();
    } catch (error) {
      console.error('خطا در پردازش تصویر:', error);
      showToast('خطا در خواندن تصویر.', 'error');
      removeAttachedImage(); // Clean up on error
    } finally {
      showLoading(false);
    }
  };

  const handleThemeToggle = () => {
    document.body.classList.toggle('dark-theme');
    const isDarkMode = document.body.classList.contains('dark-theme');
    localStorage.setItem('darkTheme', isDarkMode);
    themeToggle.innerHTML = isDarkMode
      ? '<i class="fas fa-sun fa-fw"></i> حالت روز'
      : '<i class="fas fa-moon fa-fw"></i> حالت شب';
    themeToggle.setAttribute('aria-label', isDarkMode ? 'تغییر به حالت روز' : 'تغییر به حالت شب');
    // Update range slider thumbs for theme change
     updateRangeValue(tempRange, tempValueSpan);
     updateRangeValue(topPRange, topPValueSpan); // Update Top P slider thumb
     updateRangeValue(presencePenaltyRange, presencePenaltyValueSpan); // Update Presence Penalty slider thumb
  };

  const handleSidebarToggle = (forceOpen = null) => {
    const open = forceOpen !== null ? forceOpen : !sidebar.classList.contains('open');
    isSidebarOpen = open;
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('show', open);
    document.body.classList.toggle('sidebar-open', open); // Optional: for body styling
    mobileMenuBtn.setAttribute('aria-expanded', open);
  };

  const handleClearChat = () => {
    // Add confirmation later if desired
    const messages = chatArea.querySelectorAll('.message');
    if (messages.length === 0 && !welcomeContainer?.parentNode) return; // Nothing to clear

    // Animate out existing messages
    messages.forEach((msg, index) => {
      msg.style.transition = `opacity 0.3s ease-out ${index * 0.03}s, transform 0.3s ease-out ${index * 0.03}s`;
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-10px)';
    });

    // Clear after animation
    setTimeout(() => {
      chatArea.innerHTML = ''; // Clear content
      // conversationHistory = []; // Keep history in local storage, just clear display now. If you want to clear history completely, uncomment this line and localStorage.removeItem below
      // saveChatHistory();
      // Optionally, re-add the welcome message or a confirmation message
      addMessage("گفتگو پاک شد. چطور می‌توانم کمکتان کنم؟", false);
      // If you want the full welcome message back:
      // chatArea.appendChild(welcomeContainer); // Assuming welcomeContainer wasn't removed permanently
      // welcomeContainer.classList.remove('fade-out');
    }, messages.length * 30 + 300); // Wait for all animations + buffer
  };

  const handleClearHistory = () => {
      clearChatHistory(); // Clear history data from local storage
      handleClearChat(); // Optionally also clear the current chat display
      localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY); // Ensure history is fully cleared
      showToast('تاریخچه گفتگو پاک شد.', 'warning'); // Use warning for history clear as it's more significant than chat clear
  };


  const handleExportChat = () => {
    let chatText = `# گفتگوی Ravid AI (${new Date().toLocaleString('fa-IR')})\n\n`;
    chatText += `**مدل:** ${formatModelName(modelSelect.value)}\n`;
    chatText += `**دما:** ${tempRange.value}\n`;
    chatText += `**جستجوی وب:** ${webSearchEnabled ? 'فعال' : 'غیرفعال'}\n\n---\n\n`;

    const messages = chatArea.querySelectorAll('.message'); // Get current messages

    messages.forEach(msg => {
        const isUser = msg.classList.contains('user-message');
        const sender = isUser ? '👤 کاربر' : `🤖 ${formatModelName(modelSelect.value)}`; // Use current model name

        // Attempt to get cleaner text content, handling potential HTML structure
        let content = '';
        const contentDiv = msg.querySelector('.message-content');
        if (contentDiv) {
             // Clone to avoid modifying the original message
            const tempDiv = contentDiv.cloneNode(true);
             // Remove time span
            const timeSpan = tempDiv.querySelector('.message-time');
            if (timeSpan) timeSpan.remove();
             // Remove copy buttons
            tempDiv.querySelectorAll('.copy-code-btn').forEach(btn => btn.remove());
             // Handle images (add placeholder)
            tempDiv.querySelectorAll('img').forEach(img => {
                const p = document.createElement('p');
                p.textContent = '[تصویر پیوست شده]';
                img.replaceWith(p);
            });
             // Extract text, trying to preserve structure somewhat
            content = tempDiv.innerText || tempDiv.textContent || '';
            content = content.trim(); // Trim whitespace
        }


        chatText += `**${sender}:**\n${content || '(پیام خالی یا فقط تصویر)'}\n\n`; // Add fallback
    });

    const blob = new Blob([chatText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Generate filename with date and model
    const dateStr = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
    const modelStr = formatModelName(modelSelect.value).replace(/ /g, '_');
    a.download = `RavidAI_Chat_${modelStr}_${dateStr}.md`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('گفتگو با فرمت Markdown دانلود شد.');
  };

  const handleWebSearchToggle = () => {
      webSearchEnabled = !webSearchEnabled;
      webSearchToggle.classList.toggle('active', webSearchEnabled);
      webSearchToggle.title = `جستجوی وب (${webSearchEnabled ? 'فعال' : 'غیرفعال'})`;
      showToast(`جستجوی وب ${webSearchEnabled ? 'فعال' : 'غیرفعال'} شد.`);
      // Optional: Add a system message in chat?
      // addMessage(`سیستم: جستجوی وب ${webSearchEnabled ? 'فعال' : 'غیرفعال'} شد.`, false);
  };

  const handleSuggestionClick = (event) => {
    if (event.target.classList.contains('suggestion-chip')) {
        const suggestionText = event.target.textContent.trim();
        userInput.value = suggestionText;
        userInput.focus();
         // Trigger input event for auto-resize
        userInput.dispatchEvent(new Event('input'));
        // Optionally remove welcome message immediately
        if (welcomeContainer && !welcomeContainer.classList.contains('fade-out')) {
           welcomeContainer.classList.add('fade-out');
           setTimeout(() => welcomeContainer.remove(), 300);
        }
    }
  };

  const handleSidebarSectionToggle = (event) => {
      const headerButton = event.target.closest('.section-header');
      if (!headerButton) return;

      const contentId = headerButton.getAttribute('aria-controls');
      const content = document.getElementById(contentId);
      const isExpanded = headerButton.getAttribute('aria-expanded') === 'true';

      headerButton.setAttribute('aria-expanded', !isExpanded);
      content.hidden = isExpanded;
  };

  const handleAdvancedSettingsToggle = () => {
      const isExpanded = advancedSettingsToggle.classList.contains('expanded');
      advancedSettingsToggle.classList.toggle('expanded', !isExpanded);
      advancedSettingsSection.style.display = isExpanded ? 'none' : 'block';
      advancedSettingsToggle.setAttribute('aria-expanded', !isExpanded); // For accessibility
  };


  // --- Event Listeners ---
  if (sendButton) sendButton.addEventListener('click', handleSendMessage);
  if (userInput) {
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
    // Auto-resize textarea
    userInput.addEventListener('input', function() {
      this.style.height = 'auto'; // Reset height
      // Set height based on scroll height, respecting max-height from CSS
      this.style.height = Math.min(this.scrollHeight, parseInt(getComputedStyle(this).maxHeight)) + 'px';
    });
  }
  if (themeToggle) themeToggle.addEventListener('click', handleThemeToggle);
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => handleSidebarToggle(true));
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', () => handleSidebarToggle(false));
  if (overlay) overlay.addEventListener('click', () => handleSidebarToggle(false));
  if (clearChatBtn) clearChatBtn.addEventListener('click', handleClearChat);
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', handleClearHistory); // New clear history button event
  if (attachFileBtn) attachFileBtn.addEventListener('click', () => imageInput?.click());
  if (imageInput) imageInput.addEventListener('change', handleImageInputChange);
  if (removeImageBtn) removeImageBtn.addEventListener('click', removeAttachedImage);
  if (voiceInputBtn && speechRecognition) voiceInputBtn.addEventListener('click', toggleSpeechRecognition);
  if (webSearchToggle) webSearchToggle.addEventListener('click', handleWebSearchToggle);
  if (exportChatBtn) exportChatBtn.addEventListener('click', handleExportChat);
  if (modelSelect) modelSelect.addEventListener('change', updateModelUI);
  if (tempRange) tempRange.addEventListener('input', () => updateRangeValue(tempRange, tempValueSpan));
  if (topPRange) topPRange.addEventListener('input', () => updateRangeValue(topPRange, topPValueSpan)); // Top P range listener
  if (presencePenaltyRange) presencePenaltyRange.addEventListener('input', () => updateRangeValue(presencePenaltyRange, presencePenaltyValueSpan)); // Presence Penalty range listener
  if (advancedSettingsToggle) advancedSettingsToggle.addEventListener('click', handleAdvancedSettingsToggle); // Advanced settings toggle listener


   // Event listener for suggestion chips (using event delegation)
   const suggestionsContainer = document.querySelector('.suggestions-list');
   if (suggestionsContainer) {
       suggestionsContainer.addEventListener('click', handleSuggestionClick);
   }

    // Event listeners for sidebar section toggles (using event delegation)
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        sidebarNav.addEventListener('click', handleSidebarSectionToggle);
    }


  // --- Initial Setup ---
  const init = () => {
    // Apply saved theme
    const savedTheme = localStorage.getItem('darkTheme');
    if (savedTheme === 'true') {
      document.body.classList.add('dark-theme');
      themeToggle.innerHTML = '<i class="fas fa-sun fa-fw"></i> حالت روز';
      themeToggle.setAttribute('aria-label', 'تغییر به حالت روز');
    } else {
        themeToggle.innerHTML = '<i class="fas fa-moon fa-fw"></i> حالت شب';
        themeToggle.setAttribute('aria-label', 'تغییر به حالت شب');
    }

    // Initial slider value display
    updateRangeValue(tempRange, tempValueSpan);
    updateRangeValue(topPRange, topPValueSpan); // Initialize Top P slider value
    updateRangeValue(presencePenaltyRange, presencePenaltyValueSpan); // Initialize Presence Penalty slider value

    // Initial model display
    updateModelUI();

    // Setup speech recognition
    setupSpeechRecognition();

    // Focus input on load
    // userInput?.focus(); // Maybe disable auto-focus for better initial view

    // Set initial state for sidebar sections (assuming default is expanded)
    document.querySelectorAll('.section-header').forEach(header => {
        const contentId = header.getAttribute('aria-controls');
        const content = document.getElementById(contentId);
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        if (content) content.hidden = !isExpanded;
    });

    console.log("Ravid AI Initialized ✨");
  };

  // Run Initialization
  init();

}); // End DOMContentLoaded
