import { createServer, createConnection } from 'node:net';

// Action Constants (Can Factor Out Later)
const CREATE_CHAT = "CREATE_CHAT";
const JOIN_CHAT = "JOIN_CHAT";
const START_LEADERSHIP_SELECTION = "START_LEADERSHIP_SELECTION";
const REQUEST_PING = "REQUEST_PING";
const REPLY_PING = "REPLY_PING";
const RETURN_VOTES = "RETURN_VOTES";
const CHAT_STARTED = "CHAT_STARTED";

// Leadership Selection Temp Variables
const PING_CHECKS = 3;
let participants = [];
let pingStartTime = {};
let pingEndTime = {};
let pingLatency = {};
let pseudoLeaderTally = {};
let pseudoLeaderCensus = {};


// Accept init ports from CLI
const args = process.argv.slice(2);
const myPort = args[0];
let audience = [];
let leader = args[1];
let chatStarted = false;

if (myPort === args[1]) {
    // Initialize group chat as the first member, becomes psuedo-leader
} else {
    // Join the group chat
    sendMessage(JOIN_CHAT, [leader]);
}

// Listen on a port for incoming messages
const server = createServer((socket) => {
    socket.on('data', (data) => {
        // Seperate data by first -
        const sender = data.toString().substring(0, data.toString().indexOf('-'));
        const message = data.toString().substring(data.toString().indexOf('-') + 1);
        if (message === JOIN_CHAT) {
            // Add new member to audience
            audience.push(sender);
            console.log(`New Member Joined: ${sender}`);
            console.log(`Audience: ${audience}`);
        } else if (message === REQUEST_PING) {
            console.log("Latency Request Recieved");
            sendMessage(REPLY_PING, [sender]);
        } else if (message === REPLY_PING) {
            console.log("Latency Reply Recieved");
            pingEndTime[sender] = pingEndTime[sender] === undefined ? [Date.now()] : [...pingEndTime[sender], Date.now()];
            verifyLatencyCheckComplete(participants);
        } else if (message.startsWith(START_LEADERSHIP_SELECTION)) {
            participants = message.substring(message.indexOf('-') + 1).split(',');
            // Send ping to all participants
            console.log(`Checking Latency of Participants...${participants.join(',')}`);
            checkLatency(participants);
        } else if (message.startsWith(RETURN_VOTES)) {
            console.log("Return Votes Recieved");
            const votes = message.substring(message.indexOf('-') + 1).split(',');
            tallyVotes(votes, sender);
        } else if (message.startsWith(CHAT_STARTED)) {
            leader = message.substring(message.indexOf('-') + 1);
            chatStarted = true;
            if (leader == myPort) {
                audience = participants;
                audience.filter((port) => port !== myPort);
            }
            console.log(`Chat has started with leader ${leader}! Message away!`);
        } else {
            console.log(`Incoming Message from ${sender}: ${message}`);
        }
    });
});

// Start Server
server.listen(myPort, () => {
    console.log(`Server listening on port ${myPort}`);
    if (leader === myPort) {
        console.log(`Other users can use this port to join the chat, type CREATE_CHAT to begin chatting!`);
    }
});

// Send new messages by watching text on CLI input
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (text) => {
    if (leader === myPort) {
        // Text Input Logic for Leader
        if (text.toString().trim() === CREATE_CHAT) {
            // As psuedo-leader, send a list of participants to all other participants, they will ping and find average network delay
            sendMessage(`${START_LEADERSHIP_SELECTION}-${audience.join(',') + "," + myPort}`, audience);
            participants = audience.concat([myPort]);
            checkLatency(participants);
        } else if (chatStarted) {
            sendMessage(text, audience);
        } else {
            console.log("Chat has not been started yet! Type CREATE_CHAT to begin chatting!")
        }
    } else {
        // Text Input Logic for Non-Leader
        sendMessage(text, audience);
    }
});

function sendMessage(message, audience) {
    let sendTo = audience;
    if (chatStarted && leader !== myPort) {
        sendTo = [leader];
    }

    for (const address of sendTo) {
        const client = createConnection({ port: address }, () => {
            client.write(`${myPort}-${message}`);
            client.end();
        });
    }
}

function checkLatency(participants) {
    for (const participant of participants) {
        if (participant !== myPort) {
            for (let i = 0; i < PING_CHECKS; i++) {
                pingStartTime[participant] = pingStartTime[participant] === undefined ? [Date.now()] : [...pingStartTime[participant], Date.now()];
                sendMessage(REQUEST_PING, [participant]);
            }
        }
    }
}

function verifyLatencyCheckComplete(participants) {
    for (const address of participants) {
        if ((pingEndTime[address] === undefined || pingEndTime[address].length < PING_CHECKS) && address !== myPort) {
            return;
        }
    }

    // All participants have completed latency checks, sort list and return votes to psuedo-leader
    const latencyMap = {}
    for (const address of participants) {
        if (address !== myPort) {
            for (let i = 0; i < PING_CHECKS; i++) {
                pingLatency[address] = pingLatency[address] === undefined ? [pingEndTime[address][i] - pingStartTime[address][i]] : [...pingLatency[address], pingEndTime[address][i] - pingStartTime[address][i]];
                latencyMap[address] = pingLatency[address].reduce((p1, p2) => p1 + p2) / PING_CHECKS;
            }
        }
    }

    console.log(latencyMap)
    const sortedLatency = Object.keys(latencyMap).sort((a, b) => latencyMap[a] - latencyMap[b]);
    console.log(sortedLatency);
    if (leader !== myPort) {
        sendMessage(`${RETURN_VOTES}-${sortedLatency}`, [leader]);
    } else {
        tallyVotes(sortedLatency, myPort);
    }


    
}

function tallyVotes(votes, sender) {
    console.log(`Tallying Votes from ${sender}`);
    if (pseudoLeaderCensus[sender] === undefined) {
        pseudoLeaderCensus[sender] = true;
        for (let i = 0; i < votes.length; i++) {
            pseudoLeaderTally[votes[i]] = pseudoLeaderTally[votes[i]] === undefined ? (votes.length - i) : pseudoLeaderTally[votes[i]] + (votes.length - i);
        }
    }

    console.log(pseudoLeaderTally);

    if (Object.keys(pseudoLeaderCensus).length === audience.length + 1) {
        // All votes have been tallied, find the elected leader
        leader = Object.keys(pseudoLeaderTally).sort((a, b) => pseudoLeaderTally[b] - pseudoLeaderTally[a])[0];
        console.log(`Leader has been elected: ${leader}`);
        sendMessage(`${CHAT_STARTED}-${leader}`, audience);
        chatStarted = true;
    }
}