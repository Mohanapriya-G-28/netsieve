# NetSieve Chat — Transport Layer Laboratory (TCP vs. UDP)

> *"Filter the flow, see how protocols go."*  
> **Computer Networks Course Project**: A full multi-user chat application designed to compare TCP and UDP transport behaviors, backed by embedded SQLite and native Node.js OS sockets.

## What the project demonstrates

NetSieve is a classroom chat simulator that makes transport-layer behavior visible. A student can switch between sample identities and conversations, send a message through a native TCP stream or UDP datagram path, then inspect sequence numbers, delivery acknowledgements, latency, packet drops, and application retries. SQLite keeps the conversation and message history between gateway restarts.

The identities are preloaded demo profiles; there is no account registration, password login, or access control. The browser connects to the gateway over WebSocket. The gateway then transmits through TCP and UDP sockets on the same host (UDP sender :9002 to receiver :9003). This is a LAN-ready demonstration app, but the native transport endpoints are not peer-to-peer sockets between separate student devices. UDP loss and delay are configurable simulations; TCP reliability is provided by the operating system.

The project also includes group conversations, message replies, emoji reactions, and a Network Inspector that explains the transport metrics while the demo runs.

---

## 1. System Architecture

```
+-------------------------------------------------------------------------------------------------+
|                                     NetSieve Chat Frontend                                      |
|                                     (React + Vite at :3000)                                     |
|                                                                                                 |
|   - Multi-User Identity (@alice, @bob, @carol)     - Direct & Group Conversations               |
|   - Message Replies & Emoji Reactions              - Slide-Out Network Inspector (RTT/Loss/ARQ) |
+------------------------------------------------+------------------------------------------------+
                                                 |
                               WebSocket (ws://<host>:8080)
                               [Control & Telemetry Channel]
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------+
|                                 NetSieve Central Gateway Server                                 |
|                                        (Node.js at :8080)                                       |
|                                                                                                 |
|   +--------------------------+   +-----------------------------+   +--------------------------+ |
|   |     Embedded SQLite      |   |      Native TCP Engine      |   |    Native UDP Engine     | |
|   |      (netsieve.db)       |   |      (`net.createServer`)   |   |   (`dgram.createSocket`) | |
|   |                          |   |                             |   |                          | |
|   | - Users & Presence       |   | - Port: 9001                |   | - Sender Port: 9002      | |
|   | - Conversations & Groups |   | - 4-Byte Length Framing     |   | - Receiver Port: 9003    | |
|   | - Messages & Reactions   |   | - MAX_FRAME_SIZE Protection |   | - App-Level ARQ Retries  | |
|   | - Persistent History     |   | - Byte-Stream Reliability   |   | - Deduplication Filter   | |
|   +--------------------------+   +-----------------------------+   +--------------------------+ |
+-------------------------------------------------------------------------------------------------+
```

---

## 2. Port Allocations & Network Segments

| Port | Protocol / Technology | Purpose | Segment Description |
| :--- | :--- | :--- | :--- |
| **3000** | HTTP / React (Vite) | Web App UI Delivery | Serves the web interface to desktop and mobile browsers. |
| **8080** | WebSocket (`ws://`) | Browser-to-Bridge Control | Pushes messages from browser to server and streams live telemetry back. |
| **9001** | Native OS TCP (`net`) | Real TCP Stream Engine | Runs 4-byte length-prefixed framing and stream-level acknowledgment. |
| **9002** | Native OS UDP (`dgram`)| Real UDP Sender Socket | Dispatches standalone datagrams with configurable loss and jitter. |
| **9003** | Native OS UDP (`dgram`)| Real UDP Receiver Socket | Receives datagrams, enforces deduplication, and emits UDP ACKs. |

---

## 3. How to Run the Project

### Prerequisites
- Node.js (v18+ recommended; project tested on v24.22.1)

### Quick Start (2 Terminals)

**Terminal 1 — Start Frontend:**
```powershell
npm run dev
```
Accessible at: **http://localhost:3000**

**Terminal 2 — Start Central Gateway Server:**
```powershell
npm run gateway
```
Listens on:
- WebSocket Bridge: `0.0.0.0:8080`
- Native TCP: `0.0.0.0:9001`
- Native UDP: `0.0.0.0:9002` / `0.0.0.0:9003`

### Standalone Automated Verification Tests
Run these in your terminal for automated verification proof during vivas:
- **Test TCP Framing, Concatenation, and DoS Protection:**
  ```powershell
  npm run test:tcp
  ```
- **Test UDP Datagrams, Loss Recovery, and Deduplication:**
  ```powershell
  npm run test:udp
  ```

---

## 4. Multi-Device LAN Setup (Classroom Demo)

To demonstrate multi-user chat across separate laptops, lab computers, or phones on the same Wi-Fi network:

1. **Find your host IP address**:
   In PowerShell, run `ipconfig`. Note your IPv4 Address (e.g., `192.168.1.50`).
2. **Start the servers**:
   Both Vite and the Gateway server are pre-configured to bind to `0.0.0.0` (all network interfaces).
