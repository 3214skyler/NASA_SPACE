/* =========================================================
   ACREVIEW — AGRICULTURAL PLANNING
   Planning Management | Crop Rotation | Calendar
   History Integration | Custom Modals
========================================================= */

"use strict";

// =========================================================
// 1. CONFIGURAÇÕES E ARMAZENAMENTO
// =========================================================

const PROPERTY_KEY = "acreViewProperties";
const PLAN_KEY = "acreViewPlans";
const SETTINGS_KEY = "acreViewSettings";
const HISTORY_KEY = "acreViewHistory";

const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril",
    "Maio", "Junho", "Julho", "Agosto",
    "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MONTHS_SHORT = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

let selectedPropertyId = "";
let calendarYear = new Date().getFullYear();

let properties = [];
let plans = [];

let modalAction = null;
let modalPreviousFocus = null;
let toastTimeout = null;


// =========================================================
// 2. ELEMENTOS DOM
// =========================================================

const elements = {
    sidebar: document.getElementById("planning-sidebar"),
    menuButton: document.getElementById("mobile-menu-button"),

    date: document.getElementById("planning-date"),
    avatar: document.getElementById("planning-avatar"),
    userName: document.getElementById("planning-user-name"),

    propertySelect: document.getElementById("planning-property"),
    propertyArea: document.getElementById("planning-property-area"),

    totalPlans: document.getElementById("total-plans"),
    totalCrops: document.getElementById("total-planned-crops"),
    totalRotations: document.getElementById("total-rotations"),
    propertyCount: document.getElementById("planning-property-count"),

    createPlan: document.getElementById("create-plan-button"),
    emptyCreatePlan: document.getElementById("empty-create-plan"),

    manageCrops: document.getElementById("manage-crops-button"),
    rotation: document.getElementById("rotation-button"),
    resources: document.getElementById("resources-button"),
    scenarios: document.getElementById("scenarios-button"),

    calendarPrevious: document.getElementById("calendar-previous"),
    calendarNext: document.getElementById("calendar-next"),
    calendarPeriod: document.getElementById("calendar-period"),

    calendarEmpty: document.getElementById("calendar-empty"),
    calendarContent: document.getElementById("calendar-content"),
    calendarActivities: document.getElementById("calendar-activities"),

    calendarAdd: document.getElementById("calendar-add-button"),

    savedPlans: document.getElementById("saved-plans"),
    viewAllPlans: document.getElementById("view-all-plans"),

    notifications: document.getElementById("planning-notifications"),

    // Modal
    modal: document.getElementById("planning-modal"),
    modalIcon: document.getElementById("planning-modal-icon"),
    modalTitle: document.getElementById("planning-modal-title"),
    modalDescription: document.getElementById("planning-modal-description"),
    modalForm: document.getElementById("planning-modal-form"),
    modalBody: document.getElementById("planning-modal-body"),
    modalSubmit: document.getElementById("planning-modal-submit"),
    modalClose: document.getElementById("planning-modal-close"),
    modalCancel: document.getElementById("planning-modal-cancel"),

    // Toast
    toast: document.getElementById("planning-toast"),
    toastMessage: document.getElementById("planning-toast-message")
};


// =========================================================
// 3. UTILITÁRIOS
// =========================================================

function readStorage(key, fallback = []) {
    try {
        const data = JSON.parse(localStorage.getItem(key));

        return data ?? fallback;

    } catch (error) {
        console.error(`Erro ao ler ${key}:`, error);
        return fallback;
    }
}


function saveStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;

    } catch (error) {
        console.error(`Erro ao guardar ${key}:`, error);

        showToast("Não foi possível guardar os dados.");

        return false;
    }
}


function generateId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


function getSettings() {
    const settings = readStorage(SETTINGS_KEY, {});

    return {
        unit: ["ha", "m2", "acre"].includes(settings.unit)
            ? settings.unit
            : "ha",

        language: settings.language || "pt"
    };
}


function formatArea(area) {
    if (!Number.isFinite(Number(area))) return "--";

    const settings = getSettings();

    let value = Number(area);
    let unit = "ha";

    if (settings.unit === "m2") {
        value *= 10000;
        unit = "m²";

    } else if (settings.unit === "acre") {
        value *= 2.4710538147;
        unit = "acres";
    }

    return `${value.toLocaleString("pt-PT", {
        maximumFractionDigits: 2
    })} ${unit}`;
}


// =========================================================
// 4. NOTIFICAÇÕES TOAST
// =========================================================

function showToast(message, type = "success") {
    if (!elements.toast || !elements.toastMessage) {
        console.warn(message);
        return;
    }

    const icon = elements.toast.querySelector("i");

    elements.toastMessage.textContent = message;

    if (icon) {
        icon.className = type === "error"
            ? "fa-solid fa-circle-exclamation"
            : "fa-solid fa-circle-check";
    }

    elements.toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove("show");
    }, 3200);
}


// =========================================================
// 5. SISTEMA DE MODAIS
// =========================================================

