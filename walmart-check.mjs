// One-off Walmart key check. Run: node walmart-check.mjs <consumerId> <keyVersion>
// Reads ~/.walmart-io/WM_IO_private_key.pem, signs one search the same way the
// Worker does, and prints Walmart's answer. The key itself is never printed.
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {createSign} from 'node:crypto';
const [consumerId, keyVersion = '1'] = process.argv.slice(2);
if (!consumerId) { console.log('Usage: node walmart-check.mjs <consumerId> <keyVersion>'); process.exit(1); }
const pem = readFileSync(`${homedir()}/.walmart-io/WM_IO_private_key.pem`, 'utf8');
const ts = String(Date.now());
const signature = createSign('RSA-SHA256').update(`${consumerId}\n${ts}\n${keyVersion}\n`).sign(pem, 'base64');
const url = 'https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?query=milk&numItems=2';
const res = await fetch(url, {headers: {'WM_CONSUMER.ID': consumerId, 'WM_CONSUMER.INTIMESTAMP': ts, 'WM_SEC.KEY_VERSION': keyVersion, 'WM_SEC.AUTH_SIGNATURE': signature, Accept: 'application/json'}});
console.log('Walmart answered:', res.status, res.statusText);
console.log((await res.text()).slice(0, 400));