3. **Connect from other devices**:
   - On Device B (phone or laptop on same Wi-Fi), open browser to: `http://192.168.1.50:3000`
   - Select a different user profile (`Bob Martin` or `Carol Davis`) in the sidebar.
   - Send messages in **Classroom Channel**: messages traverse native sockets on the server host and render in real time on both devices.

---

## 5. Course Demonstration Script (Viva Walkthrough)

### Step 1: The Browser Socket Constraint & Gateway Pattern (1 min)
- **Explanation**: *"Web browsers running in an operating system sandbox cannot open arbitrary TCP or UDP sockets (`AF_INET, SOCK_STREAM` or `AF_INET, SOCK_DGRAM`). NetSieve Chat solves this transparently: the browser communicates with our central server over a WebSocket control channel, and our server processes payloads through real native OS sockets using Node.js standard modules `net` and `dgram`."*

### Step 2: TCP Stream Semantics & Length-Prefixed Framing (2 mins)
- Open [http://localhost:3000](http://localhost:3000). Keep the mode on **TCP Stream**.
- Send `"Testing TCP framing"`. Point out the immediate green `ACK'd` status.
- **Key Theory**: Explain that TCP is a continuous byte stream with no message boundaries. Multiple messages can merge or fragment across socket reads. Show [server/tcpFramer.ts](file:///c:/Users/dhana%20lakshmi.G/Desktop/convera-chat-app-main/convera-chat-app-main/server/tcpFramer.ts): NetSieve encodes every message with a 4-byte Big-Endian length header (`writeUInt32BE`) and enforces a `MAX_FRAME_SIZE = 64KB` guard against buffer exhaustion.
- Run `npm run test:tcp` to demonstrate multi-frame concatenation de-chunking and partial read reassembly.

### Step 3: UDP Datagrams & Loss Recovery via Application-Level ARQ (2 mins)
- Switch mode to **UDP Datagram**.
- Open the **Network Inspector** drawer (top-right button).
- Set **Simulated Packet Loss** to `40%` and check **Application-Level ARQ**.
- Send `"Testing UDP ARQ"`. Point out the amber `Retry #1` status when a datagram drops, followed by recovery when the retransmission timeout fires.
- **Key Theory**: Emphasize that UDP itself provides zero reliability. The sequence tracking, timeouts, retries, and acknowledgments are implemented by our application layer.

### Step 4: Pure Unreliable UDP & Deduplication (2 mins)
- Uncheck **Application-Level ARQ** and send another message. When dropped, it displays soft red `Dropped` with 0 retries (mimicking VoIP/gaming packet loss).
- Run `npm run test:udp` to prove that the receiver's deduplication tracking prevents duplicate messages from rendering twice if an ACK is delayed.

---

## 6. Real vs. Simulated Behaviors

| Feature | Type | Implementation Reality |
| :--- | :--- | :--- |
| **TCP Sockets** | **REAL** | Traverses actual OS TCP loopback socket on port `9001` via `net.Socket`. |
| **TCP Framing** | **REAL** | 4-byte Big-Endian length encoding and buffer de-chunking. |
| **UDP Datagrams** | **REAL** | Traverses actual OS UDP socket on port `9002` ➔ `9003` via `dgram.Socket`. |
| **SQLite Storage** | **REAL** | Persistent embedded database (`netsieve.db`) via `better-sqlite3`. |
| **RTT (Latency)** | **REAL** | Calculated as `Date.now() - packet.timestamp` upon receiving ACK. |
| **Packet Loss & Jitter** | **SIMULATED** | Artificially introduced in the UDP engine to demonstrate recovery without requiring a degraded physical cable. |

---

## 7. Likely Instructor & Viva Questions

### Q1: Why did you use WebSockets if the project is about TCP and UDP?
> **Answer**: Browsers cannot directly open raw TCP (`SOCK_STREAM`) or UDP (`SOCK_DGRAM`) sockets due to sandbox security restrictions. If web pages could open raw sockets, they could port-scan local networks or launch DDoS attacks. The WebSocket acts as a browser-to-gateway interface; the gateway then executes the actual TCP and UDP transmissions on the host's operating system.

### Q2: Why does TCP require framing headers while UDP does not?
> **Answer**: TCP is a **byte-stream** protocol. It has no concept of individual message boundaries; multiple `write()` calls may coalesce into a single socket chunk, or a single message may arrive in fragments. UDP is **datagram-oriented**; each packet is transmitted atomically, preserving message boundaries at the transport layer.

### Q3: What is Head-of-Line (HoL) Blocking?
> **Answer**: Because TCP strictly guarantees in-order delivery, if packet #1 is delayed or dropped, subsequent packets (#2, #3) cannot be passed to the application layer until packet #1 is retransmitted and acknowledged. In UDP, datagrams are independent and can be consumed immediately regardless of whether earlier datagrams were lost.

### Q4: If UDP is connectionless and unreliable, how does NetSieve recover lost messages?
> **Answer**: Through an **Application-Level ARQ (Automatic Repeat reQuest)** layer. We assign sequence numbers (`seq`), set up retransmission timeout timers (`timeoutMs`), generate application-level ACK datagrams, and filter duplicate deliveries using a receiver deduplication set.