function openModal({
    title,
    description,
    icon = "fa-seedling",
    content = "",
    submitText = "Guardar",
    action = null,
    hideSubmit = false
}) {
    if (!elements.modal || !elements.modalForm || !elements.modalBody) {
        console.error("Estrutura do modal não encontrada.");
        return;
    }

    modalPreviousFocus = document.activeElement;
    modalAction = action;

    elements.modalTitle.textContent = title;
    elements.modalDescription.textContent = description;

    elements.modalIcon.innerHTML = `
        <i class="fa-solid ${escapeHTML(icon)}"></i>
    `;

    elements.modalBody.innerHTML = content;

    elements.modalSubmit.innerHTML = `
        <i class="fa-solid fa-check"></i>
        ${escapeHTML(submitText)}
    `;

    elements.modalSubmit.style.display = hideSubmit
        ? "none"
        : "inline-flex";

    elements.modal.classList.add("is-visible");
    elements.modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    requestAnimationFrame(() => {
        const firstInput = elements.modalBody.querySelector(
            "input:not([type='hidden']), select, textarea"
        );

        if (firstInput) {
            firstInput.focus();
        } else {
            elements.modalClose?.focus();
        }
    });
}


function closeModal() {
    if (!elements.modal) return;

    elements.modal.classList.remove("is-visible");
    elements.modal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

    elements.modalForm?.reset();

    modalAction = null;

    if (modalPreviousFocus && typeof modalPreviousFocus.focus === "function") {
        modalPreviousFocus.focus();
    }

    modalPreviousFocus = null;
}


function getMonthOptions(selected = "") {
    return MONTHS.map((month, index) => `
        <option
            value="${index + 1}"
            ${Number(selected) === index + 1 ? "selected" : ""}
        >
            ${month}
        </option>
    `).join("");
}


function getCurrentPlans() {
    return plans.filter(
        plan => String(plan.propertyId) === selectedPropertyId
    );
}


function getFirstCurrentPlan() {
    return getCurrentPlans()[0] || null;
}


// =========================================================
// 6. INTEGRAÇÃO COM O HISTÓRICO
// =========================================================

function registerHistoryEvent({
    type,
    title,
    description,
    propertyId = null,
    metadata = []
}) {
    const validTypes = [
        "agriculture",
        "planning",
        "environment",
        "system"
    ];

    if (!validTypes.includes(type)) {
        console.warn("Tipo de histórico inválido:", type);
        return false;
    }

    try {
        const history = readStorage(HISTORY_KEY, []);

        if (!Array.isArray(history)) {
            console.error("O histórico guardado não é uma lista válida.");
            return false;
        }

        const record = {
            id: generateId(),
            date: new Date().toISOString(),
            type,
            title,
            description,
            propertyId: propertyId !== null
                ? String(propertyId)
                : null,
            metadata
        };

        history.unshift(record);

        if (!saveStorage(HISTORY_KEY, history)) {
            return false;
        }

        console.log("Atividade registada no Histórico:", record);

        return true;

    } catch (error) {
        console.error("Erro ao registar atividade no histórico:", error);
        return false;
    }
}


// =========================================================
// 7. CARREGAR DADOS
// =========================================================

function loadData() {
    properties = readStorage(PROPERTY_KEY, []);
    plans = readStorage(PLAN_KEY, []);

    if (!Array.isArray(properties)) properties = [];
    if (!Array.isArray(plans)) plans = [];

    properties = properties.filter(property =>
        property &&
        property.id !== undefined &&
        property.id !== null
    );

    plans = plans.filter(plan =>
        plan &&
        typeof plan === "object" &&
        Array.isArray(plan.crops)
    );

    // Compatibilidade com planos antigos
    plans.forEach(plan => {
        if (!Array.isArray(plan.rotation)) {
            plan.rotation = [];
        }

        if (!Array.isArray(plan.scenarios)) {
            plan.scenarios = [];
        }

        if (!plan.resources || typeof plan.resources !== "object") {
            plan.resources = {
                water: "",
                fertilizer: "",
                other: ""
            };
        }
    });

    renderPropertySelector();
    updateSummary();
    renderPlans();
    renderCalendar();
}


// =========================================================
// 8. DATA E PERFIL
// =========================================================

function initializeHeader() {
    if (elements.date) {
        elements.date.textContent = new Date().toLocaleDateString(
            "pt-PT",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );
    }

    const profileName = localStorage.getItem("acreViewUserName");

    if (profileName) {
        const name = profileName.trim();

        if (name) {
            if (elements.userName) {
                elements.userName.textContent = name;
            }

            if (elements.avatar) {
                elements.avatar.textContent = name.charAt(0).toUpperCase();
            }
        }
    }
}


// =========================================================
// 9. PROPRIEDADES
// =========================================================

function renderPropertySelector() {
    if (!elements.propertySelect) return;

    elements.propertySelect.innerHTML = `
        <option value="">Selecione uma propriedade</option>
    `;

    properties.forEach(property => {
        const option = document.createElement("option");

        option.value = String(property.id);
        option.textContent = property.name || "Propriedade sem nome";

        elements.propertySelect.appendChild(option);
    });

    const stillExists = properties.some(
        property => String(property.id) === selectedPropertyId
    );

    if (!stillExists) {
        selectedPropertyId = properties.length
            ? String(properties[0].id)
            : "";
    }

    elements.propertySelect.value = selectedPropertyId;

    updateSelectedProperty();
}


function getSelectedProperty() {
    return properties.find(
        property => String(property.id) === selectedPropertyId
    ) || null;
}


function updateSelectedProperty() {
    const property = getSelectedProperty();

    if (elements.propertyArea) {
        elements.propertyArea.textContent = property
            ? formatArea(property.area)
            : "--";
    }

    updateSummary();
    renderPlans();
    renderCalendar();
}


