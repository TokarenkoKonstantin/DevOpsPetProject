# ☸️ cloud-shop — DevOps Pet Project

Production-ready Kubernetes инфраструктура для e-commerce приложения из 4 микросервисов.  
Построена с нуля за 4 месяца — 11 последовательных фаз: от Docker до HA кластера с GitOps, мониторингом и безопасностью.

![Phases](https://img.shields.io/badge/phases-11%20completed-brightgreen)
![Kubernetes](https://img.shields.io/badge/kubernetes-kubeadm-blue)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions%20%7C%20GitLab%20CI%20%7C%20ArgoCD-orange)
![IaC](https://img.shields.io/badge/IaC-Terraform%20%7C%20Ansible-purple)

---

## Архитектура

```mermaid
graph TB
    classDef cicd fill:#f39c12,stroke:#e67e22,color:#fff,font-weight:bold
    classDef app fill:#27ae60,stroke:#229954,color:#fff,font-weight:bold
    classDef db fill:#8e44ad,stroke:#7d3c98,color:#fff,font-weight:bold
    classDef monitor fill:#e74c3c,stroke:#cb4335,color:#fff,font-weight:bold
    classDef storage fill:#16a085,stroke:#138d75,color:#fff,font-weight:bold
    classDef infra fill:#2980b9,stroke:#2471a3,color:#fff,font-weight:bold

    subgraph CICD["⚙️  CI/CD"]
        GH["GitHub Actions"]
        GL["GitLab CI/CD"]
        AR["ArgoCD · GitOps"]
    end

    subgraph Proxmox["🖥️  Proxmox VE"]
        Runner["GitLab Runner\nUbuntu 22.04"]
    end

    subgraph K8s["☸️  Kubernetes Cluster · VMware Workstation · 5 нод"]
        Ingress["Ingress-NGINX\nMetalLB · 192.168.11.200"]

        subgraph App["Микросервисы"]
            FE["Frontend\nReact / Nginx"]
            PS["Product Service\nGo"]
            OS["Order Service\nFastAPI"]
            US["User Service\nFastAPI"]
        end

        subgraph DB["PostgreSQL HA · CloudNativePG"]
            PG1[("Primary")]
            PG2[("Replica 1")]
            PG3[("Replica 2")]
        end

        subgraph Obs["Мониторинг"]
            Prom["Prometheus"]
            Graf["Grafana"]
        end

        MN[("MinIO · S3")]
    end

    GH -->|"push image → GHCR"| AR
    GL -->|"lint → test → build"| Runner
    Runner -->|"push to registry"| K8s
    AR -->|"auto-sync"| K8s
    Ingress --> FE & PS & OS & US
    PS & OS & US --> PG1
    PG1 -.->|"streaming replication"| PG2 & PG3
    PG1 -->|"scheduled backup"| MN
    Prom -->|"scrape metrics"| Graf

    class GH,GL,AR cicd
    class Runner infra
    class FE,PS,OS,US app
    class PG1,PG2,PG3 db
    class Prom,Graf monitor
    class MN storage
```

---

## 🛍️ Приложение — CloudShop

![CloudShop Frontend](screenshots/frontend.png)

> Dark-theme e-commerce: каталог продуктов · корзина · авторизация (JWT) · история заказов  
> Стек: React → Nginx → Go (Products) → FastAPI (Orders, Users) → PostgreSQL

---

## Стек технологий

| Категория | Технологии |
|-----------|-----------|
| Контейнеризация | Docker, Docker Compose |
| Оркестрация | Kubernetes (kubeadm), Helm |
| CI/CD | GitHub Actions, GitLab CI/CD, ArgoCD |
| IaC | Terraform, Ansible |
| Мониторинг | Prometheus, Grafana |
| Сеть | Calico (CNI), MetalLB, Ingress-NGINX |
| Базы данных | PostgreSQL (CloudNativePG), MinIO (S3) |
| Безопасность | Trivy |
| Гипервизоры | VMware Workstation, Proxmox VE |

---

## Фазы проекта

| # | Фаза | Технологии | Статус |
|---|------|-----------|--------|
| 1 | Docker Compose | Docker, Docker Compose | ✅ |
| 2 | Kubernetes | kubeadm, Helm, Ingress-NGINX | ✅ |
| 3 | CI/CD | GitHub Actions, ArgoCD (GitOps) | ✅ |
| 4 | Мониторинг | Prometheus, Grafana | ✅ |
| 5 | IaC | Terraform, Ansible | ✅ |
| 6 | Безопасность | Trivy (сканирование CVE в pipeline) | ✅ |
| 7 | Высокая доступность | HPA, PDB | ✅ |
| 8 | Базы данных | CloudNativePG, MinIO | ✅ |
| 9 | Production Deploy | VMware Workstation, kubeadm (5 нод) | ✅ |
| 10 | CNI Migration | Flannel → Calico v3.29.3 | ✅ |
| 11 | GitLab CI/CD | GitLab CE, GitLab Runner | ✅ |

---

## CI/CD Pipeline

```
push → lint (flake8) → test (pytest + coverage) → build (Docker) → push (Registry) → deploy (ArgoCD)
```

- **GitHub Actions** — сборка и пуш образов в GHCR при изменении кода сервисов
- **ArgoCD** — GitOps: следит за репозиторием, автоматически синхронизирует кластер
- **GitLab CI** — полный pipeline: lint → test → build → push в Container Registry

---

## Быстрый старт

**Локально через Docker Compose:**
```bash
cd phase-1-docker
docker compose up --build
# Frontend: http://localhost:3000
```

**Kubernetes через Helm:**
```bash
helm install cloud-shop phase-3-helm/ecommerce/
kubectl get pods -A
```

---

## Мониторинг — Grafana дашборды

| Кластер | Node Exporter |
|---------|--------------|
| ![Cluster Overview](screenshots/grafana-cluster-overview.png) | ![Node Exporter](screenshots/grafana-node-exporter.png) |

| CPU Usage | Dashboards |
|-----------|------------|
| ![CPU Usage](screenshots/grafana-cpu-usage.png) | ![Dashboards](screenshots/grafana-dashboard-list.png) |

---

## Инфраструктура

| Компонент | Детали |
|-----------|--------|
| Кластер | 5 VM на VMware Workstation (Ubuntu 22.04, kubeadm) |
| Адреса нод | 192.168.11.101–105 (master + 4 workers) |
| Ingress IP | 192.168.11.200 (MetalLB v0.14.9) |
| CNI | Calico v3.29.3 — IPIP mode, pod CIDR 10.244.0.0/16 |
| PostgreSQL | CloudNativePG v1.23.0 — 1 primary + 2 replica |
| Автомасштабирование | HPA: min=3, max=10, CPU threshold=50% |
| Отказоустойчивость | PDB: minAvailable=2 |
| GitLab Runner | Proxmox VE VM (Ubuntu 22.04) |
| VPS | 64.188.79.192 — Nginx, Certbot SSL, Fail2ban, UFW |

