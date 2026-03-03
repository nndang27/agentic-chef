# 🍳 Recipe Optimm: Agentic AI for Menu & Recipe Optimization

Welcome to **Recipe Optimm**, an AI-powered platform designed to revolutionize meal planning and grocery shopping. By leveraging autonomous AI agents, this system intelligently optimizes daily menus, suggests personalized recipes, and dynamically fetches real-time ingredient prices from supermarkets to help users save time and budget effectively.

## 🧠 Agentic Architecture

The core of Recipe Optimm relies on an **Agentic Workflow**, where large language models (LLMs) act as reasoning engines that interact with external tools, databases, and APIs to complete complex tasks autonomously.

* **Task Orchestration:** The backend utilizes Socket.io for real-time, bi-directional communication, allowing the frontend to receive step-by-step updates as the AI agent processes complex queries.
* **Knowledge Retrieval & Graphing:** We use **Neo4j** as a Knowledge Graph to map complex relationships between ingredients, dietary restrictions, and recipes, combined with **mxbai-embed-large** for semantic search.
* **Real-Time Data Gathering:** The agents are equipped with **Tavily AI Search** and **Apify** web scrapers to browse the internet, extract current supermarket pricing, and fetch external recipe data.
* **Local AI Processing:** To ensure privacy, lower latency, and cost-effectiveness, the reasoning engine is powered by **Llama 3.1 (8B)** running locally via **Ollama**.

## 🔄 Agentic Execution Flow

The system routes user queries through a specialized decision pipeline to ensure the right tools are triggered at the right time.

**Standard Flow:**
```text
ORCHESTRATOR → SEARCH_VIDEO → SEARCH_MAP → SEARCH_RECIPE → SEARCH_PRICE → GENERAL_CHAT

**MemoryMode Flow**
```text
LOAD_SEMANTIC_MEM → MANAGE_MEMORY → ORCHESTRATOR → SEARCH_VIDEO → SEARCH_MAP → SEARCH_RECIPE → SEARCH_PRICE → GENERAL_CHAT → SUMMARIZED_HISTORY_CHAT

## 💻 Tech Stack

This project is built using a modern, scalable monolith architecture with a clear separation of concerns between the client, server, and AI services.

### Frontend
* **Framework:** TypeScript, Next.js / React
* **Authentication:** Clerk
* **Maps & Location:** Google Maps API
* **Media Management:** UploadThing, Cloudinary

### Backend & Real-time
* **Runtime:** Node.js with TypeScript (`tsx`)
* **Process Management:** PM2
* **Real-time Communication:** WebSockets (Socket.io)
* **Video/Media Utility:** `yt-dlp` (for extracting media data)

### Database & Storage
* **Relational Database:** Vercel Postgres
* **ORM:** Drizzle ORM
* **Graph Database:** Neo4j Aura (for ingredient/recipe relationship mapping)

### AI & Agents
* **LLM Engine:** Ollama (running `llama3.1:8b`)
* **Embedding Model:** `mxbai-embed-large`
* **Agent Tools:** Tavily API (Search), Apify (Scraping)

---

## 🚀 Getting Started

### 1. Environment Setup
Before running the application, you must configure the necessary API keys, database connection strings, and AI service ports. 
👉 **[Read the Environment Setup Guide](./documents/SETUP_ENV.md)**

### 2. Installation & Running the App
We use Docker to containerize the entire stack (Frontend, Backend, and Ollama) for a seamless, "one-click" development experience. 
👉 **[Read the Installation Guide](./documents/INSTALL.md)**

---

## ✨ Current Features & Agent Capabilities

The AI agents in Recipe Optimm are equipped with specific tools to handle various culinary and planning tasks. Here is what the system currently supports:

* 🎥 **Video Recommendations (`SEARCH_VIDEO`)**
  * Intelligently recommends relevant cooking videos and tutorials based on user requests and dietary preferences.

* 💰 **Price Optimization (`SEARCH_PRICE`)**
  * Capable of searching and calculating the total estimated cost of an entire recipe.
  * Supports price fetching for individual, specific ingredients to help users budget their grocery shopping.

* 🍽️ **Recipe Search (`SEARCH_RECIPE`)**
  * Discovers and retrieves detailed cooking recipes based on user prompts.
  * *Current Limitation:* Searching for multiple different recipes simultaneously in a single query is not yet supported.

* 🗺️ **Smart Routing & Location (`SEARCH_MAP`)**
  * **Route Planning:** Locates supermarkets along a specific route (e.g., from your home to a destination, or between any two specific points).
  * **Nearby Search:** Finds supermarkets close to your home address or within a specifically requested area.

* 💬 **Culinary Chatbot (`CHAT_BOT`)**
  * An interactive AI assistant dedicated to casual Q&A about food, ingredients, and cooking techniques.
  * *Scope:* The bot is strictly specialized in culinary topics and is programmed to gracefully decline off-topic conversations.

* 💾 **Recipe Management**
  * Users can seamlessly save their favorite recipes directly to their personal vault after a successful search for future reference.

* 🧠 **Memory Mode**
  * The system remembers user preferences and past interactions to provide personalized recommendations. Please click the Memory button on the top right corner to enable or disable the memory mode.


## 📸 Application Screenshots

### 🏠 Homepage
<p align="center">
  <img src="home_page_demo.png" width="800" alt="Homepage Demo">
</p>

### 📊 Dashboard
<p align="center">
  <img src="dashboard_demo.png" width="800" alt="Dashboard Demo">
</p>

### 💰 Ingredient Price Comparison
<p align="center">
  <img src="ingredent_price_compare.png" width="800" alt="Price Comparison Demo">
</p>

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License
This project is licensed under the MIT License.