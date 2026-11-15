// ==============================
// ELEMENTOS DO DOM
// ==============================

const loginTab = document.getElementById("show-login");
const registerTab = document.getElementById("show-register");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const authMessage = document.getElementById("auth-message");


// ==============================
// ALTERNAR ENTRE LOGIN E REGISTO
// ==============================

function showLogin() {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    authMessage.textContent = "";
}


function showRegister() {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");

    registerTab.classList.add("active");
    loginTab.classList.remove("active");

    authMessage.textContent = "";
}


// Eventos dos botões

loginTab.addEventListener("click", showLogin);
registerTab.addEventListener("click", showRegister);


// ==============================
// LOGIN
// ==============================

loginForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
        showMessage("Preenche todos os campos.", "error");
        return;
    }

    showMessage(
        "Formulário validado. A autenticação será ligada ao backend posteriormente.",
        "success"
    );

});


// ==============================
// CRIAR CONTA
// ==============================

registerForm.addEventListener("submit", function (event) {

    event.preventDefault();

    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();

    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    const acceptTerms = document.getElementById("accept-terms").checked;


    if (!name || !email || !password || !confirmPassword) {
        showMessage("Preenche todos os campos.", "error");
        return;
    }

    if (password.length < 8) {
        showMessage(
            "A palavra-passe deve ter pelo menos 8 caracteres.",
            "error"
        );
        return;
    }

    if (password !== confirmPassword) {
        showMessage(
            "As palavras-passe não coincidem.",
            "error"
        );
        return;
    }

    if (!acceptTerms) {
        showMessage(
            "Tens de aceitar os termos de utilização.",
            "error"
        );
        return;
    }

    showMessage(
        "Formulário validado. O registo será ligado ao backend posteriormente.",
        "success"
    );

});


// ==============================
// MENSAGENS
// ==============================

function showMessage(message, type) {

    authMessage.textContent = message;

    if (type === "error") {
        authMessage.style.color = "#f87171";
    } else {
        authMessage.style.color = "#4ade80";
    }

}

// ==============================
// MOSTRAR / OCULTAR PALAVRA-PASSE
// ==============================


document.querySelectorAll(".toggle-password").forEach(button => {

    button.addEventListener("click", function () {

        const input = document.getElementById(this.dataset.target);

        const isHidden = input.type === "password";

        input.type = isHidden ? "text" : "password";

        this.setAttribute("aria-pressed", String(isHidden));

        this.setAttribute(
            "aria-label",
            isHidden ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
        );

        this.innerHTML = isHidden
            ? `<svg class="eye-icon" viewBox="0 0 24 24" fill="none">
                <path d="M3 3L21 21"/>
                <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4"/>
                <path d="M9.9 5.2A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-4 4.5"/>
                <path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3-.5"/>
            </svg>`
            : `<svg class="eye-icon" viewBox="0 0 24 24" fill="none">
                <path d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>
                <circle cx="12" cy="12" r="3"/>
            </svg>`;

    });

});