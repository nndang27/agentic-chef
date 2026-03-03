# ⚙️ Environment Variables Setup Guide (.env) for Recipe Optimm

This document provides detailed instructions on how to obtain the necessary API Keys and Tokens to run the project.

**How to get started:**
1. Create a file named `.env` in the root directory of the project.
2. Follow the steps below to retrieve the keys for each service and populate your `.env` file.
3. **Important Note:** Absolutely DO NOT commit your `.env` file to GitHub to ensure your credentials remain secure.

---

## 1. Postgres Database (Drizzle & Vercel Postgres)
The project uses PostgreSQL. If you are using [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), these variables might be automatically generated when you link your project.

* **Dashboard URL:** [Vercel Dashboard](https://vercel.com/dashboard)
* **How to get the keys:** 1. Select your Project on Vercel.
  2. Navigate to the **Storage** tab and select your Postgres database.
  3. Switch to the `.env.local` tab and copy all the values.

```env
# Drizzle
DATABASE_URL="postgres://default:xyz@ep-xxx.postgres.vercel-storage.com:5432/verceldb"
DATABASE_URL_UNPOOLED="postgres://default:xyz@ep-xxx-pooler.postgres.vercel-storage.com:5432/verceldb"
PGHOST="ep-xxx.postgres.vercel-storage.com"
PGHOST_UNPOOLED="ep-xxx-pooler.postgres.vercel-storage.com"
PGDATABASE="verceldb"
PGPASSWORD="xyz"

# Vercel Postgres Templates
POSTGRES_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
POSTGRES_USER="default"
POSTGRES_HOST="ep-xxx.postgres.vercel-storage.com"
POSTGRES_PASSWORD="xyz"
POSTGRES_DATABASE="verceldb"
POSTGRES_URL_NO_SSL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
```

---

## 2. User Authentication (Clerk)
* **Dashboard URL:** [Clerk Dashboard](https://dashboard.clerk.com/)
* **How to get the keys:** 1. Log in and select your Application.
  2. On the left sidebar menu, select **API Keys**.
  3. Copy the `Publishable key` and `Secret key`.

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

---

## 3. File Storage & Error Tracking (UploadThing & Sentry)

### UploadThing
* **Dashboard URL:** [UploadThing Dashboard](https://uploadthing.com/dashboard)
* **How to get the keys:** Select your App -> go to the **API Keys** tab.

### Sentry
* **Dashboard URL:** [Sentry.io](https://sentry.io/)
* **How to get the keys:** 1. Go to Settings -> **Developer Settings**.
  2. Create or copy an **Auth Token** (ensure you grant `project:write` and `releases:admin` permissions).

```env
UPLOADTHING_TOKEN="..."
SENTRY_AUTH_TOKEN="sntrys_..."
```

---

## 4. Maps (Google Maps)
* **Dashboard URL:** [Google Cloud Console](https://console.cloud.google.com/)
* **How to get the keys:** 1. Navigate to APIs & Services -> **Credentials**.
  2. Click `Create Credentials` -> select `API Key`.
  3. *Note: You must go to the Library section to Enable both the **Maps JavaScript API** and the **Places API**.*

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSy..."
```

---

## 5. Graph Database (Neo4j Aura)
* **Dashboard URL:** [Neo4j Aura Console](https://console.neo4j.io/)
* **How to get the keys:** 1. When creating a new Instance, the system will automatically download a `.txt` file containing your `Username`, `Password`, and `URI`. 
  2. Your `InstanceID` can be found in the URL when you click on the instance, or directly on the dashboard.

```env
NEO4J_URI="neo4j+s://xxx.databases.neo4j.io"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="..."
NEO4J_DATABASE="neo4j"
AURA_INSTANCEID="xxx"
AURA_INSTANCENAME="Your_Instance_Name"
```

---

## 6. Data Crawling & AI Search (Apify & Tavily)

### Apify
* **Dashboard URL:** [Apify Console](https://console.apify.com/)
* **How to get the keys:** Go to Settings -> **Integrations** -> Copy your `Personal API token`.

### Tavily
* **Dashboard URL:** [Tavily AI](https://app.tavily.com/)
* **How to get the keys:** Log into the Home dashboard -> Copy your `API Key`.

```env
APIFY_API_TOKEN="apify_api_..."
TAVILY_API_KEY="tvly-..."
```

---

## 7. Image/Media Storage (Cloudinary)
* **Dashboard URL:** [Cloudinary Console](https://console.cloudinary.com/)
* **How to get the keys:** On the main Dashboard screen, locate the **Product Environment Credentials** section. You will find your `Cloud Name`, `API Key`, and `API Secret` there.

```env
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
CLOUDINARY_CLOUD_NAME="..."
```

---

## 8. Network Configuration & Deployment
These variables are defined by you depending on the environment you are running (Local or Server/VPS) so that your Backend (with sockets) and AI (Ollama) can communicate.

* `OLLAMA_HOST`: The IP/Port address of your Ollama instance (default for Docker or local is `http://127.0.0.1:11434`).
* `BACKEND_PORT`: The port your backend socket listens on (e.g., `8080`).
* `BACKEND_IP`: The IP of your backend (leave empty or use `127.0.0.1` for local, use your server's IP for deployment).

```env
OLLAMA_HOST="[http://127.0.0.1:11434](http://127.0.0.1:11434)"
BACKEND_PORT="8080"
BACKEND_IP="127.0.0.1"
```