# QueryFlow

> A web-based, no-code visual SQL query builder for MySQL — drag tables, draw JOINs, set filters, and run queries without writing a line of SQL. Developed by **Bryan James G. Dionisio**.

![QueryFlow Banner](./docs/banner.png)

---

## Features

- 🎨 **Drag & Drop Canvas** — drag tables from the schema browser onto a React Flow canvas
- 🔗 **Visual JOIN Builder** — connect table nodes with edges, configure INNER/LEFT/RIGHT JOINs and column matchers via a popover
- 🔒 **User Authentication & Saved Connections** — log in, save your database credentials with AES-256-GCM encryption, and connect with a single click
- 🔍 **Filter Builder** — nested AND/OR filter groups with all major operators (`=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IN`, `IS NULL`, `IS NOT NULL`)
- 📊 **Aggregation Panel** — GROUP BY, ORDER BY, aggregate functions (COUNT/SUM/AVG/MIN/MAX with DISTINCT), LIMIT
- ⚡ **Live SQL Preview** — syntax-highlighted SQL that updates in real time as you build
- 📋 **Results Panel** — paginated query output table with column metadata
- 🔄 **MySQL Version Compatibility** — auto-detects MySQL version on connect; grays out unsupported features (window functions on 5.6/5.7, etc.) and shows inline warnings
- 💾 **Export SQL** — download the generated query as a `.sql` file
- 📁 **Query Templates** — save and load named query definitions

---

## Architecture

```
QueryFlow/
├── client/          React + Vite + React Router frontend
│   └── src/
│       ├── pages/        Route pages (Auth/Login, Auth/Signup, Builder)
│       ├── components/   UI components (Canvas, Sidebar, ConnectionModal, etc.)
│       ├── store/        Zustand state (authStore, connectionStore, queryStore)
│       ├── services/     Axios API client
│       └── utils/        clientSqlBuilder (live preview), UUID helper
│
└── server/          Node.js + Express backend
    └── src/
        ├── api/          Route definitions (authRoutes, routes)
        ├── services/     connectionService, schemaService, internalDb, versionAdapter
        ├── utils/        encryption utilities
        └── queryBuilder/ Modular SQL generation (select, join, filter, aggregation)
```

### Data Flow

```
User (drag/drop/config)
  → queryStore (Zustand)
    → clientSqlBuilder  → SQLPreview (live, no API)
    → POST /api/execute → queryBuilder (server)
                         → versionAdapter (compat checks)
                         → mysql2 pool
                         → ResultsPanel
```

---

## Local Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **MySQL** 5.6, 5.7, or 8.0+ running locally or remotely
- **npm** 9+

### 1. Clone & Install

```bash
git clone https://github.com/BryanJamesGDionisio/queryflow.git
cd queryflow

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Server

Copy the example environment file:

```bash
cd server
copy .env.example .env
```

Edit `server/.env`:

```env
PORT=3001
SESSION_SECRET=your-long-random-secret-here
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development

# Internal Database for users and saved connections
INTERNAL_DB_HOST=localhost
INTERNAL_DB_PORT=3306
INTERNAL_DB_USER=root
INTERNAL_DB_PASSWORD=
INTERNAL_DB_NAME=queryflow_system
```

### 3. Start Development Servers

In two separate terminals:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# → Server running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# → Vite dev server on http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

### 4. Connect to MySQL

Create an account, click **Connect**, enter your MySQL credentials, and optionally check **"Save this connection for future use"**. The server will:
1. Test the connection
2. Auto-detect your MySQL version and configure compatibility
3. Securely encrypt and save your connection for 1-click reconnects later

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/signup` | None | Create a user account |
| `POST` | `/api/auth/login` | None | Authenticate user |
| `GET` | `/api/auth/me` | Session | Get current user and active connection status |
| `POST` | `/api/auth/logout` | Session | Destroy session |
| `POST` | `/api/connect` | Session | Connect to an arbitrary MySQL database |
| `POST` | `/api/connect/saved` | Session | Connect using a saved connection ID |
| `GET` | `/api/connections` | Session | List saved connections |
| `POST` | `/api/connections` | Session | Save a new connection |
| `DELETE` | `/api/connections/:id`| Session| Delete a saved connection |
| `DELETE` | `/api/disconnect` | Session | End active database session |
| `GET` | `/api/version` | Connection | Version + compat map |
| `GET` | `/api/schema` | Connection | Tables + columns |
| `POST` | `/api/execute` | Connection | Execute a JSON query definition |

---

## Author

**Bryan James G. Dionisio**

## License

MIT
