const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Game Constants ---
const TARGET_FPS = 60;
const TIME_STEP = 1000 / TARGET_FPS; // ~16.6ms per frame intended

// Physics constants tuned for 60 FPS reference
const GRAVITY = 0.6;
const JUMP_FORCE = -11; 
const BASE_SPEED = 4;
const VIEWPORT_WIDTH = canvas.width;
const VIEWPORT_HEIGHT = canvas.height;

// Entity Dimensions (Base)
const BASE_PLAYER_WIDTH = 40;
const BASE_PLAYER_HEIGHT = 45; 

// --- Assets ---
const playerImage = new Image();
playerImage.src = 'character.png';

let assetsLoaded = false;
playerImage.onload = () => {
    assetsLoaded = true;
};

// --- Firebase Setup Placeholder ---
// TODO: User must replace this with their own Firebase Config
const firebaseConfig = {
    // apiKey: "YOUR_API_KEY",
    // authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    // projectId: "YOUR_PROJECT_ID",
    // storageBucket: "YOUR_PROJECT_ID.appspot.com",
    // messagingSenderId: "YOUR_SENDER_ID",
    // appId: "YOUR_APP_ID"
};

let db = null;
// Check if Firebase is loaded and config is present
if (typeof firebase !== 'undefined' && firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} else {
    console.log("Firebase not initialized. Using LocalStorage.");
}

// --- Game State ---
let gameState = 'playing'; 
let score = 0;
let phase = 1;
let cameraX = 0;
let frameCount = 0; // Still tracked for animation timing
let timeAccumulator = 0; // For survival score

// Player State
let player = {
    x: 50,
    y: 300,
    dx: 0,
    dy: 0,
    width: BASE_PLAYER_WIDTH,
    height: BASE_PLAYER_HEIGHT,
    grounded: false,
    facingRight: true,
    sizeMultiplier: 1.0,
    speedMultiplier: 1.0,
    combo: 0,
    canDoubleJump: false, 
    jumpCount: 0 
};

// World Entities
let platforms = [];
let enemies = []; 
let blocks = []; 
let hazards = []; 
let items = [];
let particles = []; 
let coins = []; 
let clouds = []; 

// Inputs
const keys = {
    up: false
};

// --- Difficulty Parameters ---
let currentSpeed = BASE_SPEED;
let obstacleFreq = 0.1;
let pitFreq = 0.1;

// --- Initialization ---
let nextChunkX = 500;

function initGame() {
    gameState = 'playing';
    score = 0;
    phase = 1;
    cameraX = 0;
    frameCount = 0;
    timeAccumulator = 0;
    nextChunkX = 500;
    
    player.x = 100;
    player.y = 300;
    player.dx = 0;
    player.dy = 0;
    player.facingRight = true;
    player.sizeMultiplier = 1.0;
    player.speedMultiplier = 1.0;
    player.combo = 0;
    player.width = BASE_PLAYER_WIDTH;
    player.height = BASE_PLAYER_HEIGHT;
    player.canDoubleJump = false;
    player.jumpCount = 0;

    currentSpeed = BASE_SPEED;
    obstacleFreq = 0.1;
    pitFreq = 0.1;

    updateScoreUI();
    hideGameOverScreen();

    platforms = [];
    platforms.push({ x: -100, y: 550, width: 600, height: 90, type: 'ground' });

    enemies = [];
    blocks = [];
    hazards = [];
    items = [];
    particles = [];
    coins = [];
    clouds = [];
    
    for(let i=0; i<5; i++) {
        spawnCloud(Math.random() * VIEWPORT_WIDTH);
    }
}

function spawnCloud(x) {
    clouds.push({
        x: x,
        y: Math.random() * (VIEWPORT_HEIGHT / 2),
        width: 60 + Math.random() * 80,
        speed: 0.5 + Math.random() * 0.5
    });
}

// --- Level Generation ---

function updateDifficulty() {
    let newPhase = 1 + Math.floor(score / 1000);
    if (newPhase > 5) newPhase = 5; 
    
    if (newPhase > phase) {
        phase = newPhase;
        currentSpeed = BASE_SPEED * (1 + (phase - 1) * 0.1); 
        obstacleFreq = 0.1 + (phase - 1) * 0.1;
        pitFreq = 0.1 + (phase - 1) * 0.05;
    }
}

function createChunk(startX) {
    let gap = 0;
    if (Math.random() < pitFreq && startX > 800) {
        gap = 80 + Math.random() * 60; 
    }

    const width = 300 + Math.random() * 300; 
    const type = 'ground'; 
    const y = 550;

    platforms.push({ x: startX + gap, y, width, height: 90, type });

    addDecorations(startX + gap, y, width);

    return startX + gap + width;
}

