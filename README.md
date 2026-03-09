# AnsibleFlow

Plateforme DevOps centralisée pour gérer vos projets, DNS, sauvegardes et déploiements via Ansible — sans ligne de commande.

---

## Prérequis

| Outil          | Version minimale |
| -------------- | ---------------- |
| Docker         | 24+              |
| Docker Compose | v2.20+           |
| Git            | 2.x              |

> Aucune installation Python, Node.js ou Ansible n'est requise sur votre machine — tout tourne dans les conteneurs.

---

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd ansibleflow
```

### 2. Configurer les variables d'environnement

```bash
cp .env .env.local
```

Ouvrir `.env.local` et modifier **au minimum** :

```env
# Clé secrète JWT — générer avec : openssl rand -hex 32
SECRET_KEY=remplacer-par-une-vraie-cle-secrete

# Mot de passe PostgreSQL
POSTGRES_PASSWORD=un-mot-de-passe-fort

# Admin par défaut créé automatiquement au démarrage (recommandé en production)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@votredomaine.com
DEFAULT_ADMIN_PASSWORD=motdepasse-fort
```

Renommer ensuite le fichier :

```bash
mv .env.local .env
```

### 2.b Référence complète des variables `.env`

Ces variables sont lues par `docker compose` et les services backend/worker.
Le fichier est créé localement dans `ansibleflow/.env` et, en CI/CD, transmis via le secret GitHub `ENV_FILE_CONTENT`.

| Variable | Obligatoire | Description | Exemple |
|---|---|---|---|
| `POSTGRES_USER` | Oui | Utilisateur PostgreSQL | `ansibleflow` |
| `POSTGRES_PASSWORD` | Oui | Mot de passe PostgreSQL | `motdepassefort` |
| `POSTGRES_DB` | Oui | Base PostgreSQL | `ansibleflow` |
| `DATABASE_URL` | Oui | URL SQLAlchemy backend | `postgresql+asyncpg://...` |
| `REDIS_URL` | Oui | URL Redis backend | `redis://redis:6379/0` |
| `CELERY_BROKER_URL` | Oui | Broker Celery | `redis://redis:6379/0` |
| `CELERY_RESULT_BACKEND` | Oui | Backend résultats Celery | `redis://redis:6379/1` |
| `SECRET_KEY` | Oui | Clé JWT applicative | `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Oui | Expiration access token | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Oui | Expiration refresh token | `7` |
| `DEFAULT_ADMIN_USERNAME` | Recommandé prod | Username admin auto-créé au startup | `admin` |
| `DEFAULT_ADMIN_EMAIL` | Recommandé prod | Email admin auto-créé au startup | `admin@votredomaine.com` |
| `DEFAULT_ADMIN_PASSWORD` | Recommandé prod | Mot de passe admin auto-créé au startup | `motdepasse-fort` |
| `ANSIBLE_BASE_PATH` | Oui | Chemin playbooks dans le conteneur | `/app/ansible` |
| `ANSIBLE_VAULT_PASSWORD_FILE` | Optionnel | Fichier vault password | `/run/secrets/vault_password` |
| `SMTP_HOST` | Optionnel | Hôte SMTP | `smtp.mailgun.org` |
| `SMTP_PORT` | Optionnel | Port SMTP | `587` |
| `SMTP_USER` | Optionnel | User SMTP | `postmaster@...` |
| `SMTP_PASSWORD` | Optionnel | Password SMTP | `...` |
| `SMTP_FROM` | Optionnel | Expéditeur email | `ansibleflow@example.com` |
| `SLACK_WEBHOOK_URL` | Optionnel | Webhook notifications Slack | `https://hooks.slack.com/...` |
| `DEBUG` | Oui | Mode debug backend | `false` |

### 3. (Optionnel) Configurer le mot de passe Ansible Vault

Si vous souhaitez chiffrer les clés SSH avec Ansible Vault :

```bash
echo "votre-mot-de-passe-vault" > secrets/vault_password
chmod 600 secrets/vault_password
```

---

## Démarrage

### Lancer tous les services

```bash
docker compose up -d
```

Les services démarrent dans cet ordre : **PostgreSQL → Redis → Backend → Worker → Frontend → Nginx**

### Vérifier que tout tourne

```bash
docker compose ps
```

