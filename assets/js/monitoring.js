// =========================================================
// ACREVIEW — ENVIRONMENTAL MONITORING
// Property Integration | Leaflet | Local Storage
// =========================================================


// =========================================================
// 1. CONFIGURATION
// =========================================================

const PROPERTY_STORAGE_KEY = "acreViewProperties";
const SETTINGS_STORAGE_KEY = "acreViewSettings";

let monitoringMap = null;
let monitoringProperties = [];
let propertyLayers = [];


// =========================================================
// 2. STORAGE
// =========================================================

function getStoredProperties() {
    try {
        const data = JSON.parse(
            localStorage.getItem(PROPERTY_STORAGE_KEY) || "[]"
        );

        return Array.isArray(data) ? data : [];

    } catch (error) {
        console.error("Erro ao carregar propriedades:", error);
        return [];
    }
}


function getStoredSettings() {
    try {
        const data = JSON.parse(
            localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"
        );

        return data && typeof data === "object" ? data : {};

    } catch (error) {
        console.error("Erro ao carregar configurações:", error);
        return {};
    }
}


// =========================================================
// 3. SAFE HTML
// =========================================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


// =========================================================
// 4. AREA FORMATTING
// =========================================================

function formatPropertyArea(area) {
    const settings = getStoredSettings();

    const unit = settings.unit || "ha";
    const hectares = Number(area);

    if (!Number.isFinite(hectares) || hectares < 0) {
        return "--";
    }

    let value = hectares;
    let suffix = "ha";

    if (unit === "m2") {
        value = hectares * 10000;
        suffix = "m²";
    }

    if (unit === "acre") {
        value = hectares * 2.4710538147;
        suffix = "ac";
    }

    return `${value.toLocaleString("pt-PT", {
        maximumFractionDigits: 2
    })} ${suffix}`;
}


// =========================================================
// 5. PROPERTY COORDINATES
// =========================================================

function getValidCoordinates(property) {
    if (!Array.isArray(property.coordinates)) {
        return [];
    }

    return property.coordinates
        .map(point => {
            if (!Array.isArray(point) || point.length < 2) {
                return null;
            }

            const latitude = Number(point[0]);
            const longitude = Number(point[1]);

            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude) ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
            ) {
                return null;
            }

            return [latitude, longitude];
        })
        .filter(Boolean);
}


function getValidPropertyLocation(property) {
    if (
        property.latitude === null ||
        property.latitude === undefined ||
        property.longitude === null ||
        property.longitude === undefined ||
        String(property.latitude).trim() === "" ||
        String(property.longitude).trim() === ""
    ) {
        return null;
    }

    const latitude = Number(property.latitude);
    const longitude = Number(property.longitude);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return [latitude, longitude];
}


// =========================================================
// 6. MAP INITIALIZATION
// =========================================================

function initializeMonitoringMap() {
    const mapElement = document.getElementById("monitoring-map");

    if (!mapElement || typeof L === "undefined") {
        console.error("Leaflet ou o elemento do mapa não está disponível.");
        return;
    }

    monitoringMap = L.map("monitoring-map", {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: true
    });

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19
        }
    ).addTo(monitoringMap);

    setTimeout(() => {
        monitoringMap.invalidateSize();
    }, 300);
}


// =========================================================
// 7. CLEAR MAP LAYERS
// =========================================================

function clearPropertyLayers() {
    propertyLayers.forEach(layer => {
        monitoringMap.removeLayer(layer);
    });

    propertyLayers = [];
}


// =========================================================
// 8. PROPERTY POPUP
// =========================================================

function createPropertyPopup(property) {
    const name = escapeHTML(property.name || "Propriedade");
    const location = escapeHTML(property.location || "Localização não indicada");

    return `
        <div class="monitoring-popup">

            <strong>${name}</strong>

            <p>${location}</p>

            <p>
                Área:
                ${escapeHTML(formatPropertyArea(property.area))}
            </p>

        </div>
    `;
}


// =========================================================
// 9. DRAW PROPERTY ON MAP
// =========================================================

function drawPropertyOnMap(property) {
    const coordinates = getValidCoordinates(property);

    const popup = createPropertyPopup(property);

    // Property with polygon coordinates
    if (coordinates.length >= 3) {

        const polygon = L.polygon(coordinates, {
            color: "#70df8c",
            weight: 2,
            opacity: 0.95,
            fillColor: "#70df8c",
            fillOpacity: 0.20
        }).addTo(monitoringMap);

        polygon.bindPopup(popup);

        propertyLayers.push(polygon);

        return polygon;
    }

    // Property with a geographic center
    const location = getValidPropertyLocation(property);

    if (location) {

        const marker = L.circleMarker(location, {
            radius: 8,
            color: "#a1ffb3",
            weight: 2,
            fillColor: "#70df8c",
            fillOpacity: 0.9
        }).addTo(monitoringMap);

        marker.bindPopup(popup);

        propertyLayers.push(marker);

        return marker;
    }

    return null;
}


// =========================================================
// 10. RENDER ALL PROPERTIES
// =========================================================

function renderPropertiesOnMap() {
    if (!monitoringMap) return;

    clearPropertyLayers();

    monitoringProperties.forEach(property => {
        drawPropertyOnMap(property);
    });

    if (propertyLayers.length > 0) {

        const group = L.featureGroup(propertyLayers);

        monitoringMap.fitBounds(group.getBounds(), {
            padding: [35, 35],
            maxZoom: 15
        });

    } else {

        monitoringMap.setView([0, 0], 2);
    }
}


// =========================================================
// 11. POPULATE PROPERTY SELECTOR
// =========================================================

