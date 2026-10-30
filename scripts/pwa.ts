import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
const root = "apps/web/dist";
const files: string[] = [];
async function walk(path: string) {
  for (const item of await readdir(join(root, path), { withFileTypes: true })) {
    const file = path + "/" + item.name;
    if (item.isDirectory()) await walk(file);
    else if (!file.endsWith("/sw.js")) files.push(file);
  }
}
await walk("");
const hash = createHash("sha256");
for (const file of files.sort()) hash.update(await readFile(join(root, file)));
const cache = "cyberlab-static-" + hash.digest("hex").slice(0, 16);
await writeFile(
  join(root, "sw.js"),
  `const CACHE=${JSON.stringify(cache)};const FILES=${JSON.stringify(files)};self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cyberlab-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname==='/healthz'||url.pathname==='/sw.js')return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;}if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname).then(hit=>hit||fetch(event.request))));});`
);
