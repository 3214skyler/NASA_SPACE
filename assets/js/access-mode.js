// =====================================================
// ACREVIEW — ACCESS MODE
// Farmer Access | Evaluator Access
// =====================================================

"use strict";

const ACREVIEW_ACCESS_MODE_KEY = "acreViewAccessMode";
const ACREVIEW_EVALUATOR_SESSION_KEY = "acreViewEvaluatorSession";

const evaluatorParameters = new URLSearchParams(
    window.location.search
);

const evaluatorRequested =
    evaluatorParameters.get("mode") === "evaluator";


// =====================================================
// 1. INITIALIZE ACCESS SESSION
// =====================================================

function initializeAcreViewAccess() {

    if (evaluatorRequested) {

        sessionStorage.setItem(
            ACREVIEW_ACCESS_MODE_KEY,
            "evaluator"
        );

        // Uma sessão própria para este navegador/aba.
        if (!sessionStorage.getItem(
            ACREVIEW_EVALUATOR_SESSION_KEY
        )) {

            const sessionId = crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            sessionStorage.setItem(
                ACREVIEW_EVALUATOR_SESSION_KEY,
                sessionId
            );

        }

    }

    const mode = sessionStorage.getItem(
        ACREVIEW_ACCESS_MODE_KEY
    );

    window.ACREVIEW_ACCESS = {

        mode: mode === "evaluator"
            ? "evaluator"
            : "farmer",

        isEvaluator: mode === "evaluator",

        isFarmer: mode !== "evaluator",

        sessionId: sessionStorage.getItem(
            ACREVIEW_EVALUATOR_SESSION_KEY
        )

    };

}


// =====================================================
// 2. ISOLATE EVALUATOR STORAGE
// =====================================================

function initializeAcreViewStorageIsolation() {

    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    const originalClear = Storage.prototype.clear;

    function getStorageKey(key) {

        const access = window.ACREVIEW_ACCESS;

        if (
            access &&
            access.isEvaluator &&
            String(key).startsWith("acreView")
        ) {

            return [
                "acreViewEvaluator",
                access.sessionId,
                key
            ].join("::");

        }

        return key;

    }


    Storage.prototype.getItem = function(key) {

        if (this === window.localStorage) {

            key = getStorageKey(key);

        }

        return originalGetItem.call(this, key);

    };


    Storage.prototype.setItem = function(key, value) {

        if (this === window.localStorage) {

            key = getStorageKey(key);

        }

        return originalSetItem.call(
            this,
            key,
            value
        );

    };


    Storage.prototype.removeItem = function(key) {

        if (this === window.localStorage) {

            key = getStorageKey(key);

        }

        return originalRemoveItem.call(
            this,
            key
        );

    };


    // Evita que um clear() apague os dados
    // de outras aplicações ou agricultores.

    Storage.prototype.clear = function() {

        if (this !== window.localStorage) {

            return originalClear.call(this);

        }

        const access = window.ACREVIEW_ACCESS;

        if (!access || !access.isEvaluator) {

            return originalClear.call(this);

        }

        const prefix = [
            "acreViewEvaluator",
            access.sessionId
        ].join("::") + "::";

        const keysToRemove = [];

        for (
            let index = 0;
            index < originalGetLength.call(this);
            index++
        ) {

            const key = originalKey.call(this, index);

            if (key && key.startsWith(prefix)) {

                keysToRemove.push(key);

            }

        }

        keysToRemove.forEach(key => {

            originalRemoveItem.call(this, key);

        });

    };

    const originalGetLength = Object.getOwnPropertyDescriptor(
        Storage.prototype,
        "length"
    ).get;

    const originalKey = Storage.prototype.key;

}


// =====================================================
// 3. START ACCESS SYSTEM
// =====================================================

initializeAcreViewAccess();

initializeAcreViewStorageIsolation();

console.info(
    "AcreView access mode:",
    window.ACREVIEW_ACCESS.mode
);