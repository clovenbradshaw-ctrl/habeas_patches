# CLAUDE.md — Amino Immigration Habeas Petition System

## What This Is

A multi-attorney habeas corpus petition management system for immigration lawyers. Attorneys create clients, select from shared reference data (facilities, courts, attorney profiles), draft petitions from templates, and export Word/PDF documents. All data syncs via Matrix protocol for real-time collaboration. Exports are always generated locally — never stored on the server.

Production URL: `app.aminoimmigration.com`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  React SPA (Vite + TypeScript)                      │
│  app.aminoimmigration.com                           │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │  Board   │ │ Clients  │ │Directory │            │
│  │ (Kanban) │ │ + Editor │ │(Shared)  │            │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘            │
│       └─────────────┴────────────┘                  │
│                     │                               │
│           matrix-js-sdk layer                       │
│                     │                               │
└─────────────────────┼───────────────────────────────┘
                      │ HTTPS (Client-Server API)
                      ▼
┌─────────────────────────────────────────────────────┐
│  Synapse Homeserver                                 │
│  matrix.aminoimmigration.com                        │
│                                                     │
│  Rooms:                                             │
│    !org        → shared config, user mgmt           │
│    !templates  → petition templates                 │
│    !client:{n} → one per client (case files)        │
│                                                     │
│  PostgreSQL backing store                           │
│  Optional: E2EE per room                            │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1: Infrastructure Setup

### 1.1 Synapse Homeserver

Set up Synapse on the server that will serve `matrix.aminoimmigration.com`.

```bash
# If using Docker (recommended):
mkdir -p /opt/synapse/data

# Generate config
docker run -it --rm \
  -v /opt/synapse/data:/data \
  -e SYNAPSE_SERVER_NAME=aminoimmigration.com \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

# Edit /opt/synapse/data/homeserver.yaml:
#   - Set public_baseurl: https://matrix.aminoimmigration.com
#   - Set registration_shared_secret for admin user creation
#   - Enable registration: false (admin creates all accounts)
#   - Set database to PostgreSQL (not SQLite)
#   - Set max_upload_size_mb: 50

# Run
docker compose up -d
```

**DNS records needed:**
```
matrix.aminoimmigration.com  A     → server IP
app.aminoimmigration.com     A/CNAME → frontend host
_matrix._tcp.aminoimmigration.com SRV → 0 10 443 matrix.aminoimmigration.com
```

**Well-known delegation** — serve at `https://aminoimmigration.com/.well-known/matrix/server`:
```json
{ "m.server": "matrix.aminoimmigration.com:443" }
```

And `/.well-known/matrix/client`:
```json
{
  "m.homeserver": { "base_url": "https://matrix.aminoimmigration.com" }
}
```

### 1.2 Admin Bootstrap

After Synapse is running, register the admin account:

```bash
docker exec -it synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -u admin -p <password> -a
```

Then create the two foundational rooms via the admin account (use the Matrix client-server API or a script):

```
POST /_matrix/client/v3/createRoom
{
  "name": "Amino Org",
  "room_alias_name": "org",
  "visibility": "private",
  "power_level_content_override": {
    "events_default": 0,
    "state_default": 50,
    "users": { "@admin:aminoimmigration.com": 100 }
  }
}
```

```
POST /_matrix/client/v3/createRoom
{
  "name": "Templates",
  "room_alias_name": "templates",
  "visibility": "private",
  "power_level_content_override": {
    "events_default": 0,
    "state_default": 50,
    "users": { "@admin:aminoimmigration.com": 100 }
  }
}
```

---

## Phase 2: Project Structure

