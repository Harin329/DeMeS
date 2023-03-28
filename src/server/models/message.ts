import { Message, Port, MessageType, SEQUENCE_STRING_START, SEQUENCE_STRING_END } from '../../shared/models/message';

/**
 * Model layer wrapper around message operations
 */
export default class MessageModel {
    public messageSeqNum: number = 0;
    public waitingForMessageSeqNum: any = -1;
    public lastMessageFromSender: any = {};

    // Leadership Selection Temp Variables
    public PING_CHECKS: any = 3;
    public participants: any = [];
    public pingStartTime: any = {};
    public pingEndTime: any = {};
    public pingLatency: any = {};
    public pseudoLeaderTally: any = {};
    public pseudoLeaderCensus: any = {};
    public latencyMap: any = {};

    // Timers
    public leadershipPingTimer: any = null;
    public awaitLeaderPingTimer: any = null;
    public leaderlife: any = -3;

    // Init
    public myPort: string;
    public audience: string[];
    public leader: string;
    public chatStarted: boolean;

    /**
     * @constructor 
     */
    constructor() {
        const args = process.argv.slice(2);
        this.myPort = args[0];
        this.audience = [];
        this.leader = args[1];
        this.chatStarted = false;
    }

    // Handle Functions
    public handleLeaderPing(message) {
        const audienceList = message.substring(message.indexOf('-') + 1).split(',');
        this.audience = audienceList;
        this.leaderlife = -3;
        // print(`Leader Ping Recieved: ${audienceList}`);
    }

