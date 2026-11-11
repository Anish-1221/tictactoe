// Engine for Tasks 4 and 5: B x B board, M players, L in a row to win.
// Both tasks use 3 players and L = 3; Task 4 fixes B = 4, Task 5 lets
// you pick B from 3 to 10. No DOM in here.
//
// Two searches:
//  - alphabeta(): minimax with alpha-beta, using the "paranoid" idea
//    (Sturtevant & Korf 2000). The player choosing a move assumes the
//    other two are teaming up against it, so it's back to two sides
//    (me vs everyone else) and normal alpha-beta works. Default.
//  - maxn(): max^n (Luckhardt & Irani 1986). Each position gets a score
//    per player and each player maximises its own. No alpha/beta, so no
//    real pruning. Kept only to compare node counts against.

'use strict';

var EMPTY = 0;

// needs to be bigger than anything evaluate() can return, otherwise a
// good-looking position could outscore an actual win on big boards
var WIN_SCORE = 1000000;

// every run of L cells in all 4 directions, built once per board size
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

function createGame(B, L, M) {
  var lines = buildLines(B, L);

  // linesThrough[cell] = ids of the lines containing that cell. Used for
  // the win check (only lines through the last move can have completed)
  // and for counting open paths.
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

// did the move at `at` just win? only checks lines through that cell
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

// full scan, only used at the end of a game to highlight the line
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

// Candidate moves: only empty cells within `radius` of some mark. A move
// out in empty space can't help build a line any time soon, and without
// this a 10x10 board has ~100 moves per ply and the search blows up.
// It's a heuristic, so it could in theory skip a good move.
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

// number of `player`'s marks in the line, or -1 if someone else has a
// mark there too (then the line is dead for `player`)
function lineState(game, board, lineId, player) {
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

// open paths through a cell = lines through it with no opponent marks
function openPaths(game, board, cell, player) {
  var ids = game.linesThrough[cell];
  var n = 0;
  for (var i = 0; i < ids.length; i++) {
    if (lineState(game, board, ids[i], player) >= 0) n++;
  }
  return n;
}

// would placing `player` on `cell` complete a line?
function completesLine(game, board, cell, player) {
  var ids = game.linesThrough[cell];
  for (var i = 0; i < ids.length; i++) {
    if (lineState(game, board, ids[i], player) === game.L - 1) return true;
  }
  return false;
}

// Move ordering for alpha-beta: winning moves first, then moves that
// block someone else's win, then the rest by number of open paths
// (cells near the middle sit on more lines). Better ordering = more
// cutoffs; the result of the search doesn't change.
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

// cells with the most lines through them; the first move is a random one
// of these (they're all equivalent by symmetry anyway)
function bestOpenings(game) {
  var most = 0, out = [];
  for (var i = 0; i < game.size; i++) {
    var n = game.linesThrough[i].length;
    if (n > most) { most = n; out = [i]; }
    else if (n === most) out.push(i);
  }
  return out;
}

// Evaluation used at the depth limit. A line only counts for a player if
// nobody else has a mark in it. Each such line is worth count^3, so two
// marks in one open line (8) beat two marks in separate lines (1 + 1).
// Returns one score per player: v[p] for player p, v[0] unused.
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

// how many empty cells would let some other player win next turn
// (only used for breaking ties at the root, see chooseMove)
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

// single score for the paranoid search: root's eval minus everyone else's
function evaluateFor(game, board, root) {
  var v = evaluate(game, board);
  var s = v[root];
  for (var p = 1; p <= game.M; p++) if (p !== root) s -= v[p];
  return s;
}

// Alpha-beta, paranoid version. `root` is the player we're choosing a
// move for: its turns maximise, every other player's turns minimise.
// Wins score WIN_SCORE - depth so quicker wins (and slower losses) are
// preferred.
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

    // normal cutoff (alpha >= beta), or someone just won on this move,
    // which is already the best/worst this node can get
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

// max^n: winner gets WIN_SCORE - depth, the others split the negative,
// so the vector adds up to 0
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

      // the only pruning max^n gets here: can't beat winning right now
      if (bestScore >= WIN_SCORE - depth) {
        ctx.cutoffs++;
        ctx.skipped += moves.length - i - 1;
        break;
      }
    }
  }
  return best || drawVector(game.M);
}

// Called by the pages. method is 'alphabeta' (default) or 'maxn'.
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

  // first move: random cell among the ones with the most paths. No point
  // searching, and the randomness stops every game in a batch from being
  // identical.
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

  // Root loop. Each move is searched with alpha just under the best score
  // so far. Same issue as in Task 3: a score that only equals alpha isn't
  // an exact value, so it can't be treated as a tie. With alpha slightly
  // below the best, a move that really ties comes back exact, and worse
  // moves still get cut off early.
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
      if (bestScore >= WIN_SCORE) break;          // can win now, take it
    } else if (Math.abs(score - bestScore) <= EPS) {
      bestMoves.push(m);
    }
  }

  // Tie-break: fewest open threats left for the others, then best eval,
  // then random. Without this, when P1 has two ways to win, P2 sees a loss
  // either way (it assumes P3 won't help), so it stops blocking and P3
  // then can't save it either. Making P2 block one end leaves P3 able to
  // block the other.
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

// plays one full game without the page (used for testing)
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