```
amino-habeas/
├── CLAUDE.md              ← this file
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .env                   ← VITE_MATRIX_SERVER_URL, etc
├── src/
│   ├── main.tsx
│   ├── App.tsx            ← root: auth gate + router
│   │
│   ├── matrix/            ← Matrix SDK integration layer
│   │   ├── client.ts      ← singleton MatrixClient init, login, sync
│   │   ├── rooms.ts       ← room discovery: find !org, !templates, !client:*
│   │   ├── events.ts      ← custom event type constants + helpers
│   │   ├── directory.ts   ← CRUD for facilities/courts/attorneys/national
│   │   ├── petitions.ts   ← CRUD for client rooms, petitions, blocks
│   │   └── hooks.ts       ← React hooks: useMatrixClient, useRoom, useStateEvents
│   │
│   ├── models/            ← TypeScript types (no Matrix dependency)
│   │   ├── facility.ts
│   │   ├── court.ts
│   │   ├── attorney.ts
│   │   ├── client.ts      ← immigration client (not Matrix client)
│   │   ├── petition.ts
│   │   ├── template.ts
│   │   └── provenance.ts
│   │
│   ├── views/
│   │   ├── LoginView.tsx
│   │   ├── BoardView.tsx      ← kanban
│   │   ├── ClientsView.tsx    ← client list + detail
│   │   ├── DirectoryView.tsx  ← facilities, courts, attorneys, national
│   │   ├── EditorView.tsx     ← petition editor + paginated doc
│   │   └── AdminView.tsx      ← user management (admin only)
│   │
│   ├── components/
│   │   ├── PaginatedDoc.tsx
│   │   ├── EditableBlock.tsx
│   │   ├── FieldGroup.tsx
│   │   ├── Picker.tsx
│   │   ├── ProvenanceBadge.tsx
│   │   ├── KanbanCard.tsx
│   │   └── ExportButtons.tsx
│   │
│   ├── export/            ← local-only document generation
│   │   ├── word.ts        ← build Word-compatible HTML, trigger download
│   │   └── pdf.ts         ← print-to-PDF or generate via docx-js → LibreOffice
│   │
│   ├── templates/
│   │   └── habeas-1225b2.ts  ← default block array
│   │
│   └── styles/
│       └── index.css
│
└── scripts/
    ├── bootstrap-rooms.ts    ← create !org + !templates rooms
    ├── seed-directory.ts     ← populate initial facilities/courts
    └── generate-pdf.py       ← server-side PDF (reportlab)
```

