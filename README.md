# 🍅 Pomodoro · Focus

Un minuteur Pomodoro avec suivi de tâches, en HTML/CSS/JS pur — aucune dépendance, aucune installation.

## Lancer

Ouvrez simplement `index.html` dans un navigateur, ou servez le dossier :

```bash
cd pomodoro
python3 -m http.server 4173
# puis ouvrir http://localhost:4173
```

## Fonctionnalités

- **Trois modes** : Focus (25 min), pause courte (5 min), pause longue (15 min).
- **Anneau de progression** animé et compte à rebours, titre d'onglet mis à jour en direct.
- **Tâches** : ajout, validation, suppression, et la tâche « active » reçoit un 🍅 à chaque focus terminé.
- **Statistiques** : nombre de sessions focus terminées et minutes cumulées.
- **Historique** : graphique sur **7 ou 30 jours** (basculable), nombre de 🍅 et minutes par jour, plus totaux du jour / de la fenêtre / cumulé.
- **Export CSV** : bouton « ⬇ CSV » qui télécharge tout l'historique (`date,sessions,minutes`) — pratique comme sauvegarde durable.
- **Import CSV** : bouton « ⬆ CSV » qui recharge un historique exporté. Fusion par date (les dates importées remplacent les existantes), lignes invalides ignorées, totaux recalculés automatiquement.

## Où sont stockées les données ?

Tout est dans le `localStorage` du navigateur : les données **persistent** entre les sessions et redémarrages, mais restent liées à **ce navigateur + cette adresse (origine)**. Elles sont perdues si vous videz les données du site, changez de navigateur/appareil, ou utilisez le mode privé. Pour une sauvegarde durable, exportez en CSV.
- **Réglages** : durées personnalisables, nombre de cycles avant la pause longue, enchaînement auto, son de fin.
- **Persistance** : tout est sauvegardé dans `localStorage` (rien ne part sur internet).
- **Confort** : thème clair/sombre, son de fin (Web Audio), notifications navigateur, `Espace` pour démarrer/mettre en pause.

## Fichiers

- `index.html` — structure
- `style.css` — styles + thème clair/sombre
- `app.js` — toute la logique (minuteur, tâches, persistance)
