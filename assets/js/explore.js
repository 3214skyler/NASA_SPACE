// =====================================
// ACREVIEW — MAP CONFIGURATION
// =====================================

const map = L.map("map", {
    center: [0, 0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18,
    zoomControl: true,
    worldCopyJump: true
});


// =====================================
// MAP LAYERS
// =====================================

const standardLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }
);

const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
        maxNativeZoom: 17,
        keepBuffer: 4
    }
);

const vegetationOverlay = L.tileLayer.wms(
    "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi",
    {
        layers: "MODIS_Terra_NDVI_8Day",
        format: "image/png",
        transparent: true,
        version: "1.1.1",
        opacity: 0.65,
        attribution: "NASA GIBS / MODIS Terra"
    }
);

standardLayer.addTo(map);

let currentLayer = standardLayer;


// =====================================
// DOM ELEMENTS
// =====================================

const modal = document.getElementById("location-modal");

const closeModalButton = document.getElementById(
    "close-location-modal"
);

const secondaryCloseButton = document.getElementById(
    "close-modal-secondary"
);

const locationName = document.getElementById("location-name");
const locationDescription = document.getElementById("location-description");

const locationCountry = document.getElementById("location-country");
const locationRegion = document.getElementById("location-region");

const locationLatitude = document.getElementById("location-latitude");
const locationLongitude = document.getElementById("location-longitude");

const searchInput = document.getElementById("location-search");
const searchButton = document.getElementById("search-button");

const latitudeInput = document.getElementById("latitude-input");
const longitudeInput = document.getElementById("longitude-input");

const coordinatesButton = document.getElementById("coordinates-button");

const messageElement = document.getElementById("explore-message");

const propertyModal = document.getElementById("property-modal");

const propertyPointsCount = document.getElementById(
    "property-points-count"
);

function resetToolbarPosition() {
    propertyCard.style.left = "";
    propertyCard.style.top = "";
    propertyCard.style.right = "";
}

// =====================================
// FLOATING TOOLBAR — DRAG
// =====================================

const propertyCard = document.querySelector(
    "#property-modal .tool-modal-card"
);

const dragHandle = document.getElementById(
    "property-drag-handle"
);

let isDraggingToolbar = false;

let dragOffsetX = 0;
let dragOffsetY = 0;

dragHandle.addEventListener("pointerdown", function (event) {

    isDraggingToolbar = true;

    const rect = propertyCard.getBoundingClientRect();

    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    // Converter a posição inicial para coordenadas fixas
    propertyCard.style.left = `${rect.left}px`;
    propertyCard.style.top = `${rect.top}px`;

    propertyCard.style.right = "auto";

    dragHandle.setPointerCapture(event.pointerId);

});

dragHandle.addEventListener("pointermove", function (event) {

    if (!isDraggingToolbar) return;

    const cardWidth = propertyCard.offsetWidth;
    const cardHeight = propertyCard.offsetHeight;

    let newLeft = event.clientX - dragOffsetX;
    let newTop = event.clientY - dragOffsetY;

    // Impedir que a barra desapareça fora do ecrã
    newLeft = Math.max(
        0,
        Math.min(newLeft, window.innerWidth - cardWidth)
    );

    newTop = Math.max(
        0,
        Math.min(newTop, window.innerHeight - cardHeight)
    );

    propertyCard.style.left = `${newLeft}px`;
    propertyCard.style.top = `${newTop}px`;

});

function stopToolbarDragging() {
    isDraggingToolbar = false;
}

dragHandle.addEventListener(
    "pointerup",
    stopToolbarDragging
);

dragHandle.addEventListener(
    "pointercancel",
    stopToolbarDragging
);


// =====================================
// PROPERTY DRAWING
// =====================================

let isDrawingProperty = false;
let propertyPoints = [];
let propertyPreview = null;
let propertyMarkers = [];

// Camada que mantém todas as propriedades guardadas no mapa
const savedPropertiesLayer = L.layerGroup().addTo(map);

const PROPERTIES_STORAGE_KEY = "acreViewProperties";

const startDrawingButton = document.getElementById("start-drawing");
const finishDrawingButton = document.getElementById("finish-drawing");
const cancelDrawingButton = document.getElementById("cancel-drawing");

const propertyNameInput = document.getElementById("property-name");
const propertyAreaDisplay = document.getElementById("property-area");

// =====================================
// MAP MARKER
// =====================================

let selectedMarker = null;

function updateMarker(latitude, longitude) {

    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }

    selectedMarker = L.circleMarker(
        [latitude, longitude],
        {
            radius: 9,
            color: "#4ade80",
            weight: 2,
            fillColor: "#22c55e",
            fillOpacity: 0.8
        }
    ).addTo(map);

}


// =====================================
// MODAL
// =====================================

function openModal() {

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

}

function closeModal() {

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";

}

closeModalButton.addEventListener("click", closeModal);
secondaryCloseButton.addEventListener("click", closeModal);


// Fechar ao clicar fora do cartão

modal.querySelector(".modal-backdrop").addEventListener(
    "click",
    closeModal
);


// Fechar com Escape

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape" && modal.classList.contains("active")) {
        closeModal();
    }

});


// =====================================
// SYSTEM MESSAGES
// =====================================

let messageTimeout;

function showMessage(message) {

    messageElement.textContent = message;
    messageElement.classList.add("active");

    clearTimeout(messageTimeout);

    messageTimeout = setTimeout(function () {
        messageElement.classList.remove("active");
    }, 3500);

}


// =====================================
// REVERSE GEOCODING
// =====================================

async function identifyLocation(latitude, longitude) {

    locationName.textContent = "A identificar...";
    locationDescription.textContent =
        "A procurar informações geográficas desta região.";

    locationCountry.textContent = "A carregar...";
    locationRegion.textContent = "A carregar...";

    locationLatitude.textContent = latitude.toFixed(5);
    locationLongitude.textContent = longitude.toFixed(5);

    openModal();

    const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`;

    try {

        const response = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Não foi possível identificar a localização.");
        }

        const data = await response.json();

        const address = data.address || {};

        const country = address.country || "Não identificado";

        const region =
            address.state ||
            address.province ||
            address.region ||
            address.county ||
            "Não identificado";

        const locality =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.hamlet ||
            address.suburb ||
            address.county ||
            country;

        locationName.textContent = locality;
        locationCountry.textContent = country;
        locationRegion.textContent = region;

        locationDescription.textContent =
            data.display_name ||
            "Informações geográficas disponíveis para esta localização.";

    } catch (error) {

        console.error(error);

        locationName.textContent = "Localização selecionada";
        locationCountry.textContent = "Indisponível";
        locationRegion.textContent = "Indisponível";

        locationDescription.textContent =
            "Não foi possível obter o nome deste local. As coordenadas continuam disponíveis.";

        showMessage("Não foi possível identificar o nome do local.");

    }

}


// =====================================
// SELECT LOCATION
// =====================================

function selectLocation(latitude, longitude, zoom = 10) {

    map.flyTo(
        [latitude, longitude],
        zoom,
        {
            animate: true,
            duration: 1.5
        }
    );

    updateMarker(latitude, longitude);

    identifyLocation(latitude, longitude);

}


// =====================================
// MAP CLICK
// =====================================

map.on("click", function (event) {

    // Se estiver a desenhar uma propriedade
    if (isDrawingProperty) {
        addPropertyPoint(event.latlng);
        return;
    }

    // Funcionamento normal do mapa
    selectLocation(
        event.latlng.lat,
        event.latlng.lng
    );

});


// =====================================
// SEARCH BY NAME
// =====================================

async function searchLocation() {

    const query = searchInput.value.trim();

    if (!query) {
        showMessage("Introduz uma localização para pesquisar.");
        return;
    }

    searchButton.disabled = true;
    searchButton.textContent = "...";

    try {

        const url =
            `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;

        const response = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Erro na pesquisa.");
        }

        const results = await response.json();

        if (results.length === 0) {
            showMessage("Não encontramos essa localização.");
            return;
        }

        const result = results[0];

        const latitude = Number(result.lat);
        const longitude = Number(result.lon);

        selectLocation(latitude, longitude, 10);

    } catch (error) {

        console.error(error);
        showMessage("Não foi possível realizar a pesquisa.");

    } finally {

        searchButton.disabled = false;
        searchButton.textContent = "→";

    }

}

searchButton.addEventListener("click", searchLocation);

searchInput.addEventListener("keydown", function (event) {

    if (event.key === "Enter") {
        searchLocation();
    }

});


// =====================================
// SEARCH BY COORDINATES
// =====================================

function searchCoordinates() {

    const latitude = Number(latitudeInput.value);
    const longitude = Number(longitudeInput.value);

    if (
        latitudeInput.value.trim() === "" ||
        longitudeInput.value.trim() === ""
    ) {
        showMessage("Preenche a latitude e a longitude.");
        return;
    }

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        showMessage("As coordenadas introduzidas são inválidas.");
        return;
    }

    selectLocation(latitude, longitude, 10);

}

coordinatesButton.addEventListener("click", searchCoordinates);


// =====================================
// CHANGE MAP LAYER
// =====================================

const layerButtons = document.querySelectorAll(".layer-option");

const baseLayers = {
    standard: standardLayer,
    satellite: satelliteLayer
};

layerButtons.forEach(button => {

    button.addEventListener("click", function () {

        const selectedLayer = this.dataset.layer;
        const ndviControls = document.getElementById("ndvi-controls");

        // NASA: ativar ou desativar a sobreposição
        if (selectedLayer === "nasa") {

            if (map.hasLayer(vegetationOverlay)) {
                map.removeLayer(vegetationOverlay);
                this.classList.remove("active");
                this.querySelector(".layer-check").textContent = "○";
                ndviControls?.classList.remove("visible");
            } else {
                vegetationOverlay.addTo(map);
                this.classList.add("active");
                this.querySelector(".layer-check").textContent = "●";
                ndviControls?.classList.add("visible");
            }

            return;
        }

        // Mudar o mapa de fundo
        const newLayer = baseLayers[selectedLayer];

        if (!newLayer) return;

        if (map.hasLayer(currentLayer)) {
            map.removeLayer(currentLayer);
        }

        currentLayer = newLayer;
        currentLayer.addTo(map);

        // Atualizar seleção dos mapas de fundo
        layerButtons.forEach(item => {

            if (item.dataset.layer === "nasa") return;

            item.classList.remove("active");

            const check = item.querySelector(".layer-check");

            if (check) {
                check.textContent = "○";
            }
        });

        this.classList.add("active");
        this.querySelector(".layer-check").textContent = "●";

    });

});


// =====================================
// CURRENT USER LOCATION
// =====================================

let userLocationMarker = null;
let userLocationCircle = null;

function locateUser() {

    if (!navigator.geolocation) {
        showMessage("O teu navegador não suporta geolocalização.");
        return;
    }

    showMessage("A obter a tua localização...");

    navigator.geolocation.getCurrentPosition(

        function (position) {

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            const userPosition = [latitude, longitude];

            // Atualizar a posição no mapa
            selectLocation(latitude, longitude, 15);

            // Remover marcador anterior
            if (userLocationMarker) {
                map.removeLayer(userLocationMarker);
            }

            if (userLocationCircle) {
                map.removeLayer(userLocationCircle);
            }

            // Criar marcador da localização atual
            userLocationMarker = L.marker(userPosition)
                .addTo(map)
                .bindPopup("A tua localização atual");

            // Criar círculo de precisão
            userLocationCircle = L.circle(userPosition, {
                radius: position.coords.accuracy,
                color: "#27d27e",
                fillColor: "#27d27e",
                fillOpacity: 0.15,
                weight: 2
            }).addTo(map);

            userLocationMarker.openPopup();

            showMessage("A tua localização foi encontrada.");

        },

        function (error) {

            console.error(error);

            showMessage(
                "Não foi possível obter a localização. Verifica as permissões do navegador."
            );

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }

    );

}
document
    .getElementById("locate-me-button")
    .addEventListener("click", locateUser);


// =====================================
// INITIALIZATION
// =====================================

// A localização só é solicitada depois de o utilizador
// pedir explicitamente a sua localização.

map.invalidateSize();

// =====================================
// PROPERTY DRAWING FUNCTIONS
// =====================================

function addPropertyPoint(latlng) {

    propertyPoints.push(latlng);

    propertyPointsCount.textContent = propertyPoints.length;

    if (propertyPoints.length >= 3) {
    const area = calculatePropertyArea(propertyPoints);

    propertyAreaDisplay.textContent =
        `${area.toFixed(2)} ha`;
    }

    const marker = L.circleMarker(latlng, {
        radius: 5,
        color: "#ffffff",
        fillColor: "#27d27e",
        fillOpacity: 1,
        weight: 2
    }).addTo(map);

    propertyMarkers.push(marker);

    if (propertyPreview) {
        map.removeLayer(propertyPreview);
    }

    propertyPreview = L.polyline(propertyPoints, {
        color: "#27d27e",
        weight: 3,
        dashArray: "6, 8"
    }).addTo(map);

    showMessage(
        `${propertyPoints.length} pontos adicionados.`
    );
}


function startPropertyDrawing() {

    if (isDrawingProperty) return;

    const name = propertyNameInput.value.trim();

    if (!name) {
        showMessage("Introduz o nome da propriedade.");
        propertyNameInput.focus();
        return;
    }

    clearPropertyDrawing();

    isDrawingProperty = true;

    propertyModal.classList.add("is-drawing");

    startDrawingButton.disabled = true;
    finishDrawingButton.disabled = false;
    cancelDrawingButton.disabled = false;

    map.getContainer().style.cursor = "crosshair";

    showMessage("Clica no mapa para marcar os limites da propriedade.");
}


function calculatePropertyArea(points) {

    const earthRadius = 6378137;
    let area = 0;

    for (let i = 0; i < points.length; i++) {

        const current = points[i];
        const next = points[(i + 1) % points.length];

        const lat1 = current.lat * Math.PI / 180;
        const lat2 = next.lat * Math.PI / 180;

        const lon1 = current.lng * Math.PI / 180;
        const lon2 = next.lng * Math.PI / 180;

        area += (lon2 - lon1) *
            (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    area = Math.abs(area * earthRadius * earthRadius / 2);

    return area / 10000;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function saveDrawnProperty(name, area, points) {
    let properties = [];

    try {
        properties = JSON.parse(
            localStorage.getItem(PROPERTIES_STORAGE_KEY) || "[]"
        );

        if (!Array.isArray(properties)) {
            properties = [];
        }
    } catch (error) {
        console.error("Erro ao carregar propriedades:", error);
    }

    const polygon = L.polygon(points);
    const center = polygon.getBounds().getCenter();

    const property = {
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),

        name: name,
        location: `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
        latitude: center.lat,
        longitude: center.lng,
        area: area,
        soil: "Desconhecido",
        irrigation: "Outro",
        crops: "",

        // Coordenadas dos limites desenhados
        coordinates: points.map(point => [
            point.lat,
            point.lng
        ])
    };

    properties.push(property);

    try {
        localStorage.setItem(
            PROPERTIES_STORAGE_KEY,
            JSON.stringify(properties)
        );

        return property;
    } catch (error) {
        console.error("Erro ao guardar propriedade:", error);
        showMessage("Não foi possível guardar a propriedade.");
        return null;
    }
}

function finishPropertyDrawing() {

    if (propertyPoints.length < 3) {
        showMessage("Precisas de pelo menos 3 pontos para concluir.");
        return;
    }

    const name = propertyNameInput.value.trim();

    if (!name) {
        showMessage("Introduz o nome da propriedade.");
        return;
    }

    const area = calculatePropertyArea(propertyPoints);

    const confirmation = confirm(
        `Guardar a propriedade "${name}" com uma área de aproximadamente ${area.toFixed(2)} hectares?`
    );

    if (!confirmation) {
        return;
    }

    const property = saveDrawnProperty(
        name,
        area,
        propertyPoints
    );

    if (!property) return;

    const polygon = L.polygon(propertyPoints, {
        color: "#27d27e",
        fillColor: "#27d27e",
        fillOpacity: 0.2,
        weight: 3
    }).addTo(savedPropertiesLayer);

    polygon.bindPopup(
        `<strong>${escapeHTML(property.name)}</strong><br>` +
        `Área: ${area.toFixed(2)} hectares`
    );

    propertyAreaDisplay.textContent =
        `${area.toLocaleString("pt-PT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} ha`;

    stopPropertyDrawing();

    propertyPoints = [];

    propertyPointsCount.textContent = "0";

    showMessage("Propriedade guardada com sucesso!");
}


function stopPropertyDrawing() {

    isDrawingProperty = false;

    propertyModal.classList.remove("is-drawing");

    resetToolbarPosition();

    startDrawingButton.disabled = false;
    finishDrawingButton.disabled = true;
    cancelDrawingButton.disabled = true;

    map.getContainer().style.cursor = "";

    if (propertyPreview) {
        map.removeLayer(propertyPreview);
        propertyPreview = null;
    }

    propertyMarkers.forEach(marker => map.removeLayer(marker));
    propertyMarkers = [];
}


function clearPropertyDrawing() {

    propertyPointsCount.textContent = "0";

    propertyPoints = [];

    if (propertyPreview) {
        map.removeLayer(propertyPreview);
        propertyPreview = null;
    }

    propertyMarkers.forEach(marker => map.removeLayer(marker));
    propertyMarkers = [];

    propertyAreaDisplay.textContent = "0,00 ha";
}


function cancelPropertyDrawing() {

    clearPropertyDrawing();

    isDrawingProperty = false;

    propertyModal.classList.remove("is-drawing");
    resetToolbarPosition();

    startDrawingButton.disabled = false;
    finishDrawingButton.disabled = true;
    cancelDrawingButton.disabled = true;

    map.getContainer().style.cursor = "";

    showMessage("Desenho cancelado.");
}

startDrawingButton.addEventListener(
    "click",
    startPropertyDrawing
);

finishDrawingButton.addEventListener(
    "click",
    finishPropertyDrawing
);

cancelDrawingButton.addEventListener(
    "click",
    cancelPropertyDrawing
);

// Controlo de transparência NDVI

const ndviOpacity = document.getElementById("ndvi-opacity");
const opacityValue = document.getElementById("opacity-value");

if (ndviOpacity && opacityValue) {

    ndviOpacity.addEventListener("input", function () {

        const opacity = Number(this.value) / 100;

        vegetationOverlay.setOpacity(opacity);

        opacityValue.textContent = `${this.value}%`;

    });

}

// =====================================
// TOOL MODALS — ABRIR E FECHAR
// =====================================

const modalButtons = document.querySelectorAll(".sidebar-menu-button");
const toolModals = document.querySelectorAll(".tool-modal");

// Abrir o modal correspondente
modalButtons.forEach(button => {
    button.addEventListener("click", function () {
        const modalId = this.dataset.modal;
        const modal = document.getElementById(modalId);

        if (!modal) return;

        
        // Fecha qualquer outro modal aberto
        toolModals.forEach(item => {

            if (item.id === "property-modal" && isDrawingProperty) {
                cancelPropertyDrawing();
            }

            item.classList.remove("active");
        });

        modal.classList.add("active");
    });
});

// Fechar ao clicar no botão X ou no fundo
document.querySelectorAll("[data-close-modal]").forEach(element => {
    element.addEventListener("click", function () {
        const modal = this.closest(".tool-modal");

        if (!modal) return;

        if (modal.id === "property-modal" && isDrawingProperty) {
            cancelPropertyDrawing();
        }

        modal.classList.remove("active");
    });
});

// Fechar com a tecla ESC
document.addEventListener("keydown", function (event) {

    if (event.key !== "Escape") return;

    toolModals.forEach(modal => {

        if (modal.id === "property-modal" && isDrawingProperty) {
            cancelPropertyDrawing();
        }

        modal.classList.remove("active");

    });

});
// =====================================
// TUTORIAL INTERATIVO DO ACREVIEW
// =====================================

const tutorialSteps = [
    {
        icon: "🌍",
        title: "Explora o planeta",
        description: "Conhece o mapa global do AcreView.",
        text: "Podes navegar pelo mapa utilizando o rato ou os dedos. Aproxima para observar uma região e afasta para teres uma visão mais ampla do planeta."
    },
    {
        icon: "🔎",
        title: "Pesquisa localizações",
        description: "Encontra qualquer lugar do mundo.",
        text: "Abre a ferramenta Exploração. Pesquisa pelo nome de um país, cidade ou região. Também podes introduzir diretamente as coordenadas geográficas."
    },
    {
        icon: "📍",
        title: "Encontra a tua localização",
        description: "Descobre onde estás no mapa.",
        text: "Utiliza a opção de localização atual para posicionar o mapa onde te encontras. O navegador poderá pedir autorização para aceder à tua localização."
    },
    {
        icon: "🌱",
        title: "Delimita uma propriedade",
        description: "Desenha os limites da tua propriedade agrícola.",
        text: "Abre Propriedade agrícola, introduz um nome e inicia o desenho. Clica em vários pontos do mapa para definir os limites. Precisas de pelo menos três pontos para concluir e calcular uma área aproximada."
    },
    {
        icon: "🛰️",
        title: "Explora as camadas do mapa",
        description: "Observa diferentes tipos de informação.",
        text: "Na Visualização do mapa podes alternar entre o mapa normal, imagens de satélite e a camada NDVI. O NDVI indica a atividade da vegetação, mas não mede diretamente a fertilidade do solo."
    },
    {
        icon: "🌾",
        title: "Estás pronto para começar!",
        description: "Utiliza o AcreView para explorar territórios.",
        text: "Já conheces as ferramentas principais. Podes pesquisar regiões, delimitar propriedades e consultar as camadas disponíveis. Os relatórios agrícolas e as recomendações serão desenvolvidos nas próximas etapas do projeto."
    }
];

const tutorialModal = document.getElementById("tutorial-modal");
const tutorialTrigger = document.getElementById("start-tutorial");

const tutorialTitle = document.getElementById("tutorial-title");
const tutorialDescription = document.getElementById("tutorial-description");
const tutorialIcon = document.getElementById("tutorial-icon");
const tutorialHeading = document.getElementById("tutorial-heading");
const tutorialText = document.getElementById("tutorial-text");

const tutorialProgress = document.getElementById("tutorial-progress-fill");
const tutorialStepNumber = document.getElementById("tutorial-step-number");

const tutorialPrev = document.getElementById("tutorial-prev");
const tutorialNext = document.getElementById("tutorial-next");
const tutorialSkip = document.getElementById("tutorial-skip");

let currentTutorialStep = 0;

function showTutorialStep() {
    const step = tutorialSteps[currentTutorialStep];
    // Remover destaques anteriores
document.querySelectorAll(".tutorial-highlight")
    .forEach(element => {
        element.classList.remove("tutorial-highlight");
    });

// Identificar o elemento a destacar
const targets = {
    0: '[data-tutorial-target="map"]',
    1: '[data-tutorial-target="exploration"]',
    2: '[data-tutorial-target="location"]',
    3: '[data-tutorial-target="property"]',
    4: '[data-tutorial-target="layers"]'
};

const targetSelector = targets[currentTutorialStep];

if (targetSelector) {
    const target = document.querySelector(targetSelector);

    if (target) {
        target.classList.add("tutorial-highlight");
        target.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }
}

    tutorialTitle.textContent = step.title;
    tutorialDescription.textContent = step.description;
    tutorialIcon.textContent = step.icon;
    tutorialHeading.textContent = step.title;
    tutorialText.textContent = step.text;

    tutorialStepNumber.textContent =
        `Etapa ${currentTutorialStep + 1} de ${tutorialSteps.length}`;

    const progress =
        ((currentTutorialStep + 1) / tutorialSteps.length) * 100;

    tutorialProgress.style.width = `${progress}%`;

    tutorialPrev.disabled = currentTutorialStep === 0;

    tutorialNext.textContent =
        currentTutorialStep === tutorialSteps.length - 1
            ? "Concluir ✓"
            : "Seguinte →";
}

function startTutorial() {
    currentTutorialStep = 0;
    showTutorialStep();
    tutorialModal.classList.add("active");
}

function closeTutorial() {
    tutorialModal.classList.remove("active");

    document.querySelectorAll(".tutorial-highlight")
        .forEach(element => {
            element.classList.remove("tutorial-highlight");
        });
}

tutorialTrigger.addEventListener("click", startTutorial);

tutorialNext.addEventListener("click", function () {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        showTutorialStep();
    } else {
        closeTutorial();
    }
});

tutorialPrev.addEventListener("click", function () {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        showTutorialStep();
    }
});

tutorialSkip.addEventListener("click", closeTutorial);

function loadSavedProperties() {

    savedPropertiesLayer.clearLayers();

    let properties = [];

    try {
        properties = JSON.parse(
            localStorage.getItem(PROPERTIES_STORAGE_KEY) || "[]"
        );
    } catch (error) {
        console.error("Erro ao recuperar propriedades:", error);
        return;
    }

    if (!Array.isArray(properties)) return;

    properties.forEach(property => {

        if (
            !Array.isArray(property.coordinates) ||
            property.coordinates.length < 3
        ) {
            return;
        }

        const polygon = L.polygon(property.coordinates, {
            color: "#27d27e",
            fillColor: "#27d27e",
            fillOpacity: 0.2,
            weight: 3
        }).addTo(savedPropertiesLayer);

        polygon.bindPopup(
            `<strong>${escapeHTML(property.name)}</strong><br>` +
            `Área: ${Number(property.area).toFixed(2)} hectares`
        );
    });
}

loadSavedProperties();

// =====================================
// SINCRONIZAÇÃO DE PROPRIEDADES
// =====================================

window.addEventListener("storage", function (event) {

    if (
        event.key !== PROPERTIES_STORAGE_KEY &&
        event.key !== null
    ) {
        return;
    }

    // Atualizar os polígonos no mapa
    loadSavedProperties();

});