// =========================================================
// 10. RESUMO
// =========================================================

function updateSummary() {
    const relevantPlans = selectedPropertyId
        ? plans.filter(plan =>
            String(plan.propertyId) === selectedPropertyId
        )
        : plans;

    const cropCount = relevantPlans.reduce(
        (total, plan) => total + plan.crops.length,
        0
    );

    const rotationCount = relevantPlans.filter(
        plan => Array.isArray(plan.rotation) && plan.rotation.length > 0
    ).length;

    if (elements.totalPlans) {
        elements.totalPlans.textContent = relevantPlans.length;
    }

    if (elements.totalCrops) {
        elements.totalCrops.textContent = cropCount;
    }

    if (elements.totalRotations) {
        elements.totalRotations.textContent = rotationCount;
    }

    if (elements.propertyCount) {
        elements.propertyCount.textContent = properties.length;
    }
}


// =========================================================
// 11. CRIAR PLANO AGRÍCOLA
// =========================================================

function createPlan() {
    if (!properties.length) {
        showToast("Registe primeiro uma propriedade agrícola.", "error");
        return;
    }

    if (!selectedPropertyId) {
        showToast("Selecione uma propriedade.", "error");
        return;
    }

    openModal({
        title: "Criar plano agrícola",
        description: "Defina um nome para organizar as atividades da sua propriedade.",
        icon: "fa-clipboard-list",
        submitText: "Criar plano",
        action: "create-plan",

        content: `
            <div class="planning-form-section">
                <div class="planning-form-section-title">
                    <i class="fa-solid fa-circle-info"></i>
                    Informações do plano
                </div>

                <div class="planning-form-group">
                    <label for="plan-name">Nome do plano</label>

                    <input
                        type="text"
                        id="plan-name"
                        name="planName"
                        placeholder="Ex.: Produção agrícola 2027"
                        maxlength="80"
                        required
                    >

                    <small>Escolha um nome que identifique facilmente este planeamento.</small>
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-location-dot"></i>

                    <span>
                        Propriedade selecionada:
                        <strong>${escapeHTML(getSelectedProperty()?.name || "Propriedade")}</strong>
                    </span>
                </div>
            </div>
        `
    });
}


function saveNewPlan(name) {
    if (!name.trim()) {
        showToast("Introduza um nome para o plano.", "error");
        return;
    }

    const now = new Date().toISOString();

    const plan = {
        id: generateId(),
        propertyId: selectedPropertyId,
        name: name.trim(),
        crops: [],
        rotation: [],
        resources: {
            water: "",
            fertilizer: "",
            other: ""
        },
        scenarios: [],
        createdAt: now,
        updatedAt: now
    };

    plans.unshift(plan);

    if (!saveStorage(PLAN_KEY, plans)) {
        plans.shift();
        return;
    }

    const property = getSelectedProperty();

    registerHistoryEvent({
        type: "planning",
        title: "Plano agrícola criado",
        description: `Foi criado o plano "${plan.name}" para a propriedade "${property?.name || "Propriedade"}".`,
        propertyId: plan.propertyId,
        metadata: [
            {
                icon: "fa-clipboard-list",
                label: plan.name
            },
            {
                icon: "fa-seedling",
                label: "Novo planeamento"
            }
        ]
    });

    updateSummary();
    renderPlans();
    renderCalendar();

    closeModal();

    showToast("Plano agrícola criado com sucesso.");
}


// =========================================================
// 12. ADICIONAR CULTURAS
// =========================================================

function manageCrops() {
    if (!selectedPropertyId) {
        showToast("Selecione uma propriedade primeiro.", "error");
        return;
    }

    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Crie primeiro um plano agrícola.", "error");
        return;
    }

    openModal({
        title: "Adicionar cultura",
        description: "Defina a cultura e o respetivo período de produção.",
        icon: "fa-seedling",
        submitText: "Adicionar cultura",
        action: "add-crop",

        content: `
            <div class="planning-form-section">

                <div class="planning-modal-info">
                    <i class="fa-solid fa-clipboard-list"></i>

                    <span>
                        Plano:
                        <strong>${escapeHTML(plan.name)}</strong>
                    </span>
                </div>

                <div class="planning-form-group">
                    <label for="crop-name">Nome da cultura</label>

                    <input
                        type="text"
                        id="crop-name"
                        name="cropName"
                        placeholder="Ex.: Milho, Feijão, Mandioca"
                        maxlength="80"
                        required
                    >
                </div>

                <div class="planning-form-grid">

                    <div class="planning-form-group">
                        <label for="crop-planting">Mês de plantação</label>

                        <select id="crop-planting" name="plantingMonth" required>
                            <option value="">Selecionar mês</option>
                            ${getMonthOptions()}
                        </select>
                    </div>

                    <div class="planning-form-group">
                        <label for="crop-harvest">Mês de colheita</label>

                        <select id="crop-harvest" name="harvestMonth" required>
                            <option value="">Selecionar mês</option>
                            ${getMonthOptions()}
                        </select>
                    </div>

                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-lightbulb"></i>

                    <span>
                        Os períodos são registos de planeamento.
                        A sua adequação depende do clima, solo e variedade cultivada.
                    </span>
                </div>

            </div>
        `
    });
}