function populatePropertySelector() {
    const selector = document.getElementById("monitoring-property");

    if (!selector) return;

    const previousValue = selector.value;

    selector.innerHTML = `
        <option value="">Selecionar propriedade</option>
    `;

    monitoringProperties.forEach((property, index) => {

        const option = document.createElement("option");

        option.value = String(index);

        option.textContent = property.name || `Propriedade ${index + 1}`;

        selector.appendChild(option);
    });

    if (
        previousValue !== "" &&
        Number(previousValue) >= 0 &&
        Number(previousValue) < monitoringProperties.length
    ) {
        selector.value = previousValue;
    }

    if (monitoringProperties.length === 0) {
        selector.innerHTML = `
            <option value="">Nenhuma propriedade encontrada</option>
        `;
    }
}


// =========================================================
// 12. SELECT PROPERTY
// =========================================================

function selectMonitoringProperty() {
    const selector = document.getElementById("monitoring-property");

    if (!selector || !monitoringMap) return;

    const selectedIndex = selector.value;

    if (selectedIndex === "") {
        renderPropertiesOnMap();
        updateDataStatus(false);
        return;
    }

    const property = monitoringProperties[Number(selectedIndex)];

    if (!property) return;

    const polygonCoordinates = getValidCoordinates(property);
    const location = getValidPropertyLocation(property);

    if (polygonCoordinates.length >= 3) {

        const bounds = L.latLngBounds(polygonCoordinates);

        monitoringMap.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 16
        });

    } else if (location) {

        monitoringMap.setView(location, 14);

    } else {

        updateDataStatus(false);

        return;
    }

    updateDataStatus(true, property);
}


// =========================================================
// 13. DATA STATUS
// =========================================================

function updateDataStatus(hasProperty, property = null) {
    const status = document.getElementById("monitoring-data-status");

    if (!status) return;

    if (!hasProperty) {

        status.innerHTML = `
            <div class="status-icon">
                <i class="fa-solid fa-satellite-dish"></i>
            </div>

            <div>
                <strong>A aguardar dados ambientais</strong>

                <p>
                    Selecione uma propriedade para consultar os dados
                    disponíveis. Os indicadores ambientais ainda não
                    estão ligados às fontes de dados.
                </p>
            </div>

            <span class="status-badge">
                <span></span>
                Sem dados
            </span>
        `;

        return;
    }

    status.innerHTML = `
        <div class="status-icon">
            <i class="fa-solid fa-location-dot"></i>
        </div>

        <div>
            <strong>${escapeHTML(property.name || "Propriedade selecionada")}</strong>

            <p>
                Propriedade selecionada. Os dados ambientais ainda
                aguardam integração com as fontes de observação da Terra.
            </p>
        </div>

        <span class="status-badge">
            <span></span>
            A aguardar dados
        </span>
    `;
}


// =========================================================
// 14. LOAD PROPERTIES
// =========================================================

function loadMonitoringProperties() {
    monitoringProperties = getStoredProperties();

    populatePropertySelector();

    renderPropertiesOnMap();

    updateDataStatus(false);
}


// =========================================================
// 15. PERIOD SELECTOR
// =========================================================

function initializePeriodSelector() {
    const selector = document.getElementById("monitoring-period");

    if (!selector) return;

    selector.addEventListener("change", () => {
        console.info(
            "Período selecionado:",
            selector.value,
            "dias"
        );

        // Será utilizado quando os dados históricos forem integrados.
    });
}


// =========================================================
// 16. MOBILE SIDEBAR
// =========================================================

function initializeMobileMenu() {
    const button = document.getElementById("mobile-menu-button");
    const sidebar = document.getElementById("monitoring-sidebar");

    if (!button || !sidebar) return;

    button.addEventListener("click", event => {
        event.stopPropagation();

        sidebar.classList.toggle("active");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 760 &&
            !sidebar.contains(event.target) &&
            !button.contains(event.target)
        ) {
            sidebar.classList.remove("active");
        }
    });

    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            sidebar.classList.remove("active");
        });
    });
}


// =========================================================
// 17. USER SETTINGS
// =========================================================

function initializeUserInformation() {
    const avatar = document.getElementById("monitoring-avatar");
    const userName = document.getElementById("monitoring-user-name");

    if (avatar) {
        avatar.textContent = "A";
    }

    if (userName) {
        userName.textContent = "Agricultor";
    }
}


// =========================================================
// 18. REFRESH BUTTON
// =========================================================

function initializeRefreshButton() {
    const button = document.getElementById("refresh-monitoring");

    if (!button) return;

    button.addEventListener("click", () => {

        button.disabled = true;

        const icon = button.querySelector("i");

        if (icon) {
            icon.classList.add("fa-spin");
        }

        loadMonitoringProperties();

        setTimeout(() => {

            button.disabled = false;

            if (icon) {
                icon.classList.remove("fa-spin");
            }

        }, 600);
    });
}


// =========================================================
// 19. STORAGE SYNCHRONIZATION
// =========================================================

window.addEventListener("storage", event => {

    if (
        event.key === PROPERTY_STORAGE_KEY ||
        event.key === null
    ) {
        loadMonitoringProperties();
    }

    if (
        event.key === SETTINGS_STORAGE_KEY ||
        event.key === null
    ) {
        renderPropertiesOnMap();
    }

});


// =========================================================
// 20. INITIALIZATION
// =========================================================

function initializeMonitoring() {

    initializeMonitoringMap();

    loadMonitoringProperties();

    initializeMobileMenu();

    initializeUserInformation();

    initializeRefreshButton();

    initializePeriodSelector();

    const selector = document.getElementById("monitoring-property");

    if (selector) {
        selector.addEventListener(
            "change",
            selectMonitoringProperty
        );
    }

    console.info("AcreView Monitoring inicializado.");
}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeMonitoring
    );

} else {

    initializeMonitoring();

}