Résultat attendu :

```
NAME         STATUS          PORTS
db           running         0.0.0.0:5432->5432/tcp
redis        running         0.0.0.0:6379->6379/tcp
backend      running         0.0.0.0:8000->8000/tcp
worker       running
frontend     running         0.0.0.0:3000->3000/tcp
nginx        running         0.0.0.0:80->80/tcp
```

### Compte administrateur au premier démarrage

Mode recommandé: renseigner `DEFAULT_ADMIN_USERNAME`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` dans `.env`.  
Au démarrage backend, le compte admin est créé automatiquement (ou mis à jour s'il existe déjà).

Mode manuel (si auto-bootstrap non configuré): créer le premier admin via l'API.

---

## Accès aux interfaces

| Interface             | URL                         |
| --------------------- | --------------------------- |
| Application web       | http://localhost            |
| API REST              | http://localhost:8000       |
| Documentation Swagger | http://localhost:8000/docs  |
| Documentation ReDoc   | http://localhost:8000/redoc |

---

## Utilisation rapide

### S'authentifier

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -F "username=admin" \
  -F "password=motdepasse"
```

Réponse :

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

Stocker le token pour les appels suivants :

```bash
TOKEN="eyJ..."
```

### Ajouter un projet

```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mon-site",
    "domain": "mon-site.fr",
    "server_ip": "192.168.1.10",
    "tech_stack": "php",
    "environment": "production",
    "ssh_user": "deploy"
  }'
```

### Lancer une sauvegarde

```bash
curl -X POST http://localhost:8000/api/projects/1/backups \
  -H "Authorization: Bearer $TOKEN"
```

Suivre les logs en temps réel via WebSocket :

```
ws://localhost:8000/ws/jobs/<job_id>/logs?token=<access_token>
```

---

## Commandes utiles

### Voir les logs d'un service

```bash
docker compose logs -f backend
docker compose logs -f worker
```

### Redémarrer un service après modification

```bash
docker compose restart backend
```

### Rebuilder l'image après modification du code

```bash
docker compose up -d --build backend
```

### Arrêter tous les services

```bash
docker compose down
```

### Arrêter et supprimer les volumes (RESET COMPLET)

```bash
docker compose down -v
```

---

## CI/CD GitHub Actions (déploiement Docker sur serveur)

