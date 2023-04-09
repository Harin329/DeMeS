import { Port, MessageType, SEQUENCE_STRING_START, SEQUENCE_STRING_END } from '../../shared/models/message';
import axios from 'axios';

/**
 * Model layer wrapper around message operations
 */
export default class MessageModel {
    public messageSeqNum: number = 0;
    public waitingForMessageSeqNum: number = -1;
    public lastMessageFromSender: Map<Port, number> = new Map();

    // Leadership Selection Temp Variables
    public PING_CHECKS: number = 3;
    public participants: Port[] = [];
    public pingStartTime: Map<Port, number[]> = new Map();
    public pingEndTime: Map<Port, number[]> = new Map();
    public pingLatency: Map<Port, number[]> = new Map();
    public pseudoLeaderTally: Map<Port, number> = new Map();
    public pseudoLeaderCensus: Map<Port, boolean> = new Map();
    public latencyMap: Map<Port, number> = new Map();

    // Timers
    public leadershipPingTimer: any = null;
    public awaitLeaderPingTimer: any = null;
    public leaderlife: number = -3;

    // Init
    public myPort: Port;
    public audience: Port[];
    public leader: Port;
    public chatStarted: boolean;

    /**
     * @constructor 
     */
    constructor() {
        this.myPort = process.env.PORT || '3000';
        this.audience = [];
        this.leader = process.env.LEADER || '3001';
        this.chatStarted = false;
    }