function saveCrop(name, plantingMonth, harvestMonth) {
    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Não foi encontrado um plano agrícola.", "error");
        return;
    }

    const month = Number(plantingMonth);
    const harvest = Number(harvestMonth);

    if (!name.trim()) {
        showToast("Introduza o nome da cultura.", "error");
        return;
    }

    if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(harvest) ||
        harvest < 1 ||
        harvest > 12
    ) {
        showToast("Selecione meses válidos.", "error");
        return;
    }

    const crop = {
        id: generateId(),
        name: name.trim(),
        plantingMonth: month,
        harvestMonth: harvest,
        createdAt: new Date().toISOString()
    };

    plan.crops.push(crop);

    const previousUpdatedAt = plan.updatedAt;
    plan.updatedAt = new Date().toISOString();

    if (!saveStorage(PLAN_KEY, plans)) {
        plan.crops.pop();
        plan.updatedAt = previousUpdatedAt;
        return;
    }

    registerHistoryEvent({
        type: "agriculture",
        title: "Nova cultura adicionada",
        description: `A cultura "${crop.name}" foi adicionada ao plano "${plan.name}". Plantação prevista para ${MONTHS[month - 1]} e colheita para ${MONTHS[harvest - 1]}.`,
        propertyId: plan.propertyId,
        metadata: [
            {
                icon: "fa-seedling",
                label: crop.name
            },
            {
                icon: "fa-calendar",
                label: `Plantação: ${MONTHS[month - 1]}`
            },
            {
                icon: "fa-basket-shopping",
                label: `Colheita: ${MONTHS[harvest - 1]}`
            }
        ]
    });

    updateSummary();
    renderPlans();
    renderCalendar();

    closeModal();

    showToast("Cultura adicionada ao plano.");
}


// =========================================================
// 13. ROTAÇÃO DE CULTURAS
// =========================================================

function manageRotation() {
    if (!selectedPropertyId) {
        showToast("Selecione uma propriedade primeiro.", "error");
        return;
    }

    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Crie primeiro um plano agrícola.", "error");
        return;
    }

    openModal({
        title: "Rotação de culturas",
        description: "Registe uma estratégia de sucessão de culturas.",
        icon: "fa-arrows-rotate",
        submitText: "Guardar estratégia",
        action: "add-rotation",

        content: `
            <div class="planning-form-section">

                <div class="planning-modal-info">
                    <i class="fa-solid fa-clipboard-list"></i>

                    <span>
                        Plano:
                        <strong>${escapeHTML(plan.name)}</strong>
                    </span>
                </div>

                <div class="planning-form-group">
                    <label for="rotation-name">Estratégia de rotação</label>

                    <textarea
                        id="rotation-name"
                        name="rotationName"
                        rows="4"
                        maxlength="300"
                        placeholder="Ex.: Milho → Feijão → Mandioca"
                        required
                    ></textarea>

                    <small>
                        Descreva a sequência de culturas que pretende analisar.
                    </small>
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-leaf"></i>

                    <span>
                        A rotação pode contribuir para diversificar a produção
                        e apoiar a gestão da fertilidade do solo.
                        A sua adequação deve ser avaliada para cada propriedade.
                    </span>
                </div>

            </div>
        `
    });
}


function saveRotation(name) {
    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Não foi encontrado um plano agrícola.", "error");
        return;
    }

    if (!name.trim()) {
        showToast("Introduza uma estratégia de rotação.", "error");
        return;
    }

    const rotation = {
        id: generateId(),
        name: name.trim(),
        createdAt: new Date().toISOString()
    };

    plan.rotation.push(rotation);

    const previousUpdatedAt = plan.updatedAt;
    plan.updatedAt = new Date().toISOString();

    if (!saveStorage(PLAN_KEY, plans)) {
        plan.rotation.pop();
        plan.updatedAt = previousUpdatedAt;
        return;
    }

    registerHistoryEvent({
        type: "agriculture",
        title: "Estratégia de rotação criada",
        description: `Foi registada a estratégia "${rotation.name}" no plano "${plan.name}".`,
        propertyId: plan.propertyId,
        metadata: [
            {
                icon: "fa-arrows-rotate",
                label: rotation.name
            },
            {
                icon: "fa-clipboard-list",
                label: plan.name
            }
        ]
    });

    updateSummary();
    renderPlans();

    closeModal();

    showToast("Estratégia de rotação guardada.");
}


// =========================================================
// 14. GESTÃO DE RECURSOS
// =========================================================