function addDecorations(px, py, pw) {
    if (Math.random() < obstacleFreq) {
        hazards.push({
            x: px + Math.random() * (pw - 40),
            y: py - 20,
            width: 40,
            height: 20
        });
    }

    if (Math.random() < 0.4 + (phase * 0.05)) {
        spawnEnemy(px, py, pw);
    }

    if (Math.random() < 0.5) {
        const bx = px + Math.random() * (pw - 100);
        const by = py - 120 - Math.random() * 50;
        
        let bType = 'normal';
        const r = Math.random();
        if (r < 0.2) bType = 'blue'; 
        else if (r < 0.5) bType = 'yellow'; 
        else bType = 'normal'; 

        blocks.push({
            x: bx,
            y: by,
            width: 40,
            height: 40,
            type: bType,
            active: true
        });

        if (Math.random() < 0.5) {
             platforms.push({ x: bx - 30, y: by + 100, width: 100, height: 20, type: 'platform' });
        }
    }
}

function spawnEnemy(px, py, pw) {
    const enemyTypeIdx = Math.floor(Math.random() * phase) + 1; 
    
    let type = 'turtle';
    let w = 40, h = 40;
    
    if (enemyTypeIdx === 1) { type = 'turtle'; w = 40; h = 30; }
    else if (enemyTypeIdx === 2) { type = 'larva'; w = 30; h = 20; }
    else if (enemyTypeIdx === 3) { type = 'slime'; w = 30; h = 30; }
    else if (enemyTypeIdx === 4) { type = 'mouse'; w = 25; h = 20; }
    else if (enemyTypeIdx >= 5) { type = 'shark'; w = 60; h = 40; }

    enemies.push({
        x: px + Math.random() * (pw - w),
        y: py - h,
        width: w,
        height: h,
        type: type,
        dx: -1.5 * (1 + (phase * 0.1)), 
        patrolStart: px,
        patrolEnd: px + pw,
        animOffset: Math.random() * 10
    });
}

// --- Logic ---

function checkCollision(objA, objB) {
    return (
        objA.x < objB.x + objB.width &&
        objA.x + objA.width > objB.x &&
        objA.y < objB.y + objB.height &&
        objA.y + objA.height > objB.y
    );
}

function getRandomItemType() {
    const r = Math.random();
    if (r < 0.25) return 'yellow_mushroom';
    else if (r < 0.5) return 'blue_mushroom';
    else if (r < 0.75) return 'red_mushroom';
    else return 'rainbow_mushroom';
}

function applyItemEffect(type) {
    let text = "";
    if (type === 'yellow_mushroom') { 
        player.sizeMultiplier = 2.0;
        player.width = BASE_PLAYER_WIDTH * 2;
        player.height = BASE_PLAYER_HEIGHT * 2;
        player.y -= BASE_PLAYER_HEIGHT; 
        text = "BIG!";
    } else if (type === 'blue_mushroom') { 
        player.sizeMultiplier = 0.5;
        player.width = BASE_PLAYER_WIDTH * 0.5;
        player.height = BASE_PLAYER_HEIGHT * 0.5;
        text = "Small...";
    } else if (type === 'red_mushroom') { 
        player.speedMultiplier = 1.5;
        text = "SPEED UP!";
    } else if (type === 'rainbow_mushroom') {
        player.canDoubleJump = true;
        text = "Double Jump!";
    }
    
    coins.push({x: player.x, y: player.y - 20, text: text, timer: 60, color: 'white'});
}

function performJump() {
    if (player.grounded) {
        player.dy = JUMP_FORCE;
        player.grounded = false;
        player.jumpCount = 1;
    } else if (player.canDoubleJump && player.jumpCount < 2) {
        player.dy = JUMP_FORCE; 
        player.jumpCount = 2;
    }
}

