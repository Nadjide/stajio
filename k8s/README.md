# Deployer Stajio sur Kubernetes (Docker Desktop)

Ce dossier deploie Stajio et Ollama dans deux Pods separes, avec un volume
persistant pour la base SQLite et un autre pour les modeles Ollama.

## Prerequis

- Docker Desktop demarre avec Kubernetes active (cluster `Kubeadm`).
- `kubectl` disponible dans PowerShell.
- Au moins 8 Go de RAM alloues a Docker Desktop. Ollama et `phi4-mini` sont
  trop lourds pour une configuration Docker tres limitee.

Verifier le cluster :

```powershell
kubectl config use-context docker-desktop
kubectl get nodes
```

Le statut du noeud doit etre `Ready`.

## Etape 1 - Construire l'image locale de Stajio

Depuis la racine du projet :

```powershell
docker build -t stajio:local .
```

L'image s'appelle `stajio:local`, ce qui correspond exactement a la valeur de
`image` dans `stajio.yaml`.

## Etape 2 - Creer le secret JWT

Le secret ne doit pas etre versionne. La commande suivante en cree un dans le
cluster et le rend disponible seulement aux Pods du namespace `stajio`.

```powershell
$stajioJwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
kubectl create namespace stajio
kubectl create secret generic stajio-secrets --namespace stajio --from-literal=JWT_SECRET=$stajioJwt
```

Si le namespace existe deja, Kubernetes indiquera qu'il existe : ce n'est pas
un probleme. Ne relance pas la seconde commande sans supprimer ou mettre a jour
le secret, car elle echouera volontairement pour proteger la valeur existante.

## Etape 3 - Appliquer les manifests

```powershell
kubectl apply -k k8s
kubectl get all -n stajio
kubectl get pvc -n stajio
```

`-k` demande a Kubernetes de lire `kustomization.yaml`, qui regroupe les
fichiers YAML du dossier. Les PVC doivent passer a l'etat `Bound` et les Pods a
`Running`.

## Etape 4 - Telecharger le modele IA

Quand le Pod Ollama est `Running`, telecharger le modele utilise par Stajio :

```powershell
kubectl exec -n stajio deployment/ollama -- ollama pull phi4-mini
```

Le telechargement n'est necessaire qu'une fois : il est conserve dans le PVC
`ollama-data`.

## Etape 5 - Ouvrir Stajio

Le Service est volontairement interne au cluster (`ClusterIP`). Pour y acceder
depuis ton PC sans exposer l'application sur le reseau, lance :

```powershell
kubectl port-forward -n stajio service/stajio 3001:3001
```

Garde cette commande ouverte, puis va sur <http://localhost:3001>.

## Commandes utiles

```powershell
# Voir l'etat et les journaux
kubectl get pods -n stajio
kubectl logs -n stajio deployment/stajio
kubectl logs -n stajio deployment/ollama

# Suivre le demarrage d'un Pod
kubectl get pods -n stajio --watch

# Rebuild et redemarrer Stajio apres une modification du code
docker build -t stajio:local .
kubectl rollout restart deployment/stajio -n stajio
kubectl rollout status deployment/stajio -n stajio

# Tout retirer du cluster (les volumes et les donnees restent)
kubectl delete -k k8s

# Retirer aussi les donnees persistantes : irreversible
kubectl delete pvc -n stajio stajio-data ollama-data
```

## Ce que fait chaque fichier

- `namespace.yaml` : isole toutes les ressources de Stajio.
- `configmap.yaml` : fournit les variables non sensibles, dont l'adresse du
  Service Ollama.
- `storage.yaml` : demande deux disques persistants a Kubernetes.
- `ollama.yaml` : lance Ollama et l'expose uniquement aux Pods du cluster.
- `stajio.yaml` : lance Stajio, connecte SQLite et le secret JWT, et declare
  les verifications de sante.
- `kustomization.yaml` : point d'entree unique des manifests.
- `secret.example.yaml` : exemple documentaire uniquement ; le vrai secret est
  cree avec `kubectl` et ne se trouve pas dans Git.

## Limite volontaire : SQLite

Stajio reste a une seule replique, car SQLite est une base de donnees sous la
forme d'un seul fichier. Pour executer plusieurs Pods Stajio ou deployer sur
plusieurs noeuds en production, il faudra migrer vers PostgreSQL.
