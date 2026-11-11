/* ===================================================================
   Multi-player tic-tac-toe engine.

   Handles a B x B board, M players, and a win length L. Used unchanged
   by Task 4 (B=4) and Task 5 (B=3..10), both with three players and
   three in a row to win; only the settings the interface passes in
   differ.

   Pure logic, no DOM.

   TWO SEARCHES
   ------------
   Minimax, and with it alpha-beta, needs two sides whose interests are
   exactly opposed, so that one number describes the position for both.
   With three players that is not true as it stands: if player 1 is
   ahead, players 2 and 3 are both behind, but not equally.

   1. Alpha-beta, paranoid (the default).
      The player choosing a move assumes the other two are working
      together against it (Sturtevant and Korf, 2000). That turns the
      game back into two sides, "me" and "everyone else", with one
      number between them: my score. I maximise it, every other player
      minimises it. Minimax applies unchanged, and so does alpha-beta
      pruning. The assumption is pessimistic, since the other two are
      not really a team, but it is safe: a move that holds up against
      two co-operating opponents holds up against two independent ones.

   2. max^n (Luckhardt and Irani, 1986), kept for comparison.
      Every position is scored as a vector with one component per
      player, and the player to move picks the child that maximises its
      own component. This models each player more faithfully, but there
      is no alpha and beta to compare, so there is no deep pruning; only
      the immediate-win cutoff applies. Running both on the same board
      shows what alpha-beta pruning is worth with three players.

   HEURISTICS
   ----------
   Both searches use the same three, each described where it is defined:
   candidate restriction, open paths move ordering, and a depth limit
   with an evaluation function.
   =================================================================== */

'use strict';

var EMPTY = 0;

/* Far above anything the evaluation function can return, so a heuristic
   guess about a position can never outrank an actual win. */
var WIN_SCORE = 1000000;

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
     at only the lines the last move could possibly have completed, and is
     what the open paths ordering counts. */
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

function nextPlayer(game, p) {
  return (p % game.M) + 1;
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
   on, so even a shallow search explodes. A move far away from every mark
   on the board is close to worthless, because a winning line has to be
   built next to something. Candidate moves are therefore restricted to
   empty cells within `radius` of an occupied cell.

   This is a heuristic, not a sound reduction: it can in principle miss a
   good move in open space. On tic-tac-toe style games that cost is small
   and the saving is what keeps the search inside memory.
   --------------------------------------------------------------------- */

function candidateMoves(game, board, radius) {
  var B = game.B;
  var out = [];
  var seen = new Uint8Array(game.size);
  var i, r, c, dr, dc, rr, cc, idx;

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

/* --- move ordering: the open paths heuristic ---------------------------
   HEURISTIC 2 of 3.

   Alpha-beta prunes more when strong moves are tried first, because an
   early good result tightens alpha or beta and lets later siblings be
   cut off sooner. Moves are ordered by the number of possible paths still
   open through the cell: lines through it that no other player has a mark
   in. On an empty 3x3 board that is 4 for the centre, 3 for a corner and
   2 for an edge. On larger boards, cells near the middle lie on more lines
   than cells near the edge, and cells boxed in by opponents lose paths.

   Two kinds of move jump the queue because they decide the game on the
   spot: a move that completes a line for the player moving, and then a
   move that blocks a line another player would complete next turn.

   The ordering never changes the value the search returns, only how much
   work it takes to find it.
   --------------------------------------------------------------------- */

function lineState(game, board, lineId, player) {
  /* Returns how many of `player`'s marks the line holds, or -1 if another
     player also has a mark in it (the line is dead for `player`). */
  var line = game.lines[lineId];
  var own = 0;
  for (var k = 0; k < line.length; k++) {
    var v = board[line[k]];
    if (v === EMPTY) continue;
    if (v === player) own++;
    else return -1;
  }
  return own;
}

function openPaths(game, board, cell, player) {
  var ids = game.linesThrough[cell];
  var n = 0;
  for (var i = 0; i < ids.length; i++) {
    if (lineState(game, board, ids[i], player) >= 0) n++;
  }
  return n;
}

/* True if putting `player` on `cell` would complete one of its lines. */
function completesLine(game, board, cell, player) {
  var ids = game.linesThrough[cell];
  for (var i = 0; i < ids.length; i++) {
    if (lineState(game, board, ids[i], player) === game.L - 1) return true;
  }
  return false;
}

function orderMoves(game, board, player, moves) {
  var key = {};
  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    var k = openPaths(game, board, m, player);
    if (completesLine(game, board, m, player)) {
      k += 2000;                                    // wins now
    } else {
      for (var p = 1; p <= game.M; p++) {
        if (p !== player && completesLine(game, board, m, p)) {
          k += 1000;                                // blocks a win
          break;
        }
      }
    }
    key[m] = k;
  }
  return moves.slice().sort(function (a, b) { return key[b] - key[a] || a - b; });
}

/* The cells with the most paths through them on an empty board. The
   opening move is chosen at random among these. */
function bestOpenings(game) {
  var most = 0, out = [];
  for (var i = 0; i < game.size; i++) {
    var n = game.linesThrough[i].length;
    if (n > most) { most = n; out = [i]; }
    else if (n === most) out.push(i);
  }
  return out;
}

/* --- evaluation --------------------------------------------------------
   HEURISTIC 3 of 3, used when the depth limit stops the search before
   the game ends.

   A line counts for a player only if no other player has a mark in it,
   because a line already contested is dead for everyone. An open line is
   worth count^3, so two marks in an open line (8) are worth far more than
   two marks in separate lines (2). The cube rather than the square is
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

/* How many empty cells would let some player other than `player` complete
   a line on their next turn. Used only to break ties at the root. */
function threatsAgainst(game, board, player) {
  var hot = new Uint8Array(game.size);
  var n = 0;
  var lines = game.lines;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var owner = EMPTY, count = 0, gap = -1, dead = false;
    for (var k = 0; k < line.length; k++) {
      var cell = board[line[k]];
      if (cell === EMPTY) { gap = line[k]; continue; }
      if (owner === EMPTY) { owner = cell; count = 1; }
      else if (cell === owner) count++;
      else { dead = true; break; }
    }
    if (!dead && owner !== EMPTY && owner !== player &&
        count === game.L - 1 && !hot[gap]) {
      hot[gap] = 1;
      n++;
    }
  }
  return n;
}

/* The single number the paranoid search works with: the root player's
   evaluation less that of everyone else combined. */
function evaluateFor(game, board, root) {
  var v = evaluate(game, board);
  var s = v[root];
  for (var p = 1; p <= game.M; p++) if (p !== root) s -= v[p];
  return s;
}

/* ======================================================================
   SEARCH 1: alpha-beta under the paranoid assumption
   ======================================================================

   `root` is the player the search is choosing a move for. Its turns are
   maximising nodes; every other player's turns are minimising nodes,
   because under the paranoid assumption every other player is trying to
   push root's score down.

   alpha = the best score root can already guarantee elsewhere.
   beta  = the lowest score the opponents can already hold root to.
   When alpha >= beta, the player choosing at the parent would never let
   play reach this position, so the remaining siblings are cut off.

   Terminal scores are WIN_SCORE less the depth, so a quicker win is
   preferred and, when a loss cannot be avoided, a slower one.
   ---------------------------------------------------------------------- */

function alphabeta(game, board, toMove, root, depth, maxDepth, radius,
                   alpha, beta, ctx) {
  ctx.nodes++;
  if (ctx.nodes > ctx.nodeBudget) {
    ctx.exhausted = true;
    return evaluateFor(game, board, root);
  }
  if (depth >= maxDepth) return evaluateFor(game, board, root);

  var moves = orderMoves(game, board, toMove,
                         candidateMoves(game, board, radius));
  var next = nextPlayer(game, toMove);
  var maximising = (toMove === root);
  var best = maximising ? -Infinity : Infinity;

  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    board[m] = toMove;

    var score;
    if (checkWinAt(game, board, m)) {
      score = maximising ? WIN_SCORE - depth : depth - WIN_SCORE;
    } else if (boardIsFull(game, board)) {
      score = 0;
    } else {
      score = alphabeta(game, board, next, root, depth + 1, maxDepth, radius,
                        alpha, beta, ctx);
    }

    board[m] = EMPTY;

    if (maximising) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }

    /* Two reasons to stop looking at this node's remaining moves.
       The usual one: alpha >= beta, so the parent will never choose this
       position. And immediate pruning: a game won on this very move is
       the best score a maximising node can reach, and the worst a
       minimising node can inflict, because any later win sits deeper
       and scores less. Both are exact; neither changes the result. */
    if (alpha >= beta ||
        (maximising && best >= WIN_SCORE - depth) ||
        (!maximising && best <= depth - WIN_SCORE)) {
      ctx.cutoffs++;
      ctx.skipped += moves.length - i - 1;
      break;
    }
  }
  return best;
}

/* ======================================================================
   SEARCH 2: max^n
   ====================================================================== */

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

function maxn(game, board, toMove, depth, maxDepth, radius, ctx) {
  ctx.nodes++;
  if (ctx.nodes > ctx.nodeBudget) { ctx.exhausted = true; return evaluate(game, board); }
  if (depth >= maxDepth) return evaluate(game, board);

  var moves = orderMoves(game, board, toMove,
                         candidateMoves(game, board, radius));
  var best = null;
  var bestScore = -Infinity;
  var next = nextPlayer(game, toMove);

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

      /* Immediate pruning, the only cutoff max^n allows here. Nothing can
         beat winning right now, so once a move scores that, its siblings
         need not be looked at. */
      if (bestScore >= WIN_SCORE - depth) {
        ctx.cutoffs++;
        ctx.skipped += moves.length - i - 1;
        break;
      }
    }
  }
  return best || drawVector(game.M);
}

/* --- the call the interface makes ---------------------------------------
   method is 'alphabeta' (the default) or 'maxn'.
   ------------------------------------------------------------------------ */

function chooseMove(game, board, player, maxDepth, radius, nodeBudget, method) {
  var ctx = {
    nodes: 0,
    cutoffs: 0,
    skipped: 0,
    exhausted: false,
    nodeBudget: nodeBudget || 400000
  };
  var useMaxn = (method === 'maxn');
  var work = Int8Array.from(board);

  /* Opening move. On an empty board the cells with the most paths through
     them are the strongest, and by symmetry they are all equivalent, so
     searching them is wasted effort. One is picked at random. Without the
     randomness the engine would be deterministic from the first move and
     all N games in a batch would be replays of each other. */
  var occupied = 0;
  for (var q = 0; q < game.size; q++) if (work[q] !== EMPTY) occupied++;

  if (occupied === 0) {
    var opens = bestOpenings(game);
    return { move: opens[(Math.random() * opens.length) | 0],
             nodes: 0, cutoffs: 0, skipped: 0, ms: 0, exhausted: false,
             considered: opens.length, score: 0 };
  }

  var t0 = performance.now();
  var moves = orderMoves(game, work, player,
                         candidateMoves(game, work, radius));
  var next = nextPlayer(game, player);

  /* The root is searched explicitly so that every candidate the player
     might choose comes back with its exact value, and ties among the best
     can be broken at random.

     For alpha-beta this needs care (see Task 3). A move searched with a
     narrowed window that returns the same score as the best so far has
     only been shown to be no better than it. So each root move is searched
     with alpha set just below the best value found so far, and beta left
     open. A move that cannot reach the best is still cut off quickly, but
     a move that does reach it is searched exactly, so a tie is a real tie. */
  var EPS = 1e-6;
  var bestScore = -Infinity;
  var bestMoves = [];

  for (var i = 0; i < moves.length; i++) {
    var m = moves[i];
    work[m] = player;

    var score;
    if (checkWinAt(game, work, m)) {
      score = WIN_SCORE;
    } else if (boardIsFull(game, work)) {
      score = 0;
    } else if (useMaxn) {
      score = maxn(game, work, next, 1, maxDepth, radius, ctx)[player];
    } else {
      score = alphabeta(game, work, next, player, 1, maxDepth, radius,
                        bestScore - EPS, Infinity, ctx);
    }

    work[m] = EMPTY;

    if (score > bestScore + EPS) {
      bestScore = score;
      bestMoves = [m];
      if (bestScore >= WIN_SCORE) break;          // immediate win, stop
    } else if (Math.abs(score - bestScore) <= EPS) {
      bestMoves.push(m);
    }
  }

  /* Breaking ties. When several moves share the best value, prefer the
     one that leaves the fewest open threats for the other players, then
     the one with the best evaluation, and only then choose at random.

     This matters most when a player believes it is lost. Suppose player 1
     has two open ways to complete a line. Player 2 can block only one,
     and under the paranoid assumption player 3 will not block the other,
     so every move player 2 has scores the same loss. Left to chance, or
     to the evaluation alone, player 2 would rather extend a line of its
     own, and player 3, then facing two open threats, would give up too.
     Preferring the move that leaves fewer threats makes player 2 block
     one end, and leaves player 3 a position where blocking the other end
     actually saves it. The paranoid assumption is what makes player 2
     think it is lost; in the real game player 3 does not want player 1 to
     win either. */
  if (bestMoves.length > 1) {
    var fewest = Infinity, top = -Infinity, keep = [];
    for (var j = 0; j < bestMoves.length; j++) {
      work[bestMoves[j]] = player;
      var t = threatsAgainst(game, work, player);
      var e = evaluateFor(game, work, player);
      work[bestMoves[j]] = EMPTY;
      if (t < fewest || (t === fewest && e > top + EPS)) {
        fewest = t; top = e; keep = [bestMoves[j]];
      } else if (t === fewest && Math.abs(e - top) <= EPS) {
        keep.push(bestMoves[j]);
      }
    }
    bestMoves = keep;
  }

  return {
    move: bestMoves[(Math.random() * bestMoves.length) | 0],
    score: bestScore,
    nodes: ctx.nodes,
    cutoffs: ctx.cutoffs,
    skipped: ctx.skipped,
    considered: moves.length,
    exhausted: ctx.exhausted,
    ms: performance.now() - t0
  };
}

/* --- a full game, no interface involved ---------------------------------- */

function playGame(game, depth, radius, nodeBudget, method) {
  var board = emptyBoard(game);
  var toMove = 1;
  var plies = 0;
  var nodes = 0;
  var exhausted = false;

  for (;;) {
    var r = chooseMove(game, board, toMove, depth, radius, nodeBudget, method);
    board[r.move] = toMove;
    nodes += r.nodes;
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
    toMove = nextPlayer(game, toMove);
  }
}
