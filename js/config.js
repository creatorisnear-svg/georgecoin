// Everything you would normally change lives in this file.
// Edit it on GitHub (pencil icon), commit, and the site updates in about a minute.
window.STACK_CONFIG = {
  // The monkey's name, used all over the page.
  name: "George",

  // Shown top left.
  site: "Georgecoin.fun",

  // Days roll over at midnight in this time zone (Arizona).
  timezone: "America/Phoenix",

  // A new coin every day. Add one line per launch:
  //   date     = launch day, YYYY-MM-DD (Arizona time)
  //   ticker   = without the $
  //   contract = the mint address; leave "" until it is live
  // The plate follows the newest launch that has a contract (never one dated after today).
  // Older lines stay in the week strip so people can still find those coins.
  launches: [
    { date: "2026-10-05", ticker: "STACK", contract: "" },
  ],

  // Optional links. Leave "" to hide.
  links: {
    x: "",
    telegram: "",
  },

  // "auto" = pretend orders while no coin is live yet. true / false forces it.
  demo: "auto",
};