    /*
    Params:
        message: The message to send
        audience: The list of ports to send the message to
        except: The list of ports to not send the message to
        senderPort: The port that the message is coming from
    */
    public async sendMessage(message, audience, except?, senderPort?) {
        if (except === undefined) {
            except = []
        }
        if (senderPort === undefined) {
            senderPort = this.myPort
        }
        let sendTo = audience;
        if (this.chatStarted && this.leader !== this.myPort) {
            sendTo = [this.leader];
        }
        
        for (const address of sendTo) {
            if (except.indexOf(address) !== -1) continue;
            try {
                await fetch(`http://localhost:${address}/api/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(`${senderPort}-${message}`),
                });
            } catch (err) {
                console.error(err);
                audience = audience.filter((port) => port !== address);
            }
        }
    }

    public checkLatency(participants) {
        for (const participant of participants) {
            if (participant !== this.myPort) {
                for (let i = 0; i < this.PING_CHECKS; i++) {
                    this.pingStartTime[participant] = this.pingStartTime[participant] === undefined ? [Date.now()] : [...this.pingStartTime[participant], Date.now()];
                    this.sendMessage(MessageType.REQUEST_PING, [participant]);
                }
            }
        }
    }

    public verifyLatencyCheckComplete(participants) {
        for (const address of participants) {
            if ((this.pingEndTime[address] === undefined || this.pingEndTime[address].length < this.PING_CHECKS) && address !== this.myPort) {
                return;
            }
        }

        // All participants have completed latency checks, sort list and return votes to psuedo-leader
        for (const address of participants) {
            if (address !== this.myPort) {
                for (let i = 0; i < this.PING_CHECKS; i++) {
                    this.pingLatency[address] = this.pingLatency[address] === undefined ? [this.pingEndTime[address][i] - this.pingStartTime[address][i]] : [...this.pingLatency[address], this.pingEndTime[address][i] - this.pingStartTime[address][i]];
                    this.latencyMap[address] = this.pingLatency[address].reduce((p1, p2) => p1 + p2) / this.PING_CHECKS;
                }
            }
        }

        console.log(this.latencyMap)
        const sortedLatency = Object.keys(this.latencyMap).sort((a, b) => this.latencyMap[a] - this.latencyMap[b]);
        console.log(sortedLatency);
        if (this.leader !== this.myPort) {
            this.sendMessage(`${MessageType.RETURN_VOTES}-${sortedLatency}`, [this.leader]);
        } else {
            this.tallyVotes(sortedLatency, this.myPort);
        }


        
    }

    public tallyVotes(votes, sender) {
        console.log(`Tallying Votes from ${sender}`);
        if (this.pseudoLeaderCensus[sender] === undefined) {
            this. pseudoLeaderCensus[sender] = true;
            for (let i = 0; i < votes.length; i++) {
                this.pseudoLeaderTally[votes[i]] = this.pseudoLeaderTally[votes[i]] === undefined ? (votes.length - i) : this.pseudoLeaderTally[votes[i]] + (votes.length - i);
            }
        }

        this.audience = this.audience.filter((port) => port !== this.myPort);
        console.log(this.pseudoLeaderTally);

        if (Object.keys(this.pseudoLeaderCensus).length === this.audience.length + 1) {
            // All votes have been tallied, find the elected leader
            this.pseudoLeaderCensus = {};
            const tallyOrder = Object.keys(this.pseudoLeaderTally).sort((a, b) => this.pseudoLeaderTally[b] - this.pseudoLeaderTally[a]);
            this.leader = tallyOrder[0];
            this.participants = tallyOrder;
            console.log(`Leader has been elected: ${this.leader}`);
            this.sendMessage(`${MessageType.CHAT_STARTED}-${this.leader}-${tallyOrder.join(',')}`, tallyOrder);
        }
    }

    public leadershipPing() {
        this.leadershipPingTimer = setInterval(() => {
            this.sendMessage(`${MessageType.LEADER_PING}-${this.participants}`, this.audience);
        }
        , 3000);
    }

    public awaitLeaderPing() {
        this.awaitLeaderPingTimer = setInterval(() => {
            this.leaderlife++;
            if (this.leaderlife >= 1) {
                if (this.myPort === this.audience[this.leaderlife]) {
                    console.log("Leader has died, starting leadership election");
                    const audienceWOLeader = this.audience.filter((port) => port !== this.leader);
                    const audienceWOHost = audienceWOLeader.filter((port) => port !== this.myPort);
                    this.leader = this.myPort;
                    this.sendMessage(`${MessageType.START_LEADERSHIP_SELECTION}-${audienceWOLeader.join(',')}`, audienceWOHost);
                    this.chatStarted = false;
                    this.resetTempVariables();
                    this.participants = audienceWOLeader;
                    this.audience = audienceWOHost;
                    this.checkLatency(this.participants);
                    clearInterval(this.awaitLeaderPingTimer);
                }
            }
        }, 3000);
    }

    public resetTempVariables() {
        this.pingStartTime = {};
        this.pingEndTime = {};
        this.pingLatency = {};
        this.pseudoLeaderTally = {};
        this.pseudoLeaderCensus = {};
        this.latencyMap = {};
    }

    public handleACK(message) {
        let s = message.indexOf(MessageType.MESSAGE_ACK) + (MessageType.MESSAGE_ACK.length)

        let ackForSeqNum = Number(message.substring(s,message.length))

        if (this.waitingForMessageSeqNum == ackForSeqNum && this.waitingForMessageSeqNum == this.messageSeqNum) {
            this.messageSeqNum++;
        }
    }

    public addSequenceNumToMessage(message, n) {

        message = SEQUENCE_STRING_START+n+SEQUENCE_STRING_END+message
        return message 

    }

    public getSequenceNumFromMessage(message) {
        if (message.indexOf(SEQUENCE_STRING_START) == -1) {
            return -1
        }
        let s = message.indexOf(SEQUENCE_STRING_START) + (SEQUENCE_STRING_START.length)
        let e = message.indexOf(SEQUENCE_STRING_END)

        return Number(message.substring(s,e))
    }


    public getMessageFromTextWithSequenceNum(message) {
        if (message.indexOf(SEQUENCE_STRING_END) == -1) {
            return message
        }
        let s = message.indexOf(SEQUENCE_STRING_END) + SEQUENCE_STRING_END.length
        return message.substring(s,message.length).replace(/(\r\n|\n|\r)/gm, "")
    }

    public handleAckRequest(message, sender) {
        let messageText = this.getMessageFromTextWithSequenceNum(message)
        let seqNum = this.getSequenceNumFromMessage(message)

        if (this.lastMessageFromSender[sender] !== undefined && this.lastMessageFromSender[sender] >= seqNum) {
            //Don't broadcast already broadcasted messages
            console.log(`Already ACKed, sending again to  ${sender}`);
            this.sendMessage(MessageType.MESSAGE_ACK + seqNum, [sender])
        } else {
            console.log(`ACK for message sent to  ${sender}`);
            this.sendMessage(MessageType.MESSAGE_ACK + seqNum, [sender])


            console.log(`Broadcasting ${messageText} to all servers`)
            this.sendMessage(messageText, this.audience, [sender, this.leader], sender)

            this.lastMessageFromSender[sender] = seqNum
        }

    }

}