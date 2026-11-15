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

let environmentalRequestController = null;
let monitoringRequestId = 0;


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
// 12. SELECT PROPERTY AND FETCH ENVIRONMENTAL DATA
// =========================================================

async function selectMonitoringProperty() {
    const selector = document.getElementById("monitoring-property");

    if (!selector || !monitoringMap) return;

    const selectedIndex = selector.value;

    if (selectedIndex === "") {
        if (environmentalRequestController) {
            environmentalRequestController.abort();
        }

        monitoringRequestId++;

        renderPropertiesOnMap();
        resetEnvironmentalIndicators();
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
        resetEnvironmentalIndicators();

        updateDataStatus(
            false,
            null,
            "Esta propriedade não possui coordenadas geográficas válidas."
        );

        return;
    }

    await fetchPropertyEnvironmentalData(property);
}

// =========================================================
// 13. ENVIRONMENTAL DATA INTEGRATION
// =========================================================


function formatEnvironmentalValue(value, decimals = 1) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    const rounded = Number(number.toFixed(decimals));
    const normalized = Object.is(rounded, -0) ? 0 : rounded;

    return normalized.toLocaleString("pt-PT", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}


function setIndicator(elementId, value) {
    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = value;
    }
}


function resetEnvironmentalIndicators() {
    setIndicator("monitoring-temperature", "--");
    setIndicator("monitoring-rainfall", "--");
    setIndicator("monitoring-soil-moisture", "--");
    setIndicator("monitoring-ndvi", "--");

    resetMonitoringCharts();
}


function getAvailableSource(environmentalData, source) {
    const block = environmentalData?.[source];

    if (!block || block.status !== "ok" || !block.data) {
        return null;
    }

    return block.data;
}


function renderEnvironmentalAssessments(assessments) {
    const panel = document.getElementById("environmental-risks");

    if (!panel) return;

    const categories = [
        { key: "drought", title: "Avaliação de seca" },
        { key: "excess_precipitation", title: "Excesso de precipitação" },
        { key: "vegetation", title: "Alterações na vegetação" }
    ];

    if (!assessments) {
        panel.textContent = "Avaliação ambiental indisponível.";
        return;
    }

    panel.innerHTML = `
        <div class="risk-assessments">
            ${categories.map(category => {
                const result = assessments[category.key];

                if (!result) {
                    return `
                        <article class="risk-assessment-card">
                            <h3>${category.title}</h3>
                            <p>Dados de avaliação indisponíveis.</p>
                        </article>
                    `;
                }

                const assessed = result.status === "assessed";

                const evidence = (result.evidence || []).map(item => `
                    <li>
                        <strong>${escapeHTML(item.indicator)}:</strong>
                        ${escapeHTML(formatEnvironmentalValue(item.value, 2))}
                        ${escapeHTML(item.unit)}
                        <small>
                            ${escapeHTML(item.source)}
                            ${item.date ? ` — ${escapeHTML(item.date)}` : ""}
                        </small>
                    </li>
                `).join("");

                const limitations = (result.limitations || []).map(item => `
                    <li>${escapeHTML(item)}</li>
                `).join("");

                return `
                    <article class="risk-assessment-card">
                        <h3>${category.title}</h3>

                        <span class="risk-assessment-status">
                            ${assessed ? "Dados analisados" : "Dados insuficientes"}
                        </span>

                        <p>${escapeHTML(result.explanation)}</p>

                        <h4>Indicadores</h4>
                        <ul>${evidence || "<li>Sem indicadores disponíveis.</li>"}</ul>

                        <h4>Limitações</h4>
                        <ul>${limitations || "<li>Sem limitações registadas.</li>"}</ul>
                    </article>
                `;
            }).join("")}
        </div>
    `;
}