function manageResources() {
    if (!selectedPropertyId) {
        showToast("Selecione uma propriedade primeiro.", "error");
        return;
    }

    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Crie primeiro um plano agrícola.", "error");
        return;
    }

    const resources = plan.resources || {};

    openModal({
        title: "Gestão de recursos",
        description: "Registe os recursos necessários para o seu plano.",
        icon: "fa-toolbox",
        submitText: "Guardar recursos",
        action: "save-resources",

        content: `
            <div class="planning-form-section">

                <div class="planning-modal-info">
                    <i class="fa-solid fa-clipboard-list"></i>

                    <span>
                        Plano:
                        <strong>${escapeHTML(plan.name)}</strong>
                    </span>
                </div>

                <div class="planning-form-group">
                    <label for="resource-water">
                        <i class="fa-solid fa-droplet"></i>
                        Necessidades de água
                    </label>

                    <textarea
                        id="resource-water"
                        name="water"
                        rows="2"
                        maxlength="500"
                        placeholder="Ex.: Rega por gotejamento..."
                    >${escapeHTML(resources.water || "")}</textarea>
                </div>

                <div class="planning-form-group">
                    <label for="resource-fertilizer">
                        <i class="fa-solid fa-leaf"></i>
                        Fertilização
                    </label>

                    <textarea
                        id="resource-fertilizer"
                        name="fertilizer"
                        rows="2"
                        maxlength="500"
                        placeholder="Ex.: Composto orgânico..."
                    >${escapeHTML(resources.fertilizer || "")}</textarea>
                </div>

                <div class="planning-form-group">
                    <label for="resource-other">
                        <i class="fa-solid fa-toolbox"></i>
                        Outros recursos
                    </label>

                    <textarea
                        id="resource-other"
                        name="other"
                        rows="2"
                        maxlength="500"
                        placeholder="Ex.: Equipamentos, mão de obra..."
                    >${escapeHTML(resources.other || "")}</textarea>
                </div>

            </div>
        `
    });
}


function saveResources(water, fertilizer, other) {
    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Não foi encontrado um plano agrícola.", "error");
        return;
    }

    const previousResources = { ...plan.resources };
    const previousUpdatedAt = plan.updatedAt;

    plan.resources = {
        water: water.trim(),
        fertilizer: fertilizer.trim(),
        other: other.trim()
    };

    plan.updatedAt = new Date().toISOString();

    if (!saveStorage(PLAN_KEY, plans)) {
        plan.resources = previousResources;
        plan.updatedAt = previousUpdatedAt;
        return;
    }

    registerHistoryEvent({
        type: "planning",
        title: "Recursos agrícolas atualizados",
        description: `Os recursos necessários para o plano "${plan.name}" foram atualizados.`,
        propertyId: plan.propertyId,
        metadata: [
            {
                icon: "fa-droplet",
                label: `Água: ${plan.resources.water || "Não definido"}`
            },
            {
                icon: "fa-leaf",
                label: `Fertilização: ${plan.resources.fertilizer || "Não definido"}`
            },
            {
                icon: "fa-toolbox",
                label: `Outros: ${plan.resources.other || "Não definido"}`
            }
        ]
    });

    renderPlans();

    closeModal();

    showToast("Recursos atualizados.");
}


// =========================================================
// 15. CENÁRIOS AGRÍCOLAS
// =========================================================

function compareScenarios() {
    if (!selectedPropertyId) {
        showToast("Selecione uma propriedade primeiro.", "error");
        return;
    }

    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Crie primeiro um plano agrícola.", "error");
        return;
    }

    openModal({
        title: "Novo cenário agrícola",
        description: "Registe uma estratégia alternativa para análise futura.",
        icon: "fa-chart-line",
        submitText: "Registar cenário",
        action: "add-scenario",

        content: `
            <div class="planning-form-section">

                <div class="planning-modal-info">
                    <i class="fa-solid fa-clipboard-list"></i>

                    <span>
                        Plano:
                        <strong>${escapeHTML(plan.name)}</strong>
                    </span>
                </div>

                <div class="planning-form-group">
                    <label for="scenario-name">Nome do cenário</label>

                    <input
                        type="text"
                        id="scenario-name"
                        name="scenarioName"
                        maxlength="100"
                        placeholder="Ex.: Produção com menor consumo de água"
                        required
                    >
                </div>

                <div class="planning-form-group">
                    <label for="scenario-description">Descrição da estratégia</label>

                    <textarea
                        id="scenario-description"
                        name="scenarioDescription"
                        rows="4"
                        maxlength="1000"
                        placeholder="Descreva as alterações que pretende analisar..."
                    ></textarea>
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-circle-info"></i>

                    <span>
                        Este registo ainda não representa uma simulação científica.
                        A análise de cenários será integrada posteriormente com
                        dados ambientais e agrícolas.
                    </span>
                </div>

            </div>
        `
    });
}


function saveScenario(name, description) {
    const plan = getFirstCurrentPlan();

    if (!plan) {
        showToast("Não foi encontrado um plano agrícola.", "error");
        return;
    }

    if (!name.trim()) {
        showToast("Introduza um nome para o cenário.", "error");
        return;
    }

    const scenario = {
        id: generateId(),
        name: name.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString()
    };

    plan.scenarios.push(scenario);

    const previousUpdatedAt = plan.updatedAt;
    plan.updatedAt = new Date().toISOString();

    if (!saveStorage(PLAN_KEY, plans)) {
        plan.scenarios.pop();
        plan.updatedAt = previousUpdatedAt;
        return;
    }

    registerHistoryEvent({
        type: "planning",
        title: "Novo cenário agrícola registado",
        description: `O cenário "${scenario.name}" foi registado no plano "${plan.name}". ${scenario.description}`,
        propertyId: plan.propertyId,
        metadata: [
            {
                icon: "fa-chart-line",
                label: scenario.name
            },
            {
                icon: "fa-clipboard-list",
                label: plan.name
            }
        ]
    });

    renderPlans();

    closeModal();

    showToast("Cenário registado com sucesso.");
}


// =========================================================
// 16. CALENDÁRIO AGRÍCOLA
// =========================================================

function getCalendarCrops() {
    const relevantPlans = getCurrentPlans();

    return relevantPlans.flatMap(plan =>
        plan.crops.map(crop => ({
            ...crop,
            planName: plan.name,
            planId: plan.id
        }))
    );
}


