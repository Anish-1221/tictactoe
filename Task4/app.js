/* ===================================================================
   Task 4 - interface
   4x4 board, three machine players, N games, scoreboard.
   The search lives in engine.js; this file only drives it.
   =================================================================== */

'use strict';

var BOARD_SIZE = 4;
var PLAYERS = 3;
var RADIUS = 2;              // candidate moves within 2 cells of a mark
var NODE_BUDGET = 400000;    // per move; see the warning handling below

var GLYPH = { 1: '✕', 2: '○', 3: '△' };   // ✕ ○ △
var CLS   = { 1: 'p1', 2: 'p2', 3: 'p3' };

var game, cells, running = false, stopRequested = false;
var tally;

var el = function (id) { return document.getElementById(id); };
var sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

/* --- board ------------------------------------------------------------ */

function buildBoard() {
  var host = el('board');
  var px = 78;
  host.style.gridTemplateColumns = 'repeat(' + BOARD_SIZE + ', ' + px + 'px)';
  host.style.gridTemplateRows = 'repeat(' + BOARD_SIZE + ', ' + px + 'px)';
  host.innerHTML = '';
  cells = [];
  for (var i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    var c = document.createElement('div');
    c.className = 'cell';
    c.style.fontSize = '34px';
    c.style.cursor = 'default';
    host.appendChild(c);
    cells.push(c);
  }
}

function paint(board, lastMove, line) {
  for (var i = 0; i < cells.length; i++) {
    var v = board[i];
    cells[i].textContent = v === 0 ? '' : GLYPH[v];
    cells[i].className = 'cell' + (v ? ' ' + CLS[v] : '') +
      (i === lastMove ? ' just-played' : '');
  }
  for (var j = 0; line && j < line.length; j++) {
    cells[line[j]].classList.add('winning');
  }
}

/* --- scoreboard -------------------------------------------------------- */

function resetTally() {
  tally = { played: 0, draws: 0, nodes: 0, ms: 0, won: [0, 0, 0, 0] };
  el('log').textContent = '';
  for (var p = 1; p <= PLAYERS; p++) {
    el('w' + p).textContent = '0';
    el('l' + p).textContent = '0';
    el('d' + p).textContent = '0';
  }
  ['played', 'draws', 'nodes', 'ttime'].forEach(function (id) {
    el(id).textContent = '–';
  });
}

function showTally() {
  for (var p = 1; p <= PLAYERS; p++) {
    var won = tally.won[p];
    var lost = tally.played - tally.draws - won;   // someone else won
    el('w' + p).textContent = won;
    el('l' + p).textContent = lost;
    el('d' + p).textContent = tally.draws;
  }
  el('played').textContent = tally.played;
  el('draws').textContent  = tally.draws;
  el('nodes').textContent  = Math.round(tally.nodes).toLocaleString();
  el('ttime').textContent  = tally.ms.toFixed(0) + ' ms';
}

/* --- helpers ----------------------------------------------------------- */

function say(html) { el('status').innerHTML = html; }

function logLine(text) {
  var box = el('log');
  box.textContent += text + '\n';
  box.scrollTop = box.scrollHeight;
}

/* --- one game, played on screen ---------------------------------------- */

async function playVisibleGame(depth, delay) {
  var board = emptyBoard(game);
  var toMove = 1;
  var plies = 0, nodes = 0, budgetHit = false;
  var t0 = performance.now();

  paint(board, -1, null);

  for (;;) {
    if (stopRequested) return null;

    var r = chooseMove(game, board, toMove, depth, RADIUS, NODE_BUDGET);
    board[r.move] = toMove;
    nodes += r.nodes;
    if (r.exhausted) budgetHit = true;
    plies++;

    paint(board, r.move, null);
    if (delay > 0) await sleep(delay);

    if (checkWinAt(game, board, r.move)) {
      var found = findWinningLine(game, board);
      paint(board, -1, found ? found.line : null);
      return { winner: toMove, plies: plies, nodes: nodes,
               ms: performance.now() - t0, budgetHit: budgetHit };
    }
    if (boardIsFull(game, board)) {
      return { winner: 0, plies: plies, nodes: nodes,
               ms: performance.now() - t0, budgetHit: budgetHit };
    }
    toMove = (toMove % PLAYERS) + 1;
  }
}

/* --- the batch ---------------------------------------------------------- */

async function runBatch() {
  if (running) return;
  running = true;
  stopRequested = false;
  el('run').disabled = true;
  el('stop').disabled = false;
  el('warn').textContent = '';

  var n = Math.max(1, Math.min(10, Number(el('games').value) || 1));
  var winLen = Number(el('winlen').value);
  var depth = Math.max(1, Math.min(6, Number(el('depth').value) || 4));
  var delay = Number(el('delay').value);

  game = createGame(BOARD_SIZE, winLen, PLAYERS);

  resetTally();
  logLine('game  winner  plies     nodes');

  var anyBudgetHit = false;

  for (var g = 1; g <= n; g++) {
    say('Game ' + g + ' of ' + n + '…');
    el('bar').style.width = Math.round(100 * (g - 1) / n) + '%';

    var res = await playVisibleGame(depth, delay);
    if (res === null) break;

    tally.played++;
    tally.nodes += res.nodes;
    tally.ms += res.ms;
    if (res.winner === 0) tally.draws++;
    else tally.won[res.winner]++;
    if (res.budgetHit) anyBudgetHit = true;

    var name = res.winner === 0 ? 'draw  '
             : 'P' + res.winner + ' ' + GLYPH[res.winner] + '  ';
    logLine(String(g).padStart(4) + '  ' + name + '  ' +
            String(res.plies).padStart(5) + '  ' +
            String(res.nodes).padStart(8));

    showTally();
    if (delay > 0 && g < n) await sleep(delay * 3);
  }

  el('bar').style.width = '100%';
  say(tally.played + ' game' + (tally.played === 1 ? '' : 's') +
      (stopRequested ? ' (stopped early).' : ' complete.'));

  if (anyBudgetHit) {
    el('warn').textContent =
      'Search hit the ' + NODE_BUDGET.toLocaleString() +
      ' node ceiling on at least one move and returned early. ' +
      'Lower the depth for an uncut search.';
  }

  running = false;
  el('run').disabled = false;
  el('stop').disabled = true;
}

/* --- wiring -------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded', function () {
  game = createGame(BOARD_SIZE, 3, PLAYERS);
  buildBoard();
  paint(emptyBoard(game), -1, null);
  resetTally();

  el('run').addEventListener('click', runBatch);
  el('stop').addEventListener('click', function () { stopRequested = true; });

  el('delay').addEventListener('input', function () {
    el('delayval').textContent = el('delay').value + ' ms';
  });

  el('games').addEventListener('input', function () {
    var n = Math.max(1, Math.min(10, Number(el('games').value) || 1));
    el('run').textContent = 'Run ' + n + ' game' + (n === 1 ? '' : 's');
  });
});