function updateEnvironmentalIndicators(response) {
    const data = response?.environmental_data;

    if (!data) {
        resetEnvironmentalIndicators();
        return;
    }

    // NASA POWER — Temperatura média
    const power = getAvailableSource(data, "nasa_power");

    const temperature = power?.variables?.T2M?.summary?.mean;

    setIndicator(
        "monitoring-temperature",
        temperature !== null && temperature !== undefined
            ? `${formatEnvironmentalValue(temperature)} °C`
            : "--"
    );

    // NASA GPM — Precipitação acumulada nos últimos 30 dias
    const gpm = getAvailableSource(data, "gpm");

    const rainfall = gpm?.summary?.total_last_30_days_mm;

    setIndicator(
        "monitoring-rainfall",
        rainfall !== null && rainfall !== undefined
            ? `${formatEnvironmentalValue(rainfall)} mm`
            : "--"
    );

    // NASA SMAP — Humidade do solo
    const smap = getAvailableSource(data, "smap");

    const latestSoilData = smap?.latest;

    let soilMoisture = null;

    if (latestSoilData) {
        if (latestSoilData.root_zone_soil_moisture !== null &&
            latestSoilData.root_zone_soil_moisture !== undefined) {

            soilMoisture = latestSoilData.root_zone_soil_moisture;

        } else if (
            latestSoilData.surface_soil_moisture !== null &&
            latestSoilData.surface_soil_moisture !== undefined
        ) {
            soilMoisture = latestSoilData.surface_soil_moisture;
        }
    }

    setIndicator(
        "monitoring-soil-moisture",
        soilMoisture !== null
            ? `${formatEnvironmentalValue(soilMoisture * 100)} %`
            : "--"
    );

    // LANDSAT — NDVI
    const vegetation = getAvailableSource(data, "vegetation");

    const ndvi = vegetation?.latest?.ndvi;

    setIndicator(
        "monitoring-ndvi",
        ndvi !== null && ndvi !== undefined
            ? formatEnvironmentalValue(ndvi, 3)
            : "--"
    );
    renderEnvironmentalCharts(response);
}


// =========================================================
// SOURCE STATUS
// =========================================================

function getSourceStatusLabel(status) {
    const labels = {
        ok: "Disponível",
        no_data: "Sem dados",
        credentials_required: "Credenciais necessárias",
        not_configured: "Não configurado",
        error: "Erro na consulta"
    };

    return labels[status] || "Estado desconhecido";
}


function updateDataStatus(
    hasProperty,
    property = null,
    customMessage = null,
    response = null
) {
    const status = document.getElementById("monitoring-data-status");

    if (!status) return;

    if (!hasProperty) {
        status.innerHTML = `
            <div class="status-icon">
                <i class="fa-solid fa-satellite-dish"></i>
            </div>

            <div>
                <strong>A aguardar propriedade</strong>
                <p>
                    Selecione uma propriedade para consultar
                    os dados ambientais disponíveis.
                </p>
            </div>

            <span class="status-badge">
                <span></span>
                Sem seleção
            </span>
        `;

        return;
    }

    if (customMessage) {
        status.innerHTML = `
            <div class="status-icon">
                <i class="fa-solid fa-circle-exclamation"></i>
            </div>

            <div>
                <strong>${escapeHTML(property?.name || "Propriedade")}</strong>
                <p>${escapeHTML(customMessage)}</p>
            </div>

            <span class="status-badge">
                <span></span>
                Indisponível
            </span>
        `;

        return;
    }

    const summary = response?.sources_summary || {};

    const available = Object.values(summary)
        .filter(value => value === "ok").length;

    const total = Object.keys(summary).length;

    const overallStatus = response?.status || "unavailable";

    const title = {
        success: "Dados ambientais disponíveis",
        partial: "Dados ambientais parciais",
        unavailable: "Dados ambientais indisponíveis"
    };

    const message = total > 0
        ? `${available} de ${total} fontes disponíveis. Os indicadores são apresentados conforme os dados efetivamente recebidos.`
        : "A consultar as fontes de observação da Terra.";

    const badge = {
        success: "Dados disponíveis",
        partial: "Dados parciais",
        unavailable: "Sem dados"
    };

    status.innerHTML = `
        <div class="status-icon">
            <i class="fa-solid fa-satellite-dish"></i>
        </div>

        <div>
            <strong>${escapeHTML(property?.name || "Propriedade")}</strong>

            <p>
                ${escapeHTML(title[overallStatus] || "Estado dos dados")}
                — ${escapeHTML(message)}
            </p>
        </div>

        <span class="status-badge">
            <span></span>
            ${escapeHTML(badge[overallStatus] || "Desconhecido")}
        </span>
    `;
}


// =========================================================
// FETCH ENVIRONMENTAL DATA
// =========================================================

async function fetchPropertyEnvironmentalData(property) {
    if (!window.AcreViewAPI) {
        updateDataStatus(
            true,
            property,
            "O cliente de comunicação com o backend não foi carregado."
        );

        return;
    }

    const location = getValidPropertyLocation(property);

    if (!location) {
        resetEnvironmentalIndicators();

        updateDataStatus(
            true,
            property,
            "Não foi possível encontrar as coordenadas desta propriedade."
        );

        return;
    }

    if (environmentalRequestController) {
        environmentalRequestController.abort();
    }

    environmentalRequestController = new AbortController();

    const controller = environmentalRequestController;
    const requestId = ++monitoringRequestId;

    resetEnvironmentalIndicators();

    updateDataStatus(
        true,
        property,
        "A consultar NASA POWER, SMAP, GPM e Landsat..."
    );

    try {
        const response = await window.AcreViewAPI.fetchEnvironmentalData(
            location[0],
            location[1],
            {
                signal: controller.signal
            }
        );

        if (requestId !== monitoringRequestId) return;

        updateEnvironmentalIndicators(response);
        renderEnvironmentalAssessments(response?.risk_assessments);
        updateDataStatus(
            true,
            property,
            null,
            response
        );

        console.info(
            "Dados ambientais recebidos:",
            response
        );

    } catch (error) {
        if (error.name === "AbortError") return;

        console.error(
            "Erro ao consultar dados ambientais:",
            error
        );

        if (requestId !== monitoringRequestId) return;

        resetEnvironmentalIndicators();

        updateDataStatus(
            true,
            property,
            error.message
        );
    }
}

// =========================================================
// ENVIRONMENTAL CHARTS
// =========================================================

const monitoringCharts = {};

let monitoringChartData = null;


// ---------------------------------------------------------
// CHART CONFIGURATION
// ---------------------------------------------------------

function destroyMonitoringCharts() {

    Object.values(monitoringCharts).forEach(chart => {
        chart.destroy();
    });

    Object.keys(monitoringCharts).forEach(key => {
        delete monitoringCharts[key];
    });
}


// ---------------------------------------------------------
// CHART EMPTY STATE
// ---------------------------------------------------------

function setChartMessage(elementId, message) {

    const container = document.getElementById(elementId);

    if (!container) return;

    container.innerHTML = `
        <div class="chart-empty-state">
            <i class="fa-solid fa-chart-line"></i>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}


// ---------------------------------------------------------
// DATE FORMATTING
// ---------------------------------------------------------

function formatChartDate(date) {

    const parsed = new Date(`${date}T12:00:00`);

    if (Number.isNaN(parsed.getTime())) {
        return date;
    }

    return parsed.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short"
    });
}


// ---------------------------------------------------------
// FILTER TEMPORAL DATA
// ---------------------------------------------------------

function filterChartSeries(series, period) {

    if (!Array.isArray(series)) return [];

    const valid = series
        .filter(item => {
            return (
                item &&
                item.date &&
                Number.isFinite(Number(item.value))
            );
        })
        .sort((a, b) => a.date.localeCompare(b.date));

    if (valid.length === 0) return [];

    const latestDate = new Date(
        `${valid[valid.length - 1].date}T12:00:00`
    );

    const cutoff = new Date(latestDate);

    cutoff.setDate(cutoff.getDate() - Number(period) + 1);

    return valid.filter(item => {
        const date = new Date(`${item.date}T12:00:00`);

        return date >= cutoff && date <= latestDate;
    });
}


// ---------------------------------------------------------
// CREATE CHART
// ---------------------------------------------------------

function createMonitoringChart(
    elementId,
    chartType,
    series,
    label,
    unit,
    color
) {

    const container = document.getElementById(elementId);

    if (!container) return;

    const validSeries = series.filter(item =>
        item &&
        item.date &&
        Number.isFinite(Number(item.value))
    );

    if (validSeries.length === 0) {

        setChartMessage(
            elementId,
            "Não existem observações disponíveis para este período."
        );

        return;
    }

    container.innerHTML = `
        <div class="monitoring-chart-canvas">
            <canvas></canvas>
        </div>
    `;

    const canvas = container.querySelector("canvas");

    const context = canvas.getContext("2d");

    const chart = new Chart(context, {

        type: chartType,

        data: {

            labels: validSeries.map(item =>
                formatChartDate(item.date)
            ),

            datasets: [{

                label: label,

                data: validSeries.map(item =>
                    Number(item.value)
                ),

                borderColor: color,

                backgroundColor:
                    chartType === "bar"
                        ? `${color}99`
                        : `${color}20`,

                borderWidth: 2,

                tension: 0.35,

                fill: chartType === "line",

                pointRadius: 3,

                pointHoverRadius: 6,

                borderRadius: chartType === "bar" ? 4 : 0

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    callbacks: {

                        label: context => {
                            return `${label}: ${formatEnvironmentalValue(
                                context.parsed.y,
                                2
                            )} ${unit}`;
                        }

                    }

                }

            },

            scales: {

                x: {

                    grid: {
                        display: false
                    },

                    ticks: {
                        maxTicksLimit: 7,
                        color: "#9ca3af"
                    }

                },

                y: {

                    beginAtZero: chartType === "bar",

                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    },

                    ticks: {

                        color: "#9ca3af",

                        callback: value => `${value} ${unit}`

                    }

                }

            }

        }

    });

    monitoringCharts[elementId] = chart;
}


// ---------------------------------------------------------
// EXTRACT NASA POWER SERIES
// ---------------------------------------------------------

function getPowerSeries(power, variable) {

    const dates = power?.dates;

    const values = power?.variables?.[variable]?.values;

    if (
        !Array.isArray(dates) ||
        !Array.isArray(values) ||
        dates.length !== values.length
    ) {
        return [];
    }

    return dates.map((date, index) => ({
        date,
        value: values[index]
    }));
}


// ---------------------------------------------------------
// BUILD ENVIRONMENTAL CHARTS
// ---------------------------------------------------------

function renderEnvironmentalCharts(response) {

    if (typeof Chart === "undefined") {

        console.error("Chart.js não foi carregado.");

        return;
    }

    destroyMonitoringCharts();

    monitoringChartData = response?.environmental_data;

    if (!monitoringChartData) {

        resetMonitoringCharts();

        return;
    }

    const period = Number(
        document.getElementById("monitoring-period")?.value || 30
    );

    const data = monitoringChartData;

    // -----------------------------------------------------
    // TEMPERATURE — NASA POWER
    // -----------------------------------------------------

    const power = getAvailableSource(data, "nasa_power");

    const temperatureSeries = filterChartSeries(
        getPowerSeries(power, "T2M")
            .map(item => ({
                date: item.date,
                value: item.value
            })),
        period
    );

    createMonitoringChart(
        "temperature-chart",
        "line",
        temperatureSeries,
        "Temperatura",
        "°C",
        "#f59e0b"
    );


    // -----------------------------------------------------
    // RAINFALL — NASA GPM / POWER
    // -----------------------------------------------------

    const gpm = getAvailableSource(data, "gpm");

    let rainfallSeries = [];

    if (period <= 30) {

        rainfallSeries = (gpm?.series || []).map(item => ({
            date: item.date,
            value: item.precipitation_mm
        }));

    } else {

        rainfallSeries = getPowerSeries(
            power,
            "PRECTOTCORR"
        );
    }

    rainfallSeries = filterChartSeries(
        rainfallSeries,
        period
    );

    createMonitoringChart(
        "rainfall-chart",
        "bar",
        rainfallSeries,
        "Precipitação",
        "mm",
        "#38bdf8"
    );


    // -----------------------------------------------------
    // NDVI — LANDSAT
    // -----------------------------------------------------

    const vegetation = getAvailableSource(
        data,
        "vegetation"
    );

    const ndviSeries = filterChartSeries(

        (vegetation?.observations || []).map(item => ({
            date: item.date,
            value: item.ndvi
        })),

        period
    );

    createMonitoringChart(
        "ndvi-chart",
        "line",
        ndviSeries,
        "NDVI",
        "",
        "#4ade80"
    );


    // -----------------------------------------------------
    // SOIL MOISTURE — SMAP
    // -----------------------------------------------------

    const smap = getAvailableSource(data, "smap");

    const soilSeries = filterChartSeries(

        (smap?.series || []).map(item => ({
            date: item.observation_time_utc?.slice(0, 10),
            value:
                item.root_zone_soil_moisture !== null &&
                item.root_zone_soil_moisture !== undefined
                    ? item.root_zone_soil_moisture * 100
                    : null
        })),

        period
    );

    createMonitoringChart(
        "soil-chart",
        "line",
        soilSeries,
        "Humidade do solo",
        "%",
        "#60a5fa"
    );
}


// ---------------------------------------------------------
// RESET CHARTS
// ---------------------------------------------------------

function resetMonitoringCharts() {

    destroyMonitoringCharts();

    monitoringChartData = null;

    const charts = [
        "temperature-chart",
        "rainfall-chart",
        "ndvi-chart",
        "soil-chart"
    ];

    charts.forEach(id => {

        setChartMessage(
            id,
            "Selecione uma propriedade para consultar os dados."
        );

    });
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

    const selector = document.getElementById(
        "monitoring-period"
    );

    if (!selector) return;

    selector.addEventListener("change", () => {

        if (!monitoringChartData) return;

        renderEnvironmentalCharts({
            environmental_data: monitoringChartData
        });

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

    button.addEventListener("click", async () => {
        button.disabled = true;

        const icon = button.querySelector("i");

        if (icon) {
            icon.classList.add("fa-spin");
        }

        try {
            monitoringProperties = getStoredProperties();

            populatePropertySelector();

            renderPropertiesOnMap();

            const selector = document.getElementById("monitoring-property");

            if (selector && selector.value !== "") {
                await selectMonitoringProperty();
            } else {
                resetEnvironmentalIndicators();
                updateDataStatus(false);
            }

        } finally {
            button.disabled = false;

            if (icon) {
                icon.classList.remove("fa-spin");
            }
        }
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