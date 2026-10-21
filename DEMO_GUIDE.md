# NetSieve — Course Demonstration & Evaluation Guide

> **Scope note:** NetSieve uses preloaded simulator profiles, not authenticated accounts. Browser clients connect to a central WebSocket gateway; the gateway exercises TCP and UDP sockets on its own host. UDP impairment is simulated. See the README architecture notes before describing this as a multi-device network test.

**NetSieve**: *"Filter the flow, see how protocols go."*  
*A Computer Networks Course Project comparing TCP and UDP transport behaviors.*

---

## 1. System Architecture & Transparency

### Where TCP and UDP are used
```
+-------------------------------------------------------------+
|                     Browser Client (React UI)               |
|      Controls protocol modes, sliders, and views telemetry  |
+------------------------------+------------------------------+
                               |
                   WebSocket (ws://localhost:8080)
                   [Control & Telemetry Channel]
                               |
                               v
+-------------------------------------------------------------+
|                 NetSieve Gateway Server (Node.js)           |
|                                                             |
|   1. Native TCP Engine (`net.createServer`)                 |
|      - Port: 9001                                           |
|      - Framing: 4-Byte Big-Endian Length Prefix             |
|      - Transport: Connection-oriented stream (OS TCP Stack) |
|                                                             |
|   2. Native UDP Engine (`dgram.createSocket`)               |
|      - Sender Port: 9002 | Peer Receiver Port: 9003         |
|      - Framing: None (Datagram boundaries preserved natively)|
|      - Transport: Connectionless datagrams                  |
|      - App-Layer ARQ: Sequence numbers, Timeouts, ACKs      |
+-------------------------------------------------------------+
```

### Addressing the Browser Limitation
Browsers cannot directly instantiate raw OS TCP or UDP sockets due to sandbox security restrictions.
- **Honest explanation for evaluation**: The browser connects to the local NetSieve Gateway over a WebSocket channel to pass application payloads and configuration. The Gateway then routes the payload across **genuine, native OS-level sockets** (`net` for TCP and `dgram` for UDP) on the host machine.

---

## 2. Step-by-Step Demonstration Script for Evaluators

