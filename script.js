const solarPanel = document.getElementById('solar-panel');
const car = document.getElementById('car');
const batteryLevel = document.getElementById('battery-level');
const winMessage = document.getElementById('win-message');
const loseMessage = document.getElementById('lose-message');
const gameContainer = document.getElementById('game-container');
const missedContainer = document.getElementById('missed-container');

let isDragging = false;
let battery = 0;
let missedRays = 0;
const MAX_MISSED_RAYS = 3;
let offsetX, offsetY;
let sunRays = [];
let gameIsOver = false;

// --- Audio Setup ---
let audioContext;
let chargeSoundBuffer;
let winSoundBuffer;
let catchSoundBuffer;
let chargeSoundSource;

function initAudio() {
    if (audioContext) return; // Initialize only once
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    loadSound('charge.mp3').then(buffer => chargeSoundBuffer = buffer);
    loadSound('win.mp3').then(buffer => winSoundBuffer = buffer);
    loadSound('catch.mp3').then(buffer => catchSoundBuffer = buffer);
}

async function loadSound(url) {
    if (!audioContext) return;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

function playSound(buffer, loop = false) {
    if (!audioContext || !buffer) return null;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.loop = loop;
    source.start();
    return source;
}

function stopSound(source) {
    if (source) {
        source.stop();
    }
}

// --- Drag and Drop Logic ---
function dragStart(e) {
    if (e.type === 'touchstart') {
        e.preventDefault();
    }
    initAudio();
    isDragging = true;
    solarPanel.style.cursor = 'grabbing';
    const clientX = e.clientX ?? e.touches[0].clientX;
    const clientY = e.clientY ?? e.touches[0].clientY;
    offsetX = clientX - solarPanel.getBoundingClientRect().left;
    offsetY = clientY - solarPanel.getBoundingClientRect().top;
}

function dragEnd(e) {
    isDragging = false;
    solarPanel.style.cursor = 'grab';
}

function dragMove(e) {
    if (!isDragging) return;
    if (e.type === 'touchmove') {
        e.preventDefault();
    }

    const clientX = e.clientX ?? e.touches[0].clientX;
    const clientY = e.clientY ?? e.touches[0].clientY;

    const containerRect = gameContainer.getBoundingClientRect();
    let x = clientX - containerRect.left - offsetX;
    let y = clientY - containerRect.top - offsetY;

    // Constrain within the game container
    x = Math.max(0, Math.min(x, containerRect.width - solarPanel.offsetWidth));
    y = Math.max(0, Math.min(y, containerRect.height - solarPanel.offsetHeight));

    solarPanel.style.left = `${x}px`;
    solarPanel.style.top = `${y}px`;
}

solarPanel.addEventListener('mousedown', dragStart);
solarPanel.addEventListener('touchstart', dragStart, { passive: false });

document.addEventListener('mouseup', dragEnd);
document.addEventListener('touchend', dragEnd);

document.addEventListener('mousemove', dragMove);
document.addEventListener('touchmove', dragMove, { passive: false });

// --- Sun Ray Logic ---
function createSunRay() {
    if (gameIsOver) return;

    const ray = document.createElement('div');
    const containerWidth = gameContainer.offsetWidth;
    const rayWidth = 30; // Average width for positioning
    
    // Define ray types and their properties
    const rayTypes = [
        { class: 'ray-weak', power: 3 },
        { class: 'ray-medium', power: 5 },
        { class: 'ray-strong', power: 8 }
    ];
    const type = rayTypes[Math.floor(Math.random() * rayTypes.length)];

    ray.className = `sun-ray ${type.class}`;
    
    // Rays originate from top-center area
    const spawnAreaWidth = containerWidth * 0.6;
    const randomX = (containerWidth - spawnAreaWidth) / 2 + Math.random() * spawnAreaWidth;
    
    ray.style.left = `${randomX - rayWidth / 2}px`;
    ray.style.top = `60px`; // Start just below the sun in the background

    gameContainer.appendChild(ray);
    sunRays.push({
        element: ray,
        y: 60,
        power: type.power
    });
}

function updateLivesUI() {
    const lifeElements = missedContainer.querySelectorAll('.life');
    lifeElements.forEach((life, index) => {
        if (index < missedRays) {
            life.classList.add('lost');
        } else {
            life.classList.remove('lost');
        }
    });
}

function handleLoss() {
    gameIsOver = true;
    loseMessage.classList.remove('hidden');
    
    // Stop creating rays
    if (rayInterval) clearInterval(rayInterval);
    rayInterval = null;

    setTimeout(() => {
        // Reset game state
        battery = 0;
        missedRays = 0;
        gameIsOver = false;

        // Clear UI
        loseMessage.classList.add('hidden');
        winMessage.classList.add('hidden');
        winMessage.classList.remove('won');
        updateLivesUI();

        // Remove all existing sun rays
        sunRays.forEach(ray => gameContainer.removeChild(ray.element));
        sunRays = [];
        
        // Restart game logic
        startGame();

    }, 3000); // 3-second delay before restart
}

// --- Game Loop ---
function gameLoop() {
    if (gameIsOver) {
        requestAnimationFrame(gameLoop);
        return;
    }

    if (battery >= 100) {
        if (!winMessage.classList.contains('won')) {
            winMessage.classList.remove('hidden');
            winMessage.classList.add('won');
            stopSound(chargeSoundSource);
            chargeSoundSource = null;
            playSound(winSoundBuffer);
            gameIsOver = true;
            // Stop creating rays
            if (rayInterval) clearInterval(rayInterval);
            rayInterval = null;
        }
        requestAnimationFrame(gameLoop);
        return;
    }

    const panelRect = solarPanel.getBoundingClientRect();
    const carRect = car.getBoundingClientRect();
    const containerRect = gameContainer.getBoundingClientRect();

    // Move and check sun rays
    for (let i = sunRays.length - 1; i >= 0; i--) {
        const ray = sunRays[i];
        ray.y += 4; // speed of ray
        ray.element.style.top = `${ray.y}px`;

        // Collision detection with solar panel
        const rayRect = ray.element.getBoundingClientRect();
        if (
            rayRect.left < panelRect.right &&
            rayRect.right > panelRect.left &&
            rayRect.top < panelRect.bottom &&
            rayRect.bottom > panelRect.top
        ) {
            // Ray caught
            playSound(catchSoundBuffer);
            battery += ray.power; // Increase battery based on ray power
            battery = Math.min(battery, 100);

            // Remove ray
            gameContainer.removeChild(ray.element);
            sunRays.splice(i, 1);
            continue; // continue to next ray
        }

        // Remove rays that go off-screen
        if (rayRect.top > containerRect.height) {
            gameContainer.removeChild(ray.element);
            sunRays.splice(i, 1);

            // Handle missed ray
            missedRays++;
            updateLivesUI();
            if (missedRays >= MAX_MISSED_RAYS) {
                handleLoss();
            }
        }
    }

    // Calculate distance between panel and car
    const dx = (panelRect.left + panelRect.width / 2) - (carRect.left + carRect.width / 2);
    const dy = (panelRect.top + panelRect.height / 2) - (carRect.top + carRect.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if panel is close to the car to enable charging sound
    const isCloseToCar = distance < 250;

    if (isCloseToCar) {
        if (!chargeSoundSource) {
            chargeSoundSource = playSound(chargeSoundBuffer, true);
        }
    } else {
        if (chargeSoundSource) {
            stopSound(chargeSoundSource);
            chargeSoundSource = null;
        }
    }
    
    batteryLevel.style.width = `${battery}%`;

    requestAnimationFrame(gameLoop);
}

// Start the game
let rayInterval;
function startGame() {
    if (rayInterval) clearInterval(rayInterval);
    rayInterval = setInterval(createSunRay, 1000); // Faster ray creation
    if (!gameIsOver) {
        gameLoop();
    }
}

startGame();