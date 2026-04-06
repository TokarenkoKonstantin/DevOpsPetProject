# DevOps Pet Project — Cloud-Native E-commerce Platform

Микросервисная e-commerce платформа для изучения и демонстрации DevOps-практик.

## Архитектура

```
┌────────────┐   ┌────────────┐   ┌────────────┐
│  Product   │   │   Order    │   │    User    │
│  Service   │   │  Service   │   │  Service   │
│  (Go) :8080│   │(Py)  :8081 │   │(Py)  :8082 │
└──────┬─────┘   └───────────┘   └──────┬─────┘
       │                │                │
       └────────────────┼────────────────
                        │
              ┌─────────▼─────────┐   ┌────────────┐
              │    Frontend       │   │ PostgreSQL │
              │  (React)  :3000   │   │    :5432   │
              └───────────────────┘   └────────────┘
```

## Сервисы

| Сервис | Стек | Порт |
|--------|------|------|
| Product Service | Go 1.21 | 8080 |
| Order Service | Python 3.11 + FastAPI | 8081 |
| User Service | Python 3.11 + FastAPI + JWT | 8082 |
| Frontend | React + Nginx | 3000 |
| PostgreSQL | PostgreSQL 16 | 5432 |

## Быстрый старт

```bash
cd phase-1-docker
docker compose up --build
```

Доступ:
- Frontend: http://localhost:3000
- Product API: http://localhost:8080/health
- Order API: http://localhost:8081/health
- User API: http://localhost:8082/health

## Roadmap

- [x] Phase 1: Docker + Docker Compose
- [ ] Phase 2: Kubernetes (K3s, Helm, Ingress)
- [ ] Phase 3: CI/CD (Jenkins, ArgoCD)
- [ ] Phase 4: Monitoring (Prometheus, Grafana)
- [ ] Phase 5: Security (Vault, Trivy)
- [ ] Phase 6: Databases (PostgreSQL Operator)
- [ ] Phase 7: High Availability