Un workflow est fourni dans [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Comportement:

- Déclenchement automatique à chaque `push` sur `main` (ou manuel via `workflow_dispatch`)
- Synchronisation du code vers le serveur via `rsync` sur SSH
- Build et redémarrage des services directement sur le serveur:
  - `docker compose up -d --build --remove-orphans`

### Secrets GitHub à configurer

Dans `Settings > Secrets and variables > Actions`, ajouter:

- `SSH_HOST` : IP ou hostname du serveur
- `SSH_PORT` : port SSH (ex: `22`)
- `SSH_USER` : utilisateur SSH (ex: `root` ou `deploy`)
- `SSH_PRIVATE_KEY` : clé privée SSH au format OpenSSH
- `DEPLOY_PATH` : répertoire cible sur le serveur (ex: `/opt/ansibleflow`)
- `COMPOSE_FILE` (optionnel) : fichier Compose (défaut: `docker-compose.yml`)
- `COMPOSE_PROJECT_NAME` (optionnel) : nom de stack Compose fixe (défaut: `ansibleflow`)
- `ENV_FILE_CONTENT` : contenu complet du fichier `.env` à écrire sur le serveur avant `docker compose`

### Où créer chaque variable/secrets

| Élément | Où le créer | Utilisé par |
|---|---|---|
| `.env` local | Fichier `ansibleflow/.env` | Lancement local `docker compose up` |
| `ENV_FILE_CONTENT` | GitHub `Settings > Secrets and variables > Actions` | Workflow déploiement (écrit `.env` sur serveur) |
| `SSH_HOST` `SSH_PORT` `SSH_USER` | GitHub Secrets | Connexion SSH depuis GitHub Actions |
| `SSH_PRIVATE_KEY` | GitHub Secret | Authentification SSH GitHub Actions |
| `DEPLOY_PATH` | GitHub Secret | Dossier de déploiement sur le serveur |
| `COMPOSE_FILE` | GitHub Secret (optionnel) | Fichier compose cible |
| `COMPOSE_PROJECT_NAME` | GitHub Secret (optionnel) | Nom stable de stack (Portainer grouping) |
| `authorized_keys` | Serveur: `~/.ssh/authorized_keys` de `SSH_USER` | Contient la clé publique liée à `SSH_PRIVATE_KEY` |

### Prérequis serveur

- Docker et Docker Compose installés
- Utilisateur SSH autorisé à exécuter `docker compose`

---

## Structure du projet

```
ansibleflow/
├── .env                    # Variables d'environnement
├── docker-compose.yml      # Orchestration des services
│
├── backend/                # API Python FastAPI
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── core/               # Config, base de données, sécurité JWT
│   ├── models/             # Modèles SQLAlchemy (Project, Backup, Deployment…)
│   ├── api/routes/         # Endpoints REST (auth, projects, dns, backups, deployments)
│   ├── api/websockets.py   # Streaming logs temps réel
│   ├── services/           # ansible-runner, Vault, notifications
│   └── tasks/              # Tâches Celery asynchrones
│
├── frontend/               # Interface React + TailwindCSS
│
└── ansible/                # Playbooks et rôles Ansible
    ├── playbooks/          # backup.yml, deploy.yml, update_dns.yml, restore.yml
    ├── roles/              # Rôles réutilisables (dns, backup, deploy, restore)
    └── inventory/          # Inventaire dynamique des serveurs
```

---

## Rôles utilisateurs

| Rôle            | Permissions                                                |
| --------------- | ---------------------------------------------------------- |
| `administrator` | Accès complet + gestion des utilisateurs                   |
| `operator`      | Créer/modifier projets, lancer sauvegardes et déploiements |
| `observer`      | Lecture seule (dashboard, historiques)                     |

---

## Historique des commits

61 commits atomiques documentant chaque étape de construction du projet.

| Catégorie                   | Commits | Description                                                                                   |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `chore/docs`                | 3       | .gitignore, README, requirements.txt                                                          |
| `build(backend)`            | 2       | Dockerfile, .dockerignore                                                                     |
| `feat(backend/core)`        | 3       | Configuration, base de données, sécurité JWT                                                  |
| `feat(backend/models)`      | 5       | User, Project, Backup, Deployment, DNSRecord                                                  |
| `feat(backend/services)`    | 3       | ansible-runner, Vault, notifications                                                          |
| `feat(backend/tasks)`       | 4       | Celery app, tâches backup/deploy/DNS                                                          |
| `feat(backend/api)`         | 3       | Routes REST, WebSocket, entrypoint FastAPI                                                    |
| `feat(ansible)`             | 10      | ansible.cfg, inventaire, rôles (dns/backup/deploy/restore), playbooks                         |
| `feat(frontend)`            | 5       | Tooling Vite/Tailwind, index.html, App, main, CSS                                             |
| `feat(frontend/services)`   | 3       | api.js (Axios + refresh JWT), websocket.js, auth.js                                           |
| `feat(frontend/components)` | 4       | Navbar, StatusBadge, Modal, LogViewer                                                         |
| `feat(frontend/pages)`      | 6       | Login, Dashboard, ProjectDetail, Deploy, Backups, AddProject                                  |
| `build(frontend)`           | 3       | Dockerfile multi-stage, .dockerignore, nginx.conf                                             |
| `feat(docker)`              | 2       | nginx.conf reverse proxy, docker-compose.yml                                                  |
| `fix`                       | 5       | Corrections : naming conflict, worker build, proxy apt-get, healthcheck curl, email-validator |

Consulter l'historique complet :

```bash
git log --oneline
```

---

## Dépannage

**Le backend ne démarre pas**

```bash
docker compose logs backend
# Vérifier que DATABASE_URL correspond bien au service "db"
```

**Les tâches Celery ne s'exécutent pas**

```bash
docker compose logs worker
# Vérifier que REDIS_URL est correct et que Redis est healthy
```

**Erreur de connexion SSH dans un playbook**

- Vérifier que `server_ip`, `ssh_user` et `ssh_port` du projet sont corrects
- S'assurer que la clé SSH du conteneur `worker` est autorisée sur le serveur cible

**Réinitialiser la base de données**

```bash
docker compose down -v
docker compose up -d
```
