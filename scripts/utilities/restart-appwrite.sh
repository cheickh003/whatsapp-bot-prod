#!/bin/bash

# Script pour redémarrer Appwrite
# Usage: ./restart-appwrite.sh

echo "🔄 Redémarrage d'Appwrite..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Aller dans le répertoire Appwrite
APPWRITE_DIR="/home/cheickh/appwrite"

if [ ! -d "$APPWRITE_DIR" ]; then
    echo "❌ Répertoire Appwrite non trouvé à: $APPWRITE_DIR"
    echo "Veuillez ajuster le chemin APPWRITE_DIR dans ce script"
    exit 1
fi

cd "$APPWRITE_DIR"

# Arrêter Appwrite
echo "⏹️  Arrêt d'Appwrite..."
docker compose down

# Attendre un peu
sleep 3

# Démarrer Appwrite
echo "▶️  Démarrage d'Appwrite..."
docker compose up -d

# Attendre que Appwrite soit prêt
echo "⏳ Attente du démarrage d'Appwrite..."
sleep 10

# Vérifier le statut
echo ""
echo "📊 Statut des conteneurs:"
docker compose ps

echo ""
echo "✅ Appwrite redémarré!"
echo ""
echo "📌 Notes:"
echo "- Attendez 30 secondes avant de redémarrer le bot"
echo "- Vérifiez http://localhost:80 pour accéder à la console"
echo "- Les logs: docker compose logs -f"