### Dependencies

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "matrix-js-sdk": "^34",
    "zustand": "^5"
  },
  "devDependencies": {
    "typescript": "^5.5",
    "vite": "^6",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

Use **zustand** for local state management. Matrix SDK handles persistence + sync; zustand holds the denormalized view for React.

---

## Phase 3: Matrix Integration Layer

### 3.1 Custom Event Types

These are the state event types used across rooms. Each maps to a concept in the app.

```typescript
// src/matrix/events.ts

// ── !org room state events ──────────────────────────
// State key: "" (singleton)
export const EVT_NATIONAL = "com.amino.config.national";
// { iceDirector, iceDirectorTitle, dhsSecretary, attorneyGeneral }

// State key: facility ID
export const EVT_FACILITY = "com.amino.facility";
// { name, city, state, warden, fieldOfficeName, fieldOfficeDirector }

// State key: court ID
export const EVT_COURT = "com.amino.court";
// { district, division }

// State key: attorney profile ID
export const EVT_ATTORNEY = "com.amino.attorney";
// { name, barNo, firm, address, cityStateZip, phone, fax, email, proHacVice }

// State key: user MXID
export const EVT_USER_ROLE = "com.amino.user";
// { role: "admin" | "attorney", displayName }

// ── !templates room state events ────────────────────
// State key: template ID
export const EVT_TEMPLATE = "com.amino.template";
// { name, description, legalBasis, blocks: Block[], archived: boolean }

// ── !client:{id} room state events ──────────────────
// State key: "" (singleton per room)
export const EVT_CLIENT = "com.amino.client";
// { name, country, yearsInUS, entryDate, entryMethod, ... }

// State key: petition ID
export const EVT_PETITION = "com.amino.petition";
// { stage, caseNumber, facilityId, courtId, att1Id, att2Id,
//   district, division, facilityName, ... (denormalized at time of creation),
//   filingDate, filingDay, filingMonthYear }

// State key: petition ID (blocks stored separately for size)
export const EVT_PETITION_BLOCKS = "com.amino.petition.blocks";
// { blocks: Block[] }

// ── Timeline events (any room) ──────────────────────
export const EVT_OP = "com.amino.op";
// { op: "FILL"|"REVISE"|"STAGE"|"APPLY"|"SNAPSHOT", target, payload, frame }
```

### 3.2 Client Initialization

```typescript
// src/matrix/client.ts
import { createClient, MatrixClient } from "matrix-js-sdk";

let client: MatrixClient | null = null;

export async function initMatrix(
  baseUrl: string,
  userId: string,
  accessToken: string
): Promise<MatrixClient> {
  client = createClient({ baseUrl, userId, accessToken });

  // Only sync state events + limited timeline for efficiency
  // We don't need full message history
  await client.startClient({
    initialSyncLimit: 0,
    // Filter to only our custom events
    filter: {
      room: {
        state: { types: [
          "com.amino.*",
          "m.room.power_levels",
          "m.room.member"
        ]},
        timeline: { types: ["com.amino.op"], limit: 50 },
      }
    }
  });

  return client;
}

export function getClient(): MatrixClient {
  if (!client) throw new Error("Matrix client not initialized");
  return client;
}
```

### 3.3 Room Discovery

```typescript
// src/matrix/rooms.ts
import { getClient } from "./client";

// Room IDs are discovered by alias, then cached
let orgRoomId: string | null = null;
let templatesRoomId: string | null = null;

export async function getOrgRoom(): Promise<string> {
  if (orgRoomId) return orgRoomId;
  const client = getClient();
  const result = await client.getRoomIdForAlias("#org:aminoimmigration.com");
  orgRoomId = result.room_id;
  return orgRoomId;
}

export async function getTemplatesRoom(): Promise<string> {
  if (templatesRoomId) return templatesRoomId;
  const client = getClient();
  const result = await client.getRoomIdForAlias("#templates:aminoimmigration.com");
  templatesRoomId = result.room_id;
  return templatesRoomId;
}

// Client rooms are discovered by scanning joined rooms
// Convention: room name starts with "client:" or has com.amino.client state
export function getClientRooms(): string[] {
  const client = getClient();
  const rooms = client.getRooms();
  return rooms
    .filter(r => {
      try {
        r.currentState.getStateEvents("com.amino.client", "");
        return true;
      } catch { return false; }
    })
    .map(r => r.roomId);
}
```

### 3.4 Directory CRUD (Shared Reference Data)

```typescript
// src/matrix/directory.ts
import { getClient } from "./client";
import { getOrgRoom } from "./rooms";
import { EVT_FACILITY, EVT_COURT, EVT_ATTORNEY, EVT_NATIONAL, EVT_OP } from "./events";
import type { Facility, Court, AttorneyProfile, NationalDefaults } from "../models";

// ── Read: state events from !org room ───────────────
export async function getFacilities(): Promise<Record<string, Facility>> {
  const client = getClient();
  const roomId = await getOrgRoom();
  const events = client.getRoom(roomId)
    ?.currentState.getStateEvents(EVT_FACILITY) || [];

  const result: Record<string, Facility> = {};
  for (const evt of events) {
    if (evt.getStateKey() && evt.getContent()?.name) {
      const id = evt.getStateKey()!;
      result[id] = {
        id,
        ...evt.getContent(),
        // Provenance from Matrix event metadata
        createdBy: evt.getSender(),
        updatedAt: new Date(evt.getTs()).toISOString(),
      };
    }
  }
  return result;
}

// ── Write: send state event to !org room ────────────
export async function upsertFacility(facility: Facility): Promise<void> {
  const client = getClient();
  const roomId = await getOrgRoom();

  // State event — the state_key is the facility ID
  // Matrix handles versioning: each send replaces the previous state
  // Previous versions remain in room history (provenance for free)
  await client.sendStateEvent(roomId, EVT_FACILITY, {
    name: facility.name,
    city: facility.city,
    state: facility.state,
    warden: facility.warden,
    fieldOfficeName: facility.fieldOfficeName,
    fieldOfficeDirector: facility.fieldOfficeDirector,
  }, facility.id);

  // Also log an operation event for the audit trail
  await client.sendEvent(roomId, EVT_OP, {
    op: "UPDATE", target: `facility.${facility.id}`,
    payload: facility.name,
    frame: { entity: "facility" },
  });
}

export async function deleteFacility(id: string): Promise<void> {
  const client = getClient();
  const roomId = await getOrgRoom();

  // "Delete" = send state event with empty content
  // Matrix state events can't be truly deleted, but empty content = tombstoned
  await client.sendStateEvent(roomId, EVT_FACILITY, { deleted: true }, id);

  await client.sendEvent(roomId, EVT_OP, {
    op: "DELETE", target: `facility.${id}`,
    payload: null,
    frame: { entity: "facility" },
  });
}

// Courts, attorneys, national follow the same pattern:
// upsertCourt(court)   → sendStateEvent(orgRoom, EVT_COURT, {...}, court.id)
// upsertAttorney(att)  → sendStateEvent(orgRoom, EVT_ATTORNEY, {...}, att.id)
// updateNational(data)  → sendStateEvent(orgRoom, EVT_NATIONAL, {...}, "")
// Each with a corresponding EVT_OP timeline event for audit
```

### 3.5 Client Room (Case File) CRUD

```typescript
// src/matrix/petitions.ts
import { getClient } from "./client";
import { EVT_CLIENT, EVT_PETITION, EVT_PETITION_BLOCKS, EVT_OP } from "./events";
import type { ImmigrationClient, Petition, Block } from "../models";

export async function createClientRoom(
  clientData: ImmigrationClient
): Promise<string> {
  const client = getClient();

  // Create the room
  const { room_id } = await client.createRoom({
    name: `client:${clientData.name || clientData.id}`,
    visibility: "private" as any,
    invite: [], // Admin bot will auto-join later
    initial_state: [
      {
        type: EVT_CLIENT,
        state_key: "",
        content: {
          name: clientData.name,
          country: clientData.country,
          yearsInUS: clientData.yearsInUS,
          entryDate: clientData.entryDate,
          entryMethod: clientData.entryMethod,
          apprehensionLocation: clientData.apprehensionLocation,
          apprehensionDate: clientData.apprehensionDate,
          criminalHistory: clientData.criminalHistory,
          communityTies: clientData.communityTies,
        },
      },
    ],
  });

  // Log creation
  await client.sendEvent(room_id, EVT_OP, {
    op: "CREATE", target: clientData.id, payload: null,
    frame: { entity: "client" },
  });

  return room_id;
}

export async function updateClient(
  roomId: string,
  data: Partial<ImmigrationClient>
): Promise<void> {
  const client = getClient();
  const existing = client.getRoom(roomId)
    ?.currentState.getStateEvents(EVT_CLIENT, "")
    ?.getContent() || {};

  await client.sendStateEvent(roomId, EVT_CLIENT, {
    ...existing, ...data,
  }, "");
}

export async function createPetition(
  roomId: string,
  petition: Petition,
  blocks: Block[]
): Promise<void> {
  const client = getClient();

  // Petition metadata as state event
  await client.sendStateEvent(roomId, EVT_PETITION, {
    stage: petition.stage,
    caseNumber: petition.caseNumber,
    district: petition.district,
    division: petition.division,
    facilityName: petition.facilityName,
    facilityCity: petition.facilityCity,
    facilityState: petition.facilityState,
    warden: petition.warden,
    fieldOfficeName: petition.fieldOfficeName,
    fieldOfficeDirector: petition.fieldOfficeDirector,
    att1Id: petition.att1Id,
    att2Id: petition.att2Id,
    filingDate: petition.filingDate,
    filingDay: petition.filingDay,
    filingMonthYear: petition.filingMonthYear,
    templateId: petition.templateId,
  }, petition.id);

  // Blocks as separate state event (can be large)
  await client.sendStateEvent(roomId, EVT_PETITION_BLOCKS, {
    blocks,
  }, petition.id);

  await client.sendEvent(roomId, EVT_OP, {
    op: "CREATE", target: petition.id, payload: null,
    frame: { entity: "petition" },
  });
}

export async function advanceStage(
  roomId: string,
  petitionId: string,
  newStage: string,
  priorStage: string
): Promise<void> {
  const client = getClient();
  const existing = client.getRoom(roomId)
    ?.currentState.getStateEvents(EVT_PETITION, petitionId)
    ?.getContent() || {};

  await client.sendStateEvent(roomId, EVT_PETITION, {
    ...existing, stage: newStage,
  }, petitionId);

  await client.sendEvent(roomId, EVT_OP, {
    op: "STAGE", target: petitionId,
    payload: newStage,
    frame: { prior: priorStage },
  });
}
```

### 3.6 React Hooks

```typescript
// src/matrix/hooks.ts
import { useEffect, useState } from "react";
import { getClient } from "./client";
import { MatrixEvent, Room } from "matrix-js-sdk";

// Subscribe to state events of a given type across a room
export function useStateEvents<T>(
  roomId: string | null,
  eventType: string
): Record<string, T> {
  const [data, setData] = useState<Record<string, T>>({});

  useEffect(() => {
    if (!roomId) return;
    const client = getClient();
    const room = client.getRoom(roomId);
    if (!room) return;

    // Initial load from current state
    const load = () => {
      const events = room.currentState.getStateEvents(eventType) || [];
      const result: Record<string, T> = {};
      for (const evt of events) {
        const key = evt.getStateKey();
        const content = evt.getContent();
        if (key && content && !content.deleted) {
          result[key] = { id: key, ...content } as T;
        }
      }
      setData(result);
    };
    load();

    // Listen for updates
    const handler = (event: MatrixEvent) => {
      if (event.getType() === eventType && event.getRoomId() === roomId) {
        load(); // Reload all state of this type
      }
    };
    client.on("Room.timeline" as any, handler);
    client.on("RoomState.events" as any, handler);

    return () => {
      client.removeListener("Room.timeline" as any, handler);
      client.removeListener("RoomState.events" as any, handler);
    };
  }, [roomId, eventType]);

  return data;
}

// Get user's role from !org room
export function useUserRole(): "admin" | "attorney" | null {
  const [role, setRole] = useState<"admin" | "attorney" | null>(null);

  useEffect(() => {
    // Check power levels in !org room
    // admin = power_level >= 50, attorney = member with power_level 0
    // This runs after sync completes
    const check = async () => {
      const client = getClient();
      const { getOrgRoom } = await import("./rooms");
      const orgRoomId = await getOrgRoom();
      const room = client.getRoom(orgRoomId);
      if (!room) { setRole("attorney"); return; }

      const pl = room.currentState.getStateEvents("m.room.power_levels", "");
      const myPl = pl?.getContent()?.users?.[client.getUserId()!] ?? 0;
      setRole(myPl >= 50 ? "admin" : "attorney");
    };
    check();
  }, []);

  return role;
}
```

### 3.7 Zustand Store

```typescript
// src/store.ts
import { create } from "zustand";
import type { Facility, Court, AttorneyProfile, NationalDefaults,
  ImmigrationClient, Petition } from "./models";

interface AppState {
  // Shared directory (from !org room)
  facilities: Record<string, Facility>;
  courts: Record<string, Court>;
  attProfiles: Record<string, AttorneyProfile>;
  national: NationalDefaults;

  // Clients + petitions (from !client:* rooms)
  clients: Record<string, ImmigrationClient & { roomId: string }>;
  petitions: Record<string, Petition & { roomId: string }>;

  // UI state
  role: "admin" | "attorney" | null;
  currentView: "board" | "clients" | "directory" | "editor" | "admin";
  selectedClientId: string | null;
  selectedPetitionId: string | null;

  // Actions
  setFacilities: (f: Record<string, Facility>) => void;
  setCourts: (c: Record<string, Court>) => void;
  setAttProfiles: (a: Record<string, AttorneyProfile>) => void;
  setNational: (n: NationalDefaults) => void;
  setClients: (c: Record<string, ImmigrationClient & { roomId: string }>) => void;
  setPetitions: (p: Record<string, Petition & { roomId: string }>) => void;
  // ... etc
}

export const useStore = create<AppState>((set) => ({
  facilities: {},
  courts: {},
  attProfiles: {},
  national: { iceDirector: "", iceDirectorTitle: "", dhsSecretary: "", attorneyGeneral: "" },
  clients: {},
  petitions: {},
  role: null,
  currentView: "board",
  selectedClientId: null,
  selectedPetitionId: null,
  setFacilities: (f) => set({ facilities: f }),
  setCourts: (c) => set({ courts: c }),
  setAttProfiles: (a) => set({ attProfiles: a }),
  setNational: (n) => set({ national: n }),
  setClients: (c) => set({ clients: c }),
  setPetitions: (p) => set({ petitions: p }),
}));
```

---

## Phase 4: Admin Bot (Optional but Recommended)

A lightweight bot that auto-joins admins to new client rooms.

```typescript
// scripts/admin-bot.ts
// Runs as a separate process, logged in as @admin-bot:aminoimmigration.com
// Listens for room invites and:
// 1. Auto-joins any room with com.amino.client state
// 2. Invites all admin users (from !org EVT_USER_ROLE state events)
// 3. Sets power levels so admins have PL 50 in client rooms

// This ensures admins can always see all clients without manual invitation
```

---

## Phase 5: Access Control Model

```
!org room:
  - Admin (PL 100): full control, manage users
  - Admin (PL 50): edit directory, manage templates
  - Attorney (PL 0): read directory, read templates

!templates room:
  - Admin (PL 50): create/edit templates
  - Attorney (PL 0): read templates

!client:{id} room:
  - Creating attorney: PL 50 (can edit their client)
  - Admins: PL 50 (can see and edit all clients)
  - Other attorneys: NOT INVITED (cannot see)

Visibility rules:
  - Kanban board: admin sees all petitions, attorney sees only theirs
  - Directory: everyone reads, admins edit
  - Client list: filtered by room membership (Matrix handles this)
```

---

## Phase 6: Implementation Order

Build in this order. Each step should be a working commit.

### Step 1: Scaffold
```bash
npm create vite@latest amino-habeas -- --template react-ts
cd amino-habeas
npm i matrix-js-sdk zustand
```

Set up `vite.config.ts` with proxy for Matrix API during dev:
```typescript
export default defineConfig({
  server: {
    proxy: {
      "/_matrix": "https://matrix.aminoimmigration.com",
    }
  }
});
```

### Step 2: Auth + Matrix Client
- `src/matrix/client.ts` — login flow, token persistence in sessionStorage
- `src/views/LoginView.tsx` — username/password form, calls `client.login("m.login.password", ...)`
- `src/App.tsx` — if authenticated, render main app; else render login

### Step 3: Room Discovery + Store Hydration
- `src/matrix/rooms.ts` — find !org, !templates, enumerate client rooms
- `src/matrix/hooks.ts` — `useStateEvents` hook
- `src/store.ts` — zustand store
- On app init after login: discover rooms → load all state → populate store

### Step 4: Directory View
- `src/views/DirectoryView.tsx` — tabs for facilities, courts, attorneys, national
- Wire CRUD to `src/matrix/directory.ts` → state events in !org
- `ProvenanceBadge` reads from Matrix event `sender` + `origin_server_ts`
- This is the first feature that round-trips through Matrix

### Step 5: Client + Petition Management
- `src/views/ClientsView.tsx` — list, create, edit
- Creating a client = creating a Matrix room with initial state
- `src/views/EditorView.tsx` — field groups with pickers for directory items
- Pickers pull from zustand store (hydrated from !org state events)
- Applying a facility/court = updating petition state event in client room

### Step 6: Paginated Document + Editor
- `src/components/PaginatedDoc.tsx` — letter-sized pages with pagination
- `src/components/EditableBlock.tsx` — contentEditable with variable interpolation
- Block edits → sendStateEvent for petition blocks + sendEvent for op log
- National defaults now flow from !org state into variable map

### Step 7: Kanban Board
- `src/views/BoardView.tsx` — three columns by stage
- Reads petition state from all client rooms
- Admin sees all; attorney sees only rooms they're members of
- Stage transitions = update petition state event + op log

### Step 8: Export
- `src/export/word.ts` — buildDocHTML + download as .doc
- `src/export/pdf.ts` — print window with @page CSS
- These NEVER touch Matrix. Built entirely from current state in zustand store.

### Step 9: Admin Panel
- `src/views/AdminView.tsx` — only visible when role === "admin"
- List users from !org EVT_USER_ROLE state events
- Create new user accounts via Synapse admin API
- Invite users to !org and !templates rooms
- Set power levels

### Step 10: Templates
- Template CRUD in !templates room
- "Save as template" from editor → admin review → promote to shared
- "New Petition" picker shows templates from !templates room

---

## Phase 7: Deployment

### Frontend
```bash
npm run build
# Deploy dist/ to app.aminoimmigration.com
# Options: Nginx static, Cloudflare Pages, Vercel, etc.
```

Nginx config:
```nginx
server {
    listen 443 ssl;
    server_name app.aminoimmigration.com;

    root /var/www/amino-habeas/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Matrix API proxy (optional, or use direct CORS)
    location /_matrix {
        proxy_pass https://matrix.aminoimmigration.com;
        proxy_set_header Host matrix.aminoimmigration.com;
    }
}
```

### Synapse CORS
In `homeserver.yaml`, if the frontend connects directly:
```yaml
# Not needed if proxying through same domain
# But if direct:
# Synapse handles CORS automatically for /_matrix endpoints
```

---

## Key Design Decisions

1. **State events for current data, timeline events for audit trail.** State events are the "latest value" — Matrix handles versioning. Timeline events (com.amino.op) are the append-only EO operator log.

2. **One room per client, not one room per petition.** A client may have multiple petitions. The room IS the case file. All petitions for a client live as state events in their room.

3. **Directory data in !org room, not per-client.** Facilities, courts, attorneys are shared across all users. They live as state events in the org room. When applied to a petition, the values are denormalized (copied) into the petition state event — so if the warden changes later, existing petitions retain the warden at time of filing.

4. **Exports are ephemeral.** Word and PDF documents are generated client-side from current state. They are never stored on Matrix. This protects sensitive PII from unnecessary server-side storage.

5. **Provenance for free.** Matrix state events carry `sender` (who sent it) and `origin_server_ts` (when). Previous versions of state events are preserved in room history. The `com.amino.op` timeline events add structured audit entries on top of that.

6. **Power levels for access control.** Admin = PL 50+ in !org and !templates. Attorney = PL 0 (read-only on shared rooms). Each attorney has PL 50 in their own client rooms. Admins get PL 50 in all client rooms (via admin bot).

---

## Environment Variables

```env
VITE_MATRIX_SERVER_URL=https://matrix.aminoimmigration.com
VITE_MATRIX_SERVER_NAME=aminoimmigration.com
VITE_ORG_ROOM_ALIAS=#org:aminoimmigration.com
VITE_TEMPLATES_ROOM_ALIAS=#templates:aminoimmigration.com
```

---

## Testing Checklist

- [ ] Login with admin credentials → see all views including Admin
- [ ] Login with attorney credentials → no Admin view, no directory edits
- [ ] Create facility in Directory → appears for all logged-in users
- [ ] Create client → Matrix room created, appears in client list
- [ ] Create petition → select facility/court from picker → fields auto-fill
- [ ] Edit body text → com.amino.op events appear in room timeline
- [ ] Advance stage → kanban card moves, stage badge updates
- [ ] Export Word → .doc downloads, opens in Word with correct formatting
- [ ] Export PDF → print dialog opens with letter-size pages
- [ ] Second attorney logs in → sees only their clients on board
- [ ] Admin logs in → sees all clients on board
- [ ] Edit facility warden → existing petitions keep old warden (denormalized)
- [ ] Provenance shows correct user + timestamp on directory items
