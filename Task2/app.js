/* ===================================================================
   Task 2 - interface
   Wires the board and the readout panel to engine.js.
   =================================================================== */

'use strict';

var GLYPH = {};
GLYPH[HUMAN]   = '✕';   // ✕
GLYPH[MACHINE] = '○';   // ○

var board, gameOver, moveNo, cells;
var pending = null;   // the machine's scheduled move, so a new game can cancel it

var el = function (id) { return document.getElementById(id); };

/* --- build the 3x3 grid of buttons once ---------------------------- */

function buildBoard() {
  var host = el('board');
  host.style.gridTemplateColumns = 'repeat(3, 104px)';
  host.style.gridTemplateRows = 'repeat(3, 104px)';
  host.innerHTML = '';
  cells = [];

  for (var i = 0; i < 9; i++) {
    var b = document.createElement('button');
    b.className = 'cell';
    b.style.fontSize = '46px';
    b.dataset.index = i;
    b.setAttribute('aria-label', 'Cell ' + (i + 1));
    b.addEventListener('click', onCellClick);
    host.appendChild(b);
    cells.push(b);
  }
}

function paint() {
  for (var i = 0; i < 9; i++) {
    var v = board[i];
    cells[i].textContent = v === EMPTY ? '' : GLYPH[v];
    cells[i].className = 'cell' +
      (v === HUMAN ? ' p1' : v === MACHINE ? ' p2' : '');
    cells[i].disabled = (v !== EMPTY) || gameOver;
  }
}

/* --- status line ---------------------------------------------------- */

function say(html) { el('status').innerHTML = html; }

function finish() {
  var w = winnerOf(board);
  gameOver = true;

  if (w === HUMAN)        say('You won. That should not be possible.');
  else if (w === MACHINE) say('<span class="who-p2">Machine wins.</span>');
  else                    say('Draw. Correct result against perfect play.');

  paint();                      // paint() rewrites className, so mark after it
  var line = winningLine(board);
  for (var i = 0; line && i < line.length; i++) {
    cells[line[i]].classList.add('winning');
  }
}

/* --- logging --------------------------------------------------------- */

function logLine(text) {
  var box = el('log');
  box.textContent += text + '\n';
  box.scrollTop = box.scrollHeight;
}

function cellName(i) {
  return 'r' + (Math.floor(i / 3) + 1) + 'c' + (i % 3 + 1);
}

/* --- readout --------------------------------------------------------- */

function showSearch(r) {
  el('ab-nodes').textContent = r.alphaBeta.nodes.toLocaleString();
  el('cutoffs').textContent  = r.alphaBeta.cutoffs.toLocaleString();
  el('skipped').textContent  = r.alphaBeta.skipped.toLocaleString();
  el('ms').textContent       = r.alphaBeta.ms.toFixed(1) + ' ms';
  el('score').textContent    = r.score > 0 ? '+' + r.score : String(r.score);

  if (r.plain) {
    var saved = 100 * (1 - r.alphaBeta.nodes / r.plain.nodes);
    el('un-nodes').textContent = r.unordered.nodes.toLocaleString();
    el('mm-nodes').textContent = r.plain.nodes.toLocaleString();
    el('saved').textContent    = saved.toFixed(1) + '%';
  } else {
    el('un-nodes').textContent = 'not run';
    el('mm-nodes').textContent = 'not run';
    el('saved').textContent    = '–';
  }
}

/* --- turns ------------------------------------------------------------ */

function onCellClick(e) {
  if (gameOver) return;
  var i = Number(e.currentTarget.dataset.index);
  if (board[i] !== EMPTY) return;

  board[i] = HUMAN;
  moveNo++;
  logLine(pad(moveNo) + '  you      ' + cellName(i));
  paint();

  if (terminalScore(board, 0) !== null) { finish(); return; }

  say('Machine is searching…');
  // let the browser paint the move before the search blocks the thread
  pending = setTimeout(machineTurn, 20);
}

function machineTurn() {
  pending = null;
  var r = chooseMove(board, MACHINE, el('compare').checked);
  board[r.move] = MACHINE;
  moveNo++;
  showSearch(r);
  logLine(pad(moveNo) + '  machine  ' + cellName(r.move) +
          '   ' + r.alphaBeta.nodes.toLocaleString() + ' nodes');
  paint();
  cells[r.move].classList.add('just-played');

  if (terminalScore(board, 0) !== null) { finish(); return; }
  say('Your move.');
}

function pad(n) { return (n < 10 ? ' ' : '') + n; }

/* --- new game ---------------------------------------------------------- */

function newGame() {
  /* Starting a new game while the machine's move is still scheduled would
     otherwise let that stale move land on the new board as an extra turn. */
  if (pending !== null) { clearTimeout(pending); pending = null; }
  board = emptyBoard();
  gameOver = false;
  moveNo = 0;
  el('log').textContent = '';
  ['ab-nodes', 'un-nodes', 'mm-nodes', 'saved', 'cutoffs', 'skipped', 'ms', 'score']
    .forEach(function (id) { el(id).textContent = '–'; });
  paint();

  if (el('first').value === 'machine') {
    say('Machine is searching…');
    pending = setTimeout(machineTurn, 20);
  } else {
    say('Your move.');
  }
}

window.addEventListener('DOMContentLoaded', function () {
  buildBoard();
  el('newgame').addEventListener('click', newGame);
  el('first').addEventListener('change', newGame);
  newGame();
});
