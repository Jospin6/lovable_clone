# Frontend Atelier

Interface Next.js App Router de création de sites : accueil, prompts, streaming SSE, code, aperçu isolé, vue mobile et export ZIP.

Consulter le [guide du projet](../README.md) pour démarrer FastAPI, configurer le modèle et connaître le périmètre de l’aperçu.

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000. Le proxy `/api` communique avec `http://127.0.0.1:8000` par défaut ; `BACKEND_URL` dans `.env.local` permet de changer cette adresse.

```bash
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Les tests démarrent leur propre backend simulé et vérifient le flux de bout en bout sans appel payant au modèle. Python et les dépendances de `backend/requirements.txt` doivent être installés dans `backend/.venv`.
