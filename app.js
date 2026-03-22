// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const historyList = document.getElementById('history-list');
const clearAllBtn = document.getElementById('clear-all-btn');

const messagesContainer = document.getElementById('messages-container');
const welcomeScreen = document.getElementById('welcome-screen');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const saveSettingsBtn = document.getElementById('save-settings');
const apiKeyInput = document.getElementById('api-key');
const providerSelect = document.getElementById('ai-provider');

// State
const currentUser = localStorage.getItem('studybot_user');
let currentSessionId = null;
let sessions = {}; // Format: { id: { title: "...", messages: [] } }

// Initialization
function init() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Add user name to UI header
    const headerTitle = document.querySelector('.chat-header h2');
    if (headerTitle) {
        headerTitle.textContent = `StudyBot - ${currentUser}`;
    }

    loadSettings();
    loadSessions();
    setupEventListeners();
    
    // Auto-focus input
    if (chatInput) chatInput.focus();
    
    // Hide sidebar by default on mobile or tablet
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.add('hidden');
        const overlay = document.getElementById('sidebar-overlay');
        if(overlay) overlay.classList.remove('active');
    }
}

// Memory Store Logic
function loadSessions() {
    const stored = localStorage.getItem(`studybot_sessions_${currentUser}`);
    if (stored) {
        sessions = JSON.parse(stored);
        renderHistoryList();
        
        // Load most recent session if available
        const sessionIds = Object.keys(sessions);
        if (sessionIds.length > 0) {
            // Sort by ID (timestamp)
            sessionIds.sort((a, b) => b - a);
            loadSession(sessionIds[0]);
        }
    }
}

function saveSessions() {
    localStorage.setItem(`studybot_sessions_${currentUser}`, JSON.stringify(sessions));
    renderHistoryList();
}

function createNewSession() {
    currentSessionId = Date.now().toString();
    sessions[currentSessionId] = {
        title: 'New Study Session',
        messages: [],
        timestamp: currentSessionId
    };
    saveSessions();
    loadSession(currentSessionId);
}

function loadSession(id) {
    if (!sessions[id]) return;
    
    currentSessionId = id;
    const session = sessions[id];
    
    // Clear chat
    document.querySelectorAll('.message-wrapper:not(.welcome-screen)').forEach(el => el.remove());
    welcomeScreen.style.display = session.messages.length > 0 ? 'none' : 'flex';
    
    // Render messages
    session.messages.forEach(msg => appendMessageDOM(msg.role, msg.content, false));
    
    // Update active class
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`[data-id="${id}"]`);
    if (activeItem) activeItem.classList.add('active');
    
    scrollToBottom();
    
    // Smoothly hide sidebar if interacting on mobile
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.add('hidden');
        const overlay = document.getElementById('sidebar-overlay');
        if(overlay) overlay.classList.remove('active');
    }
}

function renderHistoryList() {
    historyList.innerHTML = '';
    const sortedIds = Object.keys(sessions).sort((a, b) => b - a);
    
    sortedIds.forEach(id => {
        const li = document.createElement('li');
        li.className = `history-item ${id === currentSessionId ? 'active' : ''}`;
        li.dataset.id = id;
        li.innerHTML = `
            <ion-icon name="chatbox-outline"></ion-icon>
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${sessions[id].title}</span>
        `;
        li.addEventListener('click', () => loadSession(id));
        historyList.appendChild(li);
    });
}

function clearAllData() {
    if(confirm('Are you sure you want to delete all your chat history?')) {
        sessions = {};
        currentSessionId = null;
        localStorage.removeItem(`studybot_sessions_${currentUser}`);
        document.querySelectorAll('.message-wrapper:not(.welcome-screen)').forEach(el => el.remove());
        welcomeScreen.style.display = 'flex';
        renderHistoryList();
    }
}

// UI Event Listeners
function setupEventListeners() {
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const closeSidebarMobile = document.getElementById('close-sidebar-mobile');

    function toggleSidebar() {
        sidebar.classList.toggle('hidden');
        if (window.innerWidth <= 768) {
            sidebarOverlay.classList.toggle('active', !sidebar.classList.contains('hidden'));
        }
    }

    function closeSidebarOnMobile() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('hidden');
            if(sidebarOverlay) sidebarOverlay.classList.remove('active');
        }
    }

    // Sidebar Toggle
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    if (closeSidebarMobile) closeSidebarMobile.addEventListener('click', closeSidebarOnMobile);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebarOnMobile);

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight < 200 ? this.scrollHeight : 200) + 'px';
        
        sendBtn.disabled = this.value.trim().length === 0;
    });

    // Send Message on Enter (shift+enter for newline)
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!this.value.trim()) return;
            handleSendMessage();
        }
    });

    sendBtn.addEventListener('click', handleSendMessage);
    newChatBtn.addEventListener('click', createNewSession);
    clearAllBtn.addEventListener('click', clearAllData);
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('studybot_user');
            window.location.href = 'login.html';
        });
    }
    
    // Settings Interactions
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
    saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Close modal on click outside
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
}

