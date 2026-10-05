# Georgecoin.fun

George is a curious little monkey who lives for Sunday, because Sunday is pancake day.
There's a new coin every day, and every buy of today's coin drops a pancake on his plate.

Plain static site (HTML, CSS, JS). No server, no API keys. Hosted on GitHub Pages.

## Adding each day's coin

Open `js/config.js` on GitHub, click the pencil, and add a line to `launches`:

```js
launches: [
  { date: "2026-10-05", ticker: "STACK", contract: "" },
  { date: "2026-10-06", ticker: "SECONDS", contract: "PASTE_THE_MINT_ADDRESS_HERE" },
],
```

Commit. The site updates in about a minute.

- `date` is the launch day in Arizona time (`timezone` in the same file).
- The plate follows the newest launch that has a contract. Leave `contract` empty until the coin is live.
- While nothing is live the page runs pretend orders so it never looks dead.

## How buys become pancakes

- DexScreener gives the number of buys in the last 24 hours. That is the starting stack.
- GeckoTerminal gives each new trade, so every buy drops a pancake sized by its SOL amount
  (silver dollar under 0.25, buttermilk to 1, fluffy to 5, the big one above that).
- The Jupiter swap box on the page lets people buy right there; their pancake lands with a flag on it.

## Testing

Add `?ca=ANY_MINT_ADDRESS` to the URL to watch any live coin's buys on the plate,
or `?demo=1` to force pretend orders.

## The character

George on this site is an original cartoon (ginger fur, long tail, chef's hat, apron).
It is not a copy of any existing character. Keep it that way: no yellow hats, no traced art.
