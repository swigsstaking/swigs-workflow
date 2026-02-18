# SWIGS Workflow - Documentation Infrastructure

## Table des matieres

1. [Architecture](#architecture)
2. [Configuration Serveur](#configuration-serveur)
3. [Deploiement](#deploiement)
4. [Scalabilite](#scalabilite)
5. [Securite](#securite)
6. [Monitoring](#monitoring)
7. [Backup & Recovery](#backup--recovery)
8. [Troubleshooting](#troubleshooting)
9. [Commandes Rapides](#commandes-rapides)

---

## Architecture

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         SW6C-1                                  │
│                   (i5-8500, 16GB RAM)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Nginx     │  │  PM2        │  │      MongoDB            │ │
│  │   (Proxy)   │──│  Cluster    │──│   (Local Instance)      │ │
│  │   :80/:443  │  │             │  │      :27017             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                          │                                      │
│         ┌────────────────┼────────────────┐                    │
│         ▼                ▼                ▼                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  workflow   │  │    hub      │  │    task     │            │
│  │   :3004     │  │   :3006     │  │   :3002     │            │
│  │ (2 inst.)   │  │ (1 inst.)   │  │ (1 inst.)   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Stack Technique

| Composant | Version | Role |
|-----------|---------|------|
| Node.js | 20.x LTS | Runtime JavaScript |
| Express | 4.21.x | Framework HTTP |
| MongoDB | 7.x | Base de donnees |
| PM2 | 5.x | Process Manager |
| Nginx | 1.24.x | Reverse Proxy |

### Ports Utilises

| Application | Port | Description |
|-------------|------|-------------|
| swigs-workflow | 3004 | Gestion projets & facturation |
| swigs-hub | 3006 | SSO central |
| swigs-task | 3002 | Gestion taches |
| ai-builder | 3001 | Constructeur IA |
| MongoDB | 27017 | Base de donnees |

---

## Configuration Serveur

### Variables d'environnement (.env)

```bash
# Server
PORT=3004
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/swigs-workflow

# Security
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d

# CORS (comma-separated list)
CORS_ORIGINS=https://workflow.swigs.ch,http://192.168.110.59:3004

# SWIGS Hub SSO
HUB_URL=https://apps.swigs.online
APP_ID=swigs-workflow
APP_SECRET=your-app-secret

# Email (SMTP)
SMTP_HOST=mail.infomaniak.com
SMTP_PORT=587
SMTP_USER=your-email@swigs.online
SMTP_PASS=your-password

# CMS Integration (optional)
CMS_API_URL=http://192.168.110.73:3000/api
CMS_SERVICE_TOKEN=your-cms-token
```

### Configuration Nginx

```nginx
# /etc/nginx/sites-available/swigs-workflow

upstream workflow_backend {
    least_conn;
    server 127.0.0.1:3004 weight=1;
    keepalive 32;
}

server {
    listen 80;
    server_name workflow.swigs.ch;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name workflow.swigs.ch;

    ssl_certificate /etc/letsencrypt/live/workflow.swigs.ch/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/workflow.swigs.ch/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain application/json application/javascript text/css;

    # API Backend
    location /api {
        proxy_pass http://workflow_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Frontend (static files)
    location / {
        root /home/swigs/swigs-workflow-frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Deploiement

### Chemin serveur

```
Serveur: 192.168.110.59 (SW6C-1)
User: swigs
Backend: ~/swigs-workflow/
Frontend: ~/swigs-workflow-frontend/
```

### Mise a jour Backend

```bash
# Depuis la machine locale
rsync -avz backend/server.js swigs@192.168.110.59:~/swigs-workflow/
rsync -avz backend/src/ swigs@192.168.110.59:~/swigs-workflow/src/

# Sur le serveur
ssh swigs@192.168.110.59
cd ~/swigs-workflow
npm install --production
pm2 reload swigs-workflow
```

### Mise a jour Frontend

```bash
# Build local
cd frontend
npm run build

# Deploy
rsync -avz --delete dist/ swigs@192.168.110.59:~/swigs-workflow-frontend/dist/
```

### Script de deploiement complet

```bash
#!/bin/bash
# deploy.sh

SERVER="swigs@192.168.110.59"
BACKEND_PATH="~/swigs-workflow"
FRONTEND_PATH="~/swigs-workflow-frontend"

echo "=== Deploiement SWIGS Workflow ==="

# Backend
echo ">> Backend..."
rsync -avz backend/server.js $SERVER:$BACKEND_PATH/
rsync -avz backend/ecosystem.config.cjs $SERVER:$BACKEND_PATH/
rsync -avz backend/package.json $SERVER:$BACKEND_PATH/
rsync -avz backend/src/ $SERVER:$BACKEND_PATH/src/

ssh $SERVER "cd $BACKEND_PATH && npm install --production && pm2 reload swigs-workflow"

# Frontend
echo ">> Frontend..."
cd frontend && npm run build && cd ..
rsync -avz --delete frontend/dist/ $SERVER:$FRONTEND_PATH/dist/

echo "=== Deploiement termine ==="
```

---

## Scalabilite

### Configuration actuelle (SW6C-1)

| Resource | Actuel | Recommande |
|----------|--------|------------|
| CPU Cores | 6 | 6 |
| RAM | 16 GB | 32 GB |
| PM2 Instances | 2 | 2-4 |
| MongoDB | Local | Local ou dedie |

### Capacite estimee

| Configuration | Utilisateurs simultanes |
|---------------|------------------------|
| 1 instance PM2 | ~30-40 |
| 2 instances PM2 (actuel) | ~60-80 |
| 4 instances + optimisations | ~100-120 |
| Cluster multi-serveurs | 200+ |

### Scaling horizontal

```bash
# Augmenter le nombre d'instances
ssh swigs@192.168.110.59 "pm2 scale swigs-workflow 4"

# Verifier
ssh swigs@192.168.110.59 "pm2 list | grep workflow"
```

### Optimisations appliquees

1. **N+1 Queries fixes** - MongoDB aggregation avec $lookup
2. **Rate Limiting** - 100 req/min global, 10 req/min auth
3. **Compression** - Gzip (78% reduction)
4. **Indexes MongoDB** - Compound indexes optimises
5. **Connection Pooling** - maxPoolSize: 10

---

## Securite

### Architecture Multi-Tenant

```
┌─────────────────────────────────────────────────────────────┐
│                    Requete API                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              requireAuth Middleware                          │
│  - Verifie JWT token                                        │
│  - Extrait userId du token                                  │
│  - Refuse si pas de token (401)                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Controller                                │
│  - Filtre TOUTES les queries par userId                     │
│  - query.userId = req.user._id                              │
│  - Un user ne peut JAMAIS acceder aux donnees d'un autre    │
└─────────────────────────────────────────────────────────────┘
```

### Test d'isolation

```bash
# Sans token = 401 (BLOQUE)
curl http://192.168.110.59:3004/api/projects
# Response: {"error":"Token requis"}

# Avec token = Seulement SES projets
curl -H "Authorization: Bearer <token>" http://192.168.110.59:3004/api/projects
# Response: Projets du user authentifie uniquement
```

### Mesures implementees

| Mesure | Status | Description |
|--------|--------|-------------|
| requireAuth | ✅ | Token JWT OBLIGATOIRE sur toutes les routes |
| Multi-tenant | ✅ | Isolation par userId sur toutes les queries |
| Helmet.js | ✅ | Security headers (CSP, X-Frame, etc.) |
| Rate Limiting | ✅ | Protection DDoS/brute force |
| CORS configure | ✅ | Origins specifiques |
| JWT Auth | ✅ | Tokens expires (7j) |
| Input validation | ✅ | Mongoose schema validation |
| HTTPS | ✅ | TLS 1.2+ via Nginx |

### Rate Limiting

| Endpoint | Limite | Fenetre |
|----------|--------|---------|
| Global | 100 req | 1 min |
| /api/auth/* | 10 req | 1 min |
| /api/health | Illimite | - |

---

## Monitoring

### PM2 Monitoring

```bash
# Status en temps reel
ssh swigs@192.168.110.59 "pm2 monit"

# Liste des processus
ssh swigs@192.168.110.59 "pm2 list"

# Logs en temps reel
ssh swigs@192.168.110.59 "pm2 logs swigs-workflow"

# Metriques detaillees
ssh swigs@192.168.110.59 "pm2 show swigs-workflow"
```

### Health Check

```bash
curl http://192.168.110.59:3004/api/health

# Response
{
  "status": "OK",
  "app": "swigs-workflow",
  "version": "1.0.0",
  "timestamp": "2026-02-06T10:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 85,
    "total": 256
  }
}
```

### MongoDB Monitoring

```bash
ssh swigs@192.168.110.59 "mongosh swigs-workflow --eval 'db.stats()'"

# Index usage
ssh swigs@192.168.110.59 "mongosh swigs-workflow --eval 'db.projects.getIndexes()'"
```

---

## Backup & Recovery

### Backup MongoDB

```bash
ssh swigs@192.168.110.59 "mongodump --db swigs-workflow --out ~/backups/\$(date +%Y%m%d)"
```

### Restore MongoDB

```bash
ssh swigs@192.168.110.59 "mongorestore --db swigs-workflow --drop ~/backups/20260206/swigs-workflow"
```

---

## Troubleshooting

### L'application ne repond pas

```bash
# Verifier le status
ssh swigs@192.168.110.59 "pm2 list | grep workflow"

# Verifier les logs
ssh swigs@192.168.110.59 "pm2 logs swigs-workflow --lines 50"

# Redemarrer
ssh swigs@192.168.110.59 "pm2 restart swigs-workflow"
```

### Erreur 401 Token requis

C'est le comportement NORMAL sans authentification. L'API requiert un token JWT valide.

### Rate limiting atteint

```bash
# Verifier les headers
curl -D - http://192.168.110.59:3004/api/projects -o /dev/null 2>/dev/null | grep RateLimit
```

---

## Commandes Rapides

### Deploiement

```bash
# Sync fichiers et reload
rsync -avz backend/ swigs@192.168.110.59:~/swigs-workflow/ && \
ssh swigs@192.168.110.59 "cd ~/swigs-workflow && npm install && pm2 reload swigs-workflow"
```

### Monitoring

```bash
# Status
ssh swigs@192.168.110.59 "pm2 list"

# Logs temps reel
ssh swigs@192.168.110.59 "pm2 logs swigs-workflow"

# Health check
curl -s http://192.168.110.59:3004/api/health | jq .
```

### Restart

```bash
# Zero-downtime reload
ssh swigs@192.168.110.59 "pm2 reload swigs-workflow"

# Restart complet
ssh swigs@192.168.110.59 "pm2 restart swigs-workflow"

# Delete et restart avec config
ssh swigs@192.168.110.59 "cd ~/swigs-workflow && pm2 delete swigs-workflow && pm2 start ecosystem.config.cjs"
```

### Scaling

```bash
# 4 instances
ssh swigs@192.168.110.59 "pm2 scale swigs-workflow 4"

# Retour a 2 instances
ssh swigs@192.168.110.59 "pm2 scale swigs-workflow 2"
```

### Backup

```bash
# Backup MongoDB
ssh swigs@192.168.110.59 "mongodump --db swigs-workflow --out ~/backups/\$(date +%Y%m%d)"

# Liste des backups
ssh swigs@192.168.110.59 "ls -la ~/backups/"
```

---

*Derniere mise a jour: 6 Fevrier 2026*
