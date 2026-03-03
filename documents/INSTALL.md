# 🚀 Installation Guide (Docker)

This guide will walk you through the process of building and running the `recipe_optimm` project using Docker. By using Docker, you encapsulate the entire environment—including Node.js, Python tools (yt-dlp), PM2, and the Ollama AI models—into a single container.

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your machine:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine.
* Git.

---

## 🛠️ Step-by-Step Installation

### Step 1: Clone the Repository
First, clone the project to your local machine and navigate into the project directory:

```bash
git clone [https://github.com/nndang27/recipe_optimm.git](https://github.com/nndang27/recipe_optimm.git)
cd recipe_optimm
```

### Step 2: Configure Environment Variables
You must set up your environment variables before building or running the container. 
1. Create a `.env` file in the root directory.
2. Please refer to the [GET_ENV.MD](./GET_ENV.MD) file for detailed instructions on how to obtain and configure all the required API keys and tokens.

### Step 3: Create a `.dockerignore` File
To prevent copying unnecessary files into the Docker image and keep the build efficient, ensure you have a `.dockerignore` file in your root directory with the following content:

```text
node_modules
.git
.env
```

### Step 4: Build the Docker Image
Run the following command to build the Docker image. 

> **⚠️ Important Note:** This step will take some time and require a stable internet connection. The Dockerfile is configured to download the `llama3.1:8b` and `mxbai-embed-large` models automatically, which will add approximately ~5.5GB to the final image size.

```bash
docker build -t recipe_optimm_app .
```

### Step 5: Run the Docker Container
Once the build is successfully completed, start the container. This command runs the container in the background (`-d`), maps the necessary ports, and loads the environment variables from your `.env` file.

```bash
docker run -d \
  --name recipe_app_container \
  --env-file .env \
  -p 3000:3000 \
  -p 8080:8080 \
  -p 11434:11434 \
  recipe_optimm_app
```

**Port Mapping Breakdown:**
* `3000`: Frontend Next.js application.
* `8080`: Backend Socket server.
* `11434`: Ollama AI Server.

---

## 🔍 Managing the Container

Here are some useful commands to manage and debug your running application:

**View Application Logs:**
Since PM2 is managing multiple processes (Frontend, Backend, Ollama), you can check the logs to ensure everything started correctly:
```bash
docker logs -f recipe_app_container
```

**Access the Container Shell:**
If you need to enter the container to check files or run manual commands:
```bash
docker exec -it recipe_app_container /bin/bash
```

**Stop the Container:**
```bash
docker stop recipe_app_container
```

**Start the Container (after stopping):**
```bash
docker start recipe_app_container
```

---

## 🎉 Access the App
Once the container is running and the PM2 logs show that the services have started successfully, you can access the application at:
👉 **http://localhost:3000**