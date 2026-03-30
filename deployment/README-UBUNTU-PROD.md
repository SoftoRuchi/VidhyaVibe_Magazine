# VidhyaVibe Magazine — Ubuntu production deploy (Docker + Nginx + SSL)

This repo runs 3 Node services behind Nginx:

- `reader.vidhyavibe.in` → `apps/web` on port `1034`
- `readeradmin.vidhyavibe.in` → `apps/admin` on port `3034`
- `readerapi.vidhyavibe.in` → `services/api` on port `2034`

It uses **one** env file at repo root: `./.env` (loaded by `docker-compose.prod.yml`).

## Files used

- `docker-compose.prod.yml`
- `deployment/nginx/vidhyavibe.conf`
- `deployment/systemd/vidhyavibe-compose.service`

## Recommended server path

- Repo path: `/opt/soft/vidhyavibe/VidhyaVibe_Magazine`
- Env file: `/opt/soft/vidhyavibe/VidhyaVibe_Magazine/.env`

## DNS prerequisites

Create these DNS records pointing to your server public IP:

- `A reader.vidhyavibe.in`
- `A readeradmin.vidhyavibe.in`
- `A readerapi.vidhyavibe.in`
