import { debug } from 'node:console';
import { createServer, createConnection } from 'node:net';


// USE FUNCTION `print(string)` TO DEBUG
const PRINT_DEBUG = true;


// Action Constants (Can Factor Out Later)
const CREATE_CHAT = "CREATE_CHAT";
const JOIN_CHAT = "JOIN_CHAT";
const START_LEADERSHIP_SELECTION = "START_LEADERSHIP_SELECTION";
const REQUEST_PING = "REQUEST_PING";
const REPLY_PING = "REPLY_PING";
const RETURN_VOTES = "RETURN_VOTES";
const CHAT_STARTED = "CHAT_STARTED";
const MESSAGE_ACK = "MESSAGE_ACK";
const LEADER_PING = "LEADER_PING";


// Used for sequence numbers
let SEQUENCE_STRING_START = "@#!$&(*#!$[";
let SEQUENCE_STRING_END = "]@#!$&(*#!$";

let messageSeqNum = 0
let waitingForMessageSeqNum = -1

let lastMessageFromSender = {}

// Leadership Selection Temp Variables
const PING_CHECKS = 3;
let participants = [];
let pingStartTime = {};
let pingEndTime = {};
let pingLatency = {};
let pseudoLeaderTally = {};
let pseudoLeaderCensus = {};
let latencyMap = {};

// Timers
let leadershipPingTimer = null;
let awaitLeaderPingTimer = null;
let leaderlife = -3;


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
            if (chatStarted) {
                audience.push(myPort);
                const audienceWOLeader = audience;
                const audienceWOHost = audience;
                leader = myPort;
                sendMessage(`${START_LEADERSHIP_SELECTION}-${audienceWOLeader.join(',')}`, audienceWOHost);
                chatStarted = false;
                resetTempVariables();
                participants = audienceWOLeader;
                audience = audienceWOHost;
                checkLatency(participants);
                clearInterval(awaitLeaderPingTimer);
            }
        } else if (message === REQUEST_PING) {
            console.log("Latency Request Recieved");
            sendMessage(REPLY_PING, [sender]);
        } else if (message === REPLY_PING) {
            console.log("Latency Reply Recieved");
            pingEndTime[sender] = pingEndTime[sender] === undefined ? [Date.now()] : [...pingEndTime[sender], Date.now()];
            verifyLatencyCheckComplete(participants);
        } else if (message.startsWith(LEADER_PING)) {
            handleLeaderPing(message);
        } else if (message.startsWith(START_LEADERSHIP_SELECTION)) {
            // Lose leadership once receiving this message
            clearInterval(leadershipPingTimer);
            resetTempVariables();
            leader = sender
            chatStarted = false;
            participants = message.substring(message.indexOf('-') + 1).split(',');
            // Send ping to all participants
            console.log(`Checking Latency of Participants...${participants.join(',')}`);
            checkLatency(participants);
        } else if (message.startsWith(RETURN_VOTES)) {
            console.log("Return Votes Received");
            const votes = message.substring(message.indexOf('-') + 1).split(',');
            tallyVotes(votes, sender);
        } else if (message.startsWith(CHAT_STARTED)) {
            leaderlife = -3;
            clearInterval(leadershipPingTimer);
            clearInterval(awaitLeaderPingTimer);
            const msg = message.split('-');
            leader = msg[1];
            chatStarted = true;
            if (leader == myPort) {
                audience = msg[2].split(',');
                participants = audience;
                audience = audience.filter((port) => port !== myPort);
                leadershipPing();
            } else {
                awaitLeaderPing();
            }
            console.log(`Chat has started with leader ${leader}! Message away!`);
        } else if(message.startsWith(MESSAGE_ACK)) {
            handleACK(message);

        } else {
            let messageText = getMessageFromTextWithSequenceNum(message)

            if (leader === myPort && sender !== leader) {
                handleAckRequest(message, sender)
            }

            console.log(`Incoming Message from ${sender}: ${messageText}`);
        }
    });
});

// Start Server
server.listen(myPort, () => {
    if (myPort == undefined) {
        console.log(`Error: No port number. Please enter a port number as the first argument.`)
        process.exit(0)
    }
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
            sendMessage(addSequenceNumToMessage(text, messageSeqNum), audience, [leader]);
            messageSeqNum++
        } else {
            console.log("Chat has not been started yet! Type CREATE_CHAT to begin chatting!")
        }
    } else {
        // Text Input Logic for Non-Leader
        if (messageSeqNum == waitingForMessageSeqNum) {
            console.log("Waiting for previous message to be ACKed by leader")
        } else {
            waitingForMessageSeqNum = messageSeqNum;
            sendMessage(addSequenceNumToMessage(text, messageSeqNum), [leader]);
        }

    }
});

// Handle Functions
function handleLeaderPing(message) {
    const audienceList = message.substring(message.indexOf('-') + 1).split(',');
    audience = audienceList;
    leaderlife = -3;
    // print(`Leader Ping Recieved: ${audienceList}`);
}

