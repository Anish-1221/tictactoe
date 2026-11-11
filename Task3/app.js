// Task 3 page: runs N machine vs machine games and keeps the scoreboard.

'use strict';

var GLYPH = {};
GLYPH[P1] = '✕';
GLYPH[P2] = '○';

var cells, running = false, stopRequested = false;
var tally = { p1: 0, p2: 0, draw: 0, nodes1: 0, nodes2: 0, ms: 0 };

var el = function (id) { return document.getElementById(id); };
var sleep = function (ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
};

function buildBoard() {
  var host = el('board');
  host.style.gridTemplateColumns = 'repeat(3, 104px)';
  host.style.gridTemplateRows = 'repeat(3, 104px)';
  host.innerHTML = '';
  cells = [];
  for (var i = 0; i < 9; i++) {
    var c = document.createElement('div');
    c.className = 'cell';
    c.style.fontSize = '46px';
    c.style.cursor = 'default';
    host.appendChild(c);
    cells.push(c);
  }
}

function paint(board, lastMove, line) {
  for (var i = 0; i < 9; i++) {
    var v = board[i];
    cells[i].textContent = v === EMPTY ? '' : GLYPH[v];
    cells[i].className = 'cell' +
      (v === P1 ? ' p1' : v === P2 ? ' p2' : '') +
      (i === lastMove ? ' just-played' : '');
  }
  for (var j = 0; line && j < line.length; j++) {
    cells[line[j]].classList.add('winning');
  }
}

function say(html) { el('status').innerHTML = html; }

function cellName(i) {
  return 'r' + (Math.floor(i / 3) + 1) + 'c' + (i % 3 + 1);
}

function logLine(text) {
  var box = el('log');
  box.textContent += text + '\n';
  box.scrollTop = box.scrollHeight;
}

function resetTally() {
  tally = { p1: 0, p2: 0, draw: 0, nodes1: 0, nodes2: 0, ms: 0 };
  el('log').textContent = '';
  showTally();
  el('n1').textContent = '–';
  el('n2').textContent = '–';
  el('ttime').textContent = '–';
}

function showTally() {
  var total = tally.p1 + tally.p2 + tally.draw;
  el('w1').textContent = tally.p1;
  el('w2').textContent = tally.p2;
  el('wd').textContent = tally.draw;

  function pct(n) {
    return total ? Math.round(100 * n / total) + '%' : '–';
  }
  el('p1pct').textContent = pct(tally.p1);
  el('p2pct').textContent = pct(tally.p2);
  el('dpct').textContent  = pct(tally.draw);

  if (total) {
    el('n1').textContent = tally.nodes1.toLocaleString();
    el('n2').textContent = tally.nodes2.toLocaleString();
    el('ttime').textContent = tally.ms.toFixed(0) + ' ms';
  }
}

// one game, drawn on the board as it goes

async function playVisibleGame(d1, d2, delay) {
  var board = emptyBoard();
  var toMove = P1;
  var nodes1 = 0, nodes2 = 0;
  var t0 = performance.now();

  paint(board, -1, null);

  while (terminalScore(board, 0, P1) === null) {
    if (stopRequested) return null;

    var depth = (toMove === P1) ? d1 : d2;
    var r = chooseMove(board, toMove, depth);
    board[r.move] = toMove;
    if (toMove === P1) nodes1 += r.nodes; else nodes2 += r.nodes;

    paint(board, r.move, null);
    if (delay > 0) await sleep(delay);
    toMove = other(toMove);
  }

  var line = winningLine(board);
  paint(board, -1, line);

  return {
    winner: winnerOf(board),
    nodes1: nodes1,
    nodes2: nodes2,
    ms: performance.now() - t0,
    cells: board
  };
}

// run N games and update the tally after each

async function runBatch() {
  if (running) return;
  running = true;
  stopRequested = false;
  el('run').disabled = true;
  el('stop').disabled = false;

  var n = Math.max(1, Math.min(10, Number(el('games').value) || 1));
  var d1 = Math.max(1, Math.min(9, Number(el('d1').value) || 9));
  var d2 = Math.max(1, Math.min(9, Number(el('d2').value) || 9));
  var delay = Number(el('delay').value);

  resetTally();
  logLine('game  winner    moves  nodes P1   nodes P2');

  for (var g = 1; g <= n; g++) {
    say('Game ' + g + ' of ' + n + '…');
    el('bar').style.width = Math.round(100 * (g - 1) / n) + '%';

    var res = await playVisibleGame(d1, d2, delay);
    if (res === null) break;

    if (res.winner === P1) tally.p1++;
    else if (res.winner === P2) tally.p2++;
    else tally.draw++;

    tally.nodes1 += res.nodes1;
    tally.nodes2 += res.nodes2;
    tally.ms += res.ms;

    var filled = res.cells.filter(function (c) { return c !== EMPTY; }).length;
    var name = res.winner === P1 ? 'P1 ✕  ' :
               res.winner === P2 ? 'P2 ○  ' : 'draw   ';
    logLine(String(g).padStart(4) + '  ' + name + '  ' +
            String(filled).padStart(5) + '  ' +
            String(res.nodes1).padStart(8) + '  ' +
            String(res.nodes2).padStart(9));

    showTally();
    if (delay > 0 && g < n) await sleep(delay * 3);
  }

  el('bar').style.width = '100%';
  var done = tally.p1 + tally.p2 + tally.draw;
  say(stopRequested
    ? 'Stopped after ' + done + ' game' + (done === 1 ? '' : 's') + '.'
    : done + ' game' + (done === 1 ? '' : 's') + ' complete.');

  running = false;
  el('run').disabled = false;
  el('stop').disabled = true;
}

window.addEventListener('DOMContentLoaded', function () {
  buildBoard();
  paint(emptyBoard(), -1, null);

  el('run').addEventListener('click', runBatch);
  el('stop').addEventListener('click', function () { stopRequested = true; });

  el('delay').addEventListener('input', function () {
    el('delayval').textContent = el('delay').value + ' ms';
  });

  el('games').addEventListener('input', function () {
    var n = Math.max(1, Math.min(10, Number(el('games').value) || 1));
    el('run').textContent = 'Run ' + n + ' game' + (n === 1 ? '' : 's');
  });

  showTally();
});
