/* Public endpoint configuration only. Retailer credentials belong in the Worker. */
window.STORE_SCOUT_RETAILERS = Object.freeze({
  enabled: true,
  workerUrl: 'https://storescout-reminders-inbox.xxnovoaxgx.workers.dev',
  // Live API adapters served by the Worker.
  adapters: ['kroger', 'wholefoods'],
  // Weekly-ad feeds built by scrapers/ and published with the site.
  feeds: { sellers: 'data/sellers-weekly.json' },
  zipCode: '77019',
});
