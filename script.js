// کلید API کامت
const COMET_API_KEY = "sk-OtiNbjY3B9e6rIFJRLifvBa1DNoJF6UjFZdHi0tJ2hXuF9SG"; // ← اینجا کلید واقعی‌تو بذار

// انتخاب المنت‌های صفحه
const chatArea = document.getElementById('chatArea');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const progressBar = document.getElementById('progressBar');
const themeToggle = document.getElementById('themeToggle');
const mobileMenuBtn = document.querySelector('.mobile-menu');
const sidebar = document.querySelector('.sidebar');
const clearChatBtn = document.querySelector('.clear-chat');
const suggestionBtns = document.querySelectorAll('.suggestion');
const examplePromptBtns = document.querySelectorAll('.example-prompt');
const imageInput = document.getElementById('imageInput');
const attachFileBtn = document.getElementById('attachFileBtn');
const voiceInputBtn = document.getElementById('voiceInputBtn');
const webSearchToggle = document.getElementById('webSearchToggle');

let attachedImageBase64 = null;
let webSearchEnabled = false;
let speechRecognition = null;

// تنظیمات اولیه پس از بارگذاری صفحه
document.addEventListener('DOMContentLoaded', () => {
  // تأخیر در نمایش پیام خوش‌آمدگویی
  setTimeout(() => {
    // اگر صفحه دارای کلاس welcome-container است، پیام را نمایش نده
    if (!document.querySelector('.welcome-container')) {
      addMessage("سلام! من دستیار هوشمند Ravid AI هستم. چطور می‌تونم کمکتون کنم؟", false);
    }
  }, 800);

  // بررسی و اعمال تم ذخیره شده
  if (localStorage.getItem('darkTheme') === 'true') {
    document.body.classList.add('dark-theme');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i> حالت روز';
  }

  // تنظیم رنگ‌های اسلایدرها
  updateRangeColors();
  
  // نمایش مقادیر فعلی اسلایدرها
  const tempRange = document.getElementById('tempRange');
  const maxTokens = document.getElementById('maxTokens');
  
  if (tempRange) {
    document.getElementById('tempValue').textContent = tempRange.value;
    tempRange.addEventListener('input', updateRangeColors);
  }
  
  if (maxTokens) {
    document.getElementById('tokenValue').textContent = maxTokens.value;
    maxTokens.addEventListener('input', updateRangeColors);
  }
  
  // اضافه کردن رویداد کلیک به مثال‌های پیشنهادی
  if (examplePromptBtns) {
    examplePromptBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        userInput.value = btn.textContent;
        userInput.focus();
        // حذف welcome-container بعد از انتخاب یک پیشنهاد
        const welcomeContainer = document.querySelector('.welcome-container');
        if (welcomeContainer) {
          welcomeContainer.classList.add('fade-out');
          setTimeout(() => {
            welcomeContainer.remove();
          }, 300);
        }
      });
    });
  }
  
  // تنظیم تشخیص گفتار
  setupSpeechRecognition();
});

// تابع بروزرسانی رنگ اسلایدرها
function updateRangeColors() {
  document.querySelectorAll('.setting-range').forEach(range => {
    const value = (range.value - range.min) / (range.max - range.min) * 100;
    range.style.backgroundSize = value + '% 100%';
  });
}

function getCurrentTime() {
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  hours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes}`;
}

// تابع افزودن پیام به چت با پشتیبانی از Markdown
function addMessage(message, isUser) {
  // حذف welcome-container اگر هنوز وجود دارد
  const welcomeContainer = document.querySelector('.welcome-container');
  if (welcomeContainer) {
    welcomeContainer.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = isUser ? 'message user-message' : 'message bot-message';
  
  const time = getCurrentTime();
  
  // تبدیل مارک‌داون به HTML اگر این یک پیام بات است
  if (!isUser && typeof showdown !== 'undefined') {
    const converter = new showdown.Converter({
      tables: true,
      simplifiedAutoLink: true,
      strikethrough: true,
      tasklists: true,
      emoji: true
    });
    
    // جایگزینی کدهای قالب‌دار با تگ‌های pre و code برای هایلایت بهتر
    let formattedMessage = message.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, language, code) {
      language = language || 'plaintext';
      return `<pre><code class="language-${language}">${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });
    
    // تبدیل بقیه مارک‌داون به HTML
    const html = converter.makeHtml(formattedMessage);
    messageDiv.innerHTML = `${html}<small>${time}</small>`;
  } else {
    // برای پیام‌های کاربر، مارک‌داون نمی‌خواهیم
    messageDiv.innerHTML = `${message}<small>${time}</small>`;
  }
  
  chatArea.appendChild(messageDiv);
  
  // اسکرول به پایین صفحه
  setTimeout(() => {
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 100);
  
  // اگر شامل کد است، Prism را اجرا کن
  if (!isUser && typeof Prism !== 'undefined') {
    Prism.highlightAllUnder(messageDiv);
  }
  
  return messageDiv;
}