// Messaging Logic
async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    if (!currentSessionId) {
        createNewSession();
    }

    // Hide welcome
    welcomeScreen.style.display = 'none';

    // Reset input
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Add user message via DOM and save to memory
    appendAndSaveMessage('user', text);

    // Show typing indicator
    const typingId = showTypingIndicator();

    // Generate title for new session based on first message
    if (sessions[currentSessionId].messages.length === 1) {
        sessions[currentSessionId].title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
        renderHistoryList();
    }

    try {
        const settings = JSON.parse(localStorage.getItem(`studybot_settings_${currentUser}`) || '{"provider":"gemini","apiKey":""}');
        if (!settings.apiKey) {
            throw new Error("Please configure your API key in the Settings menu (top right).");
        }

        const responseText = await callAI(sessions[currentSessionId].messages, settings);
        removeTypingIndicator(typingId);
        appendAndSaveMessage('bot', responseText);
    } catch (error) {
        removeTypingIndicator(typingId);
        appendAndSaveMessage('bot', `**Error:** ${error.message}`);
    }
}

async function callAI(messages, settings) {
    const { provider, apiKey } = settings;
    const systemPrompt = "You are StudyBot, an expert educational AI companion. Your overarching goal is to help the user learn effectively. Provide clear, concise, and accurate explanations. Break down complex topics and use formatted markdown lists, bold text, or code blocks where appropriate.";

    if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        let formattedMessages = messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
        }));
        
        const payload = {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: formattedMessages
        };

        let res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let data = await res.json();
        
        // Auto-fallback: Dynamically fetch available models if 'not found'
        if (!res.ok && data.error?.message?.includes('not found')) {
            console.warn("Default model not found, dynamically probing available models...");
            
            const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const modelsData = await modelsRes.json();
            
            if (modelsData.models) {
                // Find a model that supports generation and has 'gemini' in its name
                const validModel = modelsData.models.find(m => 
                    m.supportedGenerationMethods?.includes('generateContent') && 
                    m.name.includes('gemini')
                );
                
                if (validModel) {
                    console.log("Found compatible model:", validModel.name);
                    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${apiKey}`;
                    
                    // Old models (like 1.0) don't support system instructions well
                    if (validModel.name.includes('1.0') || validModel.name === 'models/gemini-pro') {
                        delete payload.systemInstruction;
                    }
                    
                    res = await fetch(fallbackUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    data = await res.json();
                } else {
                    throw new Error("No text-generation models are available for this API Key.");
                }
            }
        }

        if (!res.ok) throw new Error(data.error?.message || 'Gemini API Error');
        return data.candidates[0].content.parts[0].text;
    } 
    else if (provider === 'openai' || provider === 'groq') {
        const baseUrl = provider === 'groq' 
            ? 'https://api.groq.com/openai/v1/chat/completions' 
            : 'https://api.openai.com/v1/chat/completions';
            
        const model = provider === 'groq' ? 'llama3-8b-8192' : 'gpt-3.5-turbo';
        
        const formattedMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }))
        ];

        const res = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: formattedMessages
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `${provider.toUpperCase()} API Error`);
        return data.choices[0].message.content;
    }
}

function appendAndSaveMessage(role, content) {
    // Save to memory
    sessions[currentSessionId].messages.push({ role, content });
    saveSessions();
    
    // Append to UI
    appendMessageDOM(role, content);
}

function appendMessageDOM(role, content, animate = true) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${animate ? 'animateItem' : ''}`;
    
    const icon = role === 'user' ? 'person-outline' : 'book-outline';
    
    // Parse markdown instead of simple regex
    const formattedContent = marked.parse(content);

    wrapper.innerHTML = `
        <div class="message ${role}">
            <div class="avatar">
                <ion-icon name="${icon}"></ion-icon>
            </div>
            <div class="message-content markdown-body">
                ${formattedContent}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
}

function showTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper';
    wrapper.id = 'typing-' + Date.now();
    
    wrapper.innerHTML = `
        <div class="message bot">
            <div class="avatar">
                <ion-icon name="book-outline"></ion-icon>
            </div>
            <div class="message-content" style="padding: 18px 20px;">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
    return wrapper.id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Settings
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem(`studybot_settings_${currentUser}`) || '{"provider":"gemini","apiKey":""}');
    providerSelect.value = settings.provider;
    apiKeyInput.value = settings.apiKey;
}

function saveSettings() {
    const settings = {
        provider: providerSelect.value,
        apiKey: apiKeyInput.value.trim()
    };
    localStorage.setItem(`studybot_settings_${currentUser}`, JSON.stringify(settings));
    settingsModal.classList.remove('active');
    
    // Only alert if we actually saved something new
    if(settings.apiKey) {
       // success notification logic could go here
    }
}

// Run Initialization
init();
