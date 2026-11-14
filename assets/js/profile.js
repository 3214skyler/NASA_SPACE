// =====================================================
// ACREVIEW — PROFILE SYSTEM
// Navigation, Profile, Properties, Preferences,
// Security, Themes, Language and Translation
// =====================================================


// =====================================================
// 1. SISTEMA DE TRADUÇÃO
// =====================================================

const translationCacheKey = "acreViewTranslationCache";
const settingsStorageKey = "acreViewSettings";

// =====================================================
// HISTÓRICO — REGISTAR ATIVIDADES
// =====================================================

const historyStorageKey = "acreViewHistory";

function registerHistoryEvent({
    type,
    title,
    description,
    propertyId = null,
    metadata = []
}) {
    try {
        const history = JSON.parse(
            localStorage.getItem(historyStorageKey) || "[]"
        );

        const records = Array.isArray(history) ? history : [];

        records.unshift({
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : String(Date.now()),

            date: new Date().toISOString(),
            type,
            title,
            description,
            propertyId,
            metadata
        });

        localStorage.setItem(
            historyStorageKey,
            JSON.stringify(records)
        );

    } catch (error) {
        console.error(
            "Erro ao registar atividade no histórico:",
            error
        );
    }
}

const languageCodes = {
    pt: "pt",
    en: "en",
    fr: "fr",
    es: "es"
};

const defaultSettings = {
    theme: "dark",
    language: "pt",
    unit: "ha",
    dataSharing: false
};

let currentLanguage = "pt";
let languageRequestId = 0;

const themeSetting = document.getElementById("theme-setting");
const languageSetting = document.getElementById("language-setting");
const unitSetting = document.getElementById("unit-setting");
const dataSharingSetting = document.getElementById("data-sharing-setting");
const saveSettingsButton = document.getElementById("save-settings");


// =====================================================
// 1.1. CACHE DE TRADUÇÕES
// =====================================================

function getTranslationCache() {
    try {
        return JSON.parse(
            localStorage.getItem(translationCacheKey) || "{}"
        );
    } catch (error) {
        console.error("Erro ao carregar cache:", error);
        return {};
    }
}


function saveTranslationCache(cache) {
    try {
        localStorage.setItem(
            translationCacheKey,
            JSON.stringify(cache)
        );
    } catch (error) {
        console.error("Erro ao guardar cache:", error);
    }
}


// =====================================================
// 1.2. API DE TRADUÇÃO
// =====================================================

async function translateText(text, language = currentLanguage) {

    if (!text || language === "pt") {
        return text;
    }

    if (!languageCodes[language]) {
        return text;
    }

    const originalText = String(text);

    const cache = getTranslationCache();

    const cacheKey = `${language}_${originalText}`;

    if (cache[cacheKey]) {
        return cache[cacheKey];
    }

    const params = new URLSearchParams({
        q: originalText,
        langpair: `pt|${languageCodes[language]}`
    });

    try {

        const response = await fetch(
            `https://api.mymemory.translated.net/get?${params}`
        );

        if (!response.ok) {
            throw new Error("Erro na API de tradução.");
        }

        const data = await response.json();

        if (
            Number(data.responseStatus) !== 200 ||
            !data.responseData?.translatedText
        ) {
            throw new Error("Tradução indisponível.");
        }

        const translatedText = data.responseData.translatedText;

        cache[cacheKey] = translatedText;

        saveTranslationCache(cache);

        return translatedText;

    } catch (error) {

        console.error("Erro de tradução:", error);

        return originalText;
    }
}


// =====================================================
// 1.3. TRADUÇÃO COM LIMITE DE PEDIDOS
// =====================================================

async function translateElements(elements, language) {

    const elementsArray = Array.from(elements);

    const concurrency = 3;

    let index = 0;

    async function worker() {

        while (index < elementsArray.length) {

            const currentIndex = index++;

            const element = elementsArray[currentIndex];

            if (!element) continue;

            const originalText = element.dataset.originalText;

            const translatedText = await translateText(
                originalText,
                language
            );

            if (language !== currentLanguage) {
                continue;
            }

            element.textContent = translatedText;
        }
    }

    const workers = Array.from(
        { length: Math.min(concurrency, elementsArray.length) },
        () => worker()
    );

    await Promise.all(workers);
}


