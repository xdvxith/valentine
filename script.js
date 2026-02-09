const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nctx = nextCanvas.getContext('2d');
const loveMeter = document.getElementById('love-fill');
const scoreVal = document.getElementById('score-val');
const uiLayer = document.getElementById('ui-layer');

const startScreen = document.getElementById('start-screen');
const proposalScreen = document.getElementById('proposal-screen');
const celebrationScreen = document.getElementById('celebration-screen');
const startBtn = document.getElementById('start-btn');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');
const menuScreen = document.getElementById('menu-screen');
const menuTitle = document.getElementById('menu-title');
const pauseBtn = document.getElementById('pause-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;
const WIN_SCORE = 1000; 

let score = 0;
let grid = createGrid();
let gameState = 'START';
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let nextPiece = null;

const SHAPES = {
    'I': [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    'J': [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
    'L': [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
    'O': [[1, 1], [1, 1]],
    'S': [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    'T': [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    'Z': [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const COLORS = ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1', '#fb6f92', '#c9184a', '#a4133c'];

let player = { pos: {x: 0, y: 0}, matrix: null, color: null };

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    if (toast.timeout) clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => toast.classList.remove('show'), 2000);
}

function triggerConfetti() {
    const colors = ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1', '#fb6f92'];
    for (let i = 0; i < 70; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        document.body.appendChild(confetti);
        const animation = confetti.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(100vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], { duration: Math.random() * 2000 + 3000 });
        animation.onfinish = () => confetti.remove();
    }
}

function createGrid() { return Array.from({length: ROWS}, () => Array(COLS).fill(0)); }
function createPiece(type) { return SHAPES[type].map(row => [...row]); }

function gridSweep() {
    let rowCount = 0;
    outer: for (let y = grid.length - 1; y > 0; --y) {
        for (let x = 0; x < grid[y].length; ++x) {
            if (grid[y][x] === 0) continue outer;
        }
        const row = grid.splice(y, 1)[0].fill(0);
        grid.unshift(row);
        ++y;
        rowCount++;
    }
    if (rowCount > 0) {
        score += rowCount * 100;
        const oldInterval = dropInterval;
        dropInterval = Math.max(150, 1000 - (Math.floor(score / 100) * 60));
        if (dropInterval < oldInterval) showToast("Falling faster for you! 💘");
        else showToast("Line cleared! ✨");
        updateScore();
    }
}

function draw() {
    ctx.fillStyle = '#fff0f3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const offsetX = (canvas.width - COLS * BLOCK_SIZE) / 2;
    const offsetY = (canvas.height - ROWS * BLOCK_SIZE) / 2;
    drawGridLines(ctx, offsetX, offsetY, ROWS, COLS, BLOCK_SIZE);
    drawGhost(offsetX, offsetY);
    drawMatrix(grid, {x: 0, y: 0}, offsetX, offsetY, null, ctx);
    drawMatrix(player.matrix, player.pos, offsetX, offsetY, player.color, ctx);
}

function drawNextPreview() {
    nctx.fillStyle = '#fff0f3';
    nctx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if(!nextPiece) return;
    const matrix = nextPiece.matrix;
    const size = 20;
    const pOffsetX = (nextCanvas.width - matrix[0].length * size) / 2;
    const pOffsetY = (nextCanvas.height - matrix.length * size) / 2;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                nctx.fillStyle = nextPiece.color;
                nctx.fillRect(x * size + pOffsetX, y * size + pOffsetY, size - 1, size - 1);
            }
        });
    });
}

function drawGridLines(context, offsetX, offsetY, rows, cols, size) {
    context.strokeStyle = '#ffccd5';
    context.lineWidth = 1;
    for (let i = 0; i <= cols; i++) {
        context.beginPath();
        context.moveTo(offsetX + i * size, offsetY);
        context.lineTo(offsetX + i * size, offsetY + rows * size);
        context.stroke();
    }
    for (let j = 0; j <= rows; j++) {
        context.beginPath();
        context.moveTo(offsetX, offsetY + j * size);
        context.lineTo(offsetX + cols * size, offsetY + j * size);
        context.stroke();
    }
}

function drawGhost(offsetX, offsetY) {
    const ghostPos = { x: player.pos.x, y: player.pos.y };
    while (!collide(grid, { pos: ghostPos, matrix: player.matrix })) { ghostPos.y++; }
    ghostPos.y--;
    drawMatrix(player.matrix, ghostPos, offsetX, offsetY, 'rgba(255, 77, 109, 0.2)', ctx);
}

