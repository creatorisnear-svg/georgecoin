# Georgecoin.fun

George is a curious little monkey who lives for Sunday, because Sunday is pancake day.
There's a new coin every day, and every buy of today's coin drops a pancake on his plate.

Plain static site (HTML, CSS, JS). No server, no API keys. Hosted on Cloudflare Pages from this repo.

## Adding each day's coin

Go to **georgecoin.fun/admin/** (works on a phone). Paste the contract, the ticker fills itself in,
tap **Put it on the plate**. The site switches over within a minute or two, open pages included.

The first time, the page asks for a GitHub key (it walks you through making one). The key is
stored in that browser only and can only change this one repo.

Under the hood the owner page edits `data/site.json` through the GitHub API and Cloudflare Pages
republishes on every commit. Days roll over at midnight Arizona time (`timezone` in `js/config.js`).
The plate follows the newest coin dated today or earlier that has a contract; with none, the page
runs pretend orders.

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