function renderCalendar() {
    if (!elements.calendarEmpty || !elements.calendarContent) return;

    const crops = getCalendarCrops();

    const cropsForYear = crops.filter(crop =>
        Number.isInteger(crop.plantingMonth) &&
        Number.isInteger(crop.harvestMonth)
    );

    if (!cropsForYear.length) {
        elements.calendarEmpty.style.display = "flex";
        elements.calendarContent.style.display = "none";
        return;
    }

    elements.calendarEmpty.style.display = "none";
    elements.calendarContent.style.display = "block";

    if (elements.calendarPeriod) {
        elements.calendarPeriod.textContent = calendarYear;
    }

    if (!elements.calendarActivities) return;

    elements.calendarActivities.innerHTML = "";

    cropsForYear.forEach(crop => {
        const row = document.createElement("div");

        row.className = "calendar-crop-row";

        Object.assign(row.style, {
            display: "grid",
            gridTemplateColumns: "minmax(90px, 1fr) 4fr",
            alignItems: "center",
            gap: "12px",
            minWidth: "700px",
            padding: "12px 0",
            borderBottom: "1px solid rgba(143,196,153,.08)"
        });

        const name = document.createElement("span");

        name.textContent = crop.name;

        Object.assign(name.style, {
            color: "#dcefe0",
            fontSize: "10px"
        });

        const timeline = document.createElement("div");

        Object.assign(timeline.style, {
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            position: "relative",
            height: "25px",
            background: "rgba(255,255,255,.025)",
            borderRadius: "5px",
            overflow: "hidden"
        });

        for (let i = 0; i < 12; i++) {
            const cell = document.createElement("div");

            cell.style.borderRight = "1px solid rgba(143,196,153,.06)";

            timeline.appendChild(cell);
        }

        const start = crop.plantingMonth;
        const end = crop.harvestMonth;

        const span = start <= end
            ? end - start + 1
            : 12 - start + 1 + end;

        const bar = document.createElement("div");

        const left = ((start - 1) / 12) * 100;
        const width = Math.min((span / 12) * 100, 100);

        Object.assign(bar.style, {
            position: "absolute",
            top: "5px",
            left: `${left}%`,
            width: `${width}%`,
            height: "15px",
            background: "linear-gradient(90deg,#27834b,#70df8c)",
            borderRadius: "5px",
            boxShadow: "0 0 10px rgba(112,223,140,.2)"
        });

        timeline.appendChild(bar);

        row.append(name, timeline);

        elements.calendarActivities.appendChild(row);
    });
}


// =========================================================
// 17. NAVEGAÇÃO DO CALENDÁRIO
// =========================================================

function changeCalendarYear(direction) {
    calendarYear += direction;

    if (elements.calendarPeriod) {
        elements.calendarPeriod.textContent = calendarYear;
    }

    renderCalendar();
}


// =========================================================
// 18. LISTAGEM DE PLANOS
// =========================================================

