# Reference: 27 Eternal Hot (Amusnet) — rules and pays

Research notes for a possible third game in the lab. Reference only: we build our own
art, name and math; nothing here is to be copied as an asset.

Sources, read 2026-11-16:
- Official game page: amusnet.com/games/online-casino/27-eternal-hot (game ID 421, released 2023-08-22).
- Official in-game rules page, rendered inside the free demo (FUN currency), bet 0.30.
- Third-party paytable screenshots at bet 200 (casinolandia.com), consistent with the above.

## Layout and how wins count
- 3 reels x 3 rows, 27 "reel ways". 11 symbols, one of them Wild.
- Ways pay: one symbol per reel, left to right on adjacent reels from reel 1.
  The same symbol in another row of the same reel pays the combination again.
- Total bet = ways bet (10 units) x bet multiplier. Simultaneous ways wins add up.
- Only 3-of-a-kind combinations exist (3 reels).

## Pays (3 of a kind, per way, in multiples of total bet)
| Symbol | Pays | At bet 0.30 (demo) | At bet 200 (screenshot) |
|---|---|---|---|
| Wild | 50x | 15.00 | 10,000 |
| Seven, Bell | 30x | 9.00 | 6,000 |
| Pear, Grapes | 10x | 3.00 | 2,000 |
| Watermelon, Plum | 4x | 1.20 | 800 |
| Orange, Lemon, Cherry | 2x | 0.60 | 400 |

Wild substitutes for all symbols. Cross-check: at bet 200, three lemons on one way paid 400.

## Mystery Wheel (scatter)
- 3 wheel symbols anywhere trigger one spin of the wheel. 3 Wilds do not.
- 8 sectors: 30x, 50x, 80x and 100x total bet; and 4 free-spin sectors awarding 10, 15 or 20.
  Which free-spin value repeats is not stated.
- Sector sizes do not reflect real odds (weights are hidden).

## Free spins
- Played at the bet that triggered them, on an alternate reel set.
- Start automatically and cannot be stopped.
- Retrigger: not mentioned in the rules.
- The total can go to Gamble if it is under the gamble limit.

## Gamble
- Red/black, doubles the amount; wrong guess loses it.
- Only for wins up to 35x the bet (10.50 at bet 0.30). Attempts: 1-5, set per operator.

## Jackpot Cards (provider-wide, not part of this game's math)
- Random after a finished game; guarantees one of 4 levels (clubs < diamonds < hearts < spades).
- Pick from 12 face-down cards until 3 suits match; that level is paid.
- Funded by a percentage of bets; the operator sets qualifying bets. Excluded from Gamble.

## Wheel layout (seen in the official demo)
- Clockwise from the top: x100, 10 FS, x50, 15 FS, x80, 10 FS, x30, 20 FS.
  Prize and free-spin sectors alternate. "10 free spins" appears twice.
- Pointer: a gem at the top. Spin button in the hub. Auto-spins after a 15 s countdown.
- In the test, the wheel triggered on spin 198 (one sample only) and landed on x30.

## Visual reference (three layers, for our own original design)
- Art direction:
  - Warm orange and gold backdrop.
  - Burgundy reel window with a thick gold frame.
  - Every fruit symbol is drawn as a pair (two lemons, two sevens).
  - The wheel symbol is a teal tile with a candy-wheel badge.
  - Wins: gold box around each winning cell plus fire licking the symbols. That is the "hot" signature.
  - Wheel: gold rim with pink gems; purple multiplier sectors, orange free-spin sectors with marquee-bulb numbers.
- Layout:
  - Four jackpot meters across the top, game logo in the centre.
  - 3x3 window in the middle.
  - Right rail, top to bottom: autoplay / x2 gamble, big spin button, speed, collect.
  - Bottom bar: balance, bet chips (0.10 / 0.20 / 0.30...) that also spin, last win.
- UX:
  - One tap on a bet chip both sets the bet and spins.
  - The wheel overlays the reels without changing screen.
  - Gamble is a separate stage: card on a lit pedestal, heart/spade buttons, collect in the middle, attempts left.
- Free spins (captured on the 4th wheel; the first three landed on x30):
  - Same screen and background as the base game.
  - A banner under the reels reads "FREE SPIN n OF 10".
  - The alternate reel set shows Wilds far more often. Two Wilds on one screen was common.
  - Big wins inside the round get a "BIG WIN" overlay: fire ring, flying coins, count-up.
  - The round closes with a "TOTAL WIN" panel: burgundy with a gold frame.
  - Sample: 10 free spins paid 72x the bet (one round only, not a statistic).
- Screenshots are in the session scratchpad only; third-party art is not committed.

## Other
- RTP 96.37%. Volatility 2/5 (official page).
- Demo bet range 0.10-100 FUN. The real range depends on the operator.
- Official "max win" text is ambiguous ("50 x reel pays bet").
  The 10,000x figure on third-party sites is not confirmed by Amusnet.
- Unknown: reel strips, wheel weights, scatter frequency, free-spin reel set.
  These have to be designed and tuned by us, as with the other two games.