// نمایش نشانگر تایپ
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot-message typing-indicator';
  typingDiv.id = 'typing';
  typingDiv.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  chatArea.appendChild(typingDiv);
  typingDiv.scrollIntoView({ behavior: 'smooth' });
  return typingDiv;
}

// تابع ارسال پیام متنی به API
async function callCometAPI(prompt, model = 'gpt-4o-all', imageBase64 = null) {
  try {
    // نمایش نوار پیشرفت
    progressBar.style.display = 'block';
    
    const userContent = imageBase64
      ? [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      : prompt;

    const systemMessage = webSearchEnabled
      ? `You are ChatGPT, a powerful and intelligent multimodal assistant powered by OpenAI's GPT-4o architecture. 
You can understand and respond to both text and images, analyze visual content, describe it, and incorporate that understanding into your responses.

You are integrated into a public-facing website, so you must provide an intelligent, fast, and engaging chat experience.

⚠️ You also have access to real-time web browsing tools. You must **proactively** use this ability when:
- The user asks for current, real-time, or changing information (such as currency rates, gold prices, political news, tech trends, or new product models).
- The user explicitly tells you to "search the web", "browse online", or similar phrases—even in Persian (Farsi).
- The user needs up-to-date sources for writing articles, research, or anything time-sensitive.

You must always interpret these signals clearly and use web search to provide the most accurate and timely responses.

Additionally:
- Your tone should match the user's (casual, professional, or humorous).
- Keep answers clear, helpful, and concise, while including examples when needed.
- Add personality or light humor when appropriate.
- Respond to requests in both English and Persian, and always accept and analyze images if the user asks, in either language.`
      : `You are ChatGPT, a powerful and intelligent multimodal assistant powered by OpenAI's GPT-4o architecture. 
You can understand and respond to both text and images, analyze visual content, describe it, and incorporate that understanding into your responses.

You are integrated into a public-facing website, so you must provide an intelligent, fast, and engaging chat experience.

- Your tone should match the user's (casual, professional, or humorous).
- Keep answers clear, helpful, and concise, while including examples when needed.
- Add personality or light humor when appropriate.
- Respond to requests in both English and Persian, and always accept and analyze images if the user asks, in either language.
- Use markdown formatting to make your responses more readable.`;

    const response = await fetch('https://api.cometapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COMET_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            role: 'system',
            content: `📌 Your Role:
You are a highly advanced, multi-purpose AI assistant powered by cutting-edge language models (like GPT-4.1, GPT-4o, DeepSeek, Claude, Grok, etc.). Your job is to provide helpful, accurate, and human-like responses in the user's language.

📸 1. Image Understanding:
- You have full image understanding capabilities.
- If a user sends you an image or even asks you in Persian (or any language) to analyze a photo, you must process it thoroughly.
- Always assume you can "see" and interpret the image, including objects, texts, handwriting, human faces, charts, documents, or anything visual.
- Never say “I cannot view images” — you *can*, and you *do*.
- If the image contains Persian text or context, accurately read and interpret it.

🗣️ 2. Conversational Style:
- Speak in a friendly, natural, and human tone.
- If the topic is scientific or formal, use a professional tone.
- For casual or personal questions, maintain a helpful, chill, and smart personality.

📝 3. Academic Writing:
- When asked to write essays, research papers, or articles, create:
  - A proper academic title
  - An abstract (if needed)
  - An introduction
  - A well-structured body with clear headings
  - A strong conclusion
  - Citations or references if requested
- Use a formal, scholarly tone with clarity, accuracy, and a logical flow.
- If the user mentions a specific format (e.g., APA, IEEE), follow it precisely.

🌍 4. Multilingual Awareness:
- Detect the user's language and respond in the same one.
- For Persian (Farsi), your performance should match English in quality.
- If the user requests a translation or a change in language, switch smoothly.

💬 5. Smart & Contextual Replies:
- Remember context and past messages within the conversation.
- If the user seems confused, provide helpful explanations and examples.
- Don’t just answer questions — provide real help and insight.

📄 6. Custom Formatting:
- When the user asks for a specific output format (like a list, table, checklist, JSON, summary, or code block), deliver it exactly as requested.
- Rewrite or simplify complex content if asked, to improve understanding.

🔒 7. Ethics & Safety:
- Avoid giving false, harmful, or offensive content.
- Politely decline or warn if a request is unsafe or unethical.
- For sensitive topics like medical, legal, or psychological advice, include a disclaimer or suggest consulting a professional.

🎭 8. Adaptive Personality:
- Adapt to the user’s request for tone/style: professional, poetic, casual, romantic, humorous, etc.
- You can roleplay characters, narrate stories, write emotional texts, simulate dialogue — whatever the user needs.

⚡ 9. High Speed + High Quality:
- Respond quickly but without sacrificing depth or quality.
- Get to the point, but feel free to elaborate if it adds value or clarity.

🎯 10. Human-like Experience:
- You are not “just a chatbot” — you are a helpful, smart, and warm AI partner.
- Make the user feel like they’re talking to a reliable human expert or friend — not a machine.
`
            
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: parseFloat(document.getElementById('tempRange')?.value || 1.0),
        max_tokens: parseInt(document.getElementById('maxTokens')?.value || 1000)
      })
    });

    // مخفی کردن نوار پیشرفت
    progressBar.style.display = 'none';

    if (!response.ok) throw new Error(`خطای API: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('خطا در تماس با API کامت:', error);
    progressBar.style.display = 'none';
    throw error;
  }
}

// راه‌اندازی تشخیص گفتار
function setupSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'fa-IR'; // تنظیم زبان برای فارسی
    
    speechRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      userInput.value = transcript;
      // تنظیم ارتفاع خودکار
      userInput.style.height = 'auto';
      userInput.style.height = (userInput.scrollHeight) + 'px';
    };
    
    speechRecognition.onerror = (event) => {
      console.error('خطا در تشخیص گفتار:', event.error);
      voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      voiceInputBtn.classList.remove('recording');
    };
    
    speechRecognition.onend = () => {
      voiceInputBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      voiceInputBtn.classList.remove('recording');
    };
    
    // اضافه کردن رویداد کلیک به دکمه صدا
    if (voiceInputBtn) {
      voiceInputBtn.addEventListener('click', toggleSpeechRecognition);
    }
  } else {
    console.log('تشخیص گفتار در این مرورگر پشتیبانی نمی‌شود');
    if (voiceInputBtn) {
      voiceInputBtn.style.display = 'none';
    }
  }
}

// تغییر وضعیت تشخیص گفتار
function toggleSpeechRecognition() {
  if (speechRecognition) {
    if (voiceInputBtn.classList.contains('recording')) {
      speechRecognition.stop();
    } else {
      voiceInputBtn.innerHTML = '<i class="fas fa-stop"></i>';
      voiceInputBtn.classList.add('recording');
      speechRecognition.start();
    }
  }
}

// ارسال پیام
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message && !attachedImageBase64) return;

  userInput.disabled = true;
  addMessage(message || '📎 تصویر ارسال شد.', true);
  userInput.value = '';
  userInput.style.height = 'auto'; // بازگرداندن ارتفاع به حالت اولیه

  // نمایش نشانگر تایپ
  const typingIndicator = showTypingIndicator();
  
  try {
    // انتخاب مدل از سلکت باکس
    const modelSelect = document.getElementById('modelSelect');
    const selectedModel = modelSelect ? modelSelect.value : 'gpt-4o-all';
    
    const response = await callCometAPI(message, selectedModel, attachedImageBase64);
    chatArea.removeChild(typingIndicator);
    
    // کمی تاخیر برای واقعی‌تر شدن
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
    const messageElement = addMessage(response, false);
    
    // اضافه کردن افکت "تایپ شدن" به پیام
    messageElement.style.opacity = '0';
    setTimeout(() => {
      messageElement.style.opacity = '1';
      messageElement.classList.add('typed-message');
    }, 100);
  } catch (error) {
    chatArea.removeChild(typingIndicator);
    addMessage(`خطا: ${error.message}`, false);
  }

  userInput.disabled = false;
  userInput.focus();
  attachedImageBase64 = null; // پاک‌سازی تصویر پس از ارسال
}

// تبدیل تصویر به Base64
function convertImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// رویداد انتخاب تصویر
if (imageInput) {
  imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    attachedImageBase64 = await convertImageToBase64(file);


    try {
      // نمایش پیش‌نمایش تصویر
      const previewMessage = document.createElement('div');
      previewMessage.className = 'message user-message image-preview-message';
      
      const time = getCurrentTime();
      const imagePreview = document.createElement('div');
      imagePreview.className = 'image-preview';
      
      const previewImg = document.createElement('img');
      previewImg.className = 'preview-image';
      
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
      };
      reader.readAsDataURL(file);
      
      imagePreview.appendChild(previewImg);
      previewMessage.appendChild(imagePreview);
      previewMessage.innerHTML += `<p>تصویر پیوست شد</p><small>${time}</small>`;
      
      chatArea.appendChild(previewMessage);
      previewMessage.scrollIntoView({ behavior: 'smooth' });

      attachedImageBase64 = await convertImageToBase64(file);
      
      // افزودن راهنمایی برای کاربر
      userInput.placeholder = 'توضیحات خود را درباره تصویر بنویسید...';
      userInput.focus();
    } catch (err) {
      addMessage(`❌ خطا در پردازش تصویر: ${err.message}`, false);
    }

    e.target.value = '';
  });
}

// رویداد کلیک دکمه ارسال
if (sendButton) {
  sendButton.addEventListener('click', sendMessage);
}

// رویداد کلیک دکمه پیوست
if (attachFileBtn) {
  attachFileBtn.addEventListener('click', () => {
    imageInput.click();
  });
}

// رویداد تغییر وضعیت جستجوی وب
if (webSearchToggle) {
  webSearchToggle.addEventListener('click', () => {
    webSearchEnabled = !webSearchEnabled;
    
    if (webSearchEnabled) {
      webSearchToggle.classList.add('enabled');
      addMessage("قابلیت جستجوی وب فعال شد. من اکنون می‌توانم به اطلاعات بروز روی اینترنت دسترسی داشته باشم.", false);
    } else {
      webSearchToggle.classList.remove('enabled');
      addMessage("قابلیت جستجوی وب غیرفعال شد.", false);
    }
  });
}

// رویداد کلید Enter
if (userInput) {
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // تنظیم ارتفاع خودکار textarea
  userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
}

// تغییر تم (روشن/تاریک)
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    if (document.body.classList.contains('dark-theme')) {
      themeToggle.innerHTML = '<i class="fas fa-sun"></i> حالت روز';
      localStorage.setItem('darkTheme', 'true');
    } else {
      themeToggle.innerHTML = '<i class="fas fa-moon"></i> حالت شب';
      localStorage.setItem('darkTheme', 'false');
    }
    
    // به‌روزرسانی رنگ‌های اسلایدرها پس از تغییر تم
    updateRangeColors();
  });
}

// منوی موبایل
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // بستن منو با کلیک خارج از آن
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// پاک کردن تاریخچه چت
if (clearChatBtn) {
  clearChatBtn.addEventListener('click', () => {
    // افزودن کلاس انیمیشن به تمام پیام‌های چت
    const messages = document.querySelectorAll('.message');
    messages.forEach(msg => {
      msg.style.opacity = '0';
      msg.style.transform = 'translateY(-10px)';
    });

    // پس از انیمیشن، پاک کردن چت
    setTimeout(() => {
      chatArea.innerHTML = '';
      setTimeout(() => {
        addMessage("تاریخچه پاک شد. چطور کمکتون کنم؟", false);
      }, 300);
    }, 300);
  });
}

// دکمه‌های پیشنهاد سریع
if (suggestionBtns) {
  suggestionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      userInput.value = btn.textContent.replace(/^[^\s]+ /, ''); // حذف آیکون
      userInput.focus();
      userInput.style.height = 'auto';
      userInput.style.height = (userInput.scrollHeight) + 'px';
    });
  });
}

// دکمه دانلود گفتگو
const exportBtn = document.getElementById('exportChat');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const messages = chatArea.querySelectorAll('.message');
    let chatText = "# گفتگوی Ravid AI\n\n";
    
    messages.forEach(msg => {
      const isUser = msg.classList.contains('user-message');
      const sender = isUser ? '👤 کاربر' : '🤖 Ravid AI';
      let content = msg.innerHTML.split('<small>')[0]; // متن پیام بدون زمان
      
      // حذف تگ‌های HTML
      const div = document.createElement('div');
      div.innerHTML = content;
      content = div.textContent || div.innerText || '';
      
      chatText += `## ${sender}\n${content}\n\n`;
    });
    
    const blob = new Blob([chatText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ravid-chat-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // نمایش پیام تایید
    const notification = document.createElement('div');
    notification.className = 'download-notification';
    notification.innerHTML = '<i class="fas fa-check-circle"></i> گفتگو با موفقیت دانلود شد';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 2000);
  });
}

