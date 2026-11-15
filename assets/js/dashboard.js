// =====================================================
// ACREVIEW — DASHBOARD SYSTEM
// Main Dashboard | Properties | Map | Indicators
// =====================================================


// =====================================================
// 1. CONFIGURATION
// =====================================================

const DASHBOARD_PROPERTIES_KEY = "acreViewProperties";
const DASHBOARD_SETTINGS_KEY = "acreViewSettings";

let dashboardProperties = [];
let dashboardMap = null;
let dashboardPropertiesLayer = null;


// =====================================================
// 2. STORAGE
// =====================================================

function getDashboardStorage(key, fallback) {

    try {

        const value = localStorage.getItem(key);

        return value ? JSON.parse(value) : fallback;

    } catch (error) {

        console.error("Dashboard storage error:", error);

        return fallback;

    }

}


function loadDashboardProperties() {

    const saved = getDashboardStorage(
        DASHBOARD_PROPERTIES_KEY,
        []
    );

    dashboardProperties = Array.isArray(saved)
        ? saved
        : [];

}


function getDashboardSettings() {

    return {
        unit: "ha",
        language: "pt",
        ...getDashboardStorage(
            DASHBOARD_SETTINGS_KEY,
            {}
        )
    };

}


// =====================================================
// 3. FORMAT AREA
// =====================================================

function formatDashboardArea(area) {

    const settings = getDashboardSettings();

    let value = Number(area) || 0;

    let unit = "ha";

    if (settings.unit === "m2") {

        value *= 10000;

        unit = "m²";

    } else if (settings.unit === "acre") {

        value *= 2.4710538147;

        unit = "ac";

    }

    return `${value.toLocaleString(
        settings.language === "en"
            ? "en-US"
            : settings.language === "fr"
                ? "fr-FR"
                : settings.language === "es"
                    ? "es-ES"
                    : "pt-PT",
        {
            maximumFractionDigits: 2
        }
    )} ${unit}`;

}


// =====================================================
// 4. PROFILE PLACEHOLDER
// =====================================================

function initializeDashboardProfile() {

    const access = window.ACREVIEW_ACCESS || {
        mode: "farmer",
        isEvaluator: false
    };

    const nameElements = [
        document.getElementById("sidebar-user-name"),
        document.getElementById("header-user-name"),
        document.getElementById("welcome-user-name")
    ];

    const avatarElements = [
        document.getElementById("sidebar-avatar"),
        document.getElementById("header-avatar")
    ];

    const displayName = access.isEvaluator
        ? "Avaliador"
        : "Agricultor";

    nameElements.forEach(element => {

        if (!element) return;

        element.textContent = displayName;

    });

    avatarElements.forEach(element => {

        if (!element) return;

        if (element.tagName === "IMG") {

            element.style.display = "none";

        } else {

            element.textContent = access.isEvaluator
                ? "A"
                : "A";

        }

    });

}


// =====================================================
// 5. CURRENT DATE
// =====================================================