function drawMatrix(matrix, offset, offsetX, offsetY, colorOverride, context) {
    if(!matrix) return;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = colorOverride || value;
                context.fillRect(
                    (x + offset.x) * BLOCK_SIZE + offsetX,
                    (y + offset.y) * BLOCK_SIZE + offsetY,
                    BLOCK_SIZE - 1, BLOCK_SIZE - 1
                );
            }
        });
    });
}

function collide(grid, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (grid[y + o.y] && grid[y + o.y][x + o.x]) !== 0) return true;
        }
    }
    return false;
}

function rotate(matrix) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
    matrix.forEach(row => row.reverse());
}

function playerRotate() {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix);
    while (collide(grid, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix); rotate(player.matrix); rotate(player.matrix);
            player.pos.x = pos;
            return;
        }
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(grid, player)) {
        player.pos.y--;
        merge(grid, player);
        playerReset();
        gridSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(grid, player)) player.pos.x -= dir;
}

function merge(grid, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) grid[y + player.pos.y][x + player.pos.x] = player.color;
        });
    });
}

function playerReset() {
    const pieces = 'ILJOTSZ';
    if (nextPiece === null) {
        const type = pieces[pieces.length * Math.random() | 0];
        nextPiece = { matrix: createPiece(type), color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    }
    player.matrix = nextPiece.matrix;
    player.color = nextPiece.color;
    player.pos.y = 0;
    player.pos.x = (grid[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    const nextType = pieces[pieces.length * Math.random() | 0];
    nextPiece = { matrix: createPiece(nextType), color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    drawNextPreview();
    if (collide(grid, player)) gameOver();
}

function updateScore() {
    scoreVal.innerText = score;
    const percentage = Math.min((score / WIN_SCORE) * 100, 100);
    loveMeter.style.width = `${percentage}%`;
    
    if (score >= WIN_SCORE && gameState !== 'PROPOSAL') {
        gameState = 'PROPOSAL';
        uiLayer.classList.remove('visible'); // Immediate UI cleanup
        triggerConfetti();
        
        // Clear all game screens and show proposal
        document.querySelectorAll('.screen').forEach(s => s.className = 'screen hidden');
        setTimeout(() => {
            proposalScreen.className = 'screen active';
        }, 500);
    }
}

function togglePause() {
    if (gameState !== 'PLAYING' && gameState !== 'PAUSED') return;
    if (!isPaused) {
        isPaused = true; gameState = 'PAUSED';
        menuTitle.innerText = "Game Paused";
        resumeBtn.style.display = "block";
        menuScreen.className = 'screen active';
    } else {
        isPaused = false; gameState = 'PLAYING';
        menuScreen.className = 'screen hidden';
        lastTime = performance.now();
        update();
    }
}

function gameOver() {
    gameState = 'END';
    menuTitle.innerText = "Game Over!";
    resumeBtn.style.display = "none"; 
    uiLayer.classList.remove('visible');
    menuScreen.className = 'screen active';
}

function update(time = 0) {
    if (gameState === 'PLAYING') {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) playerDrop();
        draw();
        requestAnimationFrame(update);
    }
}

function startGame() {
    // Canvas setup
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Reset game variables
    grid = createGrid();
    score = 0; 
    dropInterval = 1000;
    gameState = 'PLAYING';
    isPaused = false;
    
    // UI Management
    uiLayer.classList.add('visible'); 
    document.querySelectorAll('.screen').forEach(s => s.className = 'screen hidden');
    
    playerReset();
    updateScore();
    update();
}

function playerHardDrop() {
    while (!collide(grid, player)) {
        player.pos.y++;
    }
    player.pos.y--; // Back up to last valid spot
    merge(grid, player);
    playerReset();
    gridSweep();
    updateScore();
    dropCounter = 0;
}

window.addEventListener('keydown', event => {
    if (event.keyCode === 27) togglePause();
    
    if (gameState !== 'PLAYING') return;
    
    if (event.keyCode === 37) playerMove(-1);      // Left
    else if (event.keyCode === 39) playerMove(1);  // Right
    else if (event.keyCode === 40) playerDrop();   // Down
    else if (event.keyCode === 38) playerRotate(); // Up (Rotate)
    else if (event.keyCode === 32) playerHardDrop(); // Space (Hard Drop)
});

startBtn.addEventListener('click', startGame);

yesBtn.addEventListener('click', () => {
    proposalScreen.className = 'screen hidden';
    celebrationScreen.className = 'screen active';
    triggerConfetti();
    setInterval(triggerConfetti, 2000);
});

noBtn.addEventListener('mouseover', () => {
    noBtn.style.position = 'fixed';
    noBtn.style.left = Math.random() * (window.innerWidth - 100) + 'px';
    noBtn.style.top = Math.random() * (window.innerHeight - 50) + 'px';
});

pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', () => {
    menuScreen.className = 'screen hidden';
    startGame();
});