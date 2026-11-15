// =========================================================
// ACREVIEW — API CLIENT
// Comunicação entre o frontend e o backend FastAPI
// =========================================================

(function () {
    "use strict";

    const API_BASE_URL = "http://127.0.0.1:8000";


    // =====================================================
    // 1. HTTP REQUEST
    // =====================================================

    async function request(endpoint, options = {}) {

        let response;

        try {

            response = await fetch(`${API_BASE_URL}${endpoint}`, {

                method: options.method || "GET",

                headers: {
                    "Accept": "application/json",

                    ...(options.body ? {
                        "Content-Type": "application/json"
                    } : {}),

                    ...options.headers
                },

                body: options.body
                    ? JSON.stringify(options.body)
                    : undefined,

                signal: options.signal,
                cache: "no-store"

            });

        } catch (error) {

            if (error.name === "AbortError") {
                throw error;
            }

            throw new Error(
                "Não foi possível contactar o backend AcreView. " +
                "Confirma se o servidor FastAPI está ligado."
            );

        }

        if (!response.ok) {

            let detail = `Erro HTTP ${response.status}`;

            try {

                const data = await response.json();

                detail = data.detail || detail;

            } catch (_) {
                // Mantém a mensagem HTTP original.
            }

            throw new Error(detail);
        }

        return response.json();
    }


    // =====================================================
    // 2. ENVIRONMENTAL DATA
    // =====================================================

    async function fetchEnvironmentalData(
        latitude,
        longitude,
        options = {}
    ) {

        const lat = Number(latitude);
        const lon = Number(longitude);

        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon) ||
            lat < -90 ||
            lat > 90 ||
            lon < -180 ||
            lon > 180
        ) {

            throw new Error(
                "As coordenadas da propriedade são inválidas."
            );
        }

        const params = new URLSearchParams({
            latitude: String(lat),
            longitude: String(lon)
        });

        return request(
            `/api/environmental-data?${params.toString()}`,
            options
        );
    }


    // =====================================================
    // 3. INDIVIDUAL DATA SOURCE
    // =====================================================

    async function fetchSource(
        source,
        latitude,
        longitude,
        options = {}
    ) {

        const allowedSources = [
            "nasa_power",
            "smap",
            "gpm",
            "vegetation",
            "gaez"
        ];

        if (!allowedSources.includes(source)) {

            throw new Error(
                "Fonte de dados desconhecida."
            );
        }

        const params = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude)
        });

        return request(
            `/api/environmental-data/${source}?${params.toString()}`,
            options
        );
    }


    // =====================================================
    // 4. DATA SOURCES STATUS
    // =====================================================

    async function fetchSourcesStatus(options = {}) {

        return request(
            "/api/sources/status",
            options
        );
    }


    // =====================================================
    // 5. AGRICULTURAL ANALYSIS
    // =====================================================

    async function analyzeFarm(farmData, options = {}) {

        if (!farmData || typeof farmData !== "object") {

            throw new Error(
                "Os dados da propriedade são inválidos."
            );
        }

        const latitude = Number(farmData.latitude);
        const longitude = Number(farmData.longitude);

        if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {

            throw new Error(
                "As coordenadas da propriedade são inválidas."
            );
        }

        if (
            typeof farmData.priority !== "string" ||
            !farmData.priority.trim()
        ) {

            throw new Error(
                "Indica a prioridade agrícola antes de iniciar a análise."
            );
        }

        const payload = {

            ...farmData,

            latitude,
            longitude,

            priority: farmData.priority.trim()

        };

        return request("/api/analyze", {

            ...options,

            method: "POST",

            body: payload

        });
    }


    // =====================================================
    // 6. PUBLIC API
    // =====================================================

    window.AcreViewAPI = Object.freeze({

        baseURL: API_BASE_URL,

        request,

        fetchEnvironmentalData,

        fetchSource,

        fetchSourcesStatus,

        analyzeFarm

    });


    console.info(
        "AcreView API Client inicializado."
    );

})();