// --- Main Update Loop with Delta Time ---
// dt is in 'units of 60fps frame' (e.g. 1.0 = 16.6ms, 2.0 = 33ms)
function update(dt) {
    if (gameState !== 'playing') return;

    frameCount++;
    
    // Time based score: +1 every 1 second (1000ms)
    timeAccumulator += dt * 16.6; // dt is scale, 16.6 is ms per frame
    if (timeAccumulator >= 1000) {
        score += 1;
        timeAccumulator -= 1000;
        updateDifficulty();
    }

    updateScoreUI();

    // Movement scaled by dt
    let speed = currentSpeed * player.speedMultiplier;
    player.dx = speed * dt; // Scaled movement
    
    player.facingRight = true;

    // Gravity scaled by dt
    // v = v0 + a*dt
    player.dy += GRAVITY * dt;
    if (player.dy > 15) player.dy = 15;

    // Position scaled by dt (velocity is already pixels/frame)
    // but we updated velocity with dt, so we add velocity * dt?
    // Standard Euler integration:
    // pos += vel * dt
    // If vel is in 'pixels per frame', then pos += vel * dt works if dt=1.
    // Correct.
    
    player.x += player.dx; // player.dx already has dt applied? No, above: speed * dt.
    // Actually, if I scale dx by dt, then adding it to x is correct.
    // What about dy? dy is a velocity state.
    // dy should change by gravity * dt.
    // Then y should change by dy * dt.
    // CAREFUL: if dy is "pixels per frame @ 60fps", then:
    // Next dy = dy + GRAVITY * dt.
    // Next y = y + (dy * dt).
    // This is the correct way for variable time step.
    
    player.y += player.dy * dt;

    // Camera
    cameraX = player.x - VIEWPORT_WIDTH * 0.3;
    
    // Clouds (Visuals)
    if (Math.random() < 0.01 * dt) spawnCloud(cameraX + VIEWPORT_WIDTH + 50);
    for (let i = clouds.length - 1; i >= 0; i--) {
        let c = clouds[i];
        c.x += (c.speed * 0.2) * dt; 
        if (c.x + c.width < cameraX - 100) clouds.splice(i, 1);
    }

    // Ground Check
    player.grounded = false;

    // Collision Logic 
    // (Note: Collision at high speeds/dt might require swept collision, but for simple game, overlapping check is ok unless dt is huge)
    
    // Platforms
    for (let p of platforms) {
        if (checkCollision(player, p)) {
            const prevY = player.y - (player.dy * dt); // Backtrack using dt
            if (prevY + player.height <= p.y + (player.dy > 0 ? player.dy * dt : 0) + 5) {
                if (player.dy >= 0) {
                    player.grounded = true;
                    player.dy = 0;
                    player.y = p.y - player.height;
                    player.combo = 0; 
                    player.jumpCount = 0; 
                }
            } else if (prevY >= p.y + p.height) {
                player.dy = 0;
                player.y = p.y + p.height;
            } else {
                 if (player.dx > 0) {
                     player.x = p.x - player.width;
                 }
            }
        }
    }

    // Blocks
    for (let i = blocks.length - 1; i >= 0; i--) {
        let b = blocks[i];
        if (!b.active) continue;

        if (checkCollision(player, b)) {
            const prevY = player.y - (player.dy * dt);
            
            if (prevY >= b.y + b.height) {
                player.dy = 0;
                player.y = b.y + b.height;
                b.active = false;
                
                if (b.type === 'normal') {
                    score += 10;
                } else if (b.type === 'yellow') {
                    score += 20;
                    coins.push({x: b.x, y: b.y, text: "+50", timer: 30, color: 'gold'});
                    score += 50; 
                } else if (b.type === 'blue') {
                    score += 30;
                    const type = getRandomItemType();
                    applyItemEffect(type);
                }
                updateDifficulty();

            } else if (prevY + player.height <= b.y + 5) {
                if (player.dy >= 0) {
                    player.grounded = true;
                    player.dy = 0;
                    player.y = b.y - player.height;
                    player.combo = 0;
                    player.jumpCount = 0; 
                }
            } else {
                if (player.dx > 0) player.x = b.x - player.width;
            }
        }
    }

    // Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        e.x += e.dx * dt; // Scaled movement
        if (e.x < e.patrolStart || e.x > e.patrolEnd) e.dx *= -1;

        if (checkCollision(player, e)) {
            const prevY = player.y - (player.dy * dt);
            if (player.dy > 0 && prevY + player.height <= e.y + e.height * 0.5) {
                player.dy = -8; 
                enemies.splice(i, 1);
                
                player.combo++;
                score += 20 * player.combo;
                updateDifficulty();

            } else {
                triggerGameOver();
            }
        }
    }

    // Hazards
    for (let h of hazards) {
        if (checkCollision(player, h)) {
            const shrink = 5;
            if (
                player.x + shrink < h.x + h.width - shrink &&
                player.x + player.width - shrink > h.x + shrink &&
                player.y + player.height - shrink > h.y + shrink 
            ) {
                 triggerGameOver();
            }
        }
    }

    // Items
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        it.dy += GRAVITY * dt;
        it.y += it.dy * dt;
        it.x += it.dx * dt;
        
        for (let p of platforms) {
            if (checkCollision(it, p)) {
                if (it.dy > 0 && it.y + it.height < p.y + (it.dy*dt) + 5) {
                    it.y = p.y - it.height;
                    it.dy = 0;
                }
            }
        }

        if (checkCollision(player, it)) {
            applyItemEffect(it.type);
            items.splice(i, 1);
        }
    }

    if (player.y > VIEWPORT_HEIGHT + 100) triggerGameOver();
    if (player.x < cameraX - 50) triggerGameOver();

    // Auto-generate world
    const renderDistance = cameraX + VIEWPORT_WIDTH + 200;
    while (nextChunkX < renderDistance) {
        nextChunkX = createChunk(nextChunkX);
    }
    
    const cleanupThreshold = cameraX - 200;
    platforms = platforms.filter(p => p.x + p.width > cleanupThreshold);
    enemies = enemies.filter(e => e.x + e.width > cleanupThreshold);
    blocks = blocks.filter(b => b.x + b.width > cleanupThreshold);
    hazards = hazards.filter(h => h.x + h.width > cleanupThreshold);
    items = items.filter(i => i.x + i.width > cleanupThreshold);
    clouds = clouds.filter(c => c.x + c.width > cleanupThreshold);
}

