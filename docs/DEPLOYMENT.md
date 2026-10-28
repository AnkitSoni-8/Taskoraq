# Deployment, security & backup checklist

## Render (one Web Service = API + website)
`.env` file Render par nahi chahiye (wo git me nahi jati). Sab settings Render Dashboard -> service -> **Environment** me daalte hain.

1. MongoDB Atlas: free cluster -> Database Access me user banao -> Network Access me `0.0.0.0/0` allow karo -> connection string lo (`mongodb+srv://<user>:<pass>@<cluster>/taskoraq`).
2. Code GitHub par push karo (`.env`, `node_modules`, `dist` push mat karo - `.gitignore` me hain).
3. Render -> New -> **Blueprint** -> repo select (ye `render.yaml` padh leta hai). Ya manual Web Service:
   - **Root Directory: khali chhodo** ("backend" mat likho)
   - Build Command: `npm run render-build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
4. Environment me ye daalo: `NODE_ENV=production`, `JWT_SECRET` (Generate / 48+ random chars), `MONGO_URI` (Atlas string), `TRUST_PROXY=true`, `NODE_VERSION=20.19.0`.
5. Deploy ke baad pehla admin banao: Environment me `ADMIN_SETUP_SECRET` (16+ chars) daalo, `POST https://<your-app>.onrender.com/api/auth/setup-admin` ({name,email,password,setupSecret}), phir secret hata do. (Demo site chahiye to `SEED_DEMO=true`.)
6. Free plan par attachments (uploads) restart par mit jati hain (disk nahi) - paid plan + Disk lagao aur `UPLOAD_DIR` us path par set karo.

"Missing script: build" error ka matlab Root Directory `backend` set tha; ab backend me bhi `build` script hai, lekin frontend tabhi milega jab Root Directory khali ho.

## Production config
- `NODE_ENV=production`, `JWT_SECRET` = 48+ random bytes (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- Secrets sirf host ke secret manager / env me; `.env` kabhi commit nahi.
- HTTPS reverse proxy (nginx/Caddy/platform TLS) + `TRUST_PROXY=true`; HSTS aur secure headers proxy ya `helmet` se.
- `CLIENT_ORIGIN` = exact frontend URL. Demo seeding off (`SEED_DEMO` set mat karo).

## Security audit (har release se pehle; output save karo)
    npm audit --omit=dev            # root
    cd backend && npm audit --omit=dev
Reference: OWASP Node.js Security Cheat Sheet. Results `docs/audit/` me rakho.

## Backup / restore
    mongodump --uri "$MONGO_URI" --out backup/$(date +%F)
    tar czf uploads-$(date +%F).tgz "$UPLOAD_DIR"
Restore test (scratch DB par):
    mongorestore --uri "mongodb://127.0.0.1:27017" --nsFrom 'taskoraq.*' --nsTo 'taskoraq_restore.*' backup/<date>
    tar xzf uploads-<date>.tgz -C /tmp/uploads-restore
Login + attachment download check karo, phir date ke saath result yahan note karo.

## Scale testing
`/bootstrap` sab issues ek saath lata hai. 5k-10k issues seed karke load time napo; zarurat ho to paginated issues API UI se jodo.
