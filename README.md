# Le Rocher — Planning Technique

Application de gestion du planning du service technique.
Next.js + Neon (PostgreSQL gratuit, jamais suspendu).

---

## 🚀 Déploiement

### 1. Neon
- [neon.tech](https://neon.tech) → New Project
- SQL Editor → colle `neon_tables.sql` → Run
- Dashboard → copie la **Connection string**

### 2. .env.local
```
DATABASE_URL=postgresql://...votre url neon...
```

### 3. Test local
```bash
npm install
npm run dev
```
- Admin : http://localhost:3000 (mot de passe: `rocher2026`)
- Membres : http://localhost:3000/membre (mot de passe: `technique2026`)

### 4. GitHub
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/TON_USERNAME/planning-rocher.git
git push -u origin main
```

### 5. Vercel
- Import repo → Environment Variables → `DATABASE_URL` → Deploy

---

## 📱 Deux interfaces

- `/` → Admin (planning, membres, paramètres)
- `/membre` → Membres (saisie indispos sur téléphone)

## 🔑 Mots de passe par défaut
- Admin : `rocher2026`
- Membres : `technique2026`

Modifiables depuis Paramètres dans l'interface admin.
