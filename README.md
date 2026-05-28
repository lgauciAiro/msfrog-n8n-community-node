# n8n-nodes-wiso-frog

This is an n8n community node that exposes Wiso API resources inside n8n workflows.

---

## Table of Contents

- [Operations](#operations)
- [Credentials](#credentials)
- [Setting up inside a Docker n8n instance](#setting-up-inside-a-docker-n8n-instance)
- [Adding a new operation](#adding-a-new-operation)
- [Development](#development)
- [Compatibility](#compatibility)
- [Resources](#resources)

---

## Operations

| Resource | Operation | Description |
|---|---|---|
| Company | Get Many | Returns all companies the authenticated user has access to |
| User | Get Self | Returns the profile of the currently authenticated user |
| Workflow | Get Many | Returns all workflows, optionally filtered by company UUID |

---

## Credentials

In n8n, go to **Credentials → New** and search for **Wiso Frog API**.

Fill in:

| Field | Value |
|---|---|
| Base URL | The root URL of your Wiso backend, e.g. `http://host.docker.internal:8000` (no trailing slash). Use `host.docker.internal` instead of `localhost` when n8n runs in Docker and the backend runs on your host machine. |
| Access Token | A Passport bearer token. Paste the raw token value only, without the `Bearer ` prefix. |

To obtain a token, call the backend `/login` endpoint and copy the `access_token` from the response.

---

## Setting up inside a Docker n8n instance

These steps apply when you are running n8n in a Docker container and want to load this custom node package into it.

### Prerequisites

- Docker Desktop installed and running
- n8n container already set up
- This repository cloned to `C:\projects\wiso-n8n-community-node`

### Step 1 — Build the package

Open a terminal inside the project folder and run:

```bash
npm install
npm run build
```

This compiles the TypeScript source into `dist/`. The Docker container will read from this folder.

### Step 2 — Stop and remove the existing n8n container

In Docker Desktop:
1. Find the n8n container in the **Containers** list.
2. Click **Stop**.
3. Click **Delete** (the container only — not the volume).

> **Important:** Do not delete the `n8n_data` volume. That volume holds your saved workflows, credentials, and settings.

### Step 3 — Recreate the container with the custom node mount

In Docker Desktop, go to **Images**, find the n8n image, and click **Run**.

In the run settings, add the following:

**Environment variables:**

| Variable | Value |
|---|---|
| `N8N_CUSTOM_EXTENSIONS` | `/custom` |

**Volume mounts:**

| Host path | Container path |
|---|---|
| `C:\projects\wiso-n8n-community-node\dist` | `/custom` |
| `n8n_data` | `/home/node/.n8n` |

> The `n8n_data` entry re-attaches the named volume that holds your existing data.

**Ports:**

| Host port | Container port |
|---|---|
| `5678` | `5678` |

Click **Run**.

### Step 4 — Verify the node is loaded

1. Open n8n at `http://localhost:5678`.
2. Open or create a workflow.
3. Click the node picker (`+` button).
4. Search for **Wiso Frog**.
5. The node should appear with the three available operations.

### Step 5 — Rebuilding after code changes

When you change the node source, run:

```bash
npm run build
```

Then restart the Docker container. n8n re-reads the mounted `dist/` folder on startup.

---

## Adding a new operation

This section shows how to extend the node with a new resource or operation.

All node logic lives in two files:

- [`nodes/WisoFrog/WisoFrog.node.ts`](nodes/WisoFrog/WisoFrog.node.ts) — all UI properties and API call logic
- [`credentials/WisoFrogApi.credentials.ts`](credentials/WisoFrogApi.credentials.ts) — credential fields (only change this if the auth model changes)

### The three steps

Every new operation requires exactly three changes, all inside `WisoFrog.node.ts`.

---

#### Step 1 — Add the resource (if it is new)

Find the `resource` property in the `properties` array and add a new option:

```typescript
{
  displayName: 'Resource',
  name: 'resource',
  type: 'options',
  noDataExpression: true,
  default: 'company',
  options: [
    { name: 'Company', value: 'company' },
    { name: 'User', value: 'user' },
    { name: 'Workflow', value: 'workflow' },
    { name: 'Workflow Entry', value: 'workflowEntry' }, // ← add this
  ],
},
```

Skip this step if the resource already exists.

---

#### Step 2 — Add the operation and input fields

Add a new `operation` property block for your resource, and any input fields it needs.

```typescript
// Operation selector — only shown when resource = workflowEntry
{
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  default: 'create',
  displayOptions: {
    show: {
      resource: ['workflowEntry'],
    },
  },
  options: [
    {
      name: 'Create',
      value: 'create',
      action: 'Create a workflow entry',
      description: 'Create a new entry for a workflow',
    },
  ],
},

// Input field — only shown when resource = workflowEntry, operation = create
{
  displayName: 'Workflow ID',
  name: 'workflowId',
  type: 'string',
  default: '',
  required: true,
  description: 'The ID of the workflow to create an entry for',
  displayOptions: {
    show: {
      resource: ['workflowEntry'],
      operation: ['create'],
    },
  },
},
```

---

#### Step 3 — Add the API call in `execute()`

Inside the `for` loop in `execute()`, add a new `if` block before the final `throw`:

```typescript
if (resource === 'workflowEntry' && operation === 'create') {
  const workflowId = this.getNodeParameter('workflowId', itemIndex) as string;

  const options: IHttpRequestOptions = {
    method: 'POST',
    url: `${normalizedBaseUrl}/api/workflowentries`,
    json: true,
    body: {
      workflow_id: workflowId,
    },
  };

  const result = await this.helpers.httpRequestWithAuthentication.call(
    this,
    'wisoFrogApi',
    options,
  ) as IDataObject;

  returnData.push({ json: result, pairedItem: { item: itemIndex } });
  continue;
}
```

---

#### Step 4 — Build and restart

```bash
npm run build
```

Restart the Docker container. The new operation will appear in the node picker immediately after n8n reloads.

---

### Type hints

Add your new resource/operation values to the union types at the top of the file so TypeScript can validate them:

```typescript
type WisoResource = 'workflow' | 'company' | 'user' | 'workflowEntry';
type WisoOperation = 'getAll' | 'getSelf' | 'create';
```

---

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch for changes (TypeScript compiler in watch mode)
npm run dev

# Lint
npm run lint
```

---

## Compatibility

- n8n: 2.x and later
- Node.js: 22.x

---

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [n8n node-cli](https://www.npmjs.com/package/@n8n/node-cli)
- [n8n-workflow package](https://www.npmjs.com/package/n8n-workflow)