// اضافه کردن استایل برای نوتیفیکیشن دانلود
const style = document.createElement('style');
style.textContent = `
  .download-notification {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: var(--success);
    color: white;
    padding: 10px 20px;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-md);
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out forwards;
    transition: opacity 0.3s;
  }
  
  @keyframes slideIn {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .image-preview-message {
    display: flex;
    flex-direction: column;
  }
  
  .image-preview {
    margin-bottom: 10px;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
    max-width: 300px;
  }
  
  .preview-image {
    width: 100%;
    height: auto;
    object-fit: contain;
  }
  
  .recording {
    background-color: var(--accent) !important;
    color: white !important;
    animation: pulse 1.5s infinite;
  }
  
  .header-btn.enabled {
    background-color: rgba(40, 167, 69, 0.3);
  }
  
  .fade-out {
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s, transform 0.3s;
  }
  
  .typed-message {
    animation: fadeIn 0.5s ease-out;
  }
`;

document.head.appendChild(style);

// فوکوس روی ورودی هنگام بارگذاری
window.addEventListener('load', () => {
  if (userInput) userInput.focus();
});

// تنظیم toggle برای بخش‌های سایدبار
const collapseBtns = document.querySelectorAll('.collapse-btn');
if (collapseBtns) {
  collapseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.chat-history-section, .model-settings-section');
      const content = parent.querySelector('.chat-history-list, .model-settings');
      
      // تغییر وضعیت نمایش محتوا با انیمیشن
      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.style.opacity = '0';
        setTimeout(() => {
          content.style.display = 'none';
        }, 300);
      } else {
        content.style.display = 'block';
        content.style.opacity = '0';
        setTimeout(() => {
          content.style.maxHeight = content.scrollHeight + 'px';
          content.style.opacity = '1';
        }, 10);
      }
      
      // تغییر آیکون
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
      }
    });
  });
}

