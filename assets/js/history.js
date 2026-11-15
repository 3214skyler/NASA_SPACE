/* =========================================================
   ACREVIEW — AGRICULTURAL HISTORY
   Timeline | LocalStorage | Filters | Statistics
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // 1. STORAGE CONFIGURATION
    // =====================================================

    const STORAGE = {
        properties: "acreViewProperties",
        plans: "acreViewPlans",
        history: "acreViewHistory",
        settings: "acreViewSettings"
    };


    // =====================================================
    // 2. DOM ELEMENTS
    // =====================================================

    const elements = {
        sidebar: document.getElementById("history-sidebar"),
        mobileMenu: document.getElementById("mobile-menu-button"),

        userName: document.getElementById("history-user-name"),
        avatar: document.getElementById("history-avatar"),

        totalRecords: document.getElementById("total-records"),
        agriculturalRecords: document.getElementById("agricultural-records"),
        planningRecords: document.getElementById("planning-records"),
        totalProperties: document.getElementById("history-properties"),

        search: document.getElementById("history-search"),
        property: document.getElementById("history-property"),
        type: document.getElementById("history-type"),
        period: document.getElementById("history-period"),

        resetFilters: document.getElementById("reset-filters"),

        timeline: document.getElementById("history-timeline"),
        empty: document.getElementById("history-empty"),
        noResults: document.getElementById("history-no-results"),

        visibleRecords: document.getElementById("visible-records")
    };


    // =====================================================
    // 3. DATA
    // =====================================================

    let properties = [];
    let plans = [];
    let manualRecords = [];
    let allRecords = [];


    // =====================================================
    // 4. LOCAL STORAGE
    // =====================================================

    function readStorage(key, fallback = []) {

        try {
            const data = localStorage.getItem(key);

            if (!data) {
                return fallback;
            }

            const parsed = JSON.parse(data);

            return parsed ?? fallback;

        } catch (error) {

            console.error(
                `Erro ao ler ${key}:`,
                error
            );

            return fallback;
        }
    }


    function loadData() {

        properties = readStorage(STORAGE.properties, []);
        plans = readStorage(STORAGE.plans, []);
        manualRecords = readStorage(STORAGE.history, []);

        if (!Array.isArray(properties)) properties = [];
        if (!Array.isArray(plans)) plans = [];
        if (!Array.isArray(manualRecords)) manualRecords = [];

    }


    // =====================================================
    // 5. USER INFORMATION
    // =====================================================

    function loadUserInformation() {

        const settings = readStorage(
            STORAGE.settings,
            {}
        );

        const userName =
            localStorage.getItem("acreViewUserName") ||
            settings.userName ||
            "Agricultor";

        elements.userName.textContent = userName;

        elements.avatar.textContent =
            userName.trim().charAt(0).toUpperCase() || "A";

    }


    // =====================================================
    // 6. PROPERTY HELPERS
    // =====================================================

    function getPropertyName(propertyId) {

        const property = properties.find(
            item => String(item.id) === String(propertyId)
        );

        return property
            ? property.name
            : "Propriedade não identificada";

    }


    function renderPropertyOptions() {

        const selectedValue = elements.property.value || "all";

        elements.property.innerHTML = `
            <option value="all">Todas as propriedades</option>
        `;

        properties.forEach(property => {

            if (property.id === undefined || property.id === null) {
                return;
            }

            const option = document.createElement("option");

            option.value = String(property.id);
            option.textContent = property.name || "Propriedade sem nome";

            elements.property.appendChild(option);

        });

        const exists = Array.from(elements.property.options).some(
            option => option.value === selectedValue
        );

        elements.property.value = exists
            ? selectedValue
            : "all";

    }


    // =====================================================
    // 7. DATE HELPERS
    // =====================================================

    function getValidDate(value) {

        if (!value) {
            return null;
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;

    }


    function formatDate(date) {

        return new Intl.DateTimeFormat("pt-PT", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);

    }


    function formatTime(date) {

        return new Intl.DateTimeFormat("pt-PT", {
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);

    }


    function getDateGroupLabel(date) {

        const today = new Date();

        const yesterday = new Date();

        yesterday.setDate(today.getDate() - 1);

        const sameDay = (first, second) => {

            return (
                first.getDate() === second.getDate() &&
                first.getMonth() === second.getMonth() &&
                first.getFullYear() === second.getFullYear()
            );

        };

        if (sameDay(date, today)) {
            return "Hoje";
        }

        if (sameDay(date, yesterday)) {
            return "Ontem";
        }

        return formatDate(date);

    }


    // =====================================================
    // 8. BUILD HISTORY RECORDS
    // =====================================================

    function buildHistoryRecords() {

        const records = [];


        // -------------------------------------------------
        // 8.1 MANUAL RECORDS
        // -------------------------------------------------

        manualRecords.forEach(record => {

            if (!record || !record.date || !record.type) {
                return;
            }

            const date = getValidDate(record.date);

            if (!date) {
                return;
            }

            const allowedTypes = [
                "agriculture",
                "planning",
                "environment",
                "system"
            ];

            if (!allowedTypes.includes(record.type)) {
                return;
            }

            records.push({
                id: record.id || `manual-${date.getTime()}`,
                type: record.type,
                title: record.title || "Registo sem título",
                description: record.description || "Sem descrição disponível.",
                propertyId: record.propertyId ?? null,
                date,
                metadata: Array.isArray(record.metadata)
                    ? record.metadata
                    : []
            });

        });


        // -------------------------------------------------
        // 8.2 AGRICULTURAL PLANS
        // -------------------------------------------------

        plans.forEach(plan => {

            if (!plan || !plan.createdAt) {
                return;
            }

            const date = getValidDate(plan.createdAt);

            if (!date) {
                return;
            }

            const crops = Array.isArray(plan.crops)
                ? plan.crops
                : [];

            const rotations = Array.isArray(plan.rotation)
                ? plan.rotation
                : [];

            const propertyName = getPropertyName(plan.propertyId);

            const metadata = [];

            metadata.push({
                icon: "fa-seedling",
                label: `${crops.length} culturas`
            });

            metadata.push({
                icon: "fa-arrows-rotate",
                label: `${rotations.length} rotações`
            });

            records.push({

                id: `plan-${plan.id || date.getTime()}`,

                type: "planning",

                title: plan.name || "Plano agrícola criado",

                description:
                    `Foi criado um plano agrícola para a propriedade ${propertyName}.`,

                propertyId: plan.propertyId ?? null,

                date,

                metadata

            });

        });


        // -------------------------------------------------
        // 8.3 PROPERTIES WITH AVAILABLE CREATION DATES
        // -------------------------------------------------

        properties.forEach(property => {

            if (!property || !property.createdAt) {
                return;
            }

            const date = getValidDate(property.createdAt);

            if (!date) {
                return;
            }

            records.push({

                id: `property-${property.id || date.getTime()}`,

                type: "agriculture",

                title: "Propriedade registada",

                description:
                    `A propriedade ${property.name || "sem nome"} foi adicionada ao AcreView.`,

                propertyId: property.id ?? null,

                date,

                metadata: [
                    {
                        icon: "fa-ruler-combined",
                        label: `${Number(property.area || 0).toLocaleString("pt-PT")} ha`
                    }
                ]

            });

        });


        // -------------------------------------------------
        // 8.4 SORT CHRONOLOGICALLY
        // -------------------------------------------------

        records.sort((a, b) => {
            return b.date.getTime() - a.date.getTime();
        });

        allRecords = records;

    }


    // =====================================================
    // 9. STATISTICS
    // =====================================================

    function updateStatistics() {

        const agriculturalCount = allRecords.filter(
            record => record.type === "agriculture"
        ).length;

        const planningCount = allRecords.filter(
            record => record.type === "planning"
        ).length;

        elements.totalRecords.textContent =
            allRecords.length.toLocaleString("pt-PT");

        elements.agriculturalRecords.textContent =
            agriculturalCount.toLocaleString("pt-PT");

        elements.planningRecords.textContent =
            plans.length.toLocaleString("pt-PT");

        elements.totalProperties.textContent =
            properties.length.toLocaleString("pt-PT");

    }


    // =====================================================
    // 10. FILTER RECORDS
    // =====================================================

    function filterRecords() {

        const searchTerm = elements.search.value
            .trim()
            .toLowerCase();

        const selectedProperty = elements.property.value;
        const selectedType = elements.type.value;
        const selectedPeriod = elements.period.value;

        const now = new Date();

        return allRecords.filter(record => {

            // SEARCH
            const searchableText = [
                record.title,
                record.description,
                getPropertyName(record.propertyId)
            ].join(" ").toLowerCase();

            if (
                searchTerm &&
                !searchableText.includes(searchTerm)
            ) {
                return false;
            }


            // PROPERTY
            if (
                selectedProperty !== "all" &&
                String(record.propertyId) !== selectedProperty
            ) {
                return false;
            }


            // TYPE
            if (
                selectedType !== "all" &&
                record.type !== selectedType
            ) {
                return false;
            }


            // PERIOD
            if (selectedPeriod !== "all") {

                const days = Number(selectedPeriod);

                const startDate = new Date(now);

                startDate.setDate(
                    startDate.getDate() - days
                );

                if (
                    record.date < startDate ||
                    record.date > now
                ) {
                    return false;
                }

            }

            return true;

        });

    }


    // =====================================================
    // 11. RECORD ICONS
    // =====================================================

    function getRecordIcon(type) {

        const icons = {
            agriculture: "fa-seedling",
            planning: "fa-calendar-check",
            environment: "fa-earth-americas",
            system: "fa-gear"
        };

        return icons[type] || "fa-clock";

    }


    function getRecordTypeLabel(type) {

        const labels = {
            agriculture: "Agricultura",
            planning: "Planeamento",
            environment: "Ambiente",
            system: "Sistema"
        };

        return labels[type] || "Atividade";

    }


    // =====================================================
    // 12. CREATE TIMELINE CARD
    // =====================================================

    function createTimelineCard(record, index) {

        const card = document.createElement("article");

        card.className = "timeline-card";

        card.style.animationDelay = `${Math.min(index * 0.05, 0.4)}s`;


        const icon = document.createElement("div");

        icon.className = `timeline-card-icon ${record.type}`;

        const iconElement = document.createElement("i");

        iconElement.className = `fa-solid ${getRecordIcon(record.type)}`;

        icon.appendChild(iconElement);


        const content = document.createElement("div");

        content.className = "timeline-card-content";


        const top = document.createElement("div");

        top.className = "timeline-card-top";


        const title = document.createElement("h3");

        title.textContent = record.title;


        const time = document.createElement("time");

        time.dateTime = record.date.toISOString();

        time.textContent = formatTime(record.date);


        top.append(title, time);


        const description = document.createElement("p");

        description.textContent = record.description;


        const metadata = document.createElement("div");

        metadata.className = "timeline-card-meta";


        // PROPERTY TAG

        const propertyTag = document.createElement("span");

        propertyTag.className = "timeline-tag";

        const propertyIcon = document.createElement("i");

        propertyIcon.className = "fa-solid fa-location-dot";

        const propertyText = document.createElement("span");

        propertyText.textContent = getPropertyName(record.propertyId);

        propertyTag.append(propertyIcon, propertyText);


        // TYPE TAG

        const typeTag = document.createElement("span");

        typeTag.className = "timeline-tag";

        const typeIcon = document.createElement("i");

        typeIcon.className = `fa-solid ${getRecordIcon(record.type)}`;

        const typeText = document.createElement("span");

        typeText.textContent = getRecordTypeLabel(record.type);

        typeTag.append(typeIcon, typeText);


        metadata.append(propertyTag, typeTag);


        // EXTRA METADATA

        record.metadata.forEach(item => {

            const tag = document.createElement("span");

            tag.className = "timeline-tag";

            const itemIcon = document.createElement("i");

            itemIcon.className = `fa-solid ${item.icon || "fa-circle-info"}`;

            const itemText = document.createElement("span");

            itemText.textContent = item.label || "";

            tag.append(itemIcon, itemText);

            metadata.appendChild(tag);

        });


        content.append(
            top,
            description,
            metadata
        );

        card.append(icon, content);

        return card;

    }


    // =====================================================
    // 13. RENDER TIMELINE
    // =====================================================

    function renderTimeline() {

        const filteredRecords = filterRecords();

        elements.timeline.innerHTML = "";

        elements.visibleRecords.textContent =
            `${filteredRecords.length} registos`;


        // No records at all

        if (allRecords.length === 0) {

            elements.empty.classList.remove("hidden");
            elements.noResults.classList.add("hidden");

            return;
        }

        elements.empty.classList.add("hidden");


        // No filter results

        if (filteredRecords.length === 0) {

            elements.noResults.classList.remove("hidden");

            return;
        }

        elements.noResults.classList.add("hidden");


        // GROUP BY DATE

        const groups = new Map();

        filteredRecords.forEach(record => {

            const key = record.date.toLocaleDateString("en-CA");

            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(record);

        });


        // RENDER GROUPS

        let index = 0;

        groups.forEach(records => {

            const group = document.createElement("div");

            group.className = "timeline-date-group";


            const heading = document.createElement("div");

            heading.className = "timeline-date-label";


            const dateLabel = document.createElement("span");

            dateLabel.textContent = getDateGroupLabel(
                records[0].date
            );

            heading.appendChild(dateLabel);

            group.appendChild(heading);


            records.forEach(record => {

                group.appendChild(
                    createTimelineCard(record, index)
                );

                index++;

            });

            elements.timeline.appendChild(group);

        });

    }


    // =====================================================
    // 14. RESET FILTERS
    // =====================================================

    function resetFilters() {

        elements.search.value = "";
        elements.property.value = "all";
        elements.type.value = "all";
        elements.period.value = "all";

        renderTimeline();

    }


    // =====================================================
    // 15. REFRESH APPLICATION
    // =====================================================

    function refreshHistory() {

        loadData();

        renderPropertyOptions();

        buildHistoryRecords();

        updateStatistics();

        renderTimeline();

    }


    // =====================================================
    // 16. EVENT LISTENERS
    // =====================================================

    elements.search.addEventListener("input", renderTimeline);

    elements.property.addEventListener("change", renderTimeline);

    elements.type.addEventListener("change", renderTimeline);

    elements.period.addEventListener("change", renderTimeline);

    elements.resetFilters.addEventListener("click", resetFilters);


    // MOBILE MENU

    elements.mobileMenu.addEventListener("click", () => {

        elements.sidebar.classList.toggle("active");

    });


    // CLOSE MENU WHEN CLICKING OUTSIDE

    document.addEventListener("click", event => {

        if (
            window.innerWidth <= 768 &&
            elements.sidebar.classList.contains("active") &&
            !elements.sidebar.contains(event.target) &&
            !elements.mobileMenu.contains(event.target)
        ) {

            elements.sidebar.classList.remove("active");

        }

    });


    // =====================================================
    // 17. STORAGE SYNCHRONIZATION
    // =====================================================

    window.addEventListener("storage", event => {

        const relevantKeys = [
            STORAGE.properties,
            STORAGE.plans,
            STORAGE.history,
            STORAGE.settings,
            "acreViewUserName"
        ];

        if (
            event.key === null ||
            relevantKeys.includes(event.key)
        ) {

            refreshHistory();

            loadUserInformation();

        }

    });


    // =====================================================
    // 18. PUBLIC HISTORY API
    // =====================================================

    /*
       Future pages can register real activities with:

       AcreViewHistory.add({
           type: "agriculture",
           title: "Plantação de milho",
           description: "Plantação registada pelo agricultor.",
           propertyId: "property-id"
       });

       Allowed types:
       agriculture
       planning
       environment
       system
    */

    window.AcreViewHistory = {

        add(record) {

            const allowedTypes = [
                "agriculture",
                "planning",
                "environment",
                "system"
            ];

            if (
                !record ||
                !allowedTypes.includes(record.type) ||
                !record.title
            ) {

                console.error(
                    "Registo inválido para o histórico."
                );

                return false;

            }

            const records = readStorage(
                STORAGE.history,
                []
            );

            records.push({

                id: crypto.randomUUID
                    ? crypto.randomUUID()
                    : String(Date.now()),

                type: record.type,

                title: record.title,

                description: record.description || "",

                propertyId: record.propertyId ?? null,

                date: new Date().toISOString(),

                metadata: Array.isArray(record.metadata)
                    ? record.metadata
                    : []

            });

            localStorage.setItem(
                STORAGE.history,
                JSON.stringify(records)
            );

            refreshHistory();

            return true;

        }

    };


    // =====================================================
    // 19. INITIALIZATION
    // =====================================================

    loadUserInformation();

    refreshHistory();

});