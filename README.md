# n8n-nodes-msfrog

This is an n8n community node that exposes MSFrog API resources inside n8n workflows.

---

## Table of Contents

- [Operations](#operations)
- [Credentials](#credentials)
- [Setting up inside a Docker n8n instance](#setting-up-inside-a-docker-n8n-instance)
- [Sample Client Workflow](#sample-client-workflow)
- [Adding a new operation](#adding-a-new-operation)
- [Development](#development)
- [Compatibility](#compatibility)
- [Resources](#resources)

---

## Operations

| Resource | Operations |
|---|---|
| Company | Get Many |
| User | Get Self |
| Workflow | Get list of Workflow Entry Types, Get Many |
| Workflow Entry | Get list of existing Workflow Entries for the company, Create Workflow Entry, Update Workflow Entry, Fetch Step, Update Step, Complete Step, Un-complete Step, Create Comment, Update Comment, Delete Comment |
| Task | Create new Task, Update Task, Delete Task, Complete Task, Un-complete Task, Create Comment, Update Comment, Delete Comment |

---

## Credentials

In n8n, go to **Credentials → New** and search for **MSFrog API**.

Fill in:

| Field | Value |
|---|---|
| Base URL | The root URL of your MSFrog backend, e.g. `http://host.docker.internal:8000` (no trailing slash). Use `host.docker.internal` instead of `localhost` when n8n runs in Docker and the backend runs on your host machine. |
| Access Token | A Passport bearer token. Paste the raw token value only, without the `Bearer ` prefix. |

To obtain a token, call the backend `/login` endpoint and copy the `access_token` from the response.

Create this credential once and then select the same saved **MSFrog API** credential in every MSFrog node. When the token changes, update the credential once and all workflows will use the new token.

---

## Setting up inside a Docker n8n instance

These steps apply when you are running n8n in a Docker container and want to load this custom node package into it.

### Prerequisites

- Docker Desktop installed and running
- n8n container already set up
- This repository cloned to a local folder (for example `C:\projects\msfrog-n8n-community-node`)

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
4. Search for **MSFrog**.
5. The node should appear with workflow, workflow-entry, task, company, and user operations.

### Step 5 — Rebuilding after code changes

When you change the node source, run:

```bash
npm run build
```

Then restart the Docker container. n8n re-reads the mounted `dist/` folder on startup.

---

## Sample Client Workflow

This is the recommended first-pass workflow for the client email support scenario you described.

### Target behavior

1. End users email a dedicated support mailbox.
2. n8n reads the email body and attachments.
3. AI classifies the issue and decides whether it can self-resolve.
4. AI decides whether to create a new workflow entry or update an existing one.
5. n8n replies to the user when guidance or confirmation is needed.
6. Replies from the same email thread are linked back to the same workflow entry.

### Recommended node flow

```text
Email Trigger / IMAP Trigger
  -> Normalize Email Payload (Code)
  -> Extract Attachment Text (per attachment as needed)
  -> AI: Summarize + Classify + Decide
  -> Lookup Existing Email/Workflow Link
  -> Switch
    -> Self-resolve only
      -> AI: Draft reply
      -> Send Email
      -> Save thread outcome
    -> Create new workflow entry
      -> MSFrog: Get list of Workflow Entry Types
      -> MSFrog: Create Workflow Entry
      -> MSFrog: Create Comment
      -> Send Email
      -> Save email/workflow link
    -> Update existing workflow entry
      -> MSFrog: Get list of existing Workflow Entries for the company
      -> MSFrog: Update Workflow Entry or Update Step
      -> MSFrog: Create Comment
      -> Send Email
      -> Update email/workflow link
```

### Recommended persistence for email linking

You need one place to track which email thread belongs to which workflow entry. The cleanest approach is to keep a lightweight mapping store in n8n or in a small database table.

Store at least these fields:

| Field | Why it matters |
|---|---|
| `mailbox` | Supports multiple inbound addresses later |
| `messageId` | Unique ID for the inbound email |
| `threadId` or `conversationId` | Best key for matching follow-up replies |
| `inReplyTo` | Helps link replies when thread ID is missing |
| `references` | Extra fallback for threading |
| `fromEmail` | Useful for matching and audit |
| `subject` | Useful fallback context |
| `workflowEntryUuid` | Main link back to MSFrog |
| `workflowType` or `workflowUuid` | Tells you which workflow definition was used |
| `lastAction` | Records whether AI resolved, created, or updated |
| `lastOutboundMessageId` | Helps track replies sent by AI |

### Suggested first build

Start with a testable version before connecting a real mailbox.

1. Replace the email trigger with a **Manual Trigger**.
2. Add a **Set** node that mocks one inbound email with fields like `from`, `subject`, `text`, `messageId`, `threadId`, and `attachments`.
3. Add a **Code** node to normalize the email into a stable structure for later AI and MSFrog nodes.
4. Add an **AI** node that returns a strict JSON decision like:

```json
{
  "summary": "Printer issue reported by client",
  "canSelfResolve": false,
  "action": "create_workflow",
  "workflowType": "IT Support",
  "replyNeeded": true,
  "replyDraft": "We have logged your request and will update you shortly."
}
```

5. Add a **Switch** node on `action` with branches for `self_resolve`, `create_workflow`, and `update_workflow`.
6. Only after that works, swap the **Manual Trigger** for the real mailbox trigger.

### Attachment handling

For the first client demo, normalize all attachments into extracted text before the AI decision step.

Recommended approach:

1. Keep original binary attachments in the workflow.
2. Use attachment-type routing:
   - PDFs and text files: extract text directly
   - Images: OCR first, then pass extracted text to AI
   - Office files: convert/extract text before AI
   - Email attachments: parse nested email body and metadata if possible
3. Pass both the email body and the extracted attachment text to the AI node.

### Decision rules for create vs update

Use this order of checks:

1. If the inbound message is a reply and your mapping store already has a `workflowEntryUuid` for the thread, update the existing workflow entry.
2. If the AI explicitly identifies an existing ticket or reference number in the email, try to match that first.
3. If no link exists, create a new workflow entry.
4. Whenever AI is unsure, add a comment and reply asking for clarification instead of creating duplicates.

### Where to use MSFrog nodes

- **Get list of Workflow Entry Types**: load available workflow types before create decisions.
- **Get list of existing Workflow Entries for the company**: provide candidate entries when AI or rules try to match an existing case.
- **Create Workflow Entry**: create a new case.
- **Update Workflow Entry**: update header details when the case evolves.
- **Fetch Step / Update Step / Complete Step / Un-complete Step**: manage workflow progress when the email clearly maps to a step.
- **Create Comment / Update Comment / Delete Comment**: keep the email conversation visible on the workflow entry.
- **Task operations**: create or update follow-up tasks for assigned users when the email implies work needs to be done.

### Suggested first demo scope

For the first client-facing sample, keep the scope tight:

1. One mailbox.
2. One company.
3. One or two workflow entry types.
4. Create-comment-update flow only.
5. No automatic step completion until the linking logic is stable.

That gives you a demo that is believable without taking on the hardest edge cases too early.

---

## Adding a new operation

This section shows how to extend the node with a new resource or operation.

All node logic lives in two files:

- [`nodes/Msfrog/Msfrog.node.ts`](nodes/Msfrog/Msfrog.node.ts) — all UI properties and API call logic
- [`credentials/MsfrogApi.credentials.ts`](credentials/MsfrogApi.credentials.ts) — credential fields (only change this if the auth model changes)

### The three steps

Every new operation requires exactly three changes, all inside `Msfrog.node.ts`.

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
  displayName: 'Workflow UUID',
  name: 'workflowUuid',
  type: 'string',
  default: '',
  required: true,
  description: 'The workflow UUID to create an entry for',
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
  const workflowUuid = this.getNodeParameter('workflowUuid', itemIndex) as string;
  const name = this.getNodeParameter('name', itemIndex) as string;
  const stepAssignments = this.getNodeParameter('stepAssignments', itemIndex) as IDataObject[];

  const result = await requestApi<IDataObject>('POST', '/api/userworkflows', {
    workflow_uuid: workflowUuid,
    name,
    step_assignments: stepAssignments,
  });

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
type MsfrogResource = 'workflow' | 'company' | 'user' | 'workflowEntry' | 'task';
type MsfrogOperation = 'getTypes' | 'getAll' | 'getSelf' | 'create' | 'update';
```

---

### Versioning for breaking changes

Use node versions when a change could break existing workflows.

Current setup in [`nodes/Msfrog/Msfrog.node.ts`](nodes/Msfrog/Msfrog.node.ts):

- `version: [1, 2]`
- `defaultVersion: 1`
- version 2 is currently a placeholder guard, not a separate execution branch

This keeps the current implementation on v1 while reserving v2 for a future breaking revision.

When making a breaking change:

1. Keep v1 parameter names and execution path untouched.
2. Add or change fields for v2.
3. Add v2 execution logic behind the v2 branch.
4. Test one old workflow and one new workflow before release.

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
