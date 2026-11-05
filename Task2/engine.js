/* ===================================================================
   Task 2 - engine
   3x3 tic-tac-toe, two players, minimax with alpha-beta pruning.

   This file is pure game logic. It touches no DOM, so it can be
   reasoned about (and tested) on its own. app.js does the interface.
   =================================================================== */

'use strict';

/* --- board representation ------------------------------------------
   A board is a flat array of 9 cells, read left to right, top to
   bottom. Each cell holds EMPTY, HUMAN or MACHINE.

        0 | 1 | 2
        --+---+--
        3 | 4 | 5
        --+---+--
        6 | 7 | 8
   ------------------------------------------------------------------ */

var EMPTY   = 0;
var HUMAN   = 1;   // plays X, maximising is NOT their job: they minimise
var MACHINE = 2;   // plays O, the maximising player

/* The eight ways to make three in a row. */
var LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],   // columns
  [0, 4, 8], [2, 4, 6]               // diagonals
];

function emptyBoard() {
  return [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
}

/* Returns HUMAN, MACHINE, or 0 if nobody has won yet. */
function winnerOf(board) {
  for (var i = 0; i < LINES.length; i++) {
    var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return 0;
}

/* The three cells that won, or null. Used only to highlight them. */
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

/* --- scoring --------------------------------------------------------
   Terminal positions are scored from the MACHINE's point of view:

       machine wins  ->  +10
       human wins    ->  -10
       draw          ->    0

   The depth at which the win was found is subtracted from (or added
   to) the magnitude. Without this the engine is indifferent between
   winning now and winning in three more moves, which looks like it is
   toying with you. With it, a win at depth 1 scores 9 and a win at
   depth 5 scores 5, so the shortest win is preferred and the longest
   loss is preferred when losing is unavoidable.
   ------------------------------------------------------------------ */

function terminalScore(board, depth) {
  var w = winnerOf(board);
  if (w === MACHINE) return 10 - depth;
  if (w === HUMAN)   return depth - 10;
  if (isFull(board)) return 0;
  return null;            // not a terminal position
}

/* --- plain minimax --------------------------------------------------
   Kept so Task 2 can show, on every move, how many nodes the search
   would have visited without pruning. It is not used to pick moves.
   ------------------------------------------------------------------ */

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

/* --- minimax with alpha-beta pruning --------------------------------
   Same answer as minimax, fewer nodes visited.

   alpha = the best score the maximising player can already guarantee
           somewhere higher up the tree.
   beta  = the best score the minimising player can already guarantee.

   If at any point alpha >= beta, the player who is choosing at the
   parent node would never let play reach this position, because they
   already have a line that is at least as good. The remaining siblings
   cannot change the parent's decision, so we stop looking at them.
   That abandoned work is a cutoff, counted below.
   ------------------------------------------------------------------ */

function alphabeta(board, player, depth, alpha, beta, counter) {
  counter.nodes++;

  var score = terminalScore(board, depth);
  if (score !== null) return { move: -1, score: score };

  var moves = legalMoves(board);
  var bestMove = moves[0];

  if (player === MACHINE) {           // maximising
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      board[m] = player;
      var r = alphabeta(board, HUMAN, depth + 1, alpha, beta, counter);
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
    var r2 = alphabeta(board, MACHINE, depth + 1, alpha, beta, counter);
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

/* --- the call the interface makes -----------------------------------
   Runs alpha-beta to choose the move, then runs plain minimax on the
   same position purely to report what pruning saved.
   ------------------------------------------------------------------ */

function chooseMove(board, player, alsoMeasurePlainMinimax) {
  var abCount = { nodes: 0, cutoffs: 0, skipped: 0 };
  var t0 = performance.now();
  var choice = alphabeta(board.slice(), player, 0, -Infinity, Infinity, abCount);
  var abMs = performance.now() - t0;

  var plainCount = { nodes: 0, cutoffs: 0, skipped: 0 };
  var plainMs = null;
  if (alsoMeasurePlainMinimax) {
    var t1 = performance.now();
    minimax(board.slice(), player, 0, plainCount);
    plainMs = performance.now() - t1;
  }

  return {
    move: choice.move,
    score: choice.score,
    alphaBeta: { nodes: abCount.nodes, cutoffs: abCount.cutoffs,
                 skipped: abCount.skipped, ms: abMs },
    plain: alsoMeasurePlainMinimax ? { nodes: plainCount.nodes, ms: plainMs }
                                   : null
  };
}