/*
Params:
    message: The message to send
    audience: The list of ports to send the message to
    except: The list of ports to not send the message to
    senderPort: The port that the message is coming from
*/
function sendMessage(message, audience, except, senderPort) {
    if (except === undefined) {
        except = []
    }
    if (senderPort === undefined) {
        senderPort = myPort
    }
    let sendTo = audience;
    if (chatStarted && leader !== myPort) {
        sendTo = [leader];
    }
    
    for (const address of sendTo) {
        if (except.indexOf(address) !== -1) continue;
        const client = createConnection({ port: address }, () => {
            client.write(`${senderPort}-${message}`);
            client.end();
        });

        client.on('error', (err) => {
            audience = audience.filter((port) => port !== address);
            console.log(`Error: ${err}`);
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

    audience = audience.filter((port) => port !== myPort);
    console.log(pseudoLeaderTally);

    if (Object.keys(pseudoLeaderCensus).length === audience.length + 1) {
        // All votes have been tallied, find the elected leader
        pseudoLeaderCensus = {};
        const tallyOrder = Object.keys(pseudoLeaderTally).sort((a, b) => pseudoLeaderTally[b] - pseudoLeaderTally[a]);
        leader = tallyOrder[0];
        participants = tallyOrder;
        console.log(`Leader has been elected: ${leader}`);
        sendMessage(`${CHAT_STARTED}-${leader}-${tallyOrder.join(',')}`, tallyOrder);
    }
}

function leadershipPing() {
    leadershipPingTimer = setInterval(() => {
        sendMessage(`${LEADER_PING}-${participants}`, audience);
    }
    , 3000);
}

function awaitLeaderPing() {
    awaitLeaderPingTimer = setInterval(() => {
        leaderlife++;
        if (leaderlife >= 1) {
            if (myPort === audience[leaderlife]) {
                console.log("Leader has died, starting leadership election");
                const audienceWOLeader = audience.filter((port) => port !== leader);
                const audienceWOHost = audienceWOLeader.filter((port) => port !== myPort);
                leader = myPort;
                sendMessage(`${START_LEADERSHIP_SELECTION}-${audienceWOLeader.join(',')}`, audienceWOHost);
                chatStarted = false;
                resetTempVariables();
                participants = audienceWOLeader;
                audience = audienceWOHost;
                checkLatency(participants);
                clearInterval(awaitLeaderPingTimer);
            }
        }
    }, 3000);
}

function resetTempVariables() {
    pingStartTime = {};
    pingEndTime = {};
    pingLatency = {};
    pseudoLeaderTally = {};
    pseudoLeaderCensus = {};
    latencyMap = {};
}

function handleACK(message) {
    let s = message.indexOf(MESSAGE_ACK) + (MESSAGE_ACK.length)

    let ackForSeqNum = Number(message.substring(s,message.length))

    if (waitingForMessageSeqNum == ackForSeqNum && waitingForMessageSeqNum == messageSeqNum) {
        messageSeqNum++;
    }
}

function addSequenceNumToMessage(message, n) {

    message = SEQUENCE_STRING_START+n+SEQUENCE_STRING_END+message
    return message 

}

function getSequenceNumFromMessage(message) {
    if (message.indexOf(SEQUENCE_STRING_START) == -1) {
        return -1
    }
    let s = message.indexOf(SEQUENCE_STRING_START) + (SEQUENCE_STRING_START.length)
    let e = message.indexOf(SEQUENCE_STRING_END)

    return Number(message.substring(s,e))
}


function getMessageFromTextWithSequenceNum(message) {
    if (message.indexOf(SEQUENCE_STRING_END) == -1) {
        return message
    }
    let s = message.indexOf(SEQUENCE_STRING_END) + SEQUENCE_STRING_END.length
    return message.substring(s,message.length).replace(/(\r\n|\n|\r)/gm, "")
}

function handleAckRequest(message, sender) {
    let messageText = getMessageFromTextWithSequenceNum(message)
    let seqNum = getSequenceNumFromMessage(message)

    if (lastMessageFromSender[sender] !== undefined && lastMessageFromSender[sender] >= seqNum) {
        //Don't broadcast already broadcasted messages
        print(`Already ACKed, sending again to  ${sender}`);
        sendMessage(MESSAGE_ACK + seqNum, [sender])
    } else {
        print(`ACK for message sent to  ${sender}`);
        sendMessage(MESSAGE_ACK + seqNum, [sender])


        print(`Broadcasting ${messageText} to all servers`)
        sendMessage(messageText, audience, [sender, leader], sender)

        lastMessageFromSender[sender] = seqNum
    }

}


function print(s) {
    if (!PRINT_DEBUG) return;
    console.log('\x1b[36m%s\x1b[0m', s);
}