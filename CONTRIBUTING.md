# Contributing to ShunyaScape 🚀

First off, thank you for taking the time to contribute to **ShunyaScape**! We are excited to open-source this project and welcome developers from the MERN Stack community to build a real-time, gamified 3D simulation and city-builder.

By contributing to ShunyaScape, you help build a highly optimized, interactive, and beautiful collaborative sandbox.

---

## 🛠️ Tech Stack Overview

ShunyaScape is organized as a monorepo using `pnpm` workspaces. Here is what we use:

*   **Frontend**:
    *   [Next.js 16](https://nextjs.org/) (App Router, React 19)
    *   [Tailwind CSS v4](https://tailwindcss.com/) for modern, responsive, glassmorphic UI layout
    *   [Three.js](https://threejs.org/) for rendering the high-performance 3D voxel grid and entities
    *   [Lucide React](https://lucide.dev/) for crisp, clean vector icons
*   **Backend**:
    *   [Express.js (v5)](https://expressjs.com/) built completely with TypeScript
    *   Native WebSockets via the [`ws`](https://github.com/websockets/ws) library for real-time multiplayer states
    *   [MongoDB](https://www.mongodb.com/) & [Mongoose](https://mongoosejs.com/) for data persistence
    *   [Nodemailer](https://nodemailer.com/) for secure Email-based One-Time Password (OTP) auth
*   **Monorepo Tooling**:
    *   `pnpm` for fast, efficient workspace dependency resolution
    *   `concurrently` to run both backend and frontend servers with a single command

---

## 💻 Local Development Setup

To get ShunyaScape running locally, follow these steps:

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) v20 or higher
*   [pnpm](https://pnpm.io/) v8 or higher
*   A running instance of [MongoDB](https://www.mongodb.com/try/download/community) (either local or MongoDB Atlas)
*   A Gmail account (or SMTP provider) for Nodemailer OTP verification (optional for basic testing, but required for registration flow)

### 2. Clone the Repository
```bash
git clone https://github.com/Be1newinner/shunyascape.git
cd shunyascape
```

### 3. Install Dependencies
Run the install command from the **root** of the repository:
```bash
pnpm install
```

### 4. Configure Environment Variables
You need to set up `.env` files for both the backend and frontend.

#### Backend (`backend/.env`)
Create a `.env` file inside the `backend` folder:
```bash
cp backend/.env.sample backend/.env
```
Open `backend/.env` and fill in the values:
*   `MONGODB_URI`: Your MongoDB connection string (e.g. `mongodb://localhost:27017/shunyascape`)
*   `FRONTEND_URL`: URL of the Next.js frontend (default: `http://localhost:3000`)
*   `JWT_SECRET`: A long random string for securing sessions
*   `EMAIL_USER`: Your Gmail address (for OTP verification)
*   `CLIENT_ID`, `CLIENT_SECRET`, `OAUTH_REFRESH_TOKEN`: Gmail OAuth2 credentials (needed to send OTP mails via Nodemailer)

#### Frontend (`frontend/.env`)
Create a `.env` file inside the `frontend` folder:
```bash
cp frontend/.env.sample frontend/.env
```
Open `frontend/.env` and fill in the values:
*   `MONGODB_URI`: The same MongoDB connection string (Next.js server-side components can use this)
*   `BACKEND_API_URL`: URL of the Express backend (default: `http://localhost:8005`)
*   `FRONTEND_URL`: Next.js frontend origin (default: `http://localhost:3000`)

### 5. Running the Application
From the **root** directory, boot up both the frontend and backend concurrently:
```bash
pnpm dev
```
*   **Frontend**: Runs at [http://localhost:3000](http://localhost:3000)
*   **Backend API**: Runs at [http://localhost:8005](http://localhost:8005)
*   **WebSocket Server**: Runs on top of the backend server at `ws://localhost:8005`

---

## 🔒 Branching & Branch Protection Policy

To protect the production release branch, **direct pushes to the `main` branch are strictly prohibited**. All changes must go through Pull Requests.

### 🛑 Install the Local Pre-Push Hook
To prevent accidental direct pushes from your local machine, run the following setup script immediately after cloning:
```bash
chmod +x scripts/setup-git-hooks.sh
./scripts/setup-git-hooks.sh
```
This installs a local Git pre-push hook that blocks you if you run `git push origin main`.

### 🌿 Branch Naming Conventions
When working on a contribution, create a new branch from `main`:
*   `feature/your-feature-name` (e.g. `feature/trade-market`)
*   `bugfix/your-fix-name` (e.g. `bugfix/npc-stuck-loop`)
*   `docs/your-doc-update` (e.g. `docs/api-guide`)
*   `refactor/cleanup-name` (e.g. `refactor/optimize-three-canvas`)

---

## 🛠️ Contribution Workflow

1.  **Fork** the repository and clone it to your machine.
2.  **Install** the local Git pre-push hook (see instructions above).
3.  Create a **feature branch** off the latest `main`:
    ```bash
    git checkout -b feature/cool-new-feature
    ```
4.  Make your changes. Ensure you adhere to our **Coding Standards** (below).
5.  **Lint and Type-Check** your code:
    *   Backend:
        ```bash
        pnpm --filter express-ts-app run lint
        pnpm --filter express-ts-app run check
        ```
    *   Frontend:
        ```bash
        pnpm --filter unthikable run lint
        ```
6.  **Commit** your changes with clear, descriptive commit messages:
    ```bash
    git commit -m "feat: add ShunyaCoin animation on collection"
    ```
7.  **Push** your branch to your remote fork:
    ```bash
    git push origin feature/cool-new-feature
    ```
8.  **Open a Pull Request (PR)** on GitHub targeting the `main` branch. Provide a comprehensive summary of the changes, screenshot/recording for UI changes, and list any related issues.

---

## 📐 Coding Standards

*   **TypeScript by Default**: Avoid `any` types. Provide explicit type declarations for variables, parameters, and function return types.
*   **Keep Components Modular**: Separate logic from visual layout. In the frontend, separate React components into reusable files inside `app/` (or dedicated components folders).
*   **Real-time Optimization**: Avoid unnecessary WebSocket traffic. Only emit events when coordinates change significantly or when an action is executed. Use local client interpolation where possible.
*   **Write-Back Caching**: The backend is configured to batch write to MongoDB once every 10 seconds. Do not query the DB directly in the game loop; use the server-side memory store for real-time reads and let the bulk write handle persistence.

Thank you for contributing! If you have any questions or need help setting up, please open an Issue. Let's make ShunyaScape amazing together! 🌟
