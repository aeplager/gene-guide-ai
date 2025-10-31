# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/8c3c2350-7c41-427f-8461-087bddd0e42a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/8c3c2350-7c41-427f-8461-087bddd0e42a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Local (Docker Compose):

```sh
cp .env.example .env # or create .env with required variables
docker compose up -d --build
# Frontend: http://localhost:8090
# Backend:  http://localhost:8086
```

Required .env variables:

```
# Backend
TAVUS_API_KEY=...
TAVUS_REPLICA_ID=r4317e64d25a
TAVUS_PERSONA_ID=p92464cdb59e
TAVUS_CALLBACK_URL=
CORS_ORIGINS=http://localhost:8090

# Frontend build-time
VITE_TAVUS_BACKEND_URL=http://localhost:8082
```

If port 8082 is occupied, use 8086 (default in compose):

```
VITE_TAVUS_BACKEND_URL=http://localhost:8086
```

Azure Container Apps:

- Backend command: `gunicorn -w 2 -b 0.0.0.0:8081 app:app`
- Set `CORS_ORIGINS` to your frontend origin (no trailing slash)
- Build frontend with `VITE_TAVUS_BACKEND_URL=https://<backend-fqdn>`

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and Click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

## 🚀 Azure Deployment with GitHub Actions

### **Automated Deployment**

This project includes GitHub Actions workflow for automatic deployment to Azure Container Apps.

**Complete guide**: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)  
**Quick checklist**: [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)

### **Setup Steps**

1. **Azure Portal**: Create ACR `geneguidellm` in resource group `rg_custom_llm`
2. **GitHub Secrets**: Add 13 required secrets (see `DEPLOYMENT_GUIDE.md`)
3. **Push to main**: Automatic deployment via `.github/workflows/deploy.yml`

### **Required GitHub Secrets**

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `TAVUS_API_KEY`, `TAVUS_REPLICA_ID`, `TAVUS_PERSONA_ID`
- `DB_CONNECTION_STRING`, `COMPANY_ID`, `JWT_SECRET`
- `CUSTOM_LLM_BASE_URL`, `CUSTOM_LLM_API_KEY`, `CUSTOM_LLM_PERSONA_ID`

### **Deployment Result**

After pushing to `main`, GitHub Actions will:
- Build and push Docker images to Azure Container Registry
- Deploy backend to `gene-guide-backend.*.azurecontainerapps.io`
- Deploy frontend to `gene-guide-frontend.*.azurecontainerapps.io`
- Configure CORS between frontend and backend
- Set all environment variables automatically

**Estimated deployment time**: 5-10 minutes

---

## 📚 Documentation

- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) - Complete Azure deployment guide
- [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) - Quick deployment checklist
- [`TAVUS_INTEGRATION_GUIDE.md`](./TAVUS_INTEGRATION_GUIDE.md) - Tavus video testing
- [`TAVUS_VIDEO_DEBUGGING.md`](./TAVUS_VIDEO_DEBUGGING.md) - Video troubleshooting
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) - General testing guide
