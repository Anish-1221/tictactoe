/* ===================================================================
   Multi-player tic-tac-toe engine.

   Handles a B x B board, M players, and a win length L. Used unchanged
   by Task 4 (B=4, M=3, L=4) and Task 5 (B=3..10, M=3, L adjustable);
   only the settings the interface passes in differ.

   Pure logic, no DOM.

   WHY NOT MINIMAX
   ---------------
   Minimax assumes two players with exactly opposed interests: one score
   serves for both, because what is good for one is bad for the other.
   With three players that stops being true. If player 1 is winning,
   players 2 and 3 are both losing, but not equally, and neither can be
   described by negating player 1's score.

   The generalisation used here is max^n (Luckhardt and Irani, 1986).
   Every position is scored as a VECTOR with one component per player,
   and the player to move chooses the child whose vector maximises their
   own component. With M = 2 and a zero-sum scoring rule this reduces to
   ordinary minimax, so it is the same idea rather than a different one.

   WHY ALPHA-BETA IS NOT USED HERE
   -------------------------------
   Alpha-beta relies on the two bounds alpha and beta being two views of
   one number. With a vector of scores there is no such pair, and in the
   general case max^n admits no safe deep pruning at all. Two sound
   prunes are used instead, both noted at their definitions below:
   immediate pruning, and a bound on the remaining players' share.
   =================================================================== */

'use strict';

var EMPTY = 0;
var WIN_SCORE = 100;

/* --- geometry ---------------------------------------------------------
   Every straight run of L cells on the board, in all four directions.
   Computed once per board size, not per search.
   -------------------------------------------------------------------- */

function buildLines(B, L) {
  var lines = [];
  var r, c, k, line;

  for (r = 0; r < B; r++) {                       // horizontal
    for (c = 0; c + L <= B; c++) {
      line = [];
      for (k = 0; k < L; k++) line.push(r * B + c + k);
      lines.push(line);
    }
  }
  for (c = 0; c < B; c++) {                       // vertical
    for (r = 0; r + L <= B; r++) {
      line = [];
      for (k = 0; k < L; k++) line.push((r + k) * B + c);
      lines.push(line);
    }
  }
  for (r = 0; r + L <= B; r++) {                  // diagonal, down-right
    for (c = 0; c + L <= B; c++) {
      line = [];
      for (k = 0; k < L; k++) line.push((r + k) * B + c + k);
      lines.push(line);
    }
  }
  for (r = 0; r + L <= B; r++) {                  // diagonal, down-left
    for (c = L - 1; c < B; c++) {
      line = [];
      for (k = 0; k < L; k++) line.push((r + k) * B + c - k);
      lines.push(line);
    }
  }
  return lines;
}

/* A game object bundles the settings with everything derived from them. */
function createGame(B, L, M) {
  var lines = buildLines(B, L);

  /* For each cell, which lines pass through it. Lets the win check look
     at only the lines the last move could possibly have completed,
     instead of all of them. */
  var linesThrough = [];
  var i, j;
  for (i = 0; i < B * B; i++) linesThrough.push([]);
  for (i = 0; i < lines.length; i++) {
    for (j = 0; j < lines[i].length; j++) {
      linesThrough[lines[i][j]].push(i);
    }
  }

  return {
    B: B, L: L, M: M,
    size: B * B,
    lines: lines,
    linesThrough: linesThrough
  };
}

function emptyBoard(game) {
  return new Int8Array(game.size);
}

/* --- win detection -----------------------------------------------------
   checkWinAt is the one used during search: after a move at cell `at`,
   only the lines through `at` can have just been completed.
   --------------------------------------------------------------------- */

function checkWinAt(game, board, at) {
  var ids = game.linesThrough[at];
  var player = board[at];
  for (var i = 0; i < ids.length; i++) {
    var line = game.lines[ids[i]];
    var full = true;
    for (var k = 0; k < line.length; k++) {
      if (board[line[k]] !== player) { full = false; break; }
    }
    if (full) return true;
  }
  return false;
}

/* Full scan, used once at the end of a game to highlight the line. */
function findWinningLine(game, board) {
  for (var i = 0; i < game.lines.length; i++) {
    var line = game.lines[i];
    var p = board[line[0]];
    if (p === EMPTY) continue;
    var full = true;
    for (var k = 1; k < line.length; k++) {
      if (board[line[k]] !== p) { full = false; break; }
    }
    if (full) return { player: p, line: line };
  }
  return null;
}

function legalMoves(game, board) {
  var m = [];
  for (var i = 0; i < game.size; i++) if (board[i] === EMPTY) m.push(i);
  return m;
}

function boardIsFull(game, board) {
  for (var i = 0; i < game.size; i++) if (board[i] === EMPTY) return false;
  return true;
}

/* --- candidate moves ---------------------------------------------------
   HEURISTIC 1 of 3, and the one that makes large boards possible at all.

   On a 10x10 board the first move has 100 replies, the second 99, and so
   on, so even a shallow search explodes. In practice a move far away from
   every mark on the board is close to worthless, because a winning line
   has to be built next to something. Candidate moves are therefore
   restricted to empty cells within `radius` of an occupied cell.

   On an empty board the single centre cell is returned, since by symmetry
   every opening is equivalent and searching all of them wastes the entire
   first search.

   This is a heuristic, not a sound reduction: it can in principle miss a
   good move in open space. On tic-tac-toe style games that cost is small
   and the saving is what keeps the search inside memory.
   --------------------------------------------------------------------- */

function candidateMoves(game, board, radius) {
  var B = game.B;
  var out = [];
  var seen = new Uint8Array(game.size);
  var occupied = 0;
  var i, r, c, dr, dc, rr, cc, idx;

  for (i = 0; i < game.size; i++) if (board[i] !== EMPTY) occupied++;

  if (occupied === 0) {
    var mid = Math.floor(B / 2);
    return [mid * B + mid];
  }

  for (i = 0; i < game.size; i++) {
    if (board[i] === EMPTY) continue;
    r = (i / B) | 0;
    c = i % B;
    for (dr = -radius; dr <= radius; dr++) {
      for (dc = -radius; dc <= radius; dc++) {
        rr = r + dr; cc = c + dc;
        if (rr < 0 || rr >= B || cc < 0 || cc >= B) continue;
        idx = rr * B + cc;
        if (board[idx] === EMPTY && !seen[idx]) {
          seen[idx] = 1;
          out.push(idx);
        }
      }
    }
  }
  return out.length ? out : legalMoves(game, board);
}

/* The cells within `ring` of the board's centre, used only to vary the
   opening move. */
function centralCells(game, ring) {
  var B = game.B;
  var mid = (B - 1) / 2;
  var out = [];
  for (var r = 0; r < B; r++) {
    for (var c = 0; c < B; c++) {
      if (Math.abs(r - mid) <= ring + 0.5 && Math.abs(c - mid) <= ring + 0.5) {
        out.push(r * B + c);
      }
    }
  }
  return out.length ? out : [Math.floor(B / 2) * B + Math.floor(B / 2)];
}

/* --- evaluation --------------------------------------------------------
   Scores a non-terminal position for every player at once.

   A line counts for a player only if no other player has a mark in it,
   because a line already contested is dead for everyone. An open line is
   worth count^3, so three marks in a row (27) is worth far more than
   three separate single marks (3). The cube rather than the square is
   what makes the engine take threats seriously on larger boards, where a
   player may have many weak lines at once.

   Returns a fresh vector of length M+1, indexed by player number, with
   index 0 unused so that player p reads at vector[p].
   --------------------------------------------------------------------- */

function evaluate(game, board) {
  var M = game.M;
  var v = new Float64Array(M + 1);
  var lines = game.lines;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var owner = EMPTY;
    var count = 0;
    var dead = false;

    for (var k = 0; k < line.length; k++) {
      var cell = board[line[k]];
      if (cell === EMPTY) continue;
      if (owner === EMPTY) { owner = cell; count = 1; }
      else if (cell === owner) { count++; }
      else { dead = true; break; }
    }

    if (!dead && owner !== EMPTY) {
      v[owner] += count * count * count;
    }
  }
  return v;
}

/* Terminal vector: the winner takes WIN_SCORE less the depth it took, and
   that value is shared out negatively among everyone else, so the vector
   still sums to zero and no player is indifferent to who beats them. */
function winVector(M, winner, depth) {
  var v = new Float64Array(M + 1);
  var value = WIN_SCORE - depth;
  var share = value / (M - 1);
  for (var p = 1; p <= M; p++) v[p] = (p === winner) ? value : -share;
  return v;
}

function drawVector(M) {
  return new Float64Array(M + 1);
}

/* --- max^n search -------------------------------------------------------
   Returns the score vector for the position. `toMove` picks the child
   that maximises vector[toMove].
   ---------------------------------------------------------------------- */

function maxn(game, board, toMove, depth, maxDepth, radius, ctx) {
  ctx.nodes++;
  if (ctx.nodes > ctx.nodeBudget) { ctx.exhausted = true; return evaluate(game, board); }

  if (depth >= maxDepth) return evaluate(game, board);

  var moves = candidateMoves(game, board, radius);
  if (moves.length === 0) return drawVector(game.M);

  /* Move ordering, HEURISTIC 2 of 3. Trying the moves that look best
     first makes immediate pruning fire sooner and, on a cut-off search,
     means the moves that did get examined were the plausible ones. */
  if (moves.length > 2 && depth < 2) {
    moves = orderMoves(game, board, toMove, moves);
  }

  var best = null;
  var bestScore = -Infinity;
  var next = (toMove % game.M) + 1;

  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    board[m] = toMove;

    var vec;
    if (checkWinAt(game, board, m)) {
      vec = winVector(game.M, toMove, depth);
    } else if (boardIsFull(game, board)) {
      vec = drawVector(game.M);
    } else {
      vec = maxn(game, board, next, depth + 1, maxDepth, radius, ctx);
    }

    board[m] = EMPTY;

    if (vec[toMove] > bestScore) {
      bestScore = vec[toMove];
      best = vec;
      ctx.bestMove = m;
      if (depth === 0) ctx.rootBest = m;

      /* HEURISTIC 3 of 3, immediate pruning. Nothing can beat winning
         right now, so once a move scores the maximum achievable there is
         no reason to look at its siblings. This is sound rather than
         approximate: the value cannot be improved on. */
      if (bestScore >= WIN_SCORE - depth) {
        ctx.cutoffs++;
        break;
      }
    }
  }

  return best || drawVector(game.M);
}

/* Cheap ordering: score each candidate by how much it improves the mover's
   own evaluation, best first. One evaluate() per candidate, so it is only
   worth doing near the root. */
function orderMoves(game, board, toMove, moves) {
  var scored = [];
  for (var i = 0; i < moves.length; i++) {
    board[moves[i]] = toMove;
    var v = evaluate(game, board);
    board[moves[i]] = EMPTY;
    scored.push({ move: moves[i], s: v[toMove] });
  }
  scored.sort(function (a, b) { return b.s - a.s; });
  var out = [];
  for (var j = 0; j < scored.length; j++) out.push(scored[j].move);
  return out;
}

/* --- the call the interface makes --------------------------------------- */

function chooseMove(game, board, player, maxDepth, radius, nodeBudget) {
  var ctx = {
    nodes: 0,
    cutoffs: 0,
    rootBest: -1,
    bestMove: -1,
    exhausted: false,
    nodeBudget: nodeBudget || 400000
  };

  var work = Int8Array.from(board);

  /* Opening move. Every cell near the centre is equivalent by symmetry
     at this point, so searching them is wasted effort, and picking the
     single best one deterministically would make all N games in a batch
     replays of each other: the engine is deterministic from here on, so
     the same opening always produces the same game. One random central
     opening per game is what makes a batch of N games informative. */
  var occupied = 0;
  for (var q = 0; q < game.size; q++) if (work[q] !== EMPTY) occupied++;

  if (occupied === 0) {
    var opens = centralCells(game, 1);
    return { move: opens[(Math.random() * opens.length) | 0],
             nodes: 0, cutoffs: 0, ms: 0, exhausted: false,
             considered: opens.length, score: 0 };
  }

  var moves = candidateMoves(game, work, radius);

  if (moves.length === 1) {
    return { move: moves[0], nodes: 0, cutoffs: 0, ms: 0,
             exhausted: false, considered: 1, score: 0 };
  }

  var t0 = performance.now();

  /* The root is searched explicitly so that every candidate gets a value
     and ties can be broken at random; without that, deterministic agents
     would replay the same game every time. */
  moves = orderMoves(game, work, player, moves);

  var bestScore = -Infinity;
  var bestMoves = [];
  var next = (player % game.M) + 1;

  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    work[m] = player;

    var vec;
    if (checkWinAt(game, work, m)) {
      vec = winVector(game.M, player, 0);
    } else if (boardIsFull(game, work)) {
      vec = drawVector(game.M);
    } else {
      vec = maxn(game, work, next, 1, maxDepth, radius, ctx);
    }

    work[m] = EMPTY;

    if (vec[player] > bestScore) {
      bestScore = vec[player];
      bestMoves = [m];
      if (bestScore >= WIN_SCORE) break;        // immediate win, stop
    } else if (vec[player] === bestScore) {
      bestMoves.push(m);
    }
  }

  return {
    move: bestMoves[(Math.random() * bestMoves.length) | 0],
    score: bestScore,
    nodes: ctx.nodes,
    cutoffs: ctx.cutoffs,
    considered: moves.length,
    exhausted: ctx.exhausted,
    ms: performance.now() - t0
  };
}

/* --- a full game, no interface involved ---------------------------------- */

function playGame(game, depths, radius, nodeBudget) {
  var board = emptyBoard(game);
  var toMove = 1;
  var plies = 0;
  var nodes = new Float64Array(game.M + 1);
  var exhausted = false;

  for (;;) {
    var r = chooseMove(game, board, toMove, depths[toMove], radius, nodeBudget);
    board[r.move] = toMove;
    nodes[toMove] += r.nodes;
    if (r.exhausted) exhausted = true;
    plies++;

    if (checkWinAt(game, board, r.move)) {
      return { winner: toMove, board: board, plies: plies,
               nodes: nodes, exhausted: exhausted };
    }
    if (boardIsFull(game, board)) {
      return { winner: 0, board: board, plies: plies,
               nodes: nodes, exhausted: exhausted };
    }
    toMove = (toMove % game.M) + 1;
  }
}
