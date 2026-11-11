// Task 2: 3x3 tic-tac-toe, human vs machine, minimax with alpha-beta.
// Game logic only, no DOM. app.js handles the page.

'use strict';

// Board is a flat array of 9 cells:
//   0 1 2
//   3 4 5
//   6 7 8
var EMPTY   = 0;
var HUMAN   = 1;   // X, minimising
var MACHINE = 2;   // O, maximising

var LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
  [0, 4, 8], [2, 4, 6]               // diagonals
];

// lines passing through each cell (centre 4, corners 3, edges 2)
var LINES_THROUGH = [];
(function () {
  for (var c = 0; c < 9; c++) LINES_THROUGH.push([]);
  for (var i = 0; i < LINES.length; i++) {
    for (var k = 0; k < 3; k++) LINES_THROUGH[LINES[i][k]].push(LINES[i]);
  }
})();

function emptyBoard() {
  return [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
}

// HUMAN, MACHINE, or 0 if no one has won
function winnerOf(board) {
  for (var i = 0; i < LINES.length; i++) {
    var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return 0;
}

// the winning three cells (for highlighting), or null
function winningLine(board) {
  for (var i = 0; i < LINES.length; i++) {
    var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return LINES[i];
    }
  }
  return null;
}

function legalMoves(board) {
  var moves = [];
  for (var i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) moves.push(i);
  }
  return moves;
}

function isFull(board) {
  for (var i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) return false;
  }
  return true;
}

// Move ordering. Alpha-beta cuts more if good moves come first, so try
// the cells with the most open paths first, i.e. lines through the cell
// the opponent hasn't blocked yet. On an empty board: centre, corners,
// then edges. Doesn't change the result, just the number of nodes.
function openPaths(board, cell, player) {
  var opp = other(player);
  var lines = LINES_THROUGH[cell];
  var n = 0;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (board[l[0]] !== opp && board[l[1]] !== opp && board[l[2]] !== opp) n++;
  }
  return n;
}

function orderedMoves(board, player) {
  var moves = legalMoves(board);
  var key = [];
  for (var i = 0; i < moves.length; i++) key[moves[i]] = openPaths(board, moves[i], player);
  return moves.sort(function (a, b) { return key[b] - key[a] || a - b; });
}

// Scored from the machine's side: +10 win, -10 loss, 0 draw. Depth is
// taken off so a faster win scores higher (and a slower loss is preferred
// when the machine can't avoid losing).
function terminalScore(board, depth) {
  var w = winnerOf(board);
  if (w === MACHINE) return 10 - depth;
  if (w === HUMAN)   return depth - 10;
  if (isFull(board)) return 0;
  return null;            // game not over
}

// Plain minimax, no pruning. Only used to show how many nodes it would
// take; the machine's move always comes from alphabeta() below.
function minimax(board, player, depth, counter) {
  counter.nodes++;

  var score = terminalScore(board, depth);
  if (score !== null) return { move: -1, score: score };

  var moves = legalMoves(board);
  var bestMove = moves[0];
  var bestScore = (player === MACHINE) ? -Infinity : Infinity;

  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    board[m] = player;
    var result = minimax(board, other(player), depth + 1, counter);
    board[m] = EMPTY;

    if (player === MACHINE) {
      if (result.score > bestScore) { bestScore = result.score; bestMove = m; }
    } else {
      if (result.score < bestScore) { bestScore = result.score; bestMove = m; }
    }
  }

  return { move: bestMove, score: bestScore };
}

// Minimax with alpha-beta pruning.
// alpha = best the machine is already guaranteed higher up the tree
// beta  = best the human is already guaranteed
// Once alpha >= beta, the parent will never pick this branch, so the
// remaining moves here can be skipped (a cutoff).
// `ordered` turns the move ordering on/off. The real move always uses
// ordering; the unordered run is only there for the comparison readout.
function alphabeta(board, player, depth, alpha, beta, counter, ordered) {
  counter.nodes++;

  var score = terminalScore(board, depth);
  if (score !== null) return { move: -1, score: score };

  var moves = ordered ? orderedMoves(board, player) : legalMoves(board);
  var bestMove = moves[0];

  if (player === MACHINE) {           // maximising
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      board[m] = player;
      var r = alphabeta(board, HUMAN, depth + 1, alpha, beta, counter, ordered);
      board[m] = EMPTY;

      if (r.score > best) { best = r.score; bestMove = m; }
      if (best > alpha) alpha = best;

      if (alpha >= beta) {            // beta cutoff
        counter.cutoffs++;
        counter.skipped += moves.length - i - 1;
        break;
      }
    }
    return { move: bestMove, score: best };
  }

  var worst = Infinity;               // minimising
  for (var j = 0; j < moves.length; j++) {
    var n = moves[j];
    board[n] = player;
    var r2 = alphabeta(board, MACHINE, depth + 1, alpha, beta, counter, ordered);
    board[n] = EMPTY;

    if (r2.score < worst) { worst = r2.score; bestMove = n; }
    if (worst < beta) beta = worst;

    if (alpha >= beta) {              // alpha cutoff
      counter.cutoffs++;
      counter.skipped += moves.length - j - 1;
      break;
    }
  }
  return { move: bestMove, score: worst };
}

function other(player) {
  return player === MACHINE ? HUMAN : MACHINE;
}

// Called by the page. Picks the move with ordered alpha-beta. If compare
// is on, also runs unordered alpha-beta and plain minimax on the same
// board just to report their node counts.
function chooseMove(board, player, compare) {
  var abCount = { nodes: 0, cutoffs: 0, skipped: 0 };
  var t0 = performance.now();
  var choice = alphabeta(board.slice(), player, 0, -Infinity, Infinity,
                         abCount, true);
  var abMs = performance.now() - t0;

  var unordered = null, plain = null;
  if (compare) {
    var uCount = { nodes: 0, cutoffs: 0, skipped: 0 };
    alphabeta(board.slice(), player, 0, -Infinity, Infinity, uCount, false);
    unordered = { nodes: uCount.nodes, cutoffs: uCount.cutoffs };

    var plainCount = { nodes: 0 };
    var t1 = performance.now();
    minimax(board.slice(), player, 0, plainCount);
    plain = { nodes: plainCount.nodes, ms: performance.now() - t1 };
  }

  return {
    move: choice.move,
    score: choice.score,
    alphaBeta: { nodes: abCount.nodes, cutoffs: abCount.cutoffs,
                 skipped: abCount.skipped, ms: abMs },
    unordered: unordered,
    plain: plain
  };
}
