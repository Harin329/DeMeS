# Decentralized Messaging Service (DeMeS)

DeMes is a decentralized messaging service with leadership selection to allow user-hosted chat servers. Instead of a centralized server to process chat messages, a peer-to-peer network of participants communicate via an elected host.

Developed by Harin Wu, Sean Goyel, Justin Chan.

## Table of contents
1. [Introduction](#introduction)
2. [Problem Statement](#problem-statement)
3. [Development](#development)
4. [Project Details](#project-description)
5. [Protocol](#protocol)
6. [Stretch Goals](#stretch-goals)

# Introduction

This project's aim is to implement a decentralized private chat messaging service and protocol that addresses new host selection upon the current host going offline. Instead of a centralized server to process chat messages, a peer-to-peer network of participants (clients) in a group chat communicate via an agreed-upon host (server) who propagates collective state back to the group.

The primary components of this project is designing the leadership selection and communication protocol, while the actual implementation of messaging clients/servers are just necessary to showcase the functionality. Therefore, we have defined some stretch goals in attempts to deploy a working finished product beyond designing a leadership selection procedure and protocol alone.

This solution needs to provide chat functionality between users through a selected host, and the network of participants need to have consensus on message ordering, host status, and leadership selection upon a host going offline defined in a formal protocol. In terms of actual implementation, this project includes a host/client application that implements the protocol, using a simple server, interface, and abstracted messaging framework.

# Problem Statement

There is rising concern regarding privacy, content moderation, and where messaging data is being stored. Centralized messaging platforms pose a threat to privacy. While products like telegram and signal are garnering more interest for their focus in end-to-end encryption, solutions like these ultimately still use centralized servers under private control.

This project provides an alternative solution that enables user-hosted chat servers for private group messages. Beyond basic messaging functionality, this solution aims to achieve similar traits of availability and persistence provided by centralized platforms, but implemented through a peer-to-peer network alone via a custom protocol, interface, and leadership selection process (and stretch goal of host state migration/replication).

# Development 

1. Install [Node.js](https://nodejs.org/en/download/)
2. Run `node client.js <MyPort> <PsuedoLeader>`

# Project Details

### Distributed Systems Problems
- Leadership Selection
    - There will be a host which is responsible for broadcasting messages to all the clients. In the case that the host goes down, another client will be made the host, and their state, if out of date, will be updated by other clients.
- Consensus
    - Achieve consensus across network on who is the host and what is the state of the chat session.
    - Client to host, has a new message been sent and received by others.
    - Host to clients, has a new message been received
- Trust and encryption
    - Encrypt/decrypt messages between users.
    - Trust participant identities through asymmetric encryption.
- Persistence (Stretch Goal)
    - When a disconnected user rejoins
    - Need to update their state to the current state 
    - Recovering chats after session goes offline

### Services
- Messaging service 
    - Messaging protocol
    - Host “Pub/Sub” message service to chat clients
    - Basic sending/receiving messages functionality
    - Leadership Selection built into protocol
- Fault tolerance
    - Updating new hosts beliefs 
    - Updating clients endpoint information
    - Accounting for messages sent to the previous host after it went down

### Interface

A large portion of this project consists of formalizing the protocol and interface, while the implementation itself plays a smaller role. This section describes general steps in core functionality in the project. Creating the formal documentation is outside the scope of the proposal, and will follow in the project implementation.

**Network (Private Chat) Initialization:**
- There is some user who wants to start the chat, client C1
- C1 has a list of users’ client addresses
- C1 sends an init message to the users to invite them to the chat
    - C1 will send the invite in intervals for some timeout 
        - Exponential back off
    - Clients need to respond within this time to join the chat
- The chat session is initialized at this point. Invited users are considered participants, but are inactive until they respond to the invite.

**Status of host**
- Host sends periodic pings (heartbeat) to all clients 
- Heartbeat is a list of users
- All messages sent are stored on the client in a map/list
    - Only gets cleared after a heartbeat
    - If a host swap happens, all messages in map/list are resent to the new host

**Leadership Selection**

This section consists of the focus of our project. The aim is to implement a form of weighted ranked voting between clients on initialization to decide on next hosts, and a majority request system to determine when the current host is offline and to migrate to a new host. This process is likely to be altered if the stretch goal of host migration is implemented.

- Host Candidate List. After network is initialized:
    - Each client will send a few pings to every other client to determine its average network delay to other participants.
    - Each client passes it’s ordered list of hosts by delay to the current host
    - The host will receive a list from every client and find the optimal next host list based on these ‘votes’
    - The host uses this list as it’s heartbeat ping.
- Leadership Election
    - If a client doesn’t receive a heartbeat in X duration, it sends a election request to the next host on the list.
    - All clients are listening for these requests at all times. If a client receives a majority of votes in X minutes, it becomes the new host and broadcasts to all clients
    - Clients keep voting until a new host is decided and starts broadcasting the host heartbeat.
        - Vote for candidate1 for X duration. If candidate 1 doesn’t achieve majority within X duration, it broadcasts its inelgibility. Vote for candidate2 for X duration …
        - Fallback scenario if no majority is reached

***Optimal Candidate Hosts***

The ordered list of host candidates decided after network initialization is based on the centrality of a client within the network. This is defined as the client with the least average network delay to every other client in the network.

Once the current host receives average network delays between every pair of clients, it computes the candidate list by using the Floyd-Warshall algorithm and calculating centrality for each client, taking in consideration asymmetric network delays (different delays for clients A -> B and B-> A).

Algorithm Pseudocode
```
	Recieve network delay “edges” from all clients

	Build a directed graph using edge weights

	Compute shortest paths between vertices (clients) using Floyd-Warshall algorithm, obtaining matrix of shortest paths between all pairs.

    Compute closeness centrality score for each server

    Return ordering by centrality score
```

Closeness centrality of a client i is defined as:
```
	closeness(i) = 1 / (sum of average network delay from i to all other clients)
	centrality(i) = 1 / closeness(i)
```

**Leadership Selection Process**

![Leadership Selection](docs/leadership-election.png)
		
**Basic Messaging**
- Client C2, sends a message to the host
- Host broadcasts the message to all the clients
    - We set a timeout and retry hyperparameter 
- The host keeps track of the messages that were not delivered to some clients
    - The clients likely disconnected

**Message Ordering Scenarios**

![message-ordering](docs/message-ordering.png)

**User rejoins after being inactive**
- Client keep tracks of users, can send a message to any of the clients / hosts to find the address of the current host
    - If the current host has the history of the missed message for that client it will receive them
    - Otherwise, this client will be readded to the messaging service with no messaging history

**Get History**
- Client requests history with some n param 
- The Host keeps track of what slice of the history the client has received 
- On the next get history call it will send the next slice of size n
- This will be used for pagination from the client

**Assumptions and Constraints**
- Chat service is designed to be used by small private groups of trusted users
    - Initial host knows list of other users client addresses beforehand
    - Clients manually communicate private key beforehand for encryption
- Scaling constraints
    - We tradeoff decentralizing with the burden of workload by the leader. In its current proposed state, this service will not scale to large networks as all messages propagate through a single host server.
    - *Overhead for all peers acknowledging messages and detecting offlines. Retransmission/redundancy can be used for better performance over simplicity.
- CAP theorem (ish)
    - Under the context of an ongoing chat session:
        - Chat sessions are mostly available: Dropped/delayed messages are fault tolerant, but messages cannot be handled during leadership migration.
        - Chat sessions are partition tolerant: When a host is disconnected, the network can continue with leadership selection.
        - Chat sessions are not consistent: Chat ordering is determined by the current host, meaning that the true timing order of messages is not preserved.
- Limitations:
    - *Maximum network size* (number of users): Defined by the hosts computing resources and how many users it can support while maintaining “real-time” messaging functionality. This requires testing at scale to determine set limits.
    - *Message size*: While the HTTP specification has no specific limits, we will limit text messages (the only supported format) to 2048 characters.
    - *Message frequency*: We won’t impose any frequency limits within private chats, as the assumed use case is between trusted users. Other popular chat services typically do not have limits too, but rather anti-spam measures (stretch goal).

**Failure Scenarios**
- *Network Partition*
    - Non-host
        - If non-host users are disconnected, the network simply continues - disconnected users are presumed to be offline by the host when they don’t acknowledge messages after X retries / X duration, and do not receive any more messages.
        - Non-host users will need to reconnect by notifying the host, by pinging other users for its address. It’s empty state will need to be updated by the host (stretch goal).
    - Host disconnection
        - Clients will deem the host offline when no heartbeat is received within X duration.
            - The leadership selection process will proceed with the pre-determined list of candidates
    - Hybrid failure
        - If a network partition occurs where the host and a majority of users are disconnected from a minority of users, the minority of users are disconnected from the chat session until a connection can be re-established. The chat session continues with the majority.
        - If a network partition occurs where the host and a minority of users are disconnected from a majority of users, the majority will perform leadership selection within itself and elect a new host.
            - The original host keeps track of responding clients. If it goes below the majority of users, the host is in a potentially invalidated state. If it receives a heartbeat from now on, it knows that a majority has elected a new host and it is no longer the host. 
            - *This process will be formalized further in the protocol documentation

**Validation, Development and Deployment Environments**

*Development environment*

Multiple users will be run on different localhost ports. A user consists of a node.js/express server listening for messages, and a frontend client that displays received messages and can send user input messages to other users endpoints. Network delays between clients, dropped messages, and host failures need to be mocked. Clients and servers will have unit test suites for functional testing using mocked request/response scenarios.

*Deployment environment*

Local host endpoints can be easily translated to deployed addresses on cloud providers. Client/server instances can be packed together and containerized with Docker to be deployed on different cloud virtual machines in different geographic locations. Faults can still be mimicked, but the system will also handle actual faults and network delays. Integration tests will be run with Selenium to automate chat session scenarios and validate functionality and fault tolerance.

- Functional unit test suite (localhost) (Jest or Mocha/chai + necessary mocking libraries)
    - Message functionality
        - Mocking delayed/dropped messages and host disconnections
        - Ordering of messages by mocking host received messages
    - Mocking host failover scenarios (leadership selection)
        - Host goes down, backup is selected
        - Host and next backup goes down, new host is selected
        - Host goes down, optimal backup is selected (artificial ordering)
        - Tie breaking
        - Fallback scenario
        - Complete equivalence classes and boundary edge case tests
- Integration tests (live deployed network) (Selenium)
    - Automated client input and end-to-end network testing (same as above, but live)
    - Performance, scalability and reliability system testing (wireshark, load testing, distributed tracing tools)
- Ad hoc functionality testing based on stretch goals

This deployment is still very much a simulation, although in theory actual users could use the cloud-deployed clients. However, this defeats the purpose of the self-hosted decentralized system. A public release of this service would require refactoring into a standalone self-hosted desktop/mobile/web application instead.

# Protocol

[Messaging Protocol](docs/protocol.md)

# Stretch Goals

- State migration
    - Currently, a new leader will be selected upon host failures, but we need to ensure consistent host state migration as well.
    - Have a fault tolerance procedure that allows us to have a backup of the host state.
    - When the new host is elected, the state of the previous host gets migrated.
- QoL functionality
    - User Interface improvements and aesthetics
    - Upgrade encryption to the Signal or OTR protocol (Asymmetric and symmetric encryption with perfect forward secrecy/signature)
    - Adding new users to the messaging platform 
    - Some client can add a new user by sending the host an add user message
    - Recovering user state after reconnecting
    - Recovering chats after every user goes offline
    - Persisted chats beyond chat session without centralized source of truth?
    - And other functionality commonly implemented in chat services
