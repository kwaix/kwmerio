const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const SPEED = 5;

// Assets
const playerImage = new Image();
playerImage.src = 'character.png';

let assetsLoaded = false;
playerImage.onload = () => {
    assetsLoaded = true;
};

// Game State
let gameState = 'playing'; // playing, won, lost

const player = {
    x: 50,
    y: 300,
    width: 44, 
    height: 50, 
    dx: 0,
    dy: 0,
    grounded: false,
    facingRight: true
};

const keys = {
    right: false,
    left: false,
    up: false
};

// Platforms
const platforms = [
    { x: 0, y: 550, width: 800, height: 50, type: 'ground' },
    { x: 200, y: 450, width: 100, height: 20, type: 'platform' },
    { x: 400, y: 350, width: 100, height: 20, type: 'platform' },
    { x: 600, y: 250, width: 100, height: 20, type: 'platform' },
    { x: 100, y: 200, width: 100, height: 20, type: 'platform' },
    { x: 700, y: 200, width: 100, height: 20, type: 'platform' } // Final platform for goal
];

// Goal (Moved to top right)
const goal = { x: 750, y: 150, width: 30, height: 50 };

// Spikes/Enemies
const hazards = [
    { x: 300, y: 530, width: 40, height: 20 },
    { x: 500, y: 530, width: 40, height: 20 }
];


function resetGame() {
    player.x = 50;
    player.y = 300;
    player.dx = 0;
    player.dy = 0;
    player.facingRight = true;
    gameState = 'playing';
}

function update() {
    if (!assetsLoaded || gameState !== 'playing') return;

    // Horizontal Movement
    if (keys.right) {
        player.dx = SPEED;
        player.facingRight = true;
    } else if (keys.left) {
        player.dx = -SPEED;
        player.facingRight = false;
    } else {
        player.dx = 0;
    }

    player.x += player.dx;

    // Wall collision
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Vertical Movement
    if (keys.up && player.grounded) {
        player.dy = JUMP_FORCE;
        player.grounded = false;
    }

    player.dy += GRAVITY;
    player.y += player.dy;

    // Collision Detection
    player.grounded = false;

    for (let platform of platforms) {
        if (
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y
        ) {
            const prevY = player.y - player.dy;
            if (prevY + player.height <= platform.y) {
                player.grounded = true;
                player.dy = 0;
                player.y = platform.y - player.height;
            } else if (prevY >= platform.y + platform.height) {
                player.dy = 0;
                player.y = platform.y + platform.height;
            } else {
                 if (player.dx > 0) { 
                    player.x = platform.x - player.width;
                 } else if (player.dx < 0) {
                    player.x = platform.x + platform.width;
                 }
            }
        }
    }
    
    // Floor failsafe
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        player.grounded = true;
    }

    // Hazard Collision
    for (let hazard of hazards) {
        if (
            player.x < hazard.x + hazard.width &&
            player.x + player.width > hazard.x &&
            player.y < hazard.y + hazard.height &&
            player.y + player.height > hazard.y
        ) {
            gameState = 'lost';
        }
    }

    // Goal Collision
    if (
        player.x < goal.x + goal.width &&
        player.x + player.width > goal.x &&
        player.y < goal.y + goal.height &&
        player.y + player.height > goal.y
    ) {
        gameState = 'won';
    }
}

function draw() {
    // Clear screen
    ctx.fillStyle = '#87CEEB'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Platforms
    for (let platform of platforms) {
        ctx.fillStyle = '#654321';
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(platform.x, platform.y, platform.width, 5);
    }

    // Draw Hazards
    ctx.fillStyle = 'red';
    for (let hazard of hazards) {
        // Draw spikes as triangles
        ctx.beginPath();
        ctx.moveTo(hazard.x, hazard.y + hazard.height);
        ctx.lineTo(hazard.x + hazard.width / 2, hazard.y);
        ctx.lineTo(hazard.x + hazard.width, hazard.y + hazard.height);
        ctx.fill();
    }

    // Draw Goal
    ctx.fillStyle = 'gold';
    ctx.fillRect(goal.x + 5, goal.y, 5, 50); // Pole
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(goal.x + 10, goal.y);
    ctx.lineTo(goal.x + 30, goal.y + 10);
    ctx.lineTo(goal.x + 10, goal.y + 20);
    ctx.fill();


    // Draw Player
    if (assetsLoaded) {
        ctx.save();
        // The image source faces Left.
        if (player.facingRight) { 
            // We want to face Right, so we Flip.
            ctx.translate(player.x + player.width, player.y);
            ctx.scale(-1, 1);
            ctx.drawImage(playerImage, 0, 0, player.width, player.height);
        } else {
            // We want to face Left (default), so we draw as is.
            ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
        }
        ctx.restore();
    } else {
        ctx.fillStyle = 'blue';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Draw UI
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    if (gameState === 'won') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.fillText('You Won! Press Space to Restart', 150, 300);
    } else if (gameState === 'lost') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '40px Arial';
        ctx.fillText('Game Over! Press Space to Restart', 150, 300);
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Input handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'ArrowUp' || e.code === 'Space') {
        if (gameState !== 'playing') {
            resetGame();
        } else {
            keys.up = true;
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowUp' || e.code === 'Space') keys.up = false;
});

// Start
loop();
