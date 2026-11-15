/* =========================================================
   ACREVIEW — AI ASSISTANT
   Chat Interface | Conversation History | Farm Context
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // 1. CONFIGURATION
    // =====================================================

    const STORAGE = {
        properties: "acreViewProperties",
        preferences: "acreViewPreferences",
        conversations: "acreViewConversations",
        activeConversation: "acreViewActiveConversation",
        settings: "acreViewSettings"
    };

    const elements = {
        sidebar: document.getElementById("assistant-sidebar"),
        mobileMenu: document.getElementById("mobile-menu-button"),

        conversationList: document.getElementById("conversation-list"),
        newChatButton: document.getElementById("new-chat-button"),
        clearChatButton: document.getElementById("clear-chat-button"),

        welcomeScreen: document.getElementById("welcome-screen"),
        chatMessages: document.getElementById("chat-messages"),

        chatForm: document.getElementById("chat-form"),
        chatInput: document.getElementById("chat-input"),
        sendButton: document.getElementById("send-message-button"),
        messageCounter: document.getElementById("message-counter"),

        propertySelect: document.getElementById("assistant-property"),

        contextLocation: document.getElementById("context-location"),
        contextArea: document.getElementById("context-area"),
        contextSoil: document.getElementById("context-soil"),
        contextCrops: document.getElementById("context-crops"),

        propertyDataStatus: document.getElementById("property-data-status"),
        avatar: document.getElementById("assistant-avatar")
    };

    let conversations = loadConversations();
    let activeConversationId = localStorage.getItem(
        STORAGE.activeConversation
    );

    let properties = loadProperties();


    // =====================================================
    // 2. STORAGE FUNCTIONS
    // =====================================================

    function readStorage(key, fallback) {
        try {
            const value = localStorage.getItem(key);

            return value ? JSON.parse(value) : fallback;

        } catch (error) {
            console.error(`Erro ao ler ${key}:`, error);
            return fallback;
        }
    }


    function saveStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;

        } catch (error) {
            console.error(`Erro ao guardar ${key}:`, error);
            showToast("Não foi possível guardar os dados.");
            return false;
        }
    }


    function loadProperties() {
        const data = readStorage(STORAGE.properties, []);

        return Array.isArray(data) ? data : [];
    }


    function loadConversations() {
        const data = readStorage(STORAGE.conversations, []);

        return Array.isArray(data) ? data : [];
    }


    function persistConversations() {
        saveStorage(STORAGE.conversations, conversations);
    }


    // =====================================================
    // 3. UTILITIES
    // =====================================================

    function createId() {
        if (window.crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }


    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
    }


    function formatTime(date) {
        return new Date(date).toLocaleTimeString(
            "pt-PT",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }


    function showToast(message) {
        let toast = document.getElementById("assistant-toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "assistant-toast";

            Object.assign(toast.style, {
                position: "fixed",
                bottom: "25px",
                right: "25px",
                zIndex: "9999",
                padding: "13px 20px",
                borderRadius: "12px",
                background: "#102b1b",
                border: "1px solid rgba(85,214,139,.3)",
                color: "#8af0ae",
                fontSize: "12px",
                boxShadow: "0 10px 30px rgba(0,0,0,.3)",
                opacity: "0",
                transform: "translateY(10px)",
                transition: ".3s ease"
            });

            document.body.appendChild(toast);
        }

        toast.textContent = message;

        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";

        clearTimeout(toast.timer);

        toast.timer = setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
        }, 2800);
    }


    // =====================================================
    // 4. CONVERSATION MANAGEMENT
    // =====================================================

    function createConversation() {

        const conversation = {
            id: createId(),
            title: "Nova conversa",
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        conversations.unshift(conversation);

        activeConversationId = conversation.id;

        localStorage.setItem(
            STORAGE.activeConversation,
            activeConversationId
        );

        persistConversations();

        renderConversationList();
        renderMessages();

        elements.chatInput.focus();

        return conversation;
    }


    function getActiveConversation() {
        return conversations.find(
            conversation => conversation.id === activeConversationId
        );
    }


    function selectConversation(id) {

        const conversation = conversations.find(
            item => item.id === id
        );

        if (!conversation) return;

        activeConversationId = id;

        localStorage.setItem(
            STORAGE.activeConversation,
            id
        );

        renderConversationList();
        renderMessages();

        elements.sidebar.classList.remove("active");
    }


    function deleteConversation(id) {

        const conversation = conversations.find(
            item => item.id === id
        );

        if (!conversation) return;

        if (!confirm("Tens a certeza de que queres eliminar esta conversa?")) {
            return;
        }

        conversations = conversations.filter(
            item => item.id !== id
        );

        if (activeConversationId === id) {
            activeConversationId = null;
        }

        persistConversations();

        if (!activeConversationId) {
            if (conversations.length > 0) {
                activeConversationId = conversations[0].id;

                localStorage.setItem(
                    STORAGE.activeConversation,
                    activeConversationId
                );
            } else {
                localStorage.removeItem(
                    STORAGE.activeConversation
                );
            }
        }

        renderConversationList();
        renderMessages();

        showToast("Conversa eliminada.");
    }


    // =====================================================
    // 5. RENDER CONVERSATION LIST
    // =====================================================

    function renderConversationList() {

        elements.conversationList.innerHTML = "";

        if (conversations.length === 0) {

            elements.conversationList.innerHTML = `
                <p class="conversation-empty">
                    As tuas conversas aparecerão aqui.
                </p>
            `;

            return;
        }

        conversations.forEach(conversation => {

            const item = document.createElement("div");

            item.className = "conversation-item";

            if (conversation.id === activeConversationId) {
                item.classList.add("active");
            }

            const title = document.createElement("span");

            title.textContent = conversation.title || "Nova conversa";

            title.style.flex = "1";

            const icon = document.createElement("i");

            icon.className = "fa-regular fa-message";

            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.title = "Eliminar conversa";
            deleteButton.innerHTML = `
                <i class="fa-solid fa-trash-can"></i>
            `;

            Object.assign(deleteButton.style, {
                border: "none",
                background: "transparent",
                color: "#879b8d",
                cursor: "pointer",
                padding: "5px"
            });

            deleteButton.addEventListener("click", event => {
                event.stopPropagation();
                deleteConversation(conversation.id);
            });

            item.append(icon, title, deleteButton);

            item.addEventListener("click", () => {
                selectConversation(conversation.id);
            });

            elements.conversationList.appendChild(item);
        });
    }


    // =====================================================
    // 6. RENDER MESSAGES
    // =====================================================

    function renderMessages() {

        const conversation = getActiveConversation();

        elements.chatMessages.innerHTML = "";

        const hasMessages = conversation &&
            conversation.messages.length > 0;

        elements.welcomeScreen.style.display =
            hasMessages ? "none" : "flex";

        elements.chatMessages.classList.toggle(
            "visible",
            Boolean(hasMessages)
        );

        if (!hasMessages) return;

        conversation.messages.forEach(message => {
            addMessageToDOM(message, false);
        });

        scrollToBottom();
    }


    function addMessageToDOM(message, animate = true) {

        const messageElement = document.createElement("div");

        messageElement.className = `message ${message.role}`;

        if (!animate) {
            messageElement.style.animation = "none";
        }

        const avatar = document.createElement("div");

        avatar.className = "message-avatar";

        avatar.innerHTML = message.role === "user"
            ? '<i class="fa-solid fa-user"></i>'
            : '<i class="fa-solid fa-seedling"></i>';

        const body = document.createElement("div");

        body.className = "message-body";

        const content = document.createElement("div");

        content.innerHTML = escapeHTML(message.content).replace(
            /\n/g,
            "<br>"
        );

        const time = document.createElement("span");

        time.className = "message-time";

        time.textContent = formatTime(message.createdAt);

        body.append(content, time);

        messageElement.append(avatar, body);

        elements.chatMessages.appendChild(messageElement);
    }


    function scrollToBottom() {
        elements.chatMessages.scrollTop =
            elements.chatMessages.scrollHeight;
    }


    // =====================================================
    // 7. SEND MESSAGE
    // =====================================================

    function sendMessage(text) {

        const messageText = text.trim();

        if (!messageText) return;

        if (messageText.length > 2000) {
            showToast("A mensagem ultrapassa o limite permitido.");
            return;
        }

        let conversation = getActiveConversation();

        if (!conversation) {
            conversation = createConversation();
        }

        const userMessage = {
            id: createId(),
            role: "user",
            content: messageText,
            createdAt: new Date().toISOString()
        };

        conversation.messages.push(userMessage);

        if (conversation.messages.length === 1) {
            conversation.title =
                messageText.length > 35
                    ? messageText.substring(0, 35) + "..."
                    : messageText;
        }

        conversation.updatedAt = new Date().toISOString();

        persistConversations();

        elements.chatInput.value = "";

        updateMessageCounter();
        adjustTextarea();

        renderMessages();
        renderConversationList();

        showDemoResponse();
    }


    // =====================================================
    // 8. DEMONSTRATION RESPONSE
    // =====================================================

    function showDemoResponse() {

        elements.sendButton.disabled = true;

        const typing = document.createElement("div");

        typing.className = "message typing";

        typing.innerHTML = `
            <div class="message-avatar">
                <i class="fa-solid fa-seedling"></i>
            </div>

            <div class="message-body">
                A preparar a demonstração...
            </div>
        `;

        elements.chatMessages.appendChild(typing);

        scrollToBottom();

        setTimeout(() => {

            typing.remove();

            const response = `
Esta é uma demonstração da interface do Assistente IA do AcreView.

A ligação ao modelo de inteligência artificial ainda não está ativa.

Para produzir uma análise agrícola fundamentada, o sistema precisará de:

1. Dados da tua exploração e das culturas.
2. Informações sobre o solo e os recursos disponíveis.
3. Dados ambientais e climáticos relevantes.
4. Fontes de informação verificáveis.

Quando estas integrações estiverem disponíveis, o assistente poderá analisar o contexto da exploração, apresentar opções, explicar os fundamentos e indicar as limitações de cada recomendação.

O agricultor continuará a tomar a decisão final.
            `.trim();

            const conversation = getActiveConversation();

            if (!conversation) {
                elements.sendButton.disabled = false;
                return;
            }

            const assistantMessage = {
                id: createId(),
                role: "assistant",
                content: response,
                createdAt: new Date().toISOString()
            };

            conversation.messages.push(assistantMessage);

            conversation.updatedAt = new Date().toISOString();

            persistConversations();

            renderMessages();
            renderConversationList();

            elements.sendButton.disabled = false;

        }, 900);
    }


    // =====================================================
    // 9. MESSAGE COUNTER AND TEXTAREA
    // =====================================================

    function updateMessageCounter() {

        const length = elements.chatInput.value.length;

        elements.messageCounter.textContent = `${length} / 2000`;
    }


    function adjustTextarea() {

        elements.chatInput.style.height = "auto";

        elements.chatInput.style.height =
            `${Math.min(elements.chatInput.scrollHeight, 120)}px`;
    }


    // =====================================================
    // 10. FARM CONTEXT
    // =====================================================

    function renderPropertyOptions() {

        properties = loadProperties();

        elements.propertySelect.innerHTML = "";

        if (properties.length === 0) {

            const option = document.createElement("option");

            option.value = "";
            option.textContent = "Nenhuma exploração registada";

            elements.propertySelect.appendChild(option);

            updatePropertyContext(null);

            return;
        }

        properties.forEach(property => {

            const option = document.createElement("option");

            option.value = property.id;
            option.textContent = property.name || "Exploração sem nome";

            elements.propertySelect.appendChild(option);
        });

        const previousId = elements.propertySelect.dataset.selected;

        const selectedProperty = properties.find(
            property => String(property.id) === String(previousId)
        );

        const property = selectedProperty || properties[0];

        elements.propertySelect.value = property.id;

        elements.propertySelect.dataset.selected = property.id;

        updatePropertyContext(property);
    }


    function updatePropertyContext(property) {

        if (!property) {

            elements.contextLocation.textContent = "Não disponível";
            elements.contextArea.textContent = "--";
            elements.contextSoil.textContent = "Não informado";
            elements.contextCrops.textContent = "Não informado";

            elements.propertyDataStatus.textContent = "Sem dados";

            return;
        }

        elements.contextLocation.textContent =
            property.location || "Não informada";

        const area = Number(property.area);

        elements.contextArea.textContent =
            Number.isFinite(area) && area > 0
                ? `${area.toLocaleString("pt-PT")} ha`
                : "Não informada";

        elements.contextSoil.textContent =
            property.soil || "Não informado";

        elements.contextCrops.textContent =
            property.crops || "Não informado";

        elements.propertyDataStatus.textContent = "Disponível";
    }


    // =====================================================
    // 11. USER PROFILE
    // =====================================================

    function loadUserAvatar() {

        const settings = readStorage(STORAGE.settings, {});

        const name =
            localStorage.getItem("acreViewUserName") ||
            settings.userName ||
            "Agricultor";

        elements.avatar.textContent =
            name.trim().charAt(0).toUpperCase() || "A";
    }


    // =====================================================
    // 12. CLEAR ACTIVE CONVERSATION
    // =====================================================

    function clearActiveConversation() {

        const conversation = getActiveConversation();

        if (!conversation || conversation.messages.length === 0) {
            showToast("Não existem mensagens para limpar.");
            return;
        }

        if (!confirm("Queres limpar as mensagens desta conversa?")) {
            return;
        }

        conversation.messages = [];
        conversation.title = "Nova conversa";
        conversation.updatedAt = new Date().toISOString();

        persistConversations();

        renderMessages();
        renderConversationList();

        showToast("Conversa limpa.");
    }


    // =====================================================
    // 13. EVENT LISTENERS
    // =====================================================

    elements.chatForm.addEventListener("submit", event => {

        event.preventDefault();

        sendMessage(elements.chatInput.value);
    });


    elements.chatInput.addEventListener("input", () => {

        updateMessageCounter();
        adjustTextarea();
    });


    elements.chatInput.addEventListener("keydown", event => {

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            elements.chatForm.requestSubmit();
        }
    });


    elements.newChatButton.addEventListener("click", () => {

        createConversation();

        elements.sidebar.classList.remove("active");
    });


    elements.clearChatButton.addEventListener(
        "click",
        clearActiveConversation
    );


    elements.propertySelect.addEventListener("change", () => {

        const property = properties.find(
            item => String(item.id) === elements.propertySelect.value
        );

        elements.propertySelect.dataset.selected =
            elements.propertySelect.value;

        updatePropertyContext(property || null);
    });


    elements.mobileMenu.addEventListener("click", () => {

        elements.sidebar.classList.toggle("active");
    });


    // =====================================================
    // 14. SUGGESTION CARDS
    // =====================================================

    document.querySelectorAll(".suggestion-card").forEach(card => {

        card.addEventListener("click", () => {

            const prompt = card.dataset.prompt;

            if (!prompt) return;

            sendMessage(prompt);
        });
    });


    // =====================================================
    // 15. STORAGE SYNCHRONIZATION
    // =====================================================

    window.addEventListener("storage", event => {

        if (event.key === STORAGE.properties) {

            renderPropertyOptions();

            showToast("Dados das explorações atualizados.");
        }

        if (event.key === STORAGE.conversations) {

            conversations = loadConversations();

            renderConversationList();
            renderMessages();
        }

    });


    // =====================================================
    // 16. INITIALIZATION
    // =====================================================

    function initializeAssistant() {

        renderPropertyOptions();

        loadUserAvatar();

        if (
            !conversations.some(
                conversation => conversation.id === activeConversationId
            )
        ) {
            activeConversationId = conversations[0]?.id || null;
        }

        if (activeConversationId) {

            localStorage.setItem(
                STORAGE.activeConversation,
                activeConversationId
            );

        } else {

            localStorage.removeItem(
                STORAGE.activeConversation
            );
        }

        renderConversationList();
        renderMessages();

        updateMessageCounter();

    }


    initializeAssistant();

});