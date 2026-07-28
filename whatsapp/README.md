# Campagne WhatsApp automatique — clients EasySell (senboutique)

Robot d'envoi qui prend tes clients (paiement à la livraison via EasySell) et leur
envoie automatiquement un message WhatsApp via l'**API officielle Meta (WhatsApp Cloud API)**.

> ⚠️ L'envoi part de **ton** numéro WhatsApp Business. Personne ne peut envoyer à ta
> place depuis l'extérieur : c'est une règle de Meta. Ce script automatise l'envoi
> une fois que ton compte est configuré.

## Ce dont tu as besoin (une seule fois)

1. **Un compte Meta Business** : https://business.facebook.com
2. **Ajouter le produit WhatsApp** dans un app Meta Developers : https://developers.facebook.com
   → tu obtiens un **Phone Number ID** et un **Token**.
3. **Créer un modèle de message** ("template") dans Meta Business Manager :
   - Catégorie : **MARKETING**
   - Langue : **Français (fr)**
   - Exemple de corps avec variables :
     ```
     Bonjour {{1}} 🛍️ Spécial MAGAL chez SenBoutique : {{2}} sur nos produits jusqu'à dimanche !
     Livraison partout, paiement à la livraison. Commandez : {{3}}
     ```
   - Attendre la **validation** par Meta (quelques minutes à quelques heures).

## Configuration

```bash
cd whatsapp
cp .env.example .env
# puis édite .env et colle : WA_TOKEN, WA_PHONE_NUMBER_ID, WA_TEMPLATE_NAME
```

Place ta liste de clients dans `whatsapp/clients_easysell.csv` (colonnes `nom,telephone`).
Ce fichier est **ignoré par git** (données personnelles). Un exemple de format est
fourni : `clients_easysell.example.csv`.

## Utilisation

**1. Test à blanc (n'envoie RIEN, vérifie juste la liste) :**
```bash
python3 send_campaign.py --dry-run --template=promo_magal \
  --param="{nom}" --param="-20%" --param="https://senboutiquesn.myshopify.com"
```

**2. Envoi réel :**
```bash
python3 send_campaign.py --template=promo_magal --lang=fr \
  --param="{nom}" --param="-20%" --param="https://senboutiquesn.myshopify.com"
```

> Astuce : une valeur qui commence par `-` (ex. `-20%`) doit s'écrire avec `=`
> (`--param="-20%"`), sinon elle est confondue avec une option.

- `--param` remplit les variables `{{1}}`, `{{2}}`, `{{3}}` du modèle, dans l'ordre.
- `{nom}` est remplacé automatiquement par le nom de chaque client.
- Un journal `envoi_AAAAMMJJ_HHMMSS.csv` est écrit avec le résultat (OK / ECHEC) par numéro.

## Bonnes pratiques
- Garde une pause entre les envois (`--delay`, défaut 1,5 s) pour ne pas te faire limiter.
- N'envoie qu'aux clients qui ont commandé chez toi (opt-in implicite) et propose une
  sortie ("STOP") pour rester conforme.
- Ne partage jamais ton `.env` ni ton `clients_easysell.csv`.