// --- Drawing ---

function draw() {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let c of clouds) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.width/3, 0, Math.PI * 2);
        ctx.arc(c.x + c.width/3, c.y - c.width/4, c.width/3, 0, Math.PI * 2);
        ctx.arc(c.x + c.width/2, c.y, c.width/3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Platforms
    ctx.fillStyle = '#654321'; 
    for (let p of platforms) {
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(p.x, p.y, p.width, 10);
        ctx.fillStyle = '#654321';
    }

    // Blocks
    for (let b of blocks) {
        if (!b.active) continue;
        if (b.type === 'normal') ctx.fillStyle = '#8B4513';
        else if (b.type === 'yellow') ctx.fillStyle = '#FFD700';
        else if (b.type === 'blue') ctx.fillStyle = '#4169E1';
        
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(b.x, b.y, b.width, b.height);
    }

    // Hazards
    ctx.fillStyle = 'red';
    for (let h of hazards) {
        ctx.beginPath();
        ctx.moveTo(h.x, h.y + h.height);
        ctx.moveTo(h.x + h.width/2, h.y); 
        ctx.lineTo(h.x + h.width, h.y + h.height);
        ctx.lineTo(h.x, h.y + h.height);
        ctx.fill();
    }

    // Enemies
    for (let e of enemies) {
        ctx.save();
        if (e.dx > 0) { 
            ctx.translate(e.x + e.width, e.y);
            ctx.scale(-1, 1);
            ctx.translate(-e.width, 0); 
        }
        
        if (e.type === 'larva') {
            let scale = 1 + Math.sin(frameCount * 0.2 + e.animOffset) * 0.2; 
            ctx.fillStyle = '#7FFF00'; 
            for(let k=0; k<3; k++) {
                let segX = e.x + 10 + k*10 * scale; 
                ctx.beginPath();
                ctx.arc(segX, e.y + 10, 10, 0, Math.PI*2);
                ctx.fill();
            }
        } else if (e.type === 'turtle') {
            ctx.fillStyle = 'green';
            ctx.beginPath();
            ctx.arc(e.x + e.width/2, e.y + e.height/2, e.width/2, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#90EE90'; 
            ctx.fillRect(e.x-5, e.y+15, 10, 10);
        } else if (e.type === 'slime') {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.6)';
            ctx.beginPath();
            ctx.moveTo(e.x, e.y + e.height);
            ctx.quadraticCurveTo(e.x + e.width/2, e.y - 10, e.x + e.width, e.y + e.height);
            ctx.fill();
        } else if (e.type === 'mouse') {
            ctx.fillStyle = 'gray';
            ctx.fillRect(e.x, e.y+5, e.width, e.height-5);
            ctx.fillStyle = 'pink'; 
            ctx.beginPath(); ctx.arc(e.x+5, e.y+5, 5, 0, Math.PI*2); ctx.fill();
        } else if (e.type === 'shark') {
            ctx.fillStyle = 'darkblue';
            ctx.beginPath();
            ctx.moveTo(e.x + e.width, e.y + e.height/2);
            ctx.lineTo(e.x, e.y + e.height);
            ctx.lineTo(e.x + 20, e.y); 
            ctx.fill();
        }
        ctx.restore();
    }

    // Items
    for (let it of items) {
        if (it.type === 'yellow_mushroom') ctx.fillStyle = 'gold';
        else if (it.type === 'blue_mushroom') ctx.fillStyle = 'blue';
        else if (it.type === 'red_mushroom') ctx.fillStyle = 'red';
        else if (it.type === 'rainbow_mushroom') {
            let grad = ctx.createLinearGradient(it.x, it.y, it.x+it.width, it.y+it.height);
            grad.addColorStop(0, "red");
            grad.addColorStop(0.2, "orange");
            grad.addColorStop(0.4, "yellow");
            grad.addColorStop(0.6, "green");
            grad.addColorStop(0.8, "blue");
            grad.addColorStop(1, "violet");
            ctx.fillStyle = grad;
        }
        ctx.beginPath();
        ctx.arc(it.x + it.width/2, it.y + it.height/2, it.width/2, 0, Math.PI*2);
        ctx.fill();
    }

    // Text Effects
    for (let c of coins) {
        ctx.fillStyle = c.color || 'gold';
        ctx.font = '20px Arial';
        ctx.fillText(c.text, c.x, c.y - (30 - c.timer));
        c.timer--;
    }
    coins = coins.filter(c => c.timer > 0);

    // Player
    if (assetsLoaded) {
        ctx.save();
        if (player.facingRight) { 
            ctx.translate(player.x + player.width, player.y);
            ctx.scale(-1, 1);
            ctx.drawImage(playerImage, 0, 0, player.width, player.height);
        } else {
            ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
        }
        ctx.restore();
    } else {
        ctx.fillStyle = 'white';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    ctx.restore();
}

// --- UI & Global ---
function updateScoreUI() {
    document.getElementById('score-display').innerText = `${score} (Phase ${phase})`;
}

function triggerGameOver() {
    gameState = 'gameover';
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over-screen').classList.remove('hidden');
    loadLeaderboard();
}

function hideGameOverScreen() {
    document.getElementById('game-over-screen').classList.add('hidden');
}

const LEADERBOARD_KEY = 'kwmerio_scores';

// Firestore Integration
function saveScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || 'Anonymous';
    
    if (db) {
        // Use Firestore
        db.collection('scores').add({
            name: name,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            loadLeaderboard();
        }).catch((error) => {
            console.error("Error saving score:", error);
            // Fallback to local
            saveScoreLocal(name);
        });
    } else {
        // Use Local
        saveScoreLocal(name);
    }
    document.getElementById('save-score-btn').disabled = true;
}