// =====================================================
// 1.4. TRADUZIR PLACEHOLDERS
// =====================================================

async function translatePlaceholders(language) {

    const elements = document.querySelectorAll(
        "[data-i18n-placeholder]"
    );

    const translations = [];

    elements.forEach(element => {

        if (!element.hasAttribute("data-original-placeholder")) {

            element.dataset.originalPlaceholder =
                element.getAttribute("placeholder") || "";

        }

        translations.push({
            element,
            original: element.dataset.originalPlaceholder
        });

    });

    for (const item of translations) {

        if (language !== currentLanguage) return;

        const translated = await translateText(
            item.original,
            language
        );

        if (language !== currentLanguage) return;

        item.element.setAttribute(
            "placeholder",
            translated
        );
    }
}


// =====================================================
// 1.5. TRADUZIR TEXTOS HTML
// =====================================================

async function applyLanguage(language) {

    if (!languageCodes[language]) {
        language = "pt";
    }

    currentLanguage = language;

    const requestId = ++languageRequestId;

    document.documentElement.lang = language;

    const elements = document.querySelectorAll("[data-i18n]");

    // Guardar os textos originais antes de traduzir

    elements.forEach(element => {

        if (!element.hasAttribute("data-original-text")) {

            element.dataset.originalText =
                element.textContent.trim();

        }

    });

    // Restaurar imediatamente o português

    if (language === "pt") {

        elements.forEach(element => {

            element.textContent =
                element.dataset.originalText;

        });

        document.querySelectorAll(
            "[data-i18n-placeholder]"
        ).forEach(element => {

            if (element.hasAttribute("data-original-placeholder")) {

                element.setAttribute(
                    "placeholder",
                    element.dataset.originalPlaceholder
                );

            }

        });

        updateHeaderTitle(
            getActiveSectionTitle()
        );

        renderProperties();

        return;
    }

    await translateElements(elements, language);

    if (requestId !== languageRequestId) return;

    await translatePlaceholders(language);

    if (requestId !== languageRequestId) return;

    await translateSelectOptions(language);

    if (requestId !== languageRequestId) return;

    renderProperties();

    updateHeaderTitle(
        getActiveSectionTitle()
    );
}


// =====================================================
// 1.6. TRADUZIR OPÇÕES DOS SELECTS
// =====================================================

async function translateSelectOptions(language) {

    const options = document.querySelectorAll(
        "select option[data-i18n]"
    );

    for (const option of options) {

        if (!option.hasAttribute("data-original-text")) {

            option.dataset.originalText =
                option.textContent.trim();

        }

        const translated = await translateText(
            option.dataset.originalText,
            language
        );

        if (language !== currentLanguage) return;

        option.textContent = translated;
    }
}


// =====================================================
// 1.7. TRADUZIR MENSAGENS DO SISTEMA
// =====================================================

async function translatedAlert(message) {

    const translated = await translateText(
        message,
        currentLanguage
    );

    alert(translated);
}


async function translatedConfirm(message) {

    const translated = await translateText(
        message,
        currentLanguage
    );

    return confirm(translated);
}


// =====================================================
// 2. NAVEGAÇÃO ENTRE SECÇÕES
// =====================================================

const navigationButtons = document.querySelectorAll(
    ".profile-nav-item"
);

const profileSections = document.querySelectorAll(
    ".profile-section"
);


const sectionTitles = {

    personal: "Meu perfil",

    properties: "Minhas propriedades",

    preferences: "Preferências agrícolas",

    security: "Segurança da conta",

    settings: "Definições"

};


function getActiveSectionTitle() {

    const activeButton = document.querySelector(
        ".profile-nav-item.active"
    );

    if (!activeButton) {
        return "Meu perfil";
    }

    return sectionTitles[activeButton.dataset.section] ||
        "Meu perfil";
}


async function updateHeaderTitle(originalTitle) {

    const header = document.querySelector(
        ".profile-header h1"
    );

    if (!header) return;

    header.textContent = await translateText(
        originalTitle,
        currentLanguage
    );
}


navigationButtons.forEach(button => {

    button.addEventListener("click", () => {

        const sectionId = button.dataset.section;

        navigationButtons.forEach(item => {
            item.classList.remove("active");
        });

        profileSections.forEach(section => {
            section.classList.remove("active");
        });

        button.classList.add("active");

        const selectedSection = document.getElementById(
            sectionId
        );

        if (selectedSection) {
            selectedSection.classList.add("active");
        }

        updateHeaderTitle(
            sectionTitles[sectionId]
        );

    });

});


// =====================================================
// 3. EFEITO 3D NOS CARTÕES
// =====================================================

const tiltCards = document.querySelectorAll("[data-tilt]");

tiltCards.forEach(card => {

    card.addEventListener("mousemove", event => {

        const rect = card.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;

        card.style.transform =
            `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;

    });

    card.addEventListener("mouseleave", () => {

        card.style.transform =
            "perspective(1000px) rotateX(0) rotateY(0) translateZ(0)";

    });

});


// =====================================================
// 4. CARREGAR FOTOGRAFIA
// =====================================================

const avatarUpload = document.getElementById("avatar-upload");

const profileAvatar = document.getElementById("profile-avatar");

let avatarURL = null;


if (avatarUpload && profileAvatar) {

    avatarUpload.addEventListener("change", event => {

        const file = event.target.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            translatedAlert(
                "Seleciona um ficheiro de imagem válido."
            );

            return;
        }

        if (avatarURL) {
            URL.revokeObjectURL(avatarURL);
        }

        avatarURL = URL.createObjectURL(file);

        profileAvatar.src = avatarURL;

    });

}


// =====================================================
// 5. CONTAGEM ANIMADA
// =====================================================

const statNumbers = document.querySelectorAll(
    ".stat-number"
);


function animateCounter(element) {

    const target = Number(element.dataset.value);

    const duration = 1200;

    const startTime = performance.now();

    function updateCounter(currentTime) {

        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        const currentValue = Math.floor(
            target * progress
        );

        element.textContent = currentValue;

        if (progress < 1) {

            requestAnimationFrame(updateCounter);

        }

    }

    requestAnimationFrame(updateCounter);
}


statNumbers.forEach(number => {
    animateCounter(number);
});


// =====================================================
// 6. MODAL DE EDIÇÃO DO PERFIL
// =====================================================

const editModal = document.getElementById("edit-modal");

const profileForm = document.getElementById("profile-form");

const closeModalButton = document.getElementById(
    "close-edit-modal"
);

const cancelModalButton = document.getElementById(
    "cancel-edit"
);

const editButton = document.getElementById(
    "edit-profile"
);


function getProfileValue(id, defaultValue) {

    const element = document.getElementById(id);

    if (!element) return "";

    const value = element.textContent.trim();

    return value === defaultValue ? "" : value;
}


function openEditModal() {

    document.getElementById("edit-name").value =
        getProfileValue("info-name", "Não definido");

    document.getElementById("edit-email").value =
        getProfileValue("info-email", "Não definido");

    document.getElementById("edit-country").value =
        getProfileValue("info-country", "Não definido");

    document.getElementById("edit-experience").value =
        getProfileValue("info-experience", "Não definida");

    editModal.classList.add("active");
}


function closeEditModal() {

    editModal.classList.remove("active");

}


if (editButton) {
    editButton.addEventListener("click", openEditModal);
}

if (closeModalButton) {
    closeModalButton.addEventListener("click", closeEditModal);
}

if (cancelModalButton) {
    cancelModalButton.addEventListener("click", closeEditModal);
}


if (profileForm) {

    profileForm.addEventListener("submit", event => {

        event.preventDefault();

        const name = document.getElementById(
            "edit-name"
        ).value.trim();

        const email = document.getElementById(
            "edit-email"
        ).value.trim();

        const country = document.getElementById(
            "edit-country"
        ).value.trim();

        const experience = document.getElementById(
            "edit-experience"
        ).value;

        if (!name || !email) {

            translatedAlert(
                "O nome e o email são obrigatórios."
            );

            return;
        }

        document.getElementById("info-name").textContent =
            name;

        document.getElementById("info-email").textContent =
            email;

        document.getElementById("info-country").textContent =
            country || (
                currentLanguage === "pt"
                    ? "Não definido"
                    : "Not defined"
            );

        document.getElementById("info-experience").textContent =
            experience || (
                currentLanguage === "pt"
                    ? "Não definida"
                    : "Not defined"
            );

        document.getElementById("profile-name").textContent =
            name;

        document.getElementById("profile-email").textContent =
            email;

        closeEditModal();

    });

}


const editModalBackdrop = document.querySelector(
    ".edit-modal-backdrop"
);

if (editModalBackdrop) {

    editModalBackdrop.addEventListener(
        "click",
        closeEditModal
    );

}


// =====================================================
// 7. GESTÃO DE PROPRIEDADES AGRÍCOLAS
// =====================================================

const propertyModal = document.getElementById(
    "property-modal"
);

const propertyForm = document.getElementById(
    "property-form"
);

const addPropertyButton = document.getElementById(
    "add-property"
);

const firstPropertyButton = document.getElementById(
    "first-property"
);

const closePropertyButton = document.getElementById(
    "close-property-modal"
);

const cancelPropertyButton = document.getElementById(
    "cancel-property"
);

const propertiesList = document.getElementById(
    "properties-list"
);

const emptyProperties = document.getElementById(
    "empty-properties"
);

const totalProperties = document.getElementById(
    "total-properties"
);

const totalArea = document.getElementById(
    "total-area"
);


// =====================================================
// 7.1. CARREGAR PROPRIEDADES
// =====================================================

let properties = [];

try {

    properties = JSON.parse(
        localStorage.getItem("acreViewProperties") || "[]"
    );

    if (!Array.isArray(properties)) {
        properties = [];
    }

} catch (error) {

    console.error(
        "Erro ao carregar propriedades:",
        error
    );

    properties = [];

}


let editingPropertyId = null;


// =====================================================
// 7.2. ABRIR E FECHAR FORMULÁRIO
// =====================================================

async function openPropertyModal() {

    propertyForm.reset();

    editingPropertyId = null;

    propertyModal.querySelector("h2").textContent =
        await translateText("Nova propriedade");

    propertyForm.querySelector(
        '[type="submit"]'
    ).textContent =
        await translateText("Guardar propriedade");

    propertyModal.classList.add("active");
}


function closePropertyModal() {

    propertyModal.classList.remove("active");

    propertyForm.reset();

    editingPropertyId = null;

}


if (addPropertyButton) {
    addPropertyButton.addEventListener(
        "click",
        openPropertyModal
    );
}

if (firstPropertyButton) {
    firstPropertyButton.addEventListener(
        "click",
        openPropertyModal
    );
}

if (closePropertyButton) {
    closePropertyButton.addEventListener(
        "click",
        closePropertyModal
    );
}

if (cancelPropertyButton) {
    cancelPropertyButton.addEventListener(
        "click",
        closePropertyModal
    );
}


if (propertyModal) {

    propertyModal.addEventListener("click", event => {

        if (event.target === propertyModal) {
            closePropertyModal();
        }

    });

}


// =====================================================
// 7.3. GUARDAR PROPRIEDADES
// =====================================================

function saveProperties() {
    try {
        localStorage.setItem(
            "acreViewProperties",
            JSON.stringify(properties)
        );

        return true;

    } catch (error) {
        console.error("Erro ao guardar propriedades:", error);

        translatedAlert(
            "Não foi possível guardar as propriedades."
        );

        return false;
    }
}


// =====================================================
// 7.4. REGISTAR OU EDITAR PROPRIEDADE
// =====================================================

if (propertyForm) {

    propertyForm.addEventListener("submit", event => {

        event.preventDefault();

        const name = document.getElementById(
            "property-name"
        ).value.trim();

        const location = document.getElementById(
            "property-location"
        ).value.trim();

        const latitudeValue = document.getElementById(
            "property-latitude"
        ).value;

        const longitudeValue = document.getElementById(
            "property-longitude"
        ).value;

        const area = Number(
            document.getElementById("property-area").value
        );

        const soil = document.getElementById(
            "property-soil"
        ).value;

        const irrigation = document.getElementById(
            "property-irrigation"
        ).value;

        const crops = document.getElementById(
            "property-crops"
        ).value.trim();


        if ((latitudeValue === "") !== (longitudeValue === "")) {

            translatedAlert(
                "Preenche a latitude e a longitude ou deixa ambas vazias."
            );

            return;
        }


        const latitude = latitudeValue === ""
            ? null
            : Number(latitudeValue);

        const longitude = longitudeValue === ""
            ? null
            : Number(longitudeValue);


        if (
            latitude !== null &&
            (
                !Number.isFinite(latitude) ||
                latitude < -90 ||
                latitude > 90
            )
        ) {

            translatedAlert(
                "A latitude deve estar entre -90 e 90."
            );

            return;
        }


        if (
            longitude !== null &&
            (
                !Number.isFinite(longitude) ||
                longitude < -180 ||
                longitude > 180
            )
        ) {

            translatedAlert(
                "A longitude deve estar entre -180 e 180."
            );

            return;
        }


        if (!Number.isFinite(area) || area <= 0) {

            translatedAlert(
                "Introduz uma área válida, superior a zero."
            );

            return;
        }


        const existingProperty = editingPropertyId
            ? properties.find(
                property => property.id === editingPropertyId
            )
            : null;


        const propertyData = {

            id: editingPropertyId || (
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : String(Date.now())
            ),

            name,
            location,
            latitude,
            longitude,
            area,
            soil,
            irrigation,
            crops,

            coordinates: existingProperty?.coordinates || null

        };


       // Guardar o estado anterior para permitir recuperar
        // os dados caso a gravação falhe.

        const previousProperties = [...properties];

        if (editingPropertyId) {

            properties = properties.map(property =>
                property.id === editingPropertyId
                    ? propertyData
                    : property
            );

        } else {

            properties.push(propertyData);

        }


        // Só continuar se a gravação for bem-sucedida.

        if (!saveProperties()) {
            properties = previousProperties;
            return;
        }


        // Registar a atividade no histórico.

        if (editingPropertyId) {

            registerHistoryEvent({
                type: "agriculture",
                title: "Propriedade agrícola atualizada",

                description:
                    `Os dados da propriedade "${propertyData.name}" foram atualizados.`,

                propertyId: propertyData.id,

                metadata: [
                    {
                        icon: "fa-map",
                        label: `Área: ${propertyData.area} ha`
                    },
                    {
                        icon: "fa-location-dot",
                        label: propertyData.location || "Localização não definida"
                    },
                    {
                        icon: "fa-seedling",
                        label: propertyData.crops || "Culturas não informadas"
                    }
                ]
            });

        } else {

            registerHistoryEvent({
                type: "agriculture",
                title: "Nova propriedade agrícola criada",

                description:
                 `A propriedade "${propertyData.name}" foi registada através do Perfil.`,

                propertyId: propertyData.id,

                metadata: [
                 {
                        icon: "fa-map",
                label: `Área: ${propertyData.area} ha`
                    },
                    {
                        icon: "fa-location-dot",
                        label: propertyData.location || "Localização não definida"
                 },
                    {
                     icon: "fa-seedling",
                label: propertyData.crops || "Culturas não informadas"
                 }
             ]
            });

        }


        renderProperties();

        closePropertyModal();

    });

}


// =====================================================
// 7.5. CONVERTER UNIDADES DE ÁREA
// =====================================================

function formatAreaInSelectedUnit(areaInHectares) {

    let settings = {};

    try {

        settings = JSON.parse(
            localStorage.getItem(settingsStorageKey) || "{}"
        );

    } catch (error) {

        console.error("Erro nas definições:", error);

    }


    const selectedUnit = settings.unit || "ha";

    let convertedArea = Number(areaInHectares);

    let unitLabel = "ha";


    if (selectedUnit === "m2") {

        convertedArea *= 10000;

        unitLabel = "m²";

    } else if (selectedUnit === "acre") {

        convertedArea *= 2.4710538147;

        unitLabel = "ac";

    }


    return `${convertedArea.toLocaleString("pt-PT", {
        maximumFractionDigits: 2
    })} ${unitLabel}`;

}


// =====================================================
// 7.6. APRESENTAR PROPRIEDADES
// =====================================================

async function renderProperties() {

    if (!propertiesList) return;

    propertiesList.replaceChildren();


    if (totalProperties) {
        totalProperties.textContent = properties.length;
    }


    const areaSum = properties.reduce(
        (total, property) =>
            total + Number(property.area || 0),
        0
    );


    if (totalArea) {
        totalArea.textContent =
            formatAreaInSelectedUnit(areaSum);
    }


    if (properties.length === 0) {

        if (emptyProperties) {

            emptyProperties.style.display = "block";

            propertiesList.appendChild(emptyProperties);

        }

        return;

    }


    if (emptyProperties) {
        emptyProperties.style.display = "none";
    }


    const languageAtRender = currentLanguage;


    for (const property of properties) {

        const card = document.createElement("article");

        card.className = "property-card";


        const information = document.createElement("div");

        information.className =
            "property-card-information";


        const title = document.createElement("h3");

        title.textContent = property.name;


        const location = document.createElement("p");

        location.textContent = `📍 ${property.location}`;


        const details = document.createElement("div");

        details.className = "property-details";


        const area = document.createElement("span");

        const soil = document.createElement("span");

        const irrigation = document.createElement("span");

        const crops = document.createElement("span");


        area.textContent =
            `${await translateText("Área")}: ${formatAreaInSelectedUnit(property.area)}`;


        const translatedSoil = await translateText(
            property.soil || "Não informado",
            languageAtRender
        );


        soil.textContent =
            `${await translateText("Solo", languageAtRender)}: ${translatedSoil}`;


        const translatedIrrigation = await translateText(
            property.irrigation || "Não informado",
            languageAtRender
        );


        irrigation.textContent =
            `${await translateText("Irrigação", languageAtRender)}: ${translatedIrrigation}`;


        crops.textContent =
            `${await translateText("Culturas", languageAtRender)}: ${property.crops || "Não informadas"}`;


        details.append(
            area,
            soil,
            irrigation,
            crops
        );


        information.append(
            title,
            location,
            details
        );


        const actions = document.createElement("div");

        actions.className = "property-card-actions";


        const editButton = document.createElement("button");

        editButton.type = "button";

        editButton.textContent = await translateText(
            "Editar",
            languageAtRender
        );

        editButton.addEventListener("click", () => {
            editProperty(property.id);
        });


        const deleteButton = document.createElement("button");

        deleteButton.type = "button";

        deleteButton.textContent = await translateText(
            "Eliminar",
            languageAtRender
        );

        deleteButton.addEventListener("click", () => {
            deleteProperty(property.id);
        });


        actions.append(
            editButton,
            deleteButton
        );


        card.append(
            information,
            actions
        );


        if (languageAtRender !== currentLanguage) {
            return;
        }


        propertiesList.appendChild(card);

    }

}


// =====================================================
// 7.7. EDITAR PROPRIEDADE
// =====================================================

async function editProperty(id) {

    const property = properties.find(
        item => item.id === id
    );

    if (!property) return;


    editingPropertyId = id;


    document.getElementById("property-name").value =
        property.name;

    document.getElementById("property-location").value =
        property.location;

    document.getElementById("property-latitude").value =
        property.latitude ?? "";

    document.getElementById("property-longitude").value =
        property.longitude ?? "";

    document.getElementById("property-area").value =
        property.area;

    document.getElementById("property-soil").value =
        property.soil;

    document.getElementById("property-irrigation").value =
        property.irrigation;

    document.getElementById("property-crops").value =
        property.crops;


    propertyModal.querySelector("h2").textContent =
        await translateText("Editar propriedade");

    propertyForm.querySelector(
        '[type="submit"]'
    ).textContent =
        await translateText("Guardar alterações");


    propertyModal.classList.add("active");

}


// =====================================================
// 7.8. ELIMINAR PROPRIEDADE
// =====================================================

async function deleteProperty(id) {

    const confirmation = await translatedConfirm(
        "Tens a certeza de que pretendes eliminar esta propriedade?"
    );

    if (!confirmation) return;

    const propertyToDelete = properties.find(
        property => property.id === id
    );

    if (!propertyToDelete) return;

    const previousProperties = [...properties];

    properties = properties.filter(
        property => property.id !== id
    );

    if (!saveProperties()) {
        properties = previousProperties;
        return;
    }

    registerHistoryEvent({
        type: "system",
        title: "Propriedade agrícola eliminada",

        description:
            `A propriedade "${propertyToDelete.name}" foi eliminada do Perfil.`,

        propertyId: propertyToDelete.id,

        metadata: [
            {
                icon: "fa-map",
                label: `Área anterior: ${propertyToDelete.area} ha`
            }
        ]
    });

    renderProperties();
}


// =====================================================
// 7.9. SINCRONIZAÇÃO ENTRE PÁGINAS
// =====================================================

window.addEventListener("storage", event => {

    if (
        event.key !== "acreViewProperties" &&
        event.key !== null
    ) {
        return;
    }


    try {

        properties = JSON.parse(
            localStorage.getItem("acreViewProperties") || "[]"
        );

        if (!Array.isArray(properties)) {
            properties = [];
        }

    } catch (error) {

        console.error(
            "Erro ao sincronizar propriedades:",
            error
        );

        properties = [];

    }


    renderProperties();

});


// =====================================================
// 8. PREFERÊNCIAS AGRÍCOLAS
// =====================================================

const preferencesStorageKey = "acreViewPreferences";

const savePreferencesButton = document.getElementById(
    "save-preferences"
);


function getSelectedOptions(name) {

    return Array.from(
        document.querySelectorAll(
            `input[name="${name}"]:checked`
        )
    ).map(input => input.value);

}


function saveAgriculturalPreferences() {

    const preferences = {

        crops: getSelectedOptions("crops"),

        priorities: getSelectedOptions("priorities"),

        goals: getSelectedOptions("goals")

    };

    try {

        localStorage.setItem(
            preferencesStorageKey,
            JSON.stringify(preferences)
        );

    } catch (error) {

        console.error(
            "Erro ao guardar preferências:",
            error
        );

        translatedAlert(
            "Não foi possível guardar as preferências agrícolas."
        );

        return;
    }


    registerHistoryEvent({
        type: "agriculture",

        title: "Preferências agrícolas atualizadas",

        description:
            "As culturas, prioridades e objetivos agrícolas foram atualizados.",

        metadata: [
            {
                icon: "fa-seedling",
                label: `${preferences.crops.length} culturas selecionadas`
            },
            {
                icon: "fa-bullseye",
                label: `${preferences.priorities.length} prioridades selecionadas`
            },
            {
                icon: "fa-leaf",
                label: `${preferences.goals.length} objetivos selecionados`
            }
        ]
    });


    translatedAlert(
        "Preferências agrícolas guardadas com sucesso!"
    );

}


function loadAgriculturalPreferences() {

    const savedPreferences = localStorage.getItem(
        preferencesStorageKey
    );

    if (!savedPreferences) return;


    try {

        const preferences = JSON.parse(
            savedPreferences
        );


        ["crops", "priorities", "goals"].forEach(category => {

            const selectedValues =
                preferences[category] || [];


            document.querySelectorAll(
                `input[name="${category}"]`
            ).forEach(input => {

                input.checked =
                    selectedValues.includes(input.value);

            });

        });

    } catch (error) {

        console.error(
            "Erro ao carregar preferências:",
            error
        );

    }

}


if (savePreferencesButton) {

    savePreferencesButton.addEventListener(
        "click",
        saveAgriculturalPreferences
    );

}


loadAgriculturalPreferences();


// =====================================================
// 9. SEGURANÇA DA CONTA
// =====================================================

const passwordForm = document.getElementById(
    "password-form"
);


if (passwordForm) {

    passwordForm.addEventListener("submit", async event => {

        event.preventDefault();


        const currentPassword = document.getElementById(
            "current-password"
        ).value;

        const newPassword = document.getElementById(
            "new-password"
        ).value;

        const confirmPassword = document.getElementById(
            "confirm-password"
        ).value;


        if (newPassword.length < 8) {

            await translatedAlert(
                "A nova palavra-passe deve ter pelo menos 8 caracteres."
            );

            return;

        }


        if (newPassword !== confirmPassword) {

            await translatedAlert(
                "As palavras-passe não correspondem."
            );

            return;

        }


        if (currentPassword === newPassword) {

            await translatedAlert(
                "A nova palavra-passe deve ser diferente da atual."
            );

            return;

        }


        await translatedAlert(
            "Validação concluída! A integração com o sistema de autenticação será necessária para alterar a palavra-passe."
        );


        passwordForm.reset();

    });

}


// =====================================================
// 10. SISTEMA DE TEMAS
// =====================================================

function applyTheme(theme) {

    let selectedTheme = theme;


    if (theme === "system") {

        selectedTheme = window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches
            ? "dark"
            : "light";

    }


    document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
    );


    document.documentElement.style.colorScheme =
        selectedTheme;

}


// =====================================================
// 11. CARREGAR DEFINIÇÕES
// =====================================================

function loadSettings() {

    let settings = {
        ...defaultSettings
    };


    try {

        const savedSettings = localStorage.getItem(
            settingsStorageKey
        );


        if (savedSettings) {

            settings = {
                ...defaultSettings,
                ...JSON.parse(savedSettings)
            };

        }

    } catch (error) {

        console.error(
            "Erro ao carregar definições:",
            error
        );

    }


    if (themeSetting) {
        themeSetting.value = settings.theme;
    }

    if (languageSetting) {
        languageSetting.value = settings.language;
    }

    if (unitSetting) {
        unitSetting.value = settings.unit;
    }

    if (dataSharingSetting) {
        dataSharingSetting.checked =
            settings.dataSharing;
    }


    applyTheme(settings.theme);

    applyLanguage(settings.language);

}


// =====================================================
// 12. GUARDAR DEFINIÇÕES
// =====================================================

async function saveSettings() {

    const settings = {

        theme: themeSetting.value,

        language: languageSetting.value,

        unit: unitSetting.value,

        dataSharing: dataSharingSetting.checked

    };

    try {

        localStorage.setItem(
            settingsStorageKey,
            JSON.stringify(settings)
        );

    } catch (error) {

        console.error(
            "Erro ao guardar definições:",
            error
        );

        await translatedAlert(
            "Não foi possível guardar as definições."
        );

        return;
    }


    registerHistoryEvent({
        type: "system",

        title: "Definições da conta atualizadas",

        description:
            "As definições de aparência, idioma, unidades e partilha de dados foram atualizadas.",

        metadata: [
            {
                icon: "fa-palette",
                label: `Tema: ${settings.theme}`
            },
            {
                icon: "fa-language",
                label: `Idioma: ${settings.language}`
            },
            {
                icon: "fa-ruler",
                label: `Unidade: ${settings.unit}`
            },
            {
                icon: "fa-share-nodes",
                label: settings.dataSharing
                    ? "Partilha de dados ativada"
                    : "Partilha de dados desativada"
            }
        ]
    });


    applyTheme(settings.theme);

    await applyLanguage(settings.language);


    await translatedAlert(
        "Definições guardadas com sucesso!"
    );

}


// =====================================================
// 13. EVENTOS DAS DEFINIÇÕES
// =====================================================

if (saveSettingsButton) {

    saveSettingsButton.addEventListener(
        "click",
        saveSettings
    );

}


if (themeSetting) {

    themeSetting.addEventListener("change", () => {

        applyTheme(themeSetting.value);

    });

}


if (languageSetting) {

    languageSetting.addEventListener("change", () => {

        applyLanguage(languageSetting.value);

    });

}


if (unitSetting) {

    unitSetting.addEventListener("change", () => {

        renderProperties();

    });

}


// =====================================================
// 14. FECHAR MODAIS COM ESCAPE
// =====================================================

document.addEventListener("keydown", event => {

    if (event.key !== "Escape") return;


    if (
        editModal &&
        editModal.classList.contains("active")
    ) {

        closeEditModal();

    }


    if (
        propertyModal &&
        propertyModal.classList.contains("active")
    ) {

        closePropertyModal();

    }

});


// =====================================================
// 15. INICIALIZAÇÃO DO ACREVIEW PROFILE
// =====================================================

renderProperties();

loadSettings();