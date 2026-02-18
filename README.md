# Swigs Workflow

Application de gestion de projets et de facturation avec vue Workflow unique.

## Stack

- **Backend**: Node.js + Express + MongoDB
- **Frontend**: React + Vite + Tailwind CSS
- **État**: Zustand
- **Animations**: Framer Motion

## Installation locale

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Le backend tourne sur http://localhost:3003

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend tourne sur http://localhost:5173

## Déploiement (Serveur .59)

### 1. Cloner sur le serveur

```bash
ssh swigs@192.168.110.59
cd ~
git clone git@github.com:swigsstaking/swigs-workflow.git
cd swigs-workflow/backend
```

### 2. Configurer le backend

```bash
cp .env.example .env
nano .env  # Configurer MONGODB_URI, etc.
npm install
```

### 3. Démarrer avec PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 4. Build et déployer le frontend

```bash
cd ../frontend
npm install
npm run build
sudo mkdir -p /var/www/swigs-workflow
sudo cp -r dist/* /var/www/swigs-workflow/
sudo chown -R www-data:www-data /var/www/swigs-workflow
```

### 5. Configurer Nginx

```bash
sudo nano /etc/nginx/sites-available/swigs-workflow
```

```nginx
server {
    listen 80;
    server_name workflow.swigs.online;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name workflow.swigs.online;

    ssl_certificate /etc/letsencrypt/live/workflow.swigs.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/workflow.swigs.online/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /var/www/swigs-workflow;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/swigs-workflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d workflow.swigs.online
```

## Mise à jour

```bash
ssh swigs@192.168.110.59
cd ~/swigs-workflow

# Backend
cd backend
git pull origin main
npm install
pm2 restart swigs-workflow

# Frontend
cd ../frontend
npm install
npm run build
sudo cp -r dist/* /var/www/swigs-workflow/
```

## API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects` | Liste des projets |
| POST | `/api/projects` | Créer un projet |
| GET | `/api/projects/:id` | Détail d'un projet |
| PUT | `/api/projects/:id` | Modifier un projet |
| PATCH | `/api/projects/:id/status` | Changer le statut |
| GET | `/api/statuses` | Liste des statuts |
| POST | `/api/statuses/seed` | Créer les statuts par défaut |
| GET | `/api/projects/:id/events` | Événements d'un projet |
| POST | `/api/projects/:id/events` | Ajouter un événement |
| GET | `/api/projects/:id/invoices` | Factures d'un projet |
| POST | `/api/projects/:id/invoices` | Créer une facture |
| GET | `/api/projects/:id/quotes` | Devis d'un projet |
| POST | `/api/projects/:id/quotes` | Créer un devis |
| GET | `/api/projects/:id/history` | Historique d'un projet |
| GET | `/api/settings` | Paramètres |
| PUT | `/api/settings` | Modifier les paramètres |

---

**Version**: 1.0 - Janvier 2026