function renderPlans() {
    if (!elements.savedPlans) return;

    const relevantPlans = selectedPropertyId
        ? plans.filter(plan =>
            String(plan.propertyId) === selectedPropertyId
        )
        : plans;

    elements.savedPlans.innerHTML = "";

    if (!relevantPlans.length) {
        elements.savedPlans.innerHTML = `
            <div class="plans-empty">
                <div class="empty-icon">
                    <i class="fa-solid fa-folder-open"></i>
                </div>

                <h3>Ainda não existem planos</h3>

                <p>
                    Crie o seu primeiro plano agrícola para
                    começar a organizar as suas estratégias.
                </p>

                <button class="primary-button" id="empty-create-plan">
                    <i class="fa-solid fa-plus"></i>
                    Criar primeiro plano
                </button>
            </div>
        `;

        return;
    }

    relevantPlans.forEach(plan => {
        const card = document.createElement("article");

        card.className = "saved-plan-card";

        Object.assign(card.style, {
            padding: "20px",
            background: "rgba(10,25,18,.88)",
            border: "1px solid rgba(143,196,153,.12)",
            borderRadius: "17px",
            transition: ".3s ease"
        });

        const property = properties.find(
            item => String(item.id) === String(plan.propertyId)
        );

        const cropCount = plan.crops.length;
        const rotationCount = plan.rotation?.length || 0;

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:10px;">
                <div>
                    <span style="color:#70df8c;font-size:9px;letter-spacing:1px;">
                        PLANO AGRÍCOLA
                    </span>

                    <h3 style="font-size:15px;margin-top:8px;">
                        ${escapeHTML(plan.name)}
                    </h3>

                    <p style="font-size:10px;color:#718579;margin-top:6px;">
                        ${escapeHTML(property?.name || "Propriedade indisponível")}
                    </p>
                </div>

                <button
                    class="delete-plan-button"
                    data-id="${escapeHTML(plan.id)}"
                    aria-label="Eliminar plano"
                    style="
                        width:32px;
                        height:32px;
                        flex-shrink:0;
                        border:1px solid rgba(255,100,100,.15);
                        border-radius:9px;
                        background:rgba(255,80,80,.06);
                        color:#ff8585;
                        cursor:pointer;
                    "
                >
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>

            <div style="
                display:flex;
                gap:20px;
                margin-top:20px;
                padding-top:15px;
                border-top:1px solid rgba(143,196,153,.1);
            ">
                <span style="font-size:10px;color:#a4b8a8;">
                    <i class="fa-solid fa-seedling" style="color:#70df8c;"></i>
                    ${cropCount} culturas
                </span>

                <span style="font-size:10px;color:#a4b8a8;">
                    <i class="fa-solid fa-arrows-rotate" style="color:#70df8c;"></i>
                    ${rotationCount} rotações
                </span>
            </div>

            <div style="margin-top:15px;">
                <button
                    class="open-plan-button"
                    data-id="${escapeHTML(plan.id)}"
                    style="
                        border:0;
                        background:none;
                        color:#70df8c;
                        font-size:10px;
                        font-weight:800;
                        cursor:pointer;
                    "
                >
                    Abrir plano
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        `;

        elements.savedPlans.appendChild(card);
    });

    elements.savedPlans.querySelectorAll(".delete-plan-button").forEach(button => {
        button.addEventListener("click", () => {
            deletePlan(button.dataset.id);
        });
    });

    elements.savedPlans.querySelectorAll(".open-plan-button").forEach(button => {
        button.addEventListener("click", () => {
            openPlan(button.dataset.id);
        });
    });
}


// =========================================================
// 19. CONSULTAR PLANO
// =========================================================

function openPlan(id) {
    const plan = plans.find(item => String(item.id) === String(id));

    if (!plan) return;

    const property = properties.find(
        item => String(item.id) === String(plan.propertyId)
    );

    const cropsHTML = plan.crops.length
        ? plan.crops.map(crop => `
            <div class="planning-modal-info">
                <i class="fa-solid fa-seedling"></i>

                <span>
                    <strong>${escapeHTML(crop.name)}</strong>
                    <br>
                    Plantação: ${MONTHS[crop.plantingMonth - 1] || "Não definida"}
                    · Colheita: ${MONTHS[crop.harvestMonth - 1] || "Não definida"}
                </span>
            </div>
        `).join("")
        : `<p class="planning-empty-detail">Nenhuma cultura registada.</p>`;

    const rotationsHTML = plan.rotation?.length
        ? plan.rotation.map(rotation => `
            <div class="planning-modal-info">
                <i class="fa-solid fa-arrows-rotate"></i>
                <span>${escapeHTML(rotation.name)}</span>
            </div>
        `).join("")
        : `<p class="planning-empty-detail">Nenhuma rotação registada.</p>`;

    const scenariosHTML = plan.scenarios?.length
        ? plan.scenarios.map(scenario => `
            <div class="planning-modal-info">
                <i class="fa-solid fa-chart-line"></i>

                <span>
                    <strong>${escapeHTML(scenario.name)}</strong>
                    <br>
                    ${escapeHTML(scenario.description || "Sem descrição.")}
                </span>
            </div>
        `).join("")
        : `<p class="planning-empty-detail">Nenhum cenário registado.</p>`;

    const resources = plan.resources || {};

    openModal({
        title: plan.name,
        description: `Detalhes do plano · ${property?.name || "Propriedade indisponível"}`,
        icon: "fa-clipboard-list",
        hideSubmit: true,

        content: `
            <div class="planning-form-section">

                <div class="planning-form-section-title">
                    <i class="fa-solid fa-seedling"></i>
                    Culturas
                </div>

                ${cropsHTML}

                <div class="planning-form-section-title">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    Rotações
                </div>

                ${rotationsHTML}

                <div class="planning-form-section-title">
                    <i class="fa-solid fa-toolbox"></i>
                    Recursos
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-droplet"></i>
                    <span>Água: ${escapeHTML(resources.water || "Não definido")}</span>
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-leaf"></i>
                    <span>Fertilização: ${escapeHTML(resources.fertilizer || "Não definido")}</span>
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-toolbox"></i>
                    <span>Outros: ${escapeHTML(resources.other || "Não definido")}</span>
                </div>

                <div class="planning-form-section-title">
                    <i class="fa-solid fa-chart-line"></i>
                    Cenários
                </div>

                ${scenariosHTML}

            </div>
        `
    });
}


// =========================================================
// 20. ELIMINAR PLANO
// =========================================================

function deletePlan(id) {
    const plan = plans.find(item => String(item.id) === String(id));

    if (!plan) return;

    openModal({
        title: "Eliminar plano agrícola",
        description: "Esta ação não poderá ser desfeita.",
        icon: "fa-triangle-exclamation",
        submitText: "Eliminar definitivamente",
        action: `delete-plan:${id}`,

        content: `
            <div class="planning-form-section">

                <div class="planning-modal-info">
                    <i class="fa-solid fa-trash" style="color:#ff8585;"></i>

                    <span>
                        Tem a certeza de que pretende eliminar o plano
                        <strong>${escapeHTML(plan.name)}</strong>?
                    </span>
                </div>

                <div class="planning-modal-info">
                    <i class="fa-solid fa-circle-info"></i>

                    <span>
                        As culturas, rotações, recursos e cenários
                        associados a este plano também serão eliminados.
                    </span>
                </div>

            </div>
        `
    });
}


function confirmDeletePlan(id) {
    const plan = plans.find(item => String(item.id) === String(id));

    if (!plan) return;

    const previousPlans = [...plans];

    plans = plans.filter(item => String(item.id) !== String(id));

    if (!saveStorage(PLAN_KEY, plans)) {
        plans = previousPlans;
        return;
    }

    const property = properties.find(
        item => String(item.id) === String(plan.propertyId)
    );

    registerHistoryEvent({
        type: "system",
        title: "Plano agrícola eliminado",
        description: `O plano "${plan.name}" foi eliminado${property ? ` da propriedade "${property.name}"` : ""}.`,
        propertyId: plan.propertyId,
        metadata: [
            {
                icon: "fa-trash",
                label: plan.name
            }
        ]
    });

    updateSummary();
    renderPlans();
    renderCalendar();

    closeModal();

    showToast("Plano eliminado.");
}


// =========================================================
// 21. SUBMISSÃO DOS MODAIS
// =========================================================

function handleModalSubmit(event) {
    event.preventDefault();

    if (!modalAction) return;

    const formData = new FormData(elements.modalForm);

    switch (modalAction) {

        case "create-plan": {
            const name = String(formData.get("planName") || "");

            saveNewPlan(name);
            break;
        }

        case "add-crop": {
            const name = String(formData.get("cropName") || "");
            const plantingMonth = formData.get("plantingMonth");
            const harvestMonth = formData.get("harvestMonth");

            saveCrop(name, plantingMonth, harvestMonth);
            break;
        }

        case "add-rotation": {
            const name = String(formData.get("rotationName") || "");

            saveRotation(name);
            break;
        }

        case "save-resources": {
            const water = String(formData.get("water") || "");
            const fertilizer = String(formData.get("fertilizer") || "");
            const other = String(formData.get("other") || "");

            saveResources(water, fertilizer, other);
            break;
        }

        case "add-scenario": {
            const name = String(formData.get("scenarioName") || "");
            const description = String(formData.get("scenarioDescription") || "");

            saveScenario(name, description);
            break;
        }

        default: {
            if (modalAction.startsWith("delete-plan:")) {
                const id = modalAction.replace("delete-plan:", "");

                confirmDeletePlan(id);
            }
        }
    }
}


// =========================================================
// 22. CONTROLO E ACESSIBILIDADE DOS MODAIS
// =========================================================

function initializeModalEvents() {
    if (!elements.modal) return;

    elements.modalClose?.addEventListener("click", closeModal);

    elements.modalCancel?.addEventListener("click", closeModal);

    elements.modalForm?.addEventListener("submit", handleModalSubmit);

    elements.modal.addEventListener("click", event => {
        if (event.target === elements.modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (!elements.modal.classList.contains("is-visible")) return;

        if (event.key === "Escape") {
            closeModal();
        }

        if (event.key === "Tab") {
            const focusable = elements.modal.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
            );

            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();

            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
}


// =========================================================
// 23. MENU MOBILE
// =========================================================

function initializeMobileMenu() {
    if (!elements.menuButton || !elements.sidebar) return;

    elements.menuButton.addEventListener("click", () => {
        const isOpen = elements.sidebar.classList.toggle("active");

        elements.menuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );
    });

    document.addEventListener("click", event => {
        const clickedInside = elements.sidebar.contains(event.target);
        const clickedButton = elements.menuButton.contains(event.target);

        if (!clickedInside && !clickedButton) {
            elements.sidebar.classList.remove("active");

            elements.menuButton.setAttribute("aria-expanded", "false");
        }
    });

    elements.sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            elements.sidebar.classList.remove("active");

            elements.menuButton.setAttribute("aria-expanded", "false");
        });
    });
}


// =========================================================
// 24. EVENTOS DA PÁGINA
// =========================================================

function initializeEvents() {
    elements.createPlan?.addEventListener("click", createPlan);

    elements.emptyCreatePlan?.addEventListener("click", createPlan);

    elements.manageCrops?.addEventListener("click", manageCrops);

    elements.rotation?.addEventListener("click", manageRotation);

    elements.resources?.addEventListener("click", manageResources);

    elements.scenarios?.addEventListener("click", compareScenarios);

    elements.calendarAdd?.addEventListener("click", manageCrops);

    elements.calendarPrevious?.addEventListener("click", () => {
        changeCalendarYear(-1);
    });

    elements.calendarNext?.addEventListener("click", () => {
        changeCalendarYear(1);
    });

    elements.propertySelect?.addEventListener("change", event => {
        selectedPropertyId = event.target.value;

        updateSelectedProperty();
    });

    elements.viewAllPlans?.addEventListener("click", () => {
        document.querySelector(".saved-plans-section")?.scrollIntoView({
            behavior: "smooth"
        });
    });

    elements.notifications?.addEventListener("click", () => {
        showToast("Não existem notificações novas.");
    });

    // Botão vazio criado dinamicamente
    elements.savedPlans?.addEventListener("click", event => {
        const button = event.target.closest("#empty-create-plan");

        if (button) {
            createPlan();
        }
    });

    // Sincronização entre separadores
    window.addEventListener("storage", event => {
        if (
            event.key === PROPERTY_KEY ||
            event.key === PLAN_KEY ||
            event.key === SETTINGS_KEY
        ) {
            loadData();
        }
    });
}


// =========================================================
// 25. INICIALIZAÇÃO
// =========================================================

function initializePlanning() {
    initializeHeader();

    initializeMobileMenu();

    initializeModalEvents();

    initializeEvents();

    loadData();

    console.log("AcreView Planning initialized successfully.");
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePlanning);
} else {
    initializePlanning();
}