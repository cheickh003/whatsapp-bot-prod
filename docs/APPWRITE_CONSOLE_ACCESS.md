# Accès à la Console Appwrite depuis le Réseau Local

## Adresses d'accès

### Depuis la machine serveur :
- http://localhost
- http://127.0.0.1

### Depuis votre réseau local :
- **http://192.168.1.3**

## Instructions d'accès

1. **Ouvrez votre navigateur** sur n'importe quel appareil connecté au même réseau

2. **Allez à l'adresse** : http://192.168.1.3

3. **Connexion** :
   - Email : Votre email administrateur
   - Mot de passe : Votre mot de passe Appwrite

## Dépannage

### "Connexion refusée" ou "Site inaccessible"

1. **Vérifiez le pare-feu** :
   ```bash
   # Autoriser le port 80
   sudo ufw allow 80/tcp
   sudo ufw status
   ```

2. **Vérifiez que Traefik fonctionne** :
   ```bash
   docker ps | grep traefik
   ```

3. **Testez la connexion locale d'abord** :
   ```bash
   curl -I http://localhost
   ```

### "Invalid Origin" dans Appwrite

1. Connectez-vous à la console
2. Allez dans Settings → Platforms
3. Ajoutez une nouvelle plateforme Web :
   - Hostname : `192.168.1.3`
   - Ou utilisez `*` pour accepter toutes les origines (dev uniquement)

### Ports utilisés

- **Port 80** : Console Web Appwrite
- **Port 443** : HTTPS (si configuré)

## Accès depuis l'extérieur du réseau local

Pour accéder depuis Internet :

1. **Configuration du routeur** :
   - Redirigez le port 80 externe vers 192.168.1.3:80
   - Redirigez le port 443 externe vers 192.168.1.3:443 (pour HTTPS)

2. **Nom de domaine** (recommandé) :
   - Utilisez un service DNS dynamique (DuckDNS, No-IP)
   - Ou achetez un nom de domaine

3. **Sécurité** :
   - Activez HTTPS avec Let's Encrypt
   - Utilisez des mots de passe forts
   - Limitez les IPs autorisées si possible

## URLs importantes une fois connecté

- **Dashboard** : Vue d'ensemble du projet
- **Database** : Gérer les collections et documents
- **Storage** : Voir les fichiers uploadés
- **Users** : Gérer les utilisateurs
- **Functions** : Créer des fonctions serverless
- **Settings** : Configuration du projet

## Notes

- L'adresse IP 192.168.1.3 peut changer si votre serveur redémarre
- Pour une IP fixe, configurez une IP statique dans votre routeur
- La console est accessible tant qu'Appwrite est en cours d'exécution