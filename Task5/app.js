/* ===================================================================
   Task 5 - interface
   B x B board for B = 3..10, three machine players, N games.
   Same engine as Task 4; what changes is that the board size, win
   length and all three search heuristics are under the user's control.
   =================================================================== */

'use strict';

var PLAYERS = 3;

var GLYPH = { 1: '✕', 2: '○', 3: '△' };   // ✕ ○ △
var CLS   = { 1: 'p1', 2: 'p2', 3: 'p3' };

var game, cells, running = false, stopRequested = false;
var tally;

var el = function (id) { return document.getElementById(id); };
var sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

/* A sensible win length for each board size. Four in a row on a 4x4 and
   five on a 5x5 are forced draws with three players, because every line
   can be blocked by one of the two opponents, so the default steps up
   more slowly than the board does. */
function defaultWinLength(B) {
  if (B <= 4) return 3;
  if (B === 5) return 4;
  return 5;
}

/* --- board ------------------------------------------------------------- */

function buildBoard(B) {
  var host = el('board');
  var px = Math.max(34, Math.min(104, Math.round(440 / B)));
  var font = Math.round(px * 0.46);

  host.style.gridTemplateColumns = 'repeat(' + B + ', ' + px + 'px)';
  host.style.gridTemplateRows = 'repeat(' + B + ', ' + px + 'px)';
  host.innerHTML = '';
  cells = [];

  for (var i = 0; i < B * B; i++) {
    var c = document.createElement('div');
    c.className = 'cell';
    c.style.fontSize = font + 'px';
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

/* --- settings ------------------------------------------------------------ */

function currentSettings() {
  var B = Number(el('size').value);
  var maxWin = Math.min(6, B);
  var winlen = Math.max(3, Math.min(maxWin, Number(el('winlen').value) || 3));
  return {
    B: B,
    winlen: winlen,
    depth: Math.max(1, Math.min(6, Number(el('depth').value) || 3)),
    radius: Math.max(1, Math.min(4, Number(el('radius').value) || 2)),
    budget: Math.max(10000, Number(el('budget').value) || 400000),
    games: Math.max(1, Math.min(10, Number(el('games').value) || 1)),
    delay: Number(el('delay').value)
  };
}

function applyBoardSize() {
  var B = Number(el('size').value);
  el('sizeval').textContent = B + ' × ' + B;

  var maxWin = Math.min(6, B);
  el('winlen').max = maxWin;
  if (Number(el('winlen').value) > maxWin) el('winlen').value = maxWin;
  el('winhint').textContent = 'Between 3 and ' + maxWin +
    ' on this board. Suggested: ' + defaultWinLength(B);

  var s = currentSettings();
  game = createGame(s.B, s.winlen, PLAYERS);
  buildBoard(s.B);
  paint(emptyBoard(game), -1, null);
  el('nlines').textContent = game.lines.length.toLocaleString();
}

/* --- scoreboard ---------------------------------------------------------- */

function resetTally() {
  tally = { played: 0, draws: 0, nodes: 0, ms: 0, peak: 0, hits: 0,
            won: [0, 0, 0, 0] };
  el('log').textContent = '';
  for (var p = 1; p <= PLAYERS; p++) {
    el('w' + p).textContent = '0';
    el('l' + p).textContent = '0';
    el('d' + p).textContent = '0';
  }
  ['played', 'draws', 'nodes', 'peak', 'hits', 'ttime'].forEach(function (id) {
    el(id).textContent = '–';
  });
}

function showTally() {
  for (var p = 1; p <= PLAYERS; p++) {
    var won = tally.won[p];
    el('w' + p).textContent = won;
    el('l' + p).textContent = tally.played - tally.draws - won;
    el('d' + p).textContent = tally.draws;
  }
  el('played').textContent = tally.played;
  el('draws').textContent  = tally.draws;
  el('nodes').textContent  = Math.round(tally.nodes).toLocaleString();
  el('peak').textContent   = tally.peak.toLocaleString();
  el('hits').textContent   = tally.hits;
  el('ttime').textContent  = (tally.ms / 1000).toFixed(1) + ' s';
}

function say(html) { el('status').innerHTML = html; }

function logLine(text) {
  var box = el('log');
  box.textContent += text + '\n';
  box.scrollTop = box.scrollHeight;
}

/* --- one game ------------------------------------------------------------ */

async function playVisibleGame(s) {
  var board = emptyBoard(game);
  var toMove = 1;
  var plies = 0, nodes = 0, peak = 0, hits = 0;
  var t0 = performance.now();

  paint(board, -1, null);

  for (;;) {
    if (stopRequested) return null;

    var r = chooseMove(game, board, toMove, s.depth, s.radius, s.budget);
    board[r.move] = toMove;
    nodes += r.nodes;
    if (r.nodes > peak) peak = r.nodes;
    if (r.exhausted) hits++;
    plies++;

    paint(board, r.move, null);
    if (s.delay > 0) await sleep(s.delay);
    else if (plies % 6 === 0) await sleep(0);   // let the board repaint

    if (checkWinAt(game, board, r.move)) {
      var found = findWinningLine(game, board);
      paint(board, -1, found ? found.line : null);
      return { winner: toMove, plies: plies, nodes: nodes, peak: peak,
               hits: hits, ms: performance.now() - t0 };
    }
    if (boardIsFull(game, board)) {
      return { winner: 0, plies: plies, nodes: nodes, peak: peak,
               hits: hits, ms: performance.now() - t0 };
    }
    toMove = (toMove % PLAYERS) + 1;
  }
}

/* --- batch ---------------------------------------------------------------- */

async function runBatch() {
  if (running) return;
  running = true;
  stopRequested = false;
  el('run').disabled = true;
  el('stop').disabled = false;
  el('warn').textContent = '';

  var s = currentSettings();
  game = createGame(s.B, s.winlen, PLAYERS);
  buildBoard(s.B);
  el('nlines').textContent = game.lines.length.toLocaleString();

  resetTally();
  logLine('game  winner  plies      nodes   peak/move');

  for (var g = 1; g <= s.games; g++) {
    say('Game ' + g + ' of ' + s.games + ' on ' + s.B + '×' + s.B +
        ', ' + s.winlen + ' in a row…');
    el('bar').style.width = Math.round(100 * (g - 1) / s.games) + '%';

    var res = await playVisibleGame(s);
    if (res === null) break;

    tally.played++;
    tally.nodes += res.nodes;
    tally.ms += res.ms;
    tally.hits += res.hits;
    if (res.peak > tally.peak) tally.peak = res.peak;
    if (res.winner === 0) tally.draws++;
    else tally.won[res.winner]++;

    var name = res.winner === 0 ? 'draw  '
             : 'P' + res.winner + ' ' + GLYPH[res.winner] + '  ';
    logLine(String(g).padStart(4) + '  ' + name + '  ' +
            String(res.plies).padStart(5) + '  ' +
            String(res.nodes).padStart(9) + '  ' +
            String(res.peak).padStart(10));

    showTally();
    if (s.delay > 0 && g < s.games) await sleep(s.delay * 3);
  }

  el('bar').style.width = '100%';
  say(tally.played + ' game' + (tally.played === 1 ? '' : 's') +
      (stopRequested ? ' (stopped early).' : ' complete.'));

  if (tally.hits > 0) {
    el('warn').textContent =
      tally.hits + ' move' + (tally.hits === 1 ? '' : 's') +
      ' hit the ' + s.budget.toLocaleString() + ' node ceiling and returned ' +
      'the best result found so far. Lower the depth, or reduce the ' +
      'candidate radius, for a search that completes.';
  }

  running = false;
  el('run').disabled = false;
  el('stop').disabled = true;
}

/* --- wiring ---------------------------------------------------------------- */

window.addEventListener('DOMContentLoaded', function () {
  el('winlen').value = defaultWinLength(Number(el('size').value));
  applyBoardSize();
  resetTally();

  el('size').addEventListener('input', function () {
    el('winlen').value = defaultWinLength(Number(el('size').value));
    applyBoardSize();
  });
  el('winlen').addEventListener('change', applyBoardSize);

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
