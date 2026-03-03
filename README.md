# AnsibleFlow

Plateforme DevOps centralisée pour gérer vos projets, DNS, sauvegardes et déploiements via Ansible — sans ligne de commande.

---

## Prérequis

| Outil | Version minimale |
|---|---|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| Git | 2.x |

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

# (Optionnel) Notifications Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Renommer ensuite le fichier :

```bash
mv .env.local .env
```

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

### Créer le premier compte administrateur

Au premier lancement, la base de données est vide. Créer un admin via l'API :

```bash
curl -X POST http://localhost:8000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "motdepasse",
    "role": "administrator"
  }'
```

> Pour les lancements suivants, cet endpoint est protégé et nécessite un token admin.

---

## Accès aux interfaces

| Interface | URL |
|---|---|
| Application web | http://localhost |
| API REST | http://localhost:8000 |
| Documentation Swagger | http://localhost:8000/docs |
| Documentation ReDoc | http://localhost:8000/redoc |

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

| Rôle | Permissions |
|---|---|
| `administrator` | Accès complet + gestion des utilisateurs |
| `operator` | Créer/modifier projets, lancer sauvegardes et déploiements |
| `observer` | Lecture seule (dashboard, historiques) |

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
