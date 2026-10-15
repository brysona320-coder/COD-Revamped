# Deploy the ECHOFRONT visual update without breaking multiplayer

The Cloudflare Workers URL you requested is `https://relay-zero-play.relay-zero.workers.dev`.

**IMPORTANT: Do not deploy this repository directly under the `relay-zero-play` Worker name yet.** The ECHOFRONT GitHub source currently contains offline bot practice and does not contain the working multiplayer backend you report running at that URL. `wrangler deploy --name relay-zero-play` with an assets-only config could replace the live Worker code and break WebSockets, lobbies, Durable Object bindings and/or match hosting.

## Step 1 — Safe visual preview

The repository includes `wrangler.preview.jsonc` and the manual GitHub Actions workflow **Deploy ECHOFRONT visual preview to Cloudflare Workers**. The Worker name is deliberately `echofront-visual-preview`, separate from the existing production Worker.

1. In your Cloudflare dashboard, create a scoped API token with permission to edit Workers in the correct account. Note the Cloudflare Account ID.
2. In GitHub → the ECHOFRONT repository → Settings → Secrets and variables → Actions, add two **repository secrets**: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Do not put token values in source code or chat.
3. Run Actions → **Deploy ECHOFRONT visual preview to Cloudflare Workers** → **Run workflow**.
4. The workflow installs dependencies, runs tests, builds the Vite frontend, then uses `cloudflare/wrangler-action@v4` to deploy the static assets to a separate Worker named `echofront-visual-preview`. Its exact hostname depends on your Cloudflare account subdomain.
5. Test the arena, menu, graphics tiers and pointer lock from a desktop browser. The preview does **not** add online multiplayer.

You can also build/deploy the same safe preview locally if Wrangler is authenticated:

```bash
npm install
npm test
npm run build
npx wrangler deploy --config wrangler.preview.jsonc
```

## Step 2 — Integrate with the existing live multiplayer Worker

Before replacing anything at `relay-zero-play`, obtain the **actual source code and Wrangler configuration** currently deployed under that Worker name, including Worker request handlers, Durable Objects/WebSocket endpoints, bindings, secrets' **names** (never secret values), routes and any required persistence/migrations.

Integrate the updated built frontend into that **existing** Worker project. Preserve its server `main` entrypoint and Durable Object definitions; configure an `ASSETS` binding (`assets.directory = './dist'`) and ensure WebSocket/API paths are routed to the Worker script before assets. The exact `run_worker_first` routing must match the existing backend's endpoints. Re-test multiplayer between separate browsers or computers, room creation/join, reconnection, WebSocket upgrades, scoring and authentication before switching production.

Only after that integration has passed should a release pipeline target the exact production Worker name `relay-zero-play` and deploy to `https://relay-zero-play.relay-zero.workers.dev`. Make a backup/rollback plan first. **This repository does not contain the existing Worker implementation; updating its frontend code on GitHub alone does not publish to the production Workers URL.**