function updateDashboardDate() {

    const dateElement = document.getElementById(
        "current-date"
    );

    if (!dateElement) return;

    const settings = getDashboardSettings();

    const locales = {
        pt: "pt-PT",
        en: "en-US",
        fr: "fr-FR",
        es: "es-ES"
    };

    const locale = locales[settings.language] || "pt-PT";

    const today = new Date();

    dateElement.textContent = today.toLocaleDateString(
        locale,
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


// =====================================================
// 6. AGRICULTURAL INDICATORS
// =====================================================

function extractCropNames(property) {

    if (!property.crops) return [];

    return String(property.crops)
        .split(/[,;\n]+/)
        .map(crop => crop.trim())
        .filter(Boolean);

}


function updateDashboardIndicators() {

    const propertyCount = dashboardProperties.length;

    const totalArea = dashboardProperties.reduce(
        (sum, property) => {

            return sum + (
                Number(property.area) || 0
            );

        },
        0
    );


    const uniqueCrops = new Set();

    dashboardProperties.forEach(property => {

        extractCropNames(property).forEach(crop => {

            uniqueCrops.add(crop.toLowerCase());

        });

    });


    const elements = {

        properties: document.getElementById(
            "total-properties"
        ),

        area: document.getElementById(
            "total-area"
        ),

        crops: document.getElementById(
            "total-crops"
        )

    };


    if (elements.properties) {

        elements.properties.textContent =
            propertyCount.toLocaleString("pt-PT");

    }


    if (elements.area) {

        elements.area.textContent =
            formatDashboardArea(totalArea);

    }


    if (elements.crops) {

        elements.crops.textContent =
            uniqueCrops.size.toLocaleString("pt-PT");

    }


    const monitoringStatus = document.getElementById(
        "monitoring-status"
    );

    if (monitoringStatus) {

        monitoringStatus.textContent =
            "A aguardar dados ambientais";

    }

}


// =====================================================
// 7. PROPERTY LIST
// =====================================================

function createPropertyElement(property) {

    const article = document.createElement("article");

    article.className = "dashboard-property-card";


    const information = document.createElement("div");

    information.className = "dashboard-property-information";


    const title = document.createElement("h3");

    title.textContent = property.name || "Propriedade sem nome";


    const location = document.createElement("p");

    location.textContent =
        property.location || "Localização não definida";


    const details = document.createElement("div");

    details.className = "dashboard-property-details";


    const area = document.createElement("span");

    area.textContent =
        `Área: ${formatDashboardArea(property.area)}`;


    const crops = document.createElement("span");

    const cropNames = extractCropNames(property);

    crops.textContent = cropNames.length
        ? `Culturas: ${cropNames.join(", ")}`
        : "Culturas: Não informadas";


    details.append(area, crops);

    information.append(title, location, details);


    const action = document.createElement("a");

    action.href = "explore.html";

    action.className = "dashboard-property-action";

    action.textContent = "Explorar →";


    article.append(information, action);

    return article;

}


function renderDashboardProperties() {

    const container = document.getElementById(
        "dashboard-properties"
    );

    if (!container) return;

    container.replaceChildren();


    if (dashboardProperties.length === 0) {

        const empty = document.createElement("div");

        empty.className = "dashboard-empty-properties";

        const icon = document.createElement("span");

        icon.textContent = "🌱";


        const title = document.createElement("h3");

        title.textContent = "Ainda não tens propriedades";


        const description = document.createElement("p");

        description.textContent =
            "Começa por explorar o mapa e delimitar a tua propriedade agrícola.";


        const button = document.createElement("a");

        button.href = "explore.html";

        button.className = "dashboard-empty-action";

        button.textContent = "Explorar mapa";


        empty.append(
            icon,
            title,
            description,
            button
        );


        container.appendChild(empty);

        return;

    }


    dashboardProperties.forEach(property => {

        container.appendChild(
            createPropertyElement(property)
        );

    });

}


// =====================================================
// 8. DASHBOARD MAP
// =====================================================

function initializeDashboardMap() {

    const mapElement = document.getElementById(
        "dashboard-map"
    );

    if (!mapElement) return;

    if (typeof L === "undefined") {

        console.error("Leaflet não está carregado.");

        return;

    }


    dashboardMap = L.map("dashboard-map", {

        center: [0, 0],

        zoom: 2,

        minZoom: 2,

        maxZoom: 18,

        worldCopyJump: true,

        scrollWheelZoom: false

    });


    const baseLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

            maxZoom: 19
        }
    );


    baseLayer.addTo(dashboardMap);


    dashboardPropertiesLayer = L.layerGroup().addTo(
        dashboardMap
    );


    setTimeout(() => {

        dashboardMap.invalidateSize();

    }, 300);


    renderDashboardMapProperties();

}


// =====================================================
// 9. MAP PROPERTY RENDERING
// =====================================================

function renderDashboardMapProperties() {

    if (!dashboardMap || !dashboardPropertiesLayer) {
        return;
    }


    dashboardPropertiesLayer.clearLayers();


    const boundsPoints = [];


    dashboardProperties.forEach(property => {

        // =====================================
        // PROPERTY POLYGON
        // =====================================

        if (
            Array.isArray(property.coordinates) &&
            property.coordinates.length >= 3
        ) {

            const validCoordinates =
                property.coordinates.filter(point => {

                    return (
                        Array.isArray(point) &&
                        point.length >= 2 &&
                        Number.isFinite(Number(point[0])) &&
                        Number.isFinite(Number(point[1])) &&
                        Number(point[0]) >= -90 &&
                        Number(point[0]) <= 90 &&
                        Number(point[1]) >= -180 &&
                        Number(point[1]) <= 180
                    );

                });


            if (validCoordinates.length >= 3) {

                const polygon = L.polygon(
                    validCoordinates,
                    {
                        color: "#70df8c",

                        fillColor: "#27d27e",

                        fillOpacity: 0.22,

                        weight: 2
                    }
                );


                polygon.bindPopup(
                    `<strong>${escapeDashboardHTML(
                        property.name || "Propriedade"
                    )}</strong><br>` +
                    `Área: ${formatDashboardArea(property.area)}`
                );


                polygon.addTo(dashboardPropertiesLayer);


                validCoordinates.forEach(point => {

                    boundsPoints.push(point);

                });

                return;

            }

        }


        // =====================================
        // PROPERTY MARKER
        // =====================================

        const latitude = Number(property.latitude);

        const longitude = Number(property.longitude);


        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180
        ) {

            const marker = L.circleMarker(
                [latitude, longitude],
                {
                    radius: 8,

                    color: "#ffffff",

                    weight: 2,

                    fillColor: "#27d27e",

                    fillOpacity: 0.9
                }
            );


            marker.bindPopup(
                `<strong>${escapeDashboardHTML(
                    property.name || "Propriedade"
                )}</strong><br>` +
                `Área: ${formatDashboardArea(property.area)}`
            );


            marker.addTo(dashboardPropertiesLayer);


            boundsPoints.push([
                latitude,
                longitude
            ]);

        }

    });


    // =====================================
    // FIT MAP TO PROPERTIES
    // =====================================

    if (boundsPoints.length > 0) {

        const bounds = L.latLngBounds(boundsPoints);

        dashboardMap.fitBounds(
            bounds,
            {
                padding: [35, 35],

                maxZoom: 12,

                animate: true
            }
        );

    } else {

        dashboardMap.setView([0, 0], 2);

    }

}


