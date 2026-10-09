const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startOverlay = document.getElementById('startOverlay');
const finalScoreText = document.getElementById('finalScoreText');

const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;

let score = 0;
let highScore = localStorage.getItem('pastel_snake_highscore') || 0;
highScoreDisplay.innerText = highScore;

let gameInterval = null;
let isPlaying = false;
let snake = [];
let food = null;
let specialFood = null;
let specialFoodTimer = 0;
let particles = [];
let dx = 1;
let dy = 0;
let nextDx = 1;
let nextDy = 0;
let gameSpeed = 120; // Default speed in ms

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'specialEat') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

class Food {
    constructor(isSpecial = false) {
        this.isSpecial = isSpecial;
        this.spawn();
    }

    spawn() {
        let valid = false;
        while (!valid) {
            this.x = Math.floor(Math.random() * TILE_COUNT);
            this.y = Math.floor(Math.random() * TILE_COUNT);
            valid = !snake.some(segment => segment.x === this.x && segment.y === this.y);
        }
    }

    draw() {
        ctx.fillStyle = this.isSpecial ? '#f59e0b' : '#f43f5e'; // Amber for special, Pink for regular
        ctx.shadowColor = this.isSpecial ? '#fde68a' : '#fda4af';
        ctx.shadowBlur = this.isSpecial ? 12 : 8;
        ctx.beginPath();
        ctx.arc(
            (this.x * GRID_SIZE) + (GRID_SIZE / 2),
            (this.y * GRID_SIZE) + (GRID_SIZE / 2),
            this.isSpecial ? GRID_SIZE / 2.2 : GRID_SIZE / 2.5,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.speedX = (Math.random() - 0.5) * 5;
        this.speedY = (Math.random() - 0.5) * 5;
        this.life = 1.0;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 0.04;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(this.life, 0);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

let foodItem = new Food(false);
let specialFoodItem = null;

window.addEventListener('keydown', e => {
    switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (dy === 0) { nextDx = 0; nextDy = -1; }
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (dy === 0) { nextDx = 0; nextDy = 1; }
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (dx === 0) { nextDx = -1; nextDy = 0; }
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (dx === 0) { nextDx = 1; nextDy = 0; }
            break;
    }
});

window.setDirection = function(dir) {
    if (!isPlaying) return;
    if (dir === 'UP' && dy === 0) { nextDx = 0; nextDy = -1; }
    if (dir === 'DOWN' && dy === 0) { nextDx = 0; nextDy = 1; }
    if (dir === 'LEFT' && dx === 0) { nextDx = -1; nextDy = 0; }
    if (dir === 'RIGHT' && dx === 0) { nextDx = 1; nextDy = 0; }
};

window.startGame = function() {
    startOverlay.classList.add('hidden');
    resetGameVariables();
    isPlaying = true;
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, gameSpeed);
};

window.restartGame = function() {
    gameOverOverlay.classList.add('hidden');
    resetGameVariables();
    isPlaying = true;
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, gameSpeed);
};

function resetGameVariables() {
    score = 0;
    gameSpeed = 120;
    scoreDisplay.innerText = score;
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;
    particles = [];
    specialFoodItem = null;
    specialFoodTimer = 0;
    foodItem.spawn();
}

function gameLoop() {
    update();
    draw();
}

function update() {
    dx = nextDx;
    dy = nextDy;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Wall collision (wrap-around or game over - here we use wall collision for classic arcade rule)
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        triggerGameOver();
        return;
    }

    // Self body collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        triggerGameOver();
        return;
    }

    snake.unshift(head);

    // Regular Food collision
    if (head.x === foodItem.x && head.y === foodItem.y) {
        score += 10;
        scoreDisplay.innerText = score;
        if (score > highScore) {
            highScore = score;
            highScoreDisplay.innerText = highScore;
            localStorage.setItem('pastel_snake_highscore', highScore);
        }
        playSound('eat');

        for (let i = 0; i < 12; i++) {
            particles.push(new Particle(
                (foodItem.x * GRID_SIZE) + (GRID_SIZE / 2),
                (foodItem.y * GRID_SIZE) + (GRID_SIZE / 2),
                '#f43f5e'
            ));
        }

        foodItem.spawn();

        // Random chance to spawn special golden food
        if (!specialFoodItem && Math.random() < 0.35) {
            specialFoodItem = new Food(true);
            specialFoodTimer = 45; // lasts for 45 ticks
        }

        // Increase speed slightly as score increases
        if (score % 50 === 0 && gameSpeed > 60) {
            gameSpeed -= 5;
            clearInterval(gameInterval);
            gameInterval = setInterval(gameLoop, gameSpeed);
        }
    } else if (specialFoodItem && head.x === specialFoodItem.x && head.y === specialFoodItem.y) {
        // Special Food collision (+30 points)
        score += 30;
        scoreDisplay.innerText = score;
        if (score > highScore) {
            highScore = score;
            highScoreDisplay.innerText = highScore;
            localStorage.setItem('pastel_snake_highscore', highScore);
        }
        playSound('specialEat');

        for (let i = 0; i < 18; i++) {
            particles.push(new Particle(
                (specialFoodItem.x * GRID_SIZE) + (GRID_SIZE / 2),
                (specialFoodItem.y * GRID_SIZE) + (GRID_SIZE / 2),
                '#f59e0b'
            ));
        }
        specialFoodItem = null;
    } else {
        snake.pop();
    }

    // Countdown for special food expiration
    if (specialFoodItem) {
        specialFoodTimer--;
        if (specialFoodTimer <= 0) {
            specialFoodItem = null;
        }
    }

    // Update particles
    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
}

function draw() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Subtle Grid Lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= TILE_COUNT; i++) {
        ctx.beginPath();
        ctx.moveTo(i * GRID_SIZE, 0);
        ctx.lineTo(i * GRID_SIZE, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i * GRID_SIZE);
        ctx.lineTo(canvas.width, i * GRID_SIZE);
        ctx.stroke();
    }

    // Draw Particles
    particles.forEach(p => p.draw());

    // Draw Foods
    foodItem.draw();
    if (specialFoodItem) {
        specialFoodItem.draw();
    }

    // Draw Snake with gradient styling
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#4f46e5' : '#818cf8';
        ctx.shadowColor = '#c7d2fe';
        ctx.shadowBlur = index === 0 ? 10 : 4;
        
        ctx.beginPath();
        ctx.roundRect(
            segment.x * GRID_SIZE + 2,
            segment.y * GRID_SIZE + 2,
            GRID_SIZE - 4,
            GRID_SIZE - 4,
            8
        );
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function triggerGameOver() {
    isPlaying = false;
    clearInterval(gameInterval);
    playSound('gameover');
    finalScoreText.innerText = `Skor akhir kamu: ${score}`;
    gameOverOverlay.classList.remove('hidden');
}