const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Game Constants ---
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

// --- Game State ---
let gameState = 'playing'; 
let score = 0;
let phase = 1;
let cameraX = 0;
let frameCount = 0;

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

// Inputs (Only Jump now)
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
    nextChunkX = 500;
    
    // Reset Player
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

    // Reset Difficulty
    currentSpeed = BASE_SPEED;
    obstacleFreq = 0.1;
    pitFreq = 0.1;

    updateScoreUI();
    hideGameOverScreen();

    // Initial Platform
    platforms = [];
    platforms.push({ x: -100, y: 550, width: 600, height: 90, type: 'ground' });

    enemies = [];
    blocks = [];
    hazards = [];
    items = [];
    particles = [];
    coins = [];
}

// --- Level Generation ---

function updateDifficulty() {
    let newPhase = 1 + Math.floor(score / 1000);
    if (newPhase > 5) newPhase = 5; 
    
    if (newPhase > phase) {
        phase = newPhase;
        // Speed increases by 10% per phase
        currentSpeed = BASE_SPEED * (1 + (phase - 1) * 0.1); 
        obstacleFreq = 0.1 + (phase - 1) * 0.1;
        pitFreq = 0.1 + (phase - 1) * 0.05;
    }
}

function createChunk(startX) {
    let gap = 0;
    if (Math.random() < pitFreq && startX > 800) {
        gap = 80 + Math.random() * 60; // Slightly larger gap for auto-run challenge
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
    
    let type = 'larva';
    let w = 40, h = 40;
    
    if (enemyTypeIdx === 1) { type = 'larva'; w = 30; h = 20; }
    else if (enemyTypeIdx === 2) { type = 'turtle'; w = 40; h = 30; }
    else if (enemyTypeIdx === 3) { type = 'slime'; w = 30; h = 30; }
    else if (enemyTypeIdx === 4) { type = 'mouse'; w = 25; h = 20; }
    else if (enemyTypeIdx >= 5) { type = 'shark'; w = 60; h = 40; }

    enemies.push({
        x: px + Math.random() * (pw - w),
        y: py - h,
        width: w,
        height: h,
        type: type,
        // Enemies move left towards player
        dx: -1.5 * (1 + (phase * 0.1)), 
        patrolStart: px,
        patrolEnd: px + pw
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

function spawnItem(x, y) {
    const r = Math.random();
    let type = 'yellow_mushroom';
    if (r < 0.25) type = 'blue_mushroom';
    else if (r < 0.5) type = 'red_mushroom';
    else if (r < 0.75) type = 'rainbow_mushroom'; 

    items.push({
        x: x,
        y: y,
        width: 30,
        height: 30,
        type: type,
        dy: -5, 
        dx: Math.random() > 0.5 ? 2 : -2,
        grounded: false
    });
}

function applyItemEffect(type) {
    if (type === 'yellow_mushroom') { 
        player.sizeMultiplier = 2.0;
        player.width = BASE_PLAYER_WIDTH * 2;
        player.height = BASE_PLAYER_HEIGHT * 2;
        player.y -= BASE_PLAYER_HEIGHT; 
    } else if (type === 'blue_mushroom') { 
        player.sizeMultiplier = 0.5;
        player.width = BASE_PLAYER_WIDTH * 0.5;
        player.height = BASE_PLAYER_HEIGHT * 0.5;
    } else if (type === 'red_mushroom') { 
        player.speedMultiplier = 1.5;
    } else if (type === 'rainbow_mushroom') {
        player.canDoubleJump = true;
    }
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

function update() {
    if (gameState !== 'playing') return;

    frameCount++;
    
    if (frameCount % 60 === 0) {
        score += 1;
        updateDifficulty();
    }

    updateScoreUI();

    // AUTO RUN: Always move right
    let speed = currentSpeed * player.speedMultiplier;
    player.dx = speed;
    player.facingRight = true;

    // Gravity
    player.dy += GRAVITY;
    if (player.dy > 15) player.dy = 15;

    player.x += player.dx;
    player.y += player.dy;

    // Camera: Follow player with offset
    // Player stays at 30% of screen width
    cameraX = player.x - VIEWPORT_WIDTH * 0.3;
    
    // Death if falls behind? No, camera follows.
    // Death if hits wall? Not possible in infinite runner usually.

    // Ground Check
    player.grounded = false;

    // 1. Platforms Collision
    for (let p of platforms) {
        if (checkCollision(player, p)) {
            const prevY = player.y - player.dy;
            if (prevY + player.height <= p.y + (player.dy > 0 ? player.dy : 0) + 5) {
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
                 // Side collision in Auto Run usually means death or stop
                 // If we hit a wall, game over?
                 // Or just stop and let camera overtake?
                 // Let's stop player x.
                 if (player.dx > 0) {
                     player.x = p.x - player.width;
                     // If pushed off screen by camera -> Game Over logic below
                 }
            }
        }
    }

    // 2. Blocks Collision
    for (let i = blocks.length - 1; i >= 0; i--) {
        let b = blocks[i];
        if (!b.active) continue;

        if (checkCollision(player, b)) {
            const prevY = player.y - player.dy;
            
            if (prevY >= b.y + b.height) {
                player.dy = 0;
                player.y = b.y + b.height;
                b.active = false;
                
                if (b.type === 'normal') {
                    score += 10;
                } else if (b.type === 'yellow') {
                    score += 20;
                    coins.push({x: b.x, y: b.y, timer: 30});
                    score += 50; 
                } else if (b.type === 'blue') {
                    score += 30;
                    spawnItem(b.x, b.y);
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

    // 3. Enemies Collision
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        e.x += e.dx;
        // Enemies patrol logic needs to account for moving world?
        // They just move relative to their platform.
        if (e.x < e.patrolStart || e.x > e.patrolEnd) e.dx *= -1;

        if (checkCollision(player, e)) {
            const prevY = player.y - player.dy;
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

    // 4. Hazards
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

    // 5. Items Logic
    for (let i = items.length - 1; i >= 0; i--) {
        let it = items[i];
        it.dy += GRAVITY;
        it.y += it.dy;
        it.x += it.dx;
        
        for (let p of platforms) {
            if (checkCollision(it, p)) {
                if (it.dy > 0 && it.y + it.height < p.y + it.dy + 5) {
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

    // Pit Death
    if (player.y > VIEWPORT_HEIGHT + 100) triggerGameOver();
    
    // Camera Overtake Death (if blocked by wall and camera moves past)
    if (player.x < cameraX - 50) {
        triggerGameOver();
    }

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
}

// --- Drawing ---

function draw() {
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-cameraX, 0);

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
            ctx.fillStyle = '#7FFF00'; 
            for(let k=0; k<3; k++) {
                ctx.beginPath();
                ctx.arc(e.x + 10 + k*10, e.y + 10, 10, 0, Math.PI*2);
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
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(it.x + it.width/2, it.y + it.height/2, it.width/4, 0, Math.PI*2); ctx.fill();
    }

    // Coins
    for (let c of coins) {
        ctx.fillStyle = 'gold';
        ctx.font = '20px Arial';
        ctx.fillText('+50', c.x, c.y - (30 - c.timer));
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

function saveScore() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || 'Anonymous';
    let scores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
    scores.push({ name: name, score: score });
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(scores));
    loadLeaderboard();
    document.getElementById('save-score-btn').disabled = true;
}

function loadLeaderboard() {
    let scores = JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
    const list = document.getElementById('leaderboard-list');
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

// Touch/Click Jump (Global)
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

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

initGame();
loop();
