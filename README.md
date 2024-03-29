# Decentralized Messaging Service (DeMeS)

DeMes is a decentralized messaging service with leadership selection to allow user-hosted chat servers. Instead of a centralized server to process chat messages, a peer-to-peer network of participants communicate via an elected host.

Developed by Harin Wu, Sean Goyel, Justin Chan.

![logo](docs/logo.png)

## Table of contents
1. [Introduction](#introduction)
2. [Problem Statement](#problem-statement)
3. [Development](#development)
4. [Project Details](#project-description)
5. [Protocol](#protocol)
6. [Stretch Goals](#stretch-goals)
7. [Attributions](#attributions)

# Introduction

This project's aim is to implement a decentralized private chat messaging service and protocol that addresses new host selection upon the current host going offline. Instead of a centralized server to process chat messages, a peer-to-peer network of participants (clients) in a group chat communicate via an agreed-upon host (server) who propagates collective state back to the group.

The primary components of this project is designing the leadership selection and communication protocol, while the actual implementation of messaging clients/servers are just necessary to showcase the functionality. Therefore, we have defined some stretch goals in attempts to deploy a working finished product beyond designing a leadership selection procedure and protocol alone.

This solution needs to provide chat functionality between users through a selected host, and the network of participants need to have consensus on message ordering, host status, and leadership selection upon a host going offline defined in a formal protocol. In terms of actual implementation, this project includes a host/client application that implements the protocol, using a simple server, interface, and abstracted messaging framework.

# Problem Statement

There is rising concern regarding privacy, content moderation, and where messaging data is being stored. Centralized messaging platforms pose a threat to privacy. While products like telegram and signal are garnering more interest for their focus in end-to-end encryption, solutions like these ultimately still use centralized servers under private control.

This project provides an alternative solution that enables user-hosted chat servers for private group messages. Beyond basic messaging functionality, this solution aims to achieve similar traits of availability and persistence provided by centralized platforms, but implemented through a peer-to-peer network alone via a custom protocol, interface, and leadership selection process (and stretch goal of host state migration/replication).

# Development 

1. Install [Node.js](https://nodejs.org/en/download/) (V.18. LTS recommended)
2. `cd REPOSITORY_NAME`
3. `npm install`
4. In `package.json`, change the scripts depending on your OS. This uses specific commands to inject port variables through cli input into each instance.
    - Windows:
    ```
    "scripts": {
        "watch:build": "webpack -w",
        "watch:server": "nodemon dist/server.js",
        "dev": "set /p PORT=Enter port number: && set /p LEADER=Enter pseudo leader port number: && npm-run-all --parallel watch:*",
        "start": "set /p PORT=Enter port number: && set /p LEADER=Enter pseudo leader port number: && node dist/server.js",
        "postinstall": "webpack",
        "test": "webpack && jest --coverage --forceExit",
        "test:watch": "webpack && jest --watch"
    },
    ```
    - Unix (macOS/Linux)
    ```
    "scripts": {
        "watch:build": "webpack -w",
        "watch:server": "nodemon dist/server.js",
        "dev": "read -p 'Enter port number: ' PORTI && export PORT=$PORTI && read -p 'Enter pseudo leader port number: ' LEADERI && export LEADER=$LEADERI && npm-run-all --parallel watch:*",
        "start": "read -p 'Enter port number: ' PORTI && export PORT=$PORTI && read -p 'Enter pseudo leader port number: ' LEADERI && export LEADER=$LEADERI && node dist/server.js",
        "postinstall": "webpack",
        "test": "webpack && jest --coverage --forceExit",
        "test:watch": "webpack && jest --watch"
    },
    ```
5. Run `npm run dev` to start a client/server. The CLI will prompt you for a `PORT` and `PSEUDO LEADER PORT`. `PORT` is the port this instance will be running on, and `PSEUDO LEADER PORT` is the port of the pseudo leader when a chat hasn't started yet.

Run `npm run test` to run the Jest test suite. You don't need a server running, the tests will spawn them itself.

`npm start` is used for production mode to minify and compress files for deployment.

***Example Local Workflow***

1. Open up three terminals at the project root directory.
2. Run `npm run dev` on one of them. Input `3000` and `3000`. This sets port 3000 as the pseudo leader before leadership selection is performed. Navigate to `http://localhost:3000` to see the chat UI. You can see other users when they join this pseudo state.
3. Run `npm run dev` on another terminal. Input `3001` and `3000`. We assume users know the initial address of the pseudo leader. Again, navigate to `http://localhost:3001`. At this point, you'll see that the servers have messaged each other in the CLI logs.
4. Run `npm run dev` on the final terminal. Input `3002` and `3000`. Again, navigate to `http://localhost:3001`.
5. We can start the chat with these three users now. In `http://localhost:3000`, since port 3000 is the pseudo leader, it has the ability to "start" the chat. Press the button in the sidebar. This initiates the leadership selection, where each server pings each other for network delays and returns latency maps to the pseudo leader. The pseudo leader then computes the centrality of each server, and produces a ordered list of preferred hosts. The leadership status is then migrated to the best host. If the host has changes, you'll notice in the UI that a different port has slightly different sidebar text: "Chat has started" vs "Leader has started chat".

![demo-screenshot](/docs/demo.png)

At this point, the chat is live and you can send messages to each other in the UI. The chat is capable of surviving leader failures, and will automatically migrate to a new leader. New or failed users are also able to rejoin the chat by running `npm run dev` and inputing `NEW_PORT` and `EXISTING_PORT`. This will cause a new leadership election process to be run, as network latency has likely changed.


***Implementation Details***

Since implementation details of the actual messaging functionality is not of primary concern, we propose to simplify the process by remaining at a high level of abstraction. We will use simple Express Node.js servers with bare-bone user interfaces that will act as individual participants, communicating with JSON http requests/responses whose contents (messages) follow the defined protocol. These applications can be run on a single machine on different ports, with mocked network failures, offline instances, and message dropping to enable local testing of the framework, or be deployed individually at scale on cloud providers. In addition, chats will not be persisted to disk, and all state will only be held in memory, meaning chat history is lost upon a messaging network being abandoned. This may actually be a desired feature, or perhaps be changed if QoL stretch goals are met that require storage, persistence, and/or replication.

Each Frontend/Server acts as a user in the chat network. The server has a `serverMessage` endpoint exposed for other servers to message, and a `clientMessage` endpoint to process user input from the client. The server follows a basic MVC pattern, serving the react frontend statically, and routing requests to the `messageController`'s methods. The `messageController` is responsible for again routing requests based on message type, and performing and transformations/logic needed. It then passes messages to the `messageModel`, which handles making further requests to other servers and the core messaging logic. This part is where the project deviates from traditional architecture. The "Model" in our chat network acts as a store of the messages sent between users. However, no messages are persisted to any database, and instead are just send to other users in the decentralized network.

![diagram](/docs/diagram.png.png)

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

### Validation, Development and Deployment Environments

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

[Interface and Messaging Protocol](docs/protocol.md)

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

# Attributions

- This project utilized a Typescript-React-Express boilerplate adapted from [barebones-react-typescript-express](https://github.com/covalence-io/barebones-react-typescript-express).

