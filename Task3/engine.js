// Task 3: 3x3 tic-tac-toe, machine vs machine.
// Alpha-beta with a depth limit; a heuristic scores positions where the
// limit stops the search. No DOM in here.

'use strict';

var EMPTY = 0;
var P1 = 1;          // X, moves first
var P2 = 2;          // O

var LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function emptyBoard() {
  return [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY];
}

function other(p) { return p === P1 ? P2 : P1; }

function winnerOf(board) {
  for (var i = 0; i < LINES.length; i++) {
    var a = LINES[i][0], b = LINES[i][1], c = LINES[i][2];
    if (board[a] !== EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return 0;
}

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
  var m = [];
  for (var i = 0; i < 9; i++) if (board[i] === EMPTY) m.push(i);
  return m;
}

function isFull(board) {
  for (var i = 0; i < 9; i++) if (board[i] === EMPTY) return false;
  return true;
}

// Move ordering, same as Task 2: cells with more open paths (lines the
// opponent hasn't blocked) get searched first. Centre, corners, edges.
var LINES_THROUGH = [];
(function () {
  for (var c = 0; c < 9; c++) LINES_THROUGH.push([]);
  for (var i = 0; i < LINES.length; i++) {
    for (var k = 0; k < 3; k++) LINES_THROUGH[LINES[i][k]].push(LINES[i]);
  }
})();

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

// Heuristic for when the depth limit is hit. For every line with none of
// the opponent's marks, add (my marks in it)^2, and the same the other
// way round. Divided by 10 so it always stays between a real loss and a
// real win (those are +/-(10 - depth)).
function heuristic(board, forPlayer) {
  var mine = 0, theirs = 0;
  var opp = other(forPlayer);

  for (var i = 0; i < LINES.length; i++) {
    var mineInLine = 0, theirsInLine = 0;
    for (var k = 0; k < 3; k++) {
      var v = board[LINES[i][k]];
      if (v === forPlayer) mineInLine++;
      else if (v === opp) theirsInLine++;
    }
    if (theirsInLine === 0) mine += mineInLine * mineInLine;
    if (mineInLine === 0) theirs += theirsInLine * theirsInLine;
  }
  return (mine - theirs) / 10;
}

// scores are from forPlayer's point of view
function terminalScore(board, depth, forPlayer) {
  var w = winnerOf(board);
  if (w === forPlayer)        return 10 - depth;
  if (w === other(forPlayer)) return depth - 10;
  if (isFull(board))          return 0;
  return null;
}

// Depth-limited alpha-beta. maxDepth 9 = searches to the end (perfect
// play). Lower depths give a weaker player, which is how the batch gets
// wins and losses instead of all draws.
function alphabeta(board, toMove, forPlayer, depth, maxDepth, alpha, beta, counter) {
  counter.nodes++;

  var t = terminalScore(board, depth, forPlayer);
  if (t !== null) return t;

  if (depth >= maxDepth) return heuristic(board, forPlayer);

  var moves = orderedMoves(board, toMove);
  var i, score;

  if (toMove === forPlayer) {                  // maximising
    var best = -Infinity;
    for (i = 0; i < moves.length; i++) {
      board[moves[i]] = toMove;
      score = alphabeta(board, other(toMove), forPlayer, depth + 1,
                        maxDepth, alpha, beta, counter);
      board[moves[i]] = EMPTY;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) { counter.cutoffs++; break; }   // beta cutoff
    }
    return best;
  }

  var worst = Infinity;                        // minimising
  for (i = 0; i < moves.length; i++) {
    board[moves[i]] = toMove;
    score = alphabeta(board, other(toMove), forPlayer, depth + 1,
                      maxDepth, alpha, beta, counter);
    board[moves[i]] = EMPTY;
    if (score < worst) worst = score;
    if (worst < beta) beta = worst;
    if (alpha >= beta) { counter.cutoffs++; break; }     // alpha cutoff
  }
  return worst;
}

// Root search. Each root move gets a full (-inf, inf) window on purpose.
// With pruning between root moves, a move that comes back equal to alpha
// is only known to be "no better", not an actual tie, and picking randomly
// among those let a depth-9 player choose losing moves (that was a real
// bug, 9 vs 9 stopped drawing). Pruning still happens below the root.
function rootSearch(board, player, maxDepth, counter) {
  var moves = legalMoves(board);
  var best = -Infinity;
  var bestMoves = [];

  for (var i = 0; i < moves.length; i++) {
    board[moves[i]] = player;
    var score = alphabeta(board, other(player), player, 1, maxDepth,
                          -Infinity, Infinity, counter);
    board[moves[i]] = EMPTY;

    if (score > best) { best = score; bestMoves = [moves[i]]; }
    else if (score === best) { bestMoves.push(moves[i]); }
  }

  // random pick among equally good moves, otherwise every game in a batch
  // would be exactly the same
  return {
    move: bestMoves[(Math.random() * bestMoves.length) | 0],
    score: best,
    tied: bestMoves.length
  };
}

function chooseMove(board, player, maxDepth) {
  var counter = { nodes: 0, cutoffs: 0 };
  var t0 = performance.now();
  var r = rootSearch(board.slice(), player, maxDepth, counter);
  return {
    move: r.move,
    score: r.score,
    tied: r.tied,
    nodes: counter.nodes,
    cutoffs: counter.cutoffs,
    ms: performance.now() - t0
  };
}

// Plays one full game without the page (used for testing).
function playGame(depthP1, depthP2) {
  var board = emptyBoard();
  var toMove = P1;
  var moves = [];
  var nodes = {};
  nodes[P1] = 0;
  nodes[P2] = 0;

  while (terminalScore(board, 0, P1) === null) {
    var d = (toMove === P1) ? depthP1 : depthP2;
    var r = chooseMove(board, toMove, d);
    board[r.move] = toMove;
    nodes[toMove] += r.nodes;
    moves.push({ player: toMove, cell: r.move, nodes: r.nodes });
    toMove = other(toMove);
  }

  return {
    winner: winnerOf(board),
    board: board,
    moves: moves,
    nodesP1: nodes[P1],
    nodesP2: nodes[P2]
  };
}