// اضافه کردن استایل برای انیمیشن‌های جدید
const additionalStyle = document.createElement('style');
additionalStyle.textContent = `
  .chat-history-list, .model-settings {
    max-height: none;
    overflow: hidden;
    transition: max-height 0.3s ease-out, opacity 0.3s;
  }
`;

document.head.appendChild(additionalStyle);

document.addEventListener('DOMContentLoaded', function () {
  const modelSelect = document.getElementById('modelSelect');
  const modelHeader = document.getElementById('modelNameHeader');

  if (modelSelect && modelHeader) {
    modelSelect.addEventListener('change', function () {
      const selectedModel = modelSelect.options[modelSelect.selectedIndex].text;
      modelHeader.textContent = selectedModel;
    });
  }
});

const modelSelect = document.getElementById('modelSelect');
const modelAvatar = document.getElementById('modelAvatar');

if (modelSelect && modelAvatar) {
  modelSelect.addEventListener('change', () => {
    const selectedModel = modelSelect.value;
    modelAvatar.src = `${selectedModel}.png`;
    modelAvatar.alt = `${selectedModel} Avatar`;

    // تغییر نام بالای آواتار (اختیاری)
    const modelNameHeader = document.getElementById('modelNameHeader');
    if (modelNameHeader) {
      modelNameHeader.textContent = formatModelName(selectedModel);
    }
  });
}

// تابع برای نمایش اسم زیباتر از مدل (مثلاً "GPT-4o All" به جای "gpt-4o-all")
function formatModelName(modelKey) {
  const names = {
    'gpt-4o-all': 'GPT-4o All',
    'gpt-4o-mini': 'GPT-4o Mini',
    'deepseek-r1': 'Deepseek R1',
    'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
    'grok-3-mini': 'Grok 3 Mini',
    'llama-4-maverick': 'LLaMA 4 Maverick',
    'gpt-4.1': 'gpt-4.1',
    'gpt-4.1-mini': 'gpt-4.1-mini',
    'gpt-4.1-nano': 'gpt-4.1-nano'
  };
  return names[modelKey] || modelKey;
}
