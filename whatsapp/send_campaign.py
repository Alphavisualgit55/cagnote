#!/usr/bin/env python3
"""
Envoi automatique d'une campagne WhatsApp a la base client EasySell (senboutique).

Utilise l'API officielle WhatsApp Cloud de Meta (graph.facebook.com).
Lit un fichier CSV (nom,telephone), envoie un message MODELE (template) valide
a chaque numero, en respectant une petite pause entre les envois, et ecrit un
journal des resultats (succes / echec) dans un CSV.

>>> IMPORTANT <<<
Pour du marketing, Meta EXIGE :
  1) Un numero WhatsApp Business API (WABA) + un PHONE_NUMBER_ID
  2) Un TOKEN d'acces
  3) Un MODELE de message ("template") deja VALIDE dans Meta Business Manager,
     categorie MARKETING, en francais.
Tu ne peux PAS envoyer un texte libre en premier contact : il faut un template.

Configuration : copie .env.example en .env et remplis les valeurs, OU exporte
les variables d'environnement WA_TOKEN / WA_PHONE_NUMBER_ID / WA_TEMPLATE_NAME.
"""

import argparse
import csv
import os
import re
import sys
import time
import json
import urllib.request
import urllib.error
from datetime import datetime

GRAPH_VERSION = "v22.0"


def load_env(env_path):
    """Charge un fichier .env simple (KEY=VALUE) sans dependance externe."""
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def normalize_phone(raw):
    """Nettoie/valide un numero. Retourne le numero au format E.164 sans '+',
    tel qu'attendu par l'API WhatsApp, ou None si invalide."""
    if not raw:
        return None
    p = raw.strip().replace(" ", "").replace("-", "")
    if p.startswith("+"):
        p = p[1:]
    if not p.isdigit():
        return None
    # Numero senegalais local (77xxxxxxx) -> prefixe 221
    if len(p) == 9 and p[0] == "7":
        p = "221" + p
    # Filtre grossier : au moins 8 chiffres
    if len(p) < 8:
        return None
    return p


def read_recipients(csv_path):
    """Lit le CSV (colonnes nom,telephone), dedoublonne par numero."""
    seen = {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("nom") or row.get("name") or "").strip()
            phone = normalize_phone(row.get("telephone") or row.get("phone") or "")
            if phone and phone not in seen:
                seen[phone] = name
    return seen


def build_template_payload(to, template_name, lang, body_params):
    """Construit le corps JSON d'un message template WhatsApp.
    body_params = liste de valeurs pour les variables {{1}}, {{2}}, ... du template."""
    components = []
    if body_params:
        components.append({
            "type": "body",
            "parameters": [{"type": "text", "text": str(v)} for v in body_params],
        })
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang},
        },
    }
    if components:
        payload["template"]["components"] = components
    return payload


def send_one(token, phone_number_id, payload):
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{phone_number_id}/messages"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        msg_id = body.get("messages", [{}])[0].get("id", "")
        return True, msg_id
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8"))
            reason = err.get("error", {}).get("message", str(e))
        except Exception:
            reason = f"HTTP {e.code}"
        return False, reason
    except Exception as e:  # reseau, timeout, etc.
        return False, str(e)


def main():
    ap = argparse.ArgumentParser(description="Campagne WhatsApp EasySell (API Meta Cloud)")
    ap.add_argument("--csv", default=os.path.join(os.path.dirname(__file__), "clients_easysell.csv"),
                    help="Fichier CSV des destinataires (nom,telephone)")
    ap.add_argument("--template", default=os.environ.get("WA_TEMPLATE_NAME"),
                    help="Nom du modele WhatsApp valide (categorie MARKETING)")
    ap.add_argument("--lang", default=os.environ.get("WA_TEMPLATE_LANG", "fr"),
                    help="Code langue du modele (ex: fr)")
    ap.add_argument("--param", action="append", default=[],
                    help="Valeur d'une variable du modele {{1}},{{2}}... (repetable). "
                         "Utilise {nom} pour inserer le nom du client.")
    ap.add_argument("--delay", type=float, default=1.5, help="Pause en secondes entre 2 envois")
    ap.add_argument("--dry-run", action="store_true", help="Simulation : n'envoie rien, affiche seulement")
    args = ap.parse_args()

    load_env(os.path.join(os.path.dirname(__file__), ".env"))
    token = os.environ.get("WA_TOKEN")
    phone_number_id = os.environ.get("WA_PHONE_NUMBER_ID")
    template = args.template or os.environ.get("WA_TEMPLATE_NAME")

    if not args.dry_run and (not token or not phone_number_id):
        sys.exit("ERREUR : WA_TOKEN et WA_PHONE_NUMBER_ID manquants. "
                 "Remplis whatsapp/.env (voir .env.example).")
    if not template:
        sys.exit("ERREUR : nom du modele manquant (--template ou WA_TEMPLATE_NAME).")

    recipients = read_recipients(args.csv)
    if not recipients:
        sys.exit(f"Aucun destinataire valide dans {args.csv}")

    print(f"Destinataires uniques : {len(recipients)}")
    print(f"Modele : {template} ({args.lang})  |  Mode : "
          + ("SIMULATION (dry-run)" if args.dry_run else "ENVOI REEL"))
    print("-" * 60)

    log_path = os.path.join(os.path.dirname(__file__),
                            f"envoi_{datetime.now():%Y%m%d_%H%M%S}.csv")
    ok, ko = 0, 0
    with open(log_path, "w", newline="", encoding="utf-8") as logf:
        writer = csv.writer(logf)
        writer.writerow(["telephone", "nom", "statut", "detail"])
        for phone, name in recipients.items():
            # Remplace {nom} dans les parametres par le vrai nom
            params = [p.replace("{nom}", name or "cher client") for p in args.param]
            if args.dry_run:
                print(f"[SIMU] {phone}  {name}  params={params}")
                writer.writerow([phone, name, "simu", ""])
                ok += 1
                continue
            payload = build_template_payload(phone, template, args.lang, params)
            success, detail = send_one(token, phone_number_id, payload)
            status = "OK" if success else "ECHEC"
            print(f"[{status}] {phone}  {name}  {detail}")
            writer.writerow([phone, name, status, detail])
            ok += success
            ko += (not success)
            time.sleep(args.delay)

    print("-" * 60)
    print(f"Termine.  Succes : {ok}   Echecs : {ko}")
    print(f"Journal ecrit : {log_path}")


if __name__ == "__main__":
    main()
