# Send

A private message-sharing application built around two complementary flows: **Give** and **Ask**.

**Live application:** [norum.se/send](https://norum.se/send)

## Overview

The **Give** flow is inspired by [Bitwarden Send](https://bitwarden.com/products/send/). It allows someone to write a private message, generate a shareable link, limit how many times the message can be read, and monitor access in real time.

The **Ask** flow expands on that concept by allowing someone to request information through an end-to-end encrypted link. Messages are encrypted entirely in the sender's browser using the Web Crypto API. The server stores only ciphertext, wrapped encryption keys, initialization vectors, and the recipient's public key.

## Features

### Give

Create a limited-read link containing a message.

- Configurable read limit between 1 and 100
- Shareable private links
- Live access and read statistics
- Remaining-read tracking
- Automatic removal after the final permitted read
- Manual deletion by the link creator
- Automatic expiration through the data-retention system

Give messages are stored as readable text on the server until they are deleted, consumed, replaced, or expire. Give does not use the end-to-end encryption provided by Ask.

### Ask

Create a link through which other people can send encrypted messages back to you.

- Browser-generated RSA-OAEP key pair
- Per-message AES-GCM encryption
- RSA-wrapped message keys
- Browser-side encryption and decryption
- Server-side storage of encrypted payloads only
- Live message updates using Server-Sent Events
- Optional one-time reading
- Manual link and message deletion
- Optional private-key persistence on the current device

By default, the private key remains only in the browser tab that created the link. The user can optionally save it in local storage if they want to return to the encrypted inbox on the same device.

## Encryption design

Ask uses hybrid encryption through the browser's Web Crypto API:

1. The recipient's browser generates an RSA-OAEP key pair.
2. The public key is sent to the server and associated with the Ask link.
3. The private key remains in the recipient's browser.
4. For each message, the sender's browser generates a unique AES-GCM key.
5. AES-GCM encrypts the message.
6. RSA-OAEP encrypts the AES key using the recipient's public key.
7. The server receives and stores only the encrypted message, wrapped AES key, initialization vector, and related metadata.
8. The recipient's browser uses the private RSA key to recover the AES key and decrypt the message.

```text
Recipient browser
   |
   | Generate RSA-OAEP key pair
   |
   | Public key
   v
Server
   |
   | Public key included with Ask link
   v
Sender browser
   |
   | Generate unique AES-GCM key
   | Encrypt message with AES-GCM
   | Wrap AES key with RSA-OAEP
   |
   | Ciphertext + wrapped key + IV
   v
Server
   |
   | Store encrypted payload
   v
Recipient browser
   |
   | Unwrap AES key
   | Decrypt message
   v
Plaintext
```

Cryptographic parameters:

- RSA-OAEP with a 2048-bit key and SHA-256
- AES-GCM with a 256-bit key
- A unique AES key for every message
- A random 12-byte initialization vector for every message

The project has not undergone an independent security audit and should not be used for highly sensitive or safety-critical information.

## Real-time updates

Send uses Server-Sent Events to update the interface without continuous polling.

- Ask inboxes receive notifications when encrypted messages arrive.
- Give link creators receive updated access, read, and remaining-read statistics.

SQLite remains the authoritative data store. The in-memory event emitters are used only to notify connected clients about changes.

## Data and privacy

Send stores application data in SQLite.

The application processes:

- Random session identifiers
- Link identifiers and settings
- Creation and access timestamps
- Read events
- Encrypted Ask payloads
- Plaintext Give messages

Sessions, links, messages, encryption metadata, and access events are retained for no more than 30 days. Data can be removed earlier when a link is deleted, replaced, or fully consumed.

Send uses one necessary HTTP-only session cookie. It does not use analytics, advertising, or third-party tracking cookies.

See the [privacy policy](https://norum.se/send/privacy) for more information.

## Technology

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- SQLite with `better-sqlite3`
- Web Crypto API
- Server-Sent Events
- Docker
- Node.js 20

## Project structure

```text
.
|-- application/
|   |-- app/
|   |   |-- api/          # Link, message, session, and event-stream routes
|   |   |-- ask/          # Encrypted Ask inbox creation
|   |   |-- give/         # Limited-read Give link creation
|   |   |-- g/[id]/       # Give message reader
|   |   |-- s/[id]/       # Encrypted message sender
|   |   `-- privacy/      # Privacy policy
|   |-- lib/
|   |   |-- e2ee.ts       # Browser-side encryption and decryption
|   |   |-- message-store.ts
|   |   |-- give-store.ts
|   |   |-- session-store.ts
|   |   `-- data-retention.ts
|   |-- Dockerfile
|   `-- package.json
`-- README.md
```

## Run locally

### Requirements

- Node.js 20 or newer
- npm

From the repository root:

```sh
cd application
npm install
npm run dev
```

Open [http://localhost:3000/send](http://localhost:3000/send).

The SQLite database is created automatically under `application/data/`.

### Production build

```sh
cd application
npm install
npm run build
npm run start
```

### Linting

```sh
cd application
npm run lint
```

## Run with Docker

Build the image:

```sh
docker build -t send:local ./application
```

Start the container:

```sh
docker run --rm \
  -p 3000:3000 \
  -e SESSION_COOKIE_SECURE=false \
  -v send-data:/app/data \
  send:local
```

Open [http://localhost:3000/send](http://localhost:3000/send).

The named Docker volume preserves the SQLite database between container replacements.

## Deployment

The application runs under the `/send` base path. In production, Caddy terminates HTTPS and forwards `/send` traffic to the application container on port 3000.

The wider portfolio deployment, reverse-proxy configuration, and Docker Compose stack are maintained in the Norum-web repository.
