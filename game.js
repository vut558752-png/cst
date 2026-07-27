(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30;
  const PREVIEW_BLOCK_SIZE = 24;
  const STORAGE_KEY = "cst-tetris-high-score";

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  };

  const COLORS = {
    I: "#35e5ff",
    J: "#5578ff",
    L: "#ff9b42",
    O: "#ffd84a",
    S: "#54e67a",
    T: "#bc6cff",
    Z: "#ff5576",
  };

  const boardCanvas = document.querySelector("#game-board");
  const nextCanvas = document.querySelector("#next-piece");
  const boardContext = boardCanvas.getContext("2d");
  const nextContext = nextCanvas.getContext("2d");

  const scoreElement = document.querySelector("#score");
  const linesElement = document.querySelector("#lines");
  const levelElement = document.querySelector("#level");
  const highScoreElement = document.querySelector("#high-score");
  const overlay = document.querySelector("#game-overlay");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const overlayAction = document.querySelector("#overlay-action");
  const pauseButton = document.querySelector("#pause-button");
  const restartButton = document.querySelector("#restart-button");

  let board = createBoard();
  let activePiece = null;
  let nextType = null;
  let bag = [];
  let score = 0;
  let clearedLines = 0;
  let level = 1;
  let highScore = readHighScore();
  let state = "idle";
  let lastTime = 0;
  let dropCounter = 0;
  let animationFrame = null;

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function cloneShape(type) {
    return SHAPES[type].map((row) => [...row]);
  }

  function shuffledBag() {
    const pieces = Object.keys(SHAPES);
    for (let index = pieces.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [pieces[index], pieces[target]] = [pieces[target], pieces[index]];
    }
    return pieces;
  }

  function takePieceType() {
    if (bag.length === 0) {
      bag = shuffledBag();
    }
    return bag.pop();
  }

  function createPiece(type) {
    const matrix = cloneShape(type);
    return {
      type,
      matrix,
      position: {
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: 0,
      },
    };
  }

  function spawnPiece() {
    const type = nextType ?? takePieceType();
    nextType = takePieceType();
    activePiece = createPiece(type);
    drawNextPiece();

    if (collides(activePiece.matrix, activePiece.position)) {
      endGame();
      return false;
    }
    return true;
  }

  function collides(matrix, position) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) {
          continue;
        }

        const boardX = position.x + x;
        const boardY = position.y + y;
        if (
          boardX < 0 ||
          boardX >= COLS ||
          boardY >= ROWS ||
          (boardY >= 0 && board[boardY][boardX])
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function mergePiece() {
    activePiece.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const boardY = activePiece.position.y + y;
          const boardX = activePiece.position.x + x;
          if (boardY >= 0) {
            board[boardY][boardX] = activePiece.type;
          }
        }
      });
    });
  }

  function clearCompleteLines() {
    let count = 0;

    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        count += 1;
        y += 1;
      }
    }

    if (count > 0) {
      const lineScores = [0, 100, 300, 500, 800];
      score += lineScores[count] * level;
      clearedLines += count;
      level = Math.floor(clearedLines / 10) + 1;
      persistHighScore();
      updateStats();
    }
  }

  function lockPiece() {
    mergePiece();
    clearCompleteLines();
    spawnPiece();
  }

  function movePiece(direction) {
    if (state !== "playing" || !activePiece) {
      return;
    }

    activePiece.position.x += direction;
    if (collides(activePiece.matrix, activePiece.position)) {
      activePiece.position.x -= direction;
    }
    draw();
  }

  function softDrop(manual = false) {
    if (state !== "playing" || !activePiece) {
      return;
    }

    activePiece.position.y += 1;
    if (collides(activePiece.matrix, activePiece.position)) {
      activePiece.position.y -= 1;
      lockPiece();
    } else if (manual) {
      score += 1;
      persistHighScore();
      updateStats();
    }
    dropCounter = 0;
    draw();
  }

  function hardDrop() {
    if (state !== "playing" || !activePiece) {
      return;
    }

    let distance = 0;
    while (!collides(activePiece.matrix, activePiece.position)) {
      activePiece.position.y += 1;
      distance += 1;
    }
    activePiece.position.y -= 1;
    distance -= 1;
    score += Math.max(0, distance) * 2;
    persistHighScore();
    updateStats();
    lockPiece();
    dropCounter = 0;
    draw();
  }

  function rotateMatrix(matrix, direction) {
    const rotated = matrix[0].map((_, columnIndex) =>
      matrix.map((row) => row[columnIndex]),
    );
    if (direction > 0) {
      return rotated.map((row) => row.reverse());
    }
    return rotated.reverse();
  }

  function rotatePiece(direction) {
    if (state !== "playing" || !activePiece || activePiece.type === "O") {
      return;
    }

    const originalMatrix = activePiece.matrix;
    const originalX = activePiece.position.x;
    activePiece.matrix = rotateMatrix(activePiece.matrix, direction);

    for (const offset of [0, -1, 1, -2, 2]) {
      activePiece.position.x = originalX + offset;
      if (!collides(activePiece.matrix, activePiece.position)) {
        draw();
        return;
      }
    }

    activePiece.matrix = originalMatrix;
    activePiece.position.x = originalX;
  }

  function getGhostPosition() {
    const position = { ...activePiece.position };
    while (!collides(activePiece.matrix, position)) {
      position.y += 1;
    }
    position.y -= 1;
    return position;
  }

  function drawCell(context, x, y, color, alpha = 1) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x + 0.06, y + 0.06, 0.88, 0.88);
    context.fillStyle = "rgba(255, 255, 255, 0.24)";
    context.fillRect(x + 0.11, y + 0.11, 0.68, 0.08);
    context.strokeStyle = "rgba(255, 255, 255, 0.2)";
    context.lineWidth = 0.035;
    context.strokeRect(x + 0.07, y + 0.07, 0.86, 0.86);
    context.globalAlpha = 1;
  }

  function drawMatrix(context, matrix, position, type, alpha = 1) {
    matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          drawCell(context, x + position.x, y + position.y, COLORS[type], alpha);
        }
      });
    });
  }

  function drawGrid() {
    boardContext.strokeStyle = "rgba(112, 148, 184, 0.075)";
    boardContext.lineWidth = 0.025;

    for (let x = 0; x <= COLS; x += 1) {
      boardContext.beginPath();
      boardContext.moveTo(x, 0);
      boardContext.lineTo(x, ROWS);
      boardContext.stroke();
    }
    for (let y = 0; y <= ROWS; y += 1) {
      boardContext.beginPath();
      boardContext.moveTo(0, y);
      boardContext.lineTo(COLS, y);
      boardContext.stroke();
    }
  }

  function draw() {
    boardContext.setTransform(BLOCK_SIZE, 0, 0, BLOCK_SIZE, 0, 0);
    boardContext.fillStyle = "#07101c";
    boardContext.fillRect(0, 0, COLS, ROWS);
    drawGrid();

    board.forEach((row, y) => {
      row.forEach((type, x) => {
        if (type) {
          drawCell(boardContext, x, y, COLORS[type]);
        }
      });
    });

    if (activePiece) {
      if (state === "playing") {
        drawMatrix(
          boardContext,
          activePiece.matrix,
          getGhostPosition(),
          activePiece.type,
          0.2,
        );
      }
      drawMatrix(
        boardContext,
        activePiece.matrix,
        activePiece.position,
        activePiece.type,
      );
    }
  }

  function drawNextPiece() {
    nextContext.setTransform(
      PREVIEW_BLOCK_SIZE,
      0,
      0,
      PREVIEW_BLOCK_SIZE,
      0,
      0,
    );
    nextContext.clearRect(0, 0, 5, 5);

    if (!nextType) {
      return;
    }

    const matrix = SHAPES[nextType];
    const position = {
      x: (5 - matrix[0].length) / 2,
      y: (5 - matrix.length) / 2,
    };
    drawMatrix(nextContext, matrix, position, nextType);
  }

  function updateStats() {
    scoreElement.textContent = score.toLocaleString("zh-CN");
    linesElement.textContent = clearedLines.toLocaleString("zh-CN");
    levelElement.textContent = level.toLocaleString("zh-CN");
    highScoreElement.textContent = highScore.toLocaleString("zh-CN");
  }

  function readHighScore() {
    try {
      const value = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function persistHighScore() {
    if (score <= highScore) {
      return;
    }

    highScore = score;
    try {
      localStorage.setItem(STORAGE_KEY, String(highScore));
    } catch {
      // The game still works when storage is unavailable.
    }
  }

  function showOverlay(kicker, title, copy, actionText) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayAction.textContent = actionText;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function startGame() {
    board = createBoard();
    activePiece = null;
    nextType = null;
    bag = [];
    score = 0;
    clearedLines = 0;
    level = 1;
    dropCounter = 0;
    lastTime = performance.now();
    state = "playing";
    spawnPiece();
    updateStats();
    pauseButton.disabled = false;
    pauseButton.textContent = "暂停";
    hideOverlay();
    draw();

    if (animationFrame === null) {
      animationFrame = requestAnimationFrame(update);
    }
  }

  function endGame() {
    state = "over";
    persistHighScore();
    updateStats();
    pauseButton.disabled = true;
    showOverlay(
      "本局结束",
      "游戏结束",
      `最终得分 ${score.toLocaleString("zh-CN")}，再来挑战一次吧。`,
      "再来一局",
    );
    draw();
  }

  function togglePause() {
    if (state === "idle" || state === "over") {
      return;
    }

    if (state === "paused") {
      state = "playing";
      lastTime = performance.now();
      pauseButton.textContent = "暂停";
      hideOverlay();
    } else {
      state = "paused";
      pauseButton.textContent = "继续";
      showOverlay("游戏暂停", "休息一下", "准备好后继续堆叠方块。", "继续");
    }
    draw();
  }

  function update(time = 0) {
    const delta = Math.min(time - lastTime, 100);
    lastTime = time;

    if (state === "playing") {
      dropCounter += delta;
      const dropInterval = Math.max(100, 900 - (level - 1) * 70);
      if (dropCounter >= dropInterval) {
        softDrop();
      }
      draw();
    }

    animationFrame = requestAnimationFrame(update);
  }

  function runAction(action) {
    const actions = {
      left: () => movePiece(-1),
      right: () => movePiece(1),
      down: () => softDrop(true),
      rotate: () => rotatePiece(1),
      drop: hardDrop,
    };
    actions[action]?.();
  }

  document.addEventListener("keydown", (event) => {
    const handledKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "ArrowUp",
      " ",
      "z",
      "Z",
      "x",
      "X",
      "p",
      "P",
      "Escape",
    ];
    if (handledKeys.includes(event.key)) {
      event.preventDefault();
    }

    switch (event.key) {
      case "ArrowLeft":
        movePiece(-1);
        break;
      case "ArrowRight":
        movePiece(1);
        break;
      case "ArrowDown":
        softDrop(true);
        break;
      case "ArrowUp":
      case "x":
      case "X":
        rotatePiece(1);
        break;
      case "z":
      case "Z":
        rotatePiece(-1);
        break;
      case " ":
        hardDrop();
        break;
      case "p":
      case "P":
      case "Escape":
        togglePause();
        break;
      default:
        break;
    }
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      runAction(button.dataset.action);
    });
  });

  overlayAction.addEventListener("click", () => {
    if (state === "paused") {
      togglePause();
    } else {
      startGame();
    }
  });
  pauseButton.addEventListener("click", togglePause);
  restartButton.addEventListener("click", startGame);

  pauseButton.disabled = true;
  updateStats();
  draw();
  drawNextPiece();
})();