function saveScoreLocal(name) {
    let scores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
    scores.push({ name: name, score: score });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
    loadLeaderboard();
}

function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = 'Loading...';
    
    if (db) {
        // Load from Firestore (Top 10)
        db.collection('scores')
            .orderBy('score', 'desc')
            .limit(10)
            .get()
            .then((querySnapshot) => {
                list.innerHTML = '';
                let rank = 1;
                querySnapshot.forEach((doc) => {
                    const s = doc.data();
                    const li = document.createElement('li');
                    li.innerHTML = `<span>#${rank++} ${s.name}</span> <span>${s.score}</span>`;
                    list.appendChild(li);
                });
            })
            .catch((error) => {
                console.error("Error loading leaderboard:", error);
                loadLeaderboardLocal();
            });
    } else {
        loadLeaderboardLocal();
    }
}

function loadLeaderboardLocal() {
    const list = document.getElementById('leaderboard-list');
    let scores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
    list.innerHTML = '';
    scores.forEach((s, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>#${index+1} ${s.name}</span> <span>${s.score}</span>`;
        list.appendChild(li);
    });
}

// Input Handlers
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'Space') {
        keys.up = true;
        performJump(); 
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'Space') keys.up = false;
});

document.addEventListener('touchstart', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        performJump();
    }
});
document.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        performJump();
    }
});

document.getElementById('save-score-btn').addEventListener('click', saveScore);
document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('save-score-btn').disabled = false;
    initGame();
});

// --- Game Loop with Delta Time ---
let lastTime = 0;

function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Scale dt to target FPS (60)
    // If running at 60fps, deltaTime is 16.6ms. scale = 1.
    // If running at 120fps, deltaTime is 8.3ms. scale = 0.5.
    // If running at 30fps, deltaTime is 33.3ms. scale = 2.
    const dt = deltaTime / (1000 / TARGET_FPS);

    update(dt); // Update with scaled time
    draw();
    requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
