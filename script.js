const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

let arena = createMatrix(10, 20);
let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    score: 0,
    highScore: localStorage.getItem('highScore') || 0,
};

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let paused = false;
let gameOver = false;
let animating = false;
let animationId;

const iconUrls = {
    1: 'BusinessProcessDiagram.html',
    2: 'BusinessProcessNetwork.html',
    3: 'GenericQuery.html',
    4: 'ModelVisualizer.html',
    5: 'Spreadsheet.html',
    6: 'WorkFlowDiagram.html',
    7: 'RelationalDiagram.html',
};

function svg2b64(svg) {
    if (!svg) {
        return $.browser.warn('svgb64 error: No svg element defined.');
    }
    var b64 = new XMLSerializer().serializeToString(svg);
    return 'data:image/svg+xml;base64,' + window.btoa(b64);
}

async function getTemplateSvgIcon(imgurl) {

    var data;

    if (!data) {
        data = await $.ajax({
            url: imgurl,
            dataType: 'text',
        });
    }

    if (!data) {
        return $.browser.warn('getTemplateSvgIcon error: No template data found.');
    }

    return svg2b64($(data).find('.icon').find('svg').get(0));
}

const loadedIcons = {};
let imagesLoaded = 0;

Object.keys(iconUrls).forEach(key => {
    const img = new Image();
    getTemplateSvgIcon(iconUrls[key]).then(function(imageIcon) {
        img.src = imageIcon;
        imagesLoaded++;
        if (imagesLoaded === Object.keys(iconUrls).length) {
            startGame();
        }
    })
    loadedIcons[key] = img;
});

function startGame() {
    playerReset();
    updateScore();
    update();
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function createPiece(type) {
    switch (type) {
        case 'T': return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
        case 'O': return [[2, 2], [2, 2]];
        case 'L': return [[0, 0, 3], [3, 3, 3], [0, 0, 0]];
        case 'J': return [[4, 0, 0], [4, 4, 4], [0, 0, 0]];
        case 'I': return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
        case 'S': return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
        case 'Z': return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
    }
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
        if (collide(arena, player)) {
            endGame();
        }
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function playerReset() {
    const pieces = 'TJLOSZI';
    player.matrix = createPiece(pieces[(pieces.length * Math.random()) | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        endGame();
    }
}

function arenaSweep() {
    let rowCleared = false;

    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        rowCleared = true;
        player.score += 10; // Update score when a row is cleared
        updateScore(); // Update the displayed score
        shatterRow(y);
        break;
    }

    if (rowCleared) {
        setTimeout(() => {
            arenaSweep(); // Call recursively to clear multiple rows
        }, 200); // Delay before clearing the next row
    }
}

function shatterRow(row) {
    const particles = [];
    animating = true; // Set the animation flag

    // Create particles from each block in the row
    for (let x = 0; x < arena[row].length; x++) {
        if (arena[row][x] !== 0) {
            for (let i = 0; i < 5; i++) {  // Create multiple particles per block
                particles.push({
                    x: x + 0.5, // Start from the center of the block
                    y: row + 0.5,
                    vx: (Math.random() - 0.5) * 2, // Random velocity in x
                    vy: (Math.random() - 0.5) * 2, // Random velocity in y
                    img: loadedIcons[arena[row][x]],
                    size: Math.random() * 0.5 + 0.1, // Random size
                });
            }
        }
    }

    arena.splice(row, 1); // Remove the row
    arena.unshift(new Array(arena[0].length).fill(0)); // Add a new empty row at the top

    // Animate the particles
    function animateParticles() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawArenaWithScaling(-1, 1); // Draw the current arena
        drawMatrix(player.matrix, player.pos);

        particles.forEach(p => {
            context.drawImage(p.img, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            p.x += p.vx;
            p.y += p.vy;
            p.size *= 0.96; // Gradually shrink the particles
        });

        // Continue animation if particles are still visible
        if (particles.some(p => p.size > 0.05)) {
            requestAnimationFrame(animateParticles);
        } else {
            animating = false; // Reset the animation flag
            update(); // Continue the game loop after the animation
        }
    }

    animateParticles();
}

function drawArenaWithScaling(row, scale) {
    for (let y = 0; y < arena.length; ++y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] !== 0) {
                context.drawImage(loadedIcons[arena[y][x]], x, y, 1, 1);
            }
        }
    }
}

function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.drawImage(loadedIcons[value], x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    // Clear the canvas first
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Set the canvas background to semi-transparent white
    context.fillStyle = 'rgba(255, 255, 255, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the arena and player pieces
    drawArenaWithScaling(-1, 1); // Pass -1 to skip scaling, draw normally
    drawMatrix(player.matrix, player.pos);
}

function update(time = 0) {
    if (!paused && !gameOver && !animating) { // Don't update if animating
        const deltaTime = time - lastTime;
        lastTime = time;

        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }

        draw();
        animationId = requestAnimationFrame(update);
    }
}

function updateScore() {
    document.getElementById('score').innerText = player.score;
    if (player.score > player.highScore) {
        player.highScore = player.score;
        localStorage.setItem('highScore', player.highScore);
    }
    document.getElementById('high-score').innerText = player.highScore;

    // Adjust drop speed based on score
    adjustDropInterval();
}

function adjustDropInterval() {
    // Example: Reduce dropInterval by 5ms for every 100 points, with a minimum of 100ms
    dropInterval = Math.max(1000 - (player.score / 10) * 100, 100);
}

function restartGame() {
    cancelAnimationFrame(animationId);
    arena = createMatrix(10, 20);
    player.score = 0;
    dropInterval = 1000; // Reset to the initial drop interval
    gameOver = false;
    animating = false; // Reset the animation flag
    document.getElementById('gameover-indicator').style.display = 'none';
    playerReset();
    updateScore();
    if (paused) {
        pauseGame(); // Resume the game if paused
    }
    update();
}

function pauseGame() {
    paused = !paused;
    document.getElementById('pause-indicator').style.display = paused ? 'block' : 'none';
    if (!paused && !gameOver && !animating) { // Don't update if animating
        lastTime = 0; // Reset time tracking
        update();
    } else {
        cancelAnimationFrame(animationId);
    }
}

function endGame() {
    gameOver = true;
    document.getElementById('gameover-indicator').style.display = 'block';
    cancelAnimationFrame(animationId);
}

document.addEventListener('keydown', event => {
    if (event.keyCode === 37) {
        playerMove(-1);
    } else if (event.keyCode === 39) {
        playerMove(1);
    } else if (event.keyCode === 40) {
        playerDrop();
    } else if (event.keyCode === 38) { // Arrow up to rotate
        playerRotate(1);
    } else if (event.keyCode === 80) {
        pauseGame(); // 'P' key for pausing the game
    }
});