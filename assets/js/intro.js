import * as THREE from 'three';

// ========================================
// 1. ELEMENTOS HTML
// ========================================

const container = document.getElementById('globe-container');
const progressBar = document.getElementById('loading-progress');
const percentage = document.getElementById('loading-percentage');
const loadingText = document.getElementById('loading-text');
const introScreen = document.getElementById('intro-screen');

// ========================================
// 2. CONFIGURAÇÃO DA CENA 3D
// ========================================

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.z = 4.5;

// Renderizador
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.outputColorSpace = THREE.SRGBColorSpace;

container.appendChild(renderer.domElement);

// ========================================
// 3. ILUMINAÇÃO
// ========================================

const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(5, 3, 5);
scene.add(sunlight);

// ========================================
// 4. CRIAR O GLOBO TERRESTRE
// ========================================

const geometry = new THREE.SphereGeometry(1.2, 96, 96);

const textureLoader = new THREE.TextureLoader();

textureLoader.load(
    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',

    (texture) => {

        texture.colorSpace = THREE.SRGBColorSpace;

        const material = new THREE.MeshPhongMaterial({
            map: texture,
            shininess: 10
        });

        const globe = new THREE.Mesh(geometry, material);

        scene.add(globe);

        // Criar atmosfera
        const atmosphereGeometry = new THREE.SphereGeometry(1.24, 96, 96);

        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.12,
            side: THREE.BackSide
        });

        const atmosphere = new THREE.Mesh(
            atmosphereGeometry,
            atmosphereMaterial
        );

        scene.add(atmosphere);

        // Iniciar animações
        animate(globe, atmosphere);
        startLoading(globe, atmosphere);
    },

    undefined,

    () => {
        loadingText.textContent = 'ERRO AO CARREGAR O GLOBO';
        console.error('AcreView: Não foi possível carregar a textura terrestre.');
    }
);

// ========================================
// 5. CRIAR ESTRELAS
// ========================================

const starGeometry = new THREE.BufferGeometry();
const starPositions = [];

for (let i = 0; i < 1800; i++) {

    starPositions.push(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
    );
}

starGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(starPositions, 3)
);

const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.025
});

const stars = new THREE.Points(starGeometry, starMaterial);

scene.add(stars);

// ========================================
// 6. ANIMAÇÃO CONTÍNUA
// ========================================

function animate(globe, atmosphere) {

    function render() {

        requestAnimationFrame(render);

        // Rotação terrestre
        globe.rotation.y += 0.0015;
        atmosphere.rotation.y = globe.rotation.y;

        // Movimento subtil das estrelas
        stars.rotation.y += 0.00005;

        renderer.render(scene, camera);
    }

    render();
}

// ========================================
// 7. BARRA DE CARREGAMENTO
// ========================================

function startLoading(globe, atmosphere) {

    let progress = 0;

    const interval = setInterval(() => {

        progress += 1;

        progressBar.style.width = `${progress}%`;
        percentage.textContent = `${progress}%`;

        if (progress >= 100) {

            clearInterval(interval);

            loadingText.textContent = 'ENTRANDO NO PLANETA...';

            startZoom(globe, atmosphere);
        }

    }, 35);
}

// ========================================
// 8. APROXIMAÇÃO DO GLOBO
// ========================================

function startZoom(globe, atmosphere) {

    const duration = 2500;
    const startTime = performance.now();

    const initialCameraZ = camera.position.z;
    const targetCameraZ = 1.35;

    function zoom(time) {

        const elapsed = time - startTime;

        const progress = Math.min(elapsed / duration, 1);

        // Movimento suave
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        camera.position.z =
            initialCameraZ +
            (targetCameraZ - initialCameraZ) * easedProgress;

        globe.scale.setScalar(1 + easedProgress * 0.4);
        atmosphere.scale.copy(globe.scale);

        if (progress < 1) {

            requestAnimationFrame(zoom);

        } else {

    introScreen.classList.add('finished');

    // Esperar a animação de saída do Intro
    setTimeout(() => {

        const welcomeScreen = document.getElementById('welcome-screen');

        welcomeScreen.classList.add('active');

            }, 1500);
        }
    }

    requestAnimationFrame(zoom);
}

// ========================================
// 9. RESPONSIVIDADE
// ========================================

window.addEventListener('resize', () => {

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, 2)
    );
});