// =====================================================
// 10. HTML ESCAPE
// =====================================================

function escapeDashboardHTML(value) {

    return String(value).replace(
        /[&<>"']/g,
        character => {

            const entities = {

                "&": "&amp;",

                "<": "&lt;",

                ">": "&gt;",

                '"': "&quot;",

                "'": "&#39;"

            };

            return entities[character];

        }
    );

}


// =====================================================
// 11. MOBILE SIDEBAR
// =====================================================

function initializeDashboardNavigation() {

    const sidebar = document.getElementById(
        "dashboard-sidebar"
    );

    const menuButton = document.getElementById(
        "mobile-menu-button"
    );

    if (!sidebar || !menuButton) return;


    // Abrir e fechar o menu
    menuButton.addEventListener("click", event => {

        event.stopPropagation();

        const isOpen = sidebar.classList.toggle("open");

        menuButton.classList.toggle("active", isOpen);

        menuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        menuButton.setAttribute(
            "aria-label",
            isOpen ? "Fechar menu" : "Abrir menu"
        );

    });


    // Fechar ao clicar fora da sidebar
    document.addEventListener("click", event => {

        if (
            !sidebar.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {

            closeDashboardSidebar();

        }

    });


    // Fechar ao selecionar uma página
    sidebar.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", () => {

            closeDashboardSidebar();

        });

    });


    // Fechar com a tecla Escape
    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            closeDashboardSidebar();

        }

    });


    function closeDashboardSidebar() {

        sidebar.classList.remove("open");

        menuButton.classList.remove("active");

        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );

        menuButton.setAttribute(
            "aria-label",
            "Abrir menu"
        );

    }


    // Garantir estado inicial fechado
    sidebar.classList.remove("open");

    menuButton.classList.remove("active");

    menuButton.setAttribute("aria-expanded", "false");

}


// =====================================================
// 12. NOTIFICATIONS
// =====================================================

function initializeDashboardNotifications() {

    const notificationButton = document.getElementById(
        "notification-button"
    );

    if (!notificationButton) return;


    notificationButton.addEventListener("click", () => {

        alert(
            "Não existem notificações disponíveis neste momento."
        );

    });

}


// =====================================================
// 13. MAP RESIZE
// =====================================================

window.addEventListener("resize", () => {

    if (!dashboardMap) return;

    dashboardMap.invalidateSize();

});


// =====================================================
// 14. STORAGE SYNCHRONIZATION
// =====================================================

window.addEventListener("storage", event => {

    if (
        event.key !== DASHBOARD_PROPERTIES_KEY &&
        event.key !== DASHBOARD_SETTINGS_KEY &&
        event.key !== null
    ) {
        return;

    }


    loadDashboardProperties();

    updateDashboardIndicators();

    renderDashboardProperties();

    renderDashboardMapProperties();

    updateDashboardDate();

});

// =====================================================
// 15. ACCESS MODE
// =====================================================

function initializeDashboardAccessMode() {

    const access = window.ACREVIEW_ACCESS;

    if (!access) {

        console.warn(
            "AcreView Access Mode não foi inicializado."
        );

        return;

    }

    document.body.dataset.accessMode = access.mode;

    if (access.isEvaluator) {

        document.body.classList.add("evaluator-mode");

        console.info(
            "AcreView iniciado em Modo Avaliador."
        );

    } else {

        document.body.classList.remove("evaluator-mode");

        console.info(
            "AcreView iniciado em Modo Agricultor."
        );

    }

}


// =====================================================
// 15. INITIALIZATION
// =====================================================

function initializeDashboard() {

    initializeDashboardAccessMode();

    loadDashboardProperties();

    initializeDashboardProfile();

    updateDashboardDate();

    updateDashboardIndicators();

    renderDashboardProperties();

    initializeDashboardMap();

    initializeDashboardNavigation();

    initializeDashboardNotifications();

}


document.addEventListener(
    "DOMContentLoaded",
    initializeDashboard
);