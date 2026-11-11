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

    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;

    selectLocation(latitude, longitude);

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

layerButtons.forEach(button => {

    button.addEventListener("click", function () {

        const selectedLayer = this.dataset.layer;

        if (selectedLayer === "satellite") {

            map.removeLayer(currentLayer);

            currentLayer = satelliteLayer;
            satelliteLayer.addTo(map);

        } else {

            map.removeLayer(currentLayer);

            currentLayer = standardLayer;
            standardLayer.addTo(map);

        }

        layerButtons.forEach(item => {
            item.classList.remove("active");

            const check = item.querySelector(".layer-check");

            if (check) {
                check.textContent = "○";
            }
        });

        this.classList.add("active");

        const selectedCheck = this.querySelector(".layer-check");

        if (selectedCheck) {
            selectedCheck.textContent = "●";
        }

    });

});


// =====================================
// CURRENT USER LOCATION
// =====================================

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

            selectLocation(latitude, longitude, 12);

        },

        function (error) {

            console.error(error);

            showMessage(
                "Não foi possível obter a localização. Verifica as permissões do navegador."
            );

        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }

    );

}


// =====================================
// INITIALIZATION
// =====================================

// A localização só é solicitada depois de o utilizador
// pedir explicitamente a sua localização.

map.invalidateSize();