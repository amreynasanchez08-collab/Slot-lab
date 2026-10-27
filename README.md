# Slot Lab

Local math lab for a 3-reel, 3-row fruit slot in the style of "Big Show". It has a playable
machine and a Monte Carlo simulator. The balance is fictitious and nothing connects to real
money. Local only: no remote repository.

## Run

```
npm install
npm run dev       # http://127.0.0.1:5174
npm test          # engine tests (lines, anywhere wins, dancers, RNG, exact RTP, money)
npm run build     # typecheck + production build
```

## Game rules

- **Base game:** pays only on 5 lines (3 rows and 2 diagonals), three of a kind.
  Cherry 2, Lemon 4, Orange 6, Plum 8, Bell 20, Melon 60, Seven 100 (x line bet; line bet =
  total bet / 5).
- **Mystery Bonus:** three on a prize pay as a random paytable symbol (one draw per spin,
  mean 28.6x line bet).
- **Dancer:** a symbol three cells tall: head x3, torso x2, legs x1. The complete dancer on
  all three reels awards 15 free games.
- In the base game the dancer only triggers the free games; she is not a wild there.
- **Free games:** any three or more of a symbol anywhere on the screen pay that symbol's
  prize once. Dancers are wild: missing cells (one or two) are filled with the best dancers and
  takes the product of their multipliers. Dancers alone pay nothing. Three complete dancers
  add 15 more games (retrigger). Free games use their own reel set.

## Why the dancer is not a wild in the base game

The target is a bonus about every 150 spins. That needs the complete dancer on each reel
about one spin in five, so two complete dancers land together on ~3.5% of spins. As a
wild she would make all five lines pay on those spins, and the base game alone would return
more than 200% (793% with her multipliers). `Rules` in `evaluate.ts` keeps both options.

## How the math is set

Two levers, each solved with an exact analysis (every weighted stop combination):

1. The torso stop weight sets the trigger rate to 1 / "bonus every N spins".
2. The mystery Bonus weight in the base game fills the rest of the target RTP.

The free-game reels are fixed and pay ~3.4x the bet per game, ~51x per 15-game round. The
free-game share of the RTP follows from the trigger rate: about 36% at 1 in 150.

```
RTP = base + p * E[games per round] * E[free-game win]
E[games per round] = 15 / (1 - r * 15)      (Wald, retriggers included)
```

`p` is the trigger chance on the base reels and `r` the same chance on the free-game reels.

## Measured at RTP 95%, bonus every 150 spins

| Metric | Theoretical | 1M-spin simulation |
|---|---|---|
| RTP | 95.00% | 94.78% (±1.41) |
| Base / free games | 60.65% / 34.35% | 60.46% / 34.32% |
| Free games | 1 in 150 | 1 in 149 |
| Average round | 51.5x bet | 51.0x bet |
| Base hit frequency | 9.47% | 9.44% |

Trade-offs: only ~9.5% of base spins pay (the dancer takes much of the screen), and with
dancers this rare in the free games a retrigger is about one in a billion games.

## Definitions

- **LDW (loss disguised as a win):** a paid spin that wins something, but less than the bet.
- **Near miss:** two complete dancers, or two Bonus / Melons / Sevens on a line, without the
  prize. The engine only detects near misses; it never steers reels to produce them.
- **Drawdown:** largest fall from a running balance peak.

## Limits

- The reel strips are our own. The real game's strips are not public, so this reproduces
  the format and the mechanics, not the commercial game's exact math.
- The RNG (xoshiro128**) is a fast statistical generator, not a certified gaming RNG.

---

# Plenty on Twenty hot (second game)

Novomatic's 5-reel, 3-row, 20-line fruit game with stacked symbols. Code in `src/plenty/`,
UI in `src/ui/plenty/`. Pick the game with the selector at the top of the page.

## Rules (from the game's paytable and rules screens)

- Wins pay left to right on 20 fixed lines; only the highest win per line is paid.
- Seven is wild for every symbol except the star, and pays on its own.
- Star scatter pays anywhere, in multiples of the total bet, added to line wins.
- No free games. Gamble (red/black, 50/50) after a win, up to 5 doubles; it is fair, so it
  does not change the RTP and the simulator never takes it.

| Symbols | x3 | x4 | x5 (x line bet = bet / 20) |
|---|---|---|---|
| Seven | 40 | 400 | 1000 |
| Bell | 20 | 80 | 400 |
| Melon, Plum | 20 | 40 | 200 |
| Cherry, Lemon, Orange | 10 | 20 | 100 |
| Star (x total bet, anywhere) | 5 | 20 | 500 |

The line shapes in `src/plenty/evaluate.ts` are PROVISIONAL (the common 5x3 20-line set);
the game's line chart has not been seen yet.

## Math

Exact without enumerating 5-reel combinations: a line sees one row per reel and reels are
independent, so each line's expectation is a sum over 8^5 symbol tuples of per-reel row
probabilities; stars never stack, so the star count is a sum of independent Bernoullis.
A test checks this against full brute force on small strips. The tuner moves only the
seven's weight; the published 95.61% is reached exactly (lines ~78%, stars ~17.6%).

Measured on 1M spins: RTP 95.40% (±1.08) vs 95.61% theoretical; 3+ stars 1 in 42.4 vs 42.3.