    // Handle Functions
    public handleLeaderPing(message: string) {
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
    public async sendMessage(message: string, audience: Port[], except?: Port[], senderPort?: Port) {
        if (except === undefined) {
            except = [];
        }
        if (senderPort === undefined) {
            senderPort = this.myPort;
        }
        let sendTo = [...audience];
        if (this.chatStarted && this.leader !== this.myPort) {
            sendTo = [this.leader];
        }
        
        for (const address of sendTo) {
            if (except.indexOf(address) !== -1) continue;
            try {
                await axios.post(`http://localhost:${address}/api/serverMessage`, {message: `${senderPort}-${message}`}, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } catch (err) {
                console.log(`Participant ${address} unresponsive, removed from chat.`);
                audience.splice(0, audience.length,...audience.filter((port: Port) => port !== address));
            }
        }
    }

    public checkLatency(participants: Port[]) {
        for (const participant of participants) {
            if (participant !== this.myPort) {
                for (let i = 0; i < this.PING_CHECKS; i++) {
                    const startTime: number[] = this.pingStartTime.get(participant) === undefined ? [Date.now()] : this.pingStartTime.get(participant)!.concat([Date.now()]);
                    this.pingStartTime.set(participant, startTime);
                    this.sendMessage(MessageType.REQUEST_PING, [participant]);
                }
            }
        }
    }

    public verifyLatencyCheckComplete(participants: Port[]) {
        for (const address of participants) {
            if ((this.pingEndTime.get(address) === undefined || this.pingEndTime.get(address)!.length < this.PING_CHECKS) && address !== this.myPort) {
                return;
            }
        }

        // All participants have completed latency checks, sort list and return votes to psuedo-leader
        for (const address of participants) {
            if (address !== this.myPort) {
                for (let i = 0; i < this.PING_CHECKS; i++) {
                    const latency = this.pingLatency.get(address) === undefined ? [this.pingEndTime.get(address)![i] - this.pingStartTime.get(address)![i]] : this.pingLatency.get(address)!.concat(this.pingEndTime.get(address)![i] - this.pingStartTime.get(address)![i]);
                    this.pingLatency.set(address, latency);
                    this.latencyMap.set(address, this.pingLatency.get(address)!.reduce((p1: number, p2: number) => p1 + p2) / this.PING_CHECKS);
                }
            }
        }

        console.log(this.latencyMap)
        const sortedLatency = Array.from(this.latencyMap.keys()).sort((a, b) => this.latencyMap.get(a)! - this.latencyMap.get(b)!);
        console.log(sortedLatency);
        if (this.leader !== this.myPort) {
            this.sendMessage(`${MessageType.RETURN_VOTES}-${sortedLatency}`, [this.leader]);
        } else {
            this.tallyVotes(sortedLatency, this.myPort);
        }
    }

    public tallyVotes(votes: Port[], sender: Port) {
        console.log(`Tallying Votes from ${sender}`);
        if (this.pseudoLeaderCensus.get(sender) === undefined) {
            this.pseudoLeaderCensus.set(sender, true);
            for (let i = 0; i < votes.length; i++) {
                const tally: number = this.pseudoLeaderTally.get(votes[i]) === undefined ? (votes.length - i) : this.pseudoLeaderTally.get(votes[i])! + (votes.length - i);
                this.pseudoLeaderTally.set(votes[i], tally);
            }
        }

        this.audience = this.audience.filter((port) => port !== this.myPort);
        console.log(this.pseudoLeaderTally);

        if (Array.from(this.pseudoLeaderCensus.keys()).length === this.audience.length + 1) {
            // All votes have been tallied, find the elected leader
            this.pseudoLeaderCensus = new Map();
            const tallyOrder = Array.from(this.pseudoLeaderTally.keys()).sort((a: Port, b: Port) => this.pseudoLeaderTally.get(b)! - this.pseudoLeaderTally.get(a)!);
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
                    const audienceWOLeader = this.audience.filter((port: Port) => port !== this.leader);
                    const audienceWOHost = audienceWOLeader.filter((port: Port) => port !== this.myPort);
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
        this.pingStartTime = new Map();
        this.pingEndTime = new Map();
        this.pingLatency = new Map();
        this.pseudoLeaderTally = new Map();
        this.pseudoLeaderCensus = new Map();
        this.latencyMap = new Map();
    }

    public handleACK(message: string) {
        const s: number = message.indexOf(MessageType.MESSAGE_ACK) + (MessageType.MESSAGE_ACK.length);

        const ackForSeqNum: number = Number(message.substring(s,message.length));

        if (this.waitingForMessageSeqNum == ackForSeqNum && this.waitingForMessageSeqNum == this.messageSeqNum) {
            this.messageSeqNum++;
        }
    }

    public addSequenceNumToMessage(message: string, n: number) {
        message = SEQUENCE_STRING_START+n+SEQUENCE_STRING_END + message;
        return message ;
    }

    public getSequenceNumFromMessage(message: string) {
        if (message.indexOf(SEQUENCE_STRING_START) == -1) {
            return -1;
        }
        const s: number = message.indexOf(SEQUENCE_STRING_START) + (SEQUENCE_STRING_START.length);
        const e: number = message.indexOf(SEQUENCE_STRING_END);

        return Number(message.substring(s,e));
    }


    public getMessageFromTextWithSequenceNum(message: string) {
        if (message.indexOf(SEQUENCE_STRING_END) == -1) {
            return message;
        }
        const s: number = message.indexOf(SEQUENCE_STRING_END) + SEQUENCE_STRING_END.length;
        return message.substring(s,message.length).replace(/(\r\n|\n|\r)/gm, "");
    }

    public handleAckRequest(message: string, sender: Port) {
        const messageText: string = this.getMessageFromTextWithSequenceNum(message);
        const seqNum: number = this.getSequenceNumFromMessage(message);

        if (this.lastMessageFromSender.get(sender) !== undefined && this.lastMessageFromSender.get(sender)! >= seqNum) {
            //Don't broadcast already broadcasted messages
            console.log(`Already ACKed, sending again to  ${sender}`);
            this.sendMessage(MessageType.MESSAGE_ACK + seqNum, [sender]);
        } else {
            console.log(`ACK for message sent to  ${sender}`);
            this.sendMessage(MessageType.MESSAGE_ACK + seqNum, [sender]);


            console.log(`Broadcasting ${messageText} to all servers`);
            this.sendMessage(messageText, this.audience, [sender, this.leader], sender);

            this.lastMessageFromSender.set(sender, seqNum);
        }
    }

}