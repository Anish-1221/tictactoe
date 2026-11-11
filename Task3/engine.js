/* ===================================================================
   Task 3 - engine
   3x3 tic-tac-toe, two machine players, alpha-beta pruning,
   with a search depth limit and a heuristic for cut-off leaves.

   Pure logic, no DOM.
   =================================================================== */

'use strict';

var EMPTY = 0;
var P1 = 1;          // plays ✕, moves first
var P2 = 2;          // plays ○

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

/* --- move ordering: the open paths heuristic ---------------------------
   Same as Task 2. Moves are tried in order of how many lines through the
   cell are still open to the player moving, so the centre (4 lines) comes
   before the corners (3) and the edges (2). Good moves found early tighten
   alpha and beta sooner, which is what lets alpha-beta cut more. The
   ordering never changes a move's value, only the work spent finding it.
   ---------------------------------------------------------------------- */

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

/* --- heuristic for positions the search stops at ---------------------
   Reached only when the depth limit cuts the search off before a
   terminal position. A line still open to a player is one that holds
   none of the opponent's marks. Lines are weighted by how many marks
   the player already has in them, squared, so two in a row counts for
   much more than one.

   The result is divided by 10 to keep it inside the range used by
   terminal scores, so a heuristic guess can never outrank a real win
   or be mistaken for a real loss.
   ------------------------------------------------------------------ */

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

/* --- scoring ----------------------------------------------------------
   Always from the point of view of the player the search is run for.
   -------------------------------------------------------------------- */

function terminalScore(board, depth, forPlayer) {
  var w = winnerOf(board);
  if (w === forPlayer)        return 10 - depth;
  if (w === other(forPlayer)) return depth - 10;
  if (isFull(board))          return 0;
  return null;
}

/* --- depth limited alpha-beta ------------------------------------------
   maxDepth of 9 or more searches to the end of the game, which is
   perfect play on a 3x3 board. Smaller values make a weaker opponent,
   which is what lets this task produce wins and losses rather than an
   unbroken run of draws.
   ---------------------------------------------------------------------- */

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

/* --- root search --------------------------------------------------------
   The root is handled separately and deliberately does NOT prune between
   its own children: each candidate move is searched with a full
   (-inf, +inf) window so that every one comes back with an exact value.

   This matters. Inside a pruned search a child that returns a score equal
   to alpha has only been shown to be no better than alpha; its true value
   may be worse. Treating such a score as a tie and then picking from the
   tied set at random would let a supposedly perfect player choose a losing
   move. Pruning still applies in every subtree below the root, which is
   where nearly all of the saving comes from anyway.
   ---------------------------------------------------------------------- */

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

  /* Both agents are deterministic, so without random tie breaking every
     game in a batch of N would be move for move identical and the
     scoreboard would read N of whatever the first game was. Choosing at
     random among moves of equal exact value keeps play optimal while
     letting the games differ. */
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

/* --- one complete game, played out with no interface involved ----------
   Returns the winner (P1, P2 or 0 for a draw), the move list, and the
   total nodes each agent searched.
   ---------------------------------------------------------------------- */

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