### Step 1: TCP Stream & Length-Prefixed Framing
1. Select **TCP Stream** mode in the UI.
2. Send a message (e.g., `"Hello TCP"`).
3. **What to point out**:
   - **Byte stream semantics**: Explain that TCP is a continuous stream without message boundaries. Show the evaluator [server/tcpFramer.ts](file:///c:/Users/dhana%20lakshmi.G/Desktop/convera-chat-app-main/convera-chat-app-main/server/tcpFramer.ts), demonstrating how NetSieve prefixes 4 bytes (`writeUInt32BE`) indicating payload length so the receiver knows exactly where one message ends and the next begins.
   - **Delivery & ACKs**: The packet badge shows `ACK'd` along with the measured Round Trip Time (RTT).
   - **No App Loss**: Explain why the packet loss slider is disabled in TCP mode—the OS kernel handles acknowledgment and retransmission transparently at Layer 4.

### Step 2: UDP Datagrams & Discrete Boundaries
1. Switch the selector to **UDP Datagram** mode.
2. Ensure **Simulated Packet Loss** is set to `0%`.
3. Send a message (e.g., `"Hello UDP"`).
4. **What to point out**:
   - **Datagram boundaries**: Show [server/udpEngine.ts](file:///c:/Users/dhana%20lakshmi.G/Desktop/convera-chat-app-main/convera-chat-app-main/server/udpEngine.ts). UDP sends atomic packets; no length header framing is required because UDP packet boundaries are preserved by the OS stack.

### Step 3: Simulating Packet Loss & App-Layer ARQ Retries
1. Move the **Simulated Packet Loss** slider to `40%` or `50%`.
2. Check the box **App-Level ARQ (ACK & Retries)**.
3. Send several messages in succession.
4. **What to observe**:
   - Dropped packets immediately show the amber badge `Retry #1` or `Retry #2`.
   - The **Telemetry Hub** increments the `Loss / Drops` and `Retries` counters.
   - Once retransmitted successfully, the status transitions to `ACK'd`.
   - **Key takeaway**: UDP itself does not do this—our application layer is executing an Automatic Repeat reQuest (ARQ) protocol with sequence tracking and timeout timers.

### Step 4: Pure Unreliable UDP (Simulating Packet Dropouts)
1. Keep the loss slider at `40%`.
2. **Uncheck** the **App-Level ARQ** box.
3. Send a message that encounters simulated loss.
4. **What to observe**:
   - The message permanently marks as `Packet Dropped`.
   - No retry timer fires; the datagram is lost forever.
   - **Real-world analogy**: Explain to the instructor that this mimics real-time video streaming (Zoom, VoIP, gaming) where outdated frames are discarded rather than retransmitted.

### Step 5: Jitter & Artificial Delay
1. Adjust the **Simulated Jitter/Delay** slider to `250ms`.
2. Send messages and watch the **Round Trip (RTT)** metric in the dashboard jump from ~15ms to ~260ms.

---

## 3. Real vs. Simulated Measurements

| Measurement | Nature | How it works |
| :--- | :--- | :--- |
| **TCP Socket Transmission** | **REAL** | Traverses actual OS TCP loopback socket on port `9001` via Node.js `net.Socket`. |
| **TCP Framing & De-chunking** | **REAL** | 4-byte Big-Endian header encoding and buffer slicing implemented in [server/tcpFramer.ts](file:///c:/Users/dhana%20lakshmi.G/Desktop/convera-chat-app-main/convera-chat-app-main/server/tcpFramer.ts). |
| **UDP Datagram Dispatch** | **REAL** | Traverses actual OS UDP socket on port `9002` ➔ `9003` via Node.js `dgram`. |
| **RTT (Round Trip Time)** | **REAL** | Calculated dynamically as `Date.now() - packet.timestamp` upon receiving an ACK. |
| **Packet Loss & Jitter** | **SIMULATED** | Artificially introduced in the UDP engine to demonstrate recovery mechanisms without needing a physically degraded link. |

---

## 4. Likely Instructor / Viva Questions & Answers

### Q1: Why can't browsers just open raw TCP or UDP sockets directly?
> **Answer**: For security. If web pages could open arbitrary TCP/UDP sockets, a malicious website could perform port scanning on the user's private local network (LAN), send spam via SMTP (port 25), or launch DDoS attacks using raw UDP packets. Web standards restrict browsers to high-level protocols (HTTP, WebSockets, WebRTC). Our application uses a WebSocket-to-Socket gateway to run genuine transport sockets safely on the host machine.

### Q2: Why does TCP need framing, while UDP does not?
> **Answer**: TCP is a **byte-stream** protocol. It views data as an unbroken sequence of bytes and may coalesce multiple `write()` calls into a single packet (Nagle's algorithm) or split a large payload across segments. UDP is **datagram-oriented**; each `sendto()` generates one distinct datagram whose boundaries are preserved by the IP layer.

### Q3: What is Head-of-Line (HoL) Blocking in TCP?
> **Answer**: In TCP, because in-order delivery is strictly guaranteed, if packet #1 is delayed or dropped, packets #2 and #3 cannot be delivered to the application layer until packet #1 is retransmitted and acknowledged. In UDP, datagrams are independent, so packet #2 can be processed even if packet #1 is lost.

### Q4: If UDP is unreliable, how did you make it reliable in NetSieve?
> **Answer**: By implementing application-layer ARQ (Automatic Repeat reQuest). We attached sequence numbers (`seq`), a receiver ACK mechanism, and a sender timeout timer (`RTO`). If an ACK is not received within the timeout window, the sender retransmits the datagram up to `maxRetries` times.

---

## 5. How to Run for the Demo
1. **Start the Frontend**:
   ```powershell
   npm run dev
   ```
   (Opens at `http://localhost:3000`)
2. **Start the NetSieve Gateway Server**:
   ```powershell
   npx tsx server/gateway.ts
   ```
   (Listens on WS port `8080`, TCP port `9001`, and UDP ports `9002`/`9003`)
3. **Run Unit Verification Tests (Optional, for viva proof)**:
   - TCP Framing test: `npx tsx server/testTcp.ts`
   - UDP Engine test: `npx tsx server/testUdp.ts`
