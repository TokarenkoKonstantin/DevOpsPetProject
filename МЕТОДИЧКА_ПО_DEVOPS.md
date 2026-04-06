# Методичка по DevOps

Справочник для `devops-pet-project` — всё что понадобится на этапах 2-7.

---

## Оглавление

1. [Kubernetes — основы](#1-kubernetes--основы)
2. [K3s/Kubeadm — установка](#2-k3skubeadm--установка)
3. [Kubernetes объекты](#3-kubernetes-объекты)
4. [Helm](#4-helm)
5. [Ingress](#5-ingress)
6. [CI/CD — Jenkins](#6-cicd--jenkins)
7. [GitOps — ArgoCD](#7-gitops--argocd)
8. [Мониторинг](#8-мониторинг)
9. [Логирование](#9-логирование)
10. [Безопасность](#10-безопасность)
11. [Базы данных в K8s](#11-базы-данных-в-k8s)
12. [High Availability](#12-high-availability)
13. [Полезные команды](#13-полезные-команды)
14. [Типичные ошибки и решения](#14-типичные-ошибки-и-решения)

---

## 1. Kubernetes — основы

### Архитектура

```
┌──────────────────────────────────────────────────┐
│              Control Plane (master)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ kube-    │ │ kube-    │ │ etcd     │          │
│  │ api-server││scheduler │ │          │          │
│  └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐                       │
│  │ kube-    │ │ cloud-   │                       │
│  │controller│ │ controller│                      │
│  └──────────┘ └──────────┘                       │
└──────────────────────┬───────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐
   │ Worker 1  │ │ Worker 2  │ │ Worker N  │
   │ kubelet   │ │ kubelet   │ │ kubelet   │
   │ kube-proxy│ │ kube-proxy│ │ kube-proxy│
   │ container │ │ container │ │ container │
   │ runtime   │ │ runtime   │ │ runtime   │
   └───────────┘ └───────────┘ └───────────┘
```

**Ключевые принципы:**
- Всё declarative: описываешь желаемое состояние, K8s сам его обеспечивает
- Pod — минимальная единица деплоя (1+ контейнеров, общий network/IPC)
- Service — стабильный endpoint для группы pod'ов
- Всё живёт в namespace (дефолт: `default`)

---

## 2. K3s/Kubeadm — установка

### K3s (рекомендуется для лабы)

Легковесный K8s от Rancher — всё в одном бинарнике.

**На мастер-ноде:**
```bash
# Установка
curl -sfL https://get.k3s.io | sh -

# Получить токен для worker'ов
cat /var/lib/rancher/k3s/server/node-token

# Kubeconfig
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(whoami) ~/.kube/config
```

**На worker-ноде:**
```bash
curl -sfL https://get.k3s.io | K3S_URL=https://<MASTER_IP>:6443 K3S_TOKEN=<TOKEN> sh -
```

**Проверка:**
```bash
kubectl get nodes
kubectl get pods -A
```

> **Почему K3s а не kubeadm?**
> - Один бинарник вместо десятка компонентов
> - Встроенный CNI (flannel), Ingress (traefik), ServiceLB
> - Меньше ресурсов (512MB RAM vs 2GB)
> - Для production-scale kubeadm нужен, но для обучения K3s покрывает 95%

### Kubeadm (для полноты)

```bash
# Все ноды
sudo apt update && sudo apt install -y docker.io kubelet kubeadm kubectl
sudo apt-mark hold docker.io kubelet kubeadm kubectl

# Настроить cgroup driver для docker
cat <<'EOF' | sudo tee /etc/docker/daemon.json
{
  "exec-opts": ["native.cgroupdriver=systemd"],
  "log-driver": "json-file",
  "log-opts": {"max-size": "100m"}
}
EOF
sudo systemctl restart docker

# Master
sudo kubeadm init --pod-network-cidr=10.244.0.0/16
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# CNI (Calico)
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

# Worker
sudo kubeadm join <MASTER_IP>:6443 --token <TOKEN> --discovery-token-ca-cert-hash sha256:<HASH>
```

---

## 3. Kubernetes объекты

### Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  containers:
    - name: app
      image: myapp:latest
      ports:
        - containerPort: 8080
      resources:
        requests:
          memory: "128Mi"
          cpu: "100m"
        limits:
          memory: "256Mi"
          cpu: "500m"
```

### Deployment (управляет Pod'ами)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: dev
spec:
  replicas: 2
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      containers:
        - name: product-service
          image: registry.local/product-service:latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: product-config
            - secretRef:
                name: product-secret
          # Health checks
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
```

### Service (сеть)

```yaml
# ClusterIP — внутренний (дефолт)
apiVersion: v1
kind: Service
metadata:
  name: product-service
spec:
  type: ClusterIP
  selector:
    app: product-service
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP

# NodePort — доступен на порту каждой ноды
# type: NodePort, порт 30000-32767

# LoadBalancer — внешний (нужен MetalLB для bare-metal)
# type: LoadBalancer
```

### ConfigMap и Secret

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: product-config
data:
  APP_ENV: "development"
  LOG_LEVEL: "debug"
  DB_HOST: "postgresql.database.svc.cluster.local"
  DB_PORT: "5432"
---
apiVersion: v1
kind: Secret
metadata:
  name: product-secret
type: Opaque
data:
  DB_PASSWORD: cGFzc3dvcmQxMjM=  # echo -n "password123" | base64
  API_KEY: c2VjcmV0LWtleQ==
```

```bash
# Создать из файлов/литералов
kubectl create configmap product-config --from-literal=APP_ENV=development
kubectl create secret generic product-secret --from-literal=DB_PASSWORD=password123

# Создать из .env файла
kubectl create secret generic product-secret --from-env-file=.env
```

### Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dev
---
apiVersion: v1
kind: Namespace
metadata:
  name: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: production
```

---

## 4. Helm

Пакетный менеджер для K8s. Один chart = шаблон + values.

### Структура chart

```
my-app/
├── Chart.yaml          # метаданные (имя, версия)
├── values.yaml         # значения по умолчанию
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── ingress.yaml
│   └── _helpers.tpl    # вспомогательные шаблоны
└── charts/             # зависимости (под-charts)
```

### Команды

```bash
# Создать новый chart
helm create my-app

# Установить
helm install my-release ./my-app -n dev --create-namespace

# Обновить
helm upgrade my-release ./my-app -n dev

# Откатить
helm rollback my-release 1 -n dev  # к ревизии 1

# Посмотреть историю
helm history my-release -n dev

# Удалить
helm uninstall my-release -n dev

# Посмотреть values
helm show values ./my-app
```

### Example templates

**`templates/deployment.yaml`** (шаблон, используется Helm Go templating):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "my-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "my-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: {{ .Values.service.port }}
```

**`values.yaml`**:
```yaml
replicaCount: 2

image:
  repository: registry.local/product-service
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 8080

resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "500m"

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

---

## 5. Ingress

Внешний доступ к сервисам через HTTP/HTTPS маршрутизацию.

### Traefik (встроен в K3s)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web
spec:
  rules:
    - host: product.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: product-service
                port:
                  number: 80
    - host: order.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
    - host: api.local
      http:
        paths:
          - path: /api/products
            pathType: Prefix
            backend:
              service:
                name: product-service
                port:
                  number: 80
          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

### Nginx Ingress (если ставим отдельно)

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
```

### TLS с cert-manager

```yaml
# ClusterIssuer (LetsEncrypt)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your@email.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx

# Ingress с TLS
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

---

## 6. CI/CD — Jenkins

### Установка через Helm

```bash
helm repo add jenkins https://charts.jenkins.io
helm install jenkins jenkins/jenkins -n ci-cd --create-namespace -f jenkins-values.yaml
```

**`jenkins-values.yaml`**:
```yaml
controller:
  installPlugins:
    - kubernetes
    - workflow-aggregator
    - git
    - docker-workflow
    - kubernetes-cli
    - credentials-binding
  adminPassword: admin  # потом сменить!
  serviceType: NodePort
  servicePort: 8080
  JCasC:
    configScripts:
      kubernetes-cloud: |
        jenkins:
          clouds:
            - kubernetes:
                name: kubernetes
                serverUrl: "https://kubernetes.default"
                namespace: "ci-cd"
persistence:
  enabled: true
  size: 10Gi
```

### Получить пароль

```bash
kubectl exec -n ci-cd -it deployments/jenkins -- cat /var/jenkins_home/secrets/initialAdminPassword
```

### Jenkinsfile (Declarative Pipeline)

```groovy
pipeline {
    agent any

    environment {
        REGISTRY = 'registry.local'
        IMAGE_NAME = 'product-service'
        KUBE_NAMESPACE = 'dev'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            steps {
                sh 'cd applications/product-service && go test ./...'
            }
        }

        stage('Build & Push') {
            steps {
                script {
                    def tag = "${env.BUILD_NUMBER}"
                    sh "docker build -t ${REGISTRY}/${IMAGE_NAME}:${tag} -f applications/product-service/Dockerfile applications/product-service/"
                    sh "docker push ${REGISTRY}/${IMAGE_NAME}:${tag}"
                }
            }
        }

        stage('Deploy to Dev') {
            steps {
                withCredentials([kubeconfigFile(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                    sh """
                        helm upgrade product-service ./charts/product-service \
                          --namespace ${KUBE_NAMESPACE} \
                          --set image.tag=${env.BUILD_NUMBER} \
                          --install
                    """
                }
            }
        }

        stage('Verify') {
            steps {
                sh """
                    sleep 10
                    curl -f http://product-service.${KUBE_NAMESPACE}.svc.cluster.local:8080/health
                """
            }
        }
    }

    post {
        success {
            // Отправить уведомление в Telegram
            sh "curl -s -X POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage -d chat_id=${TELEGRAM_CHAT_ID} -d text='Build #${BUILD_NUMBER} SUCCESS'"
        }
        failure {
            sh "curl -s -X POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage -d chat_id=${TELEGRAM_CHAT_ID} -d text='Build #${BUILD_NUMBER} FAILED'"
        }
    }
}
```

---

## 7. GitOps — ArgoCD

### Установка

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Получить пароль (до v2.4)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Или с v2.4 имя сервера (pod name)
kubectl -n argocd get pods -l app.kubernetes.io/name=argocd-server -o name | cut -d'/' -f 2
```

### Application Manifest

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: product-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/TokarenkoKonstantin/devops-pet-project.git
    targetRevision: main
    path: kubernetes/helm-charts/product-service
  destination:
    server: https://kubernetes.default
    namespace: dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### App of Apps

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/TokarenkoKonstantin/devops-pet-project.git
    targetRevision: main
    path: kubernetes/argocd/applications
  destination:
    server: https://kubernetes.default
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

## 8. Мониторинг

### Prometheus + Grafana через kube-prometheus-stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring-values.yaml
```

**`monitoring-values.yaml`**:
```yaml
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    retention: 7d
    resources:
      requests:
        memory: "512Mi"
        cpu: "250m"
      limits:
        memory: "1Gi"

grafana:
  adminPassword: admin
  service:
    type: NodePort
  additionalDataSources:
    - name: Loki
      type: loki
      url: http://loki:3100

alertmanager:
  config:
    route:
      receiver: telegram
    receivers:
      - name: telegram
        webhook_configs:
          - url: "http://alertmanager-telegram-bot:9095/alert"
```

### Access

```bash
# Grafana
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80

# Prometheus
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

# Alertmanager
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-alertmanager 9093:9093
```

### ServiceMonitor для своего сервиса

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: product-service
  namespace: dev
spec:
  selector:
    matchLabels:
      app: product-service
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

### Полезные метрики для дашборда

| Метрика | Описание |
|---|---|
| `up` | Pod жив (0/1) |
| `container_memory_usage_bytes` | Потребление памяти |
| `rate(container_cpu_usage_seconds_total[5m])` | CPU usage |
| `rate(http_requests_total[5m])` | RPS |
| `rate(http_requests_total{status=~"5.."}[5m])` | 5xx errors |
| `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))` | P99 latency |

---

## 9. Логирование

### Loki + Promtail (легковесный вариант)

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki-stack -n monitoring \
  --set fluent-bit.enabled=false,promtail.enabled=true,loki.enabled=true
```

Где смотреть: Grafana → Explore → выбрать Loki как datasource

### ELK Stack (Elasticsearch, Logstash/Fleet, Kibana)

Для нашей лабы — тяжеловат для 4GB RAM нод. Рекомендуемый минимум 8GB.

```bash
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch -n logging --set replicas=1
helm install kibana elastic/kibana -n logging
```

**Когда что выбрать:**
| Stack | RAM | Сложность | Когда |
|---|---|---|---|
| Loki + Promtail | ~200MB | Низкая | Для start, pet-project, большинство кейсов |
| ELK | 4-8GB+ | Высокая | Когда нужен полнотекстовый поиск, анализ |

---

## 10. Безопасность

### Trivy — сканирование образов

```bash
# Установка на ноду
sudo apt install -y rpm
wget https://github.com/aquasecurity/trivy/releases/latest/download/trivy_*.deb
sudo dpkg -i trivy_*.deb

# Скан образа
trivy image myapp:latest

# В CI пайеплайне (в Jenkinsfile)
stage('Security Scan') {
    steps {
        sh 'trivy fs --exit-code 1 --severity CRITICAL ./'
        sh 'trivy image --severity CRITICAL --exit-code 1 ${REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}'
    }
}
```

### Network Policies

```yaml
# product-service принимает трафик только от frontend и api-gateway
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: product-network-policy
  namespace: dev
spec:
  podSelector:
    matchLabels:
      app: product-service
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - protocol: TCP
          port: 8080
```

### Pod Security Standards

```yaml
# На namespace уровне
apiVersion: v1
kind: Namespace
metadata:
  name: dev
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

Уровни: `privileged` (всё можно) → `baseline` → `restricted` (самый строгий).

### RBAC — ServiceAccount для приложения

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: product-sa
  namespace: dev
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: product-role
  namespace: dev
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: product-binding
subjects:
  - kind: ServiceAccount
    name: product-sa
    namespace: dev
roleRef:
  kind: Role
  name: product-role
  apiGroup: rbac.authorization.k8s.io
```

В Deployment указать:
```yaml
spec:
  template:
    spec:
      serviceAccountName: product-sa
```

---

## 11. Базы данных в K8s

### PostgreSQL: CloudNativePG Operator

```bash
# Установить оператор
kubectl apply -f https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/main/releases/cnpg-1.22.1.yaml

# Создать кластер
cat <<'EOF' | kubectl apply -f -
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres
  namespace: database
spec:
  instances: 1  # Потом 3 для HA
  storage:
    size: 10Gi
  bootstrap:
    initdb:
      database: appdb
      owner: appuser
      secret:
        name: postgres-credentials
EOF
```

### Redis (простой Deployment + Service)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: database
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          resources:
            limits:
              memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: database
spec:
  selector:
    app: redis
  ports:
    - port: 6379
```

### StatefulSet для stateful workloads

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: database
spec:
  serviceName: mongodb
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    spec:
      containers:
        - name: mongodb
          image: mongo:7
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: data
              mountPath: /data/db
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

---

## 12. High Availability

### HPA — Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: product-hpa
  namespace: dev
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: product-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### MetalLB — LoadBalancer для bare-metal

```bash
# Установка
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.14.0/config/manifests/metallb-native.yaml

# Config IP pool
cat <<'EOF' | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default
  namespace: metallb-system
spec:
  addresses:
    - 192.168.1.200-192.168.1.250  # диапазон для VIP
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
EOF
```

### Velero — Backup кластера

```bash
# Установка (нужен S3 для стораджа, можно MinIO)
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm install velero vmware-tanzu/velero \
  --namespace velero --create-namespace \
  --set configuration.provider=aws \
  --set configuration.backupStorageLocation.bucket=velero-backups \
  --set configuration.backupStorageLocation.prefix=dev-cluster \
  --set configuration.backupStorageLocation.config.region=us-east-1 \
  --set configuration.backupStorageLocation.config.s3Url=http://minio:9000 \
  --set configuration.backupStorageLocation.config.s3ForcePathStyle=true \
  --set initContainers[0].name=velero-plugin \
  --set initContainers[0].image=velero/velero-plugin-for-aws:v1.8.0

# Backup
velero backup create full-backup --include-namespaces dev

# Restore
velero restore create --from-backup full-backup

# Schedule
velero schedule create daily --schedule="0 2 * * *" --include-namespaces dev
```

---

## 13. Полезные команды

### kubectl

```bash
# Основное
kubectl get pods -A                          # все pods
kubectl get pods -n dev -o wide             # с деталями (IP, нода)
kubectl describe pod <name> -n dev          # события и статус
kubectl logs <pod> -n dev --tail=100        # логи
kubectl logs <pod> -n dev --tail=100 -f     # follow
kubectl logs <pod> -n dev -c <container>    # если несколько контейнеров
kubectl exec -it <pod> -n dev -- /bin/sh    # зайти в pod
kubectl exec -it <pod> -n dev -- /bin/bash  # или bash
kubectl cp <local> <pod>:<remote> -n dev    # копировать файлы

# Debug
kubectl get events -n dev --sort-by='.lastTimestamp'  # events по времени
kubectl top pods -n dev                     # CPU/RAM
kubectl top nodes                           # ноды
kubectl get all -n dev                      # всё в namespace
kubectl api-resources                       # все типы ресурсов

# Работа с ресурсами (apply/delete)
kubectl apply -f file.yaml                  # создать/обновить
kubectl apply -f ./directory/               # все файлы из папки
kubectl delete -f file.yaml                 # удалить
kubectl delete pod <name> -n dev            # удалить pod
kubectl rollout restart deployment/<name> -n dev  # рестарт без downtime
kubectl rollout status deployment/<name> -n dev   # статус

# Быстрый доступ
kubectl port-forward svc/product-service 8080:80 -n dev  # проброс порта
kubectl run debug --image=nicolaka/netshoot --rm -it --restart=Never  # debug pod
```

### Helm

```bash
helm list -A                          # все релизы
helm status my-release -n dev         # статус
helm show values ./chart              # доступные values
helm template my-release ./chart      # проверить рендер без деплоя
helm install --dry-run --debug        # проверка
helm diff upgrade my-release ./chart  # что изменится (нужен плагин helm-diff)
```

### K3s

```bash
sudo k3s kubectl ...                  # через k3s, если kubectl не в PATH
sudo systemctl status k3s             # статус
sudo systemctl restart k3s            # рестарт
journalctl -u k3s -f                  # логи сервера
k3s kubectl get nodes                 # если kubectl в k3s
```

---

## 14. Типичные ошибки и решения

### Pod в статусе Pending

**Причины:**
- Нет ресурсов (CPU/RAM) — `kubectl describe pod` → `Events: 0/3 nodes available: insufficient memory`
- **Решение:** уменьшить requests или добавить ресурсы

`kubectl top nodes` — посмотреть сколько свободно

- PVC не может забайндиться — нет StorageClass
  - **Решение:** `kubectl get storageclass` — в K3s по умолчанию `local-path`

### Pod CrashLoopBackOff

**Причины:**
- Приложение упало — `kubectl logs <pod> -n dev`
- Неправильная команда запуска — `kubectl describe pod` → `Command/Args`
- Не хватает env/secret — проверить ConfigMap/Secret существуют

```bash
kubectl get configmap -n dev
kubectl get secret -n dev
```

### Service не доступен

**Причины:**
- Selector mismatch — `kubectl get svc <name> -o yaml` → `selector` должен совпадать с `pod labels`
- TargetPort ≠ containerPort — проверить
- NetworkPolicy блокирует — `kubectl get networkpolicy -A`

### ImagePullBackOff

**Причины:**
- Образ не найден — проверить `image: tag`
- Приватный registry без auth — `imagePullSecrets`
- **Решение:**
  ```bash
  kubectl create secret docker-registry regcred \
    --docker-server=registry.local \
    --docker-username=admin \
    --docker-password=password
  ```
  В Deployment: `imagePullSecrets: [regcred]`

### HPA не работает

**Причины:**
- metrics-server не установлен
  - **Решение K3s:** `kubectl top pods` уже должен работать
  - **Решение kubeadm:** `kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml`

### Helm upgrade failed

**Причины:**
- Нельзя менять immutable field (selector, clusterIP)
  - **Решение:** `helm uninstall` → `helm install` или исправить значение в существующем ресурсе
- **Превентивно:** `helm template` или `helm upgrade --dry-run --debug` перед реальным деплоем

---

## Шпаргалка: Docker → K8s маппинг

| Docker Compose | Kubernetes | Что делает |
|---|---|---|
| `services:` | `Deployment` | Запускает и поддерживает pod'ы |
| `ports: "80:8080"` | `Service` + `Ingress` | Сетевой доступ |
| `environment:` | `ConfigMap` / `Secret` | Переменные окружения |
| `volumes:` | `PersistentVolumeClaim` | Хранение данных |
| `depends_on:` | `initContainers` | Порядок запуска |
| `restart: always` | `restartPolicy: Always` (дефолт) | Рестарт |
| `networks:` | `NetworkPolicy` | Сетевая изоляция |
| `replicas:` | `Deployment.spec.replicas` | Кол-во копий |

---

## Ссылки

- [Kubernetes Docs](https://kubernetes.io/docs/)
- [K3s Docs](https://docs.k3s.io/)
- [Helm Docs](https://helm.sh/docs/)
- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
- [CloudNativePG](https://cloudnative-pg.io/documentation/)
- [MetalLB](https://metallb.universe.tf/)
- [Velero Docs](https://velero.io/docs/)
