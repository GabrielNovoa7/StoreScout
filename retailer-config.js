/* Public endpoint configuration only. Retailer credentials belong in the Worker. */
window.STORE_SCOUT_RETAILERS = Object.freeze({
  enabled: true,
  workerUrl: 'https://storescout-reminders-inbox.xxnovoaxgx.workers.dev',
  adapters: ['kroger'],
  zipCode: '77019',
});
