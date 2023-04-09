import "jest";
import axios from "axios";
import MessageModel from "../../src/server/models/message";
import {
    Port,
    MessageType,
    SEQUENCE_STRING_START,
    SEQUENCE_STRING_END,
} from "../../src/shared/models/message";

jest.mock("axios");

describe("MessageModel", () => {
    let instance: MessageModel;

    beforeEach(() => {
        instance = new MessageModel();
    });

    it("should init with chatStarted as false", async () => {
        expect(instance.chatStarted).toBe(false);
    });
});

describe("sendMessage", () => {
    const mockPost = axios.post as jest.MockedFunction<typeof axios.post>;
    let instance: MessageModel;

    beforeEach(() => {
        instance = new MessageModel();
        mockPost.mockClear();
    });

    it('should send a message to all members of the audience except those in the "except" list', async () => {
        const message = "I LOVE CS";
        const audience = ["8000", "8001"];
        const except = ["8000"];

        await instance.sendMessage(message, audience, except);

        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith(
            "http://localhost:8001/api/serverMessage",
            { message: `${instance.myPort}-${message}` },
            { headers: { "Content-Type": "application/json" } }
        );
    });

    it("should send a message only to the chat leader if chat has started and this node is not the leader", async () => {
        instance.chatStarted = true;
        instance.leader = "8001";
        instance.myPort = "8000";

        // Mock some sample data for the test
        const message = "Hello world!";
        const audience = ["8000", "8001", "8002"];

        // Call the method and wait for it to finish
        await instance.sendMessage(message, audience);

        // Check that axios.post was called once for the chat leader only
        expect(mockPost).toHaveBeenCalledTimes(1);
        expect(mockPost).toHaveBeenCalledWith(
            "http://localhost:8001/api/serverMessage",
            { message: `${instance.myPort}-${message}` },
            { headers: { "Content-Type": "application/json" } }
        );
    });

    it("sends a message to all members of the audience when chat has not started", async () => {
        instance.chatStarted = false;
        instance.myPort = "8000";

        const message = "Hello world!";
        const audience = ["8000", "8001"];

        await instance.sendMessage(message, audience);

        expect(mockPost).toHaveBeenCalledTimes(2);
        expect(mockPost).toHaveBeenCalledWith(
            "http://localhost:8000/api/serverMessage",
            { message: "8000-Hello world!" },
            { headers: { "Content-Type": "application/json" } }
        );
        expect(mockPost).toHaveBeenCalledWith(
            "http://localhost:8001/api/serverMessage",
            { message: "8000-Hello world!" },
            { headers: { "Content-Type": "application/json" } }
        );
    });

    it("leader removes an unresponsive participant from the audience", async () => {
        instance.chatStarted = true;
        instance.myPort = "5000";
        instance.leader = instance.myPort;
        mockPost.mockRejectedValueOnce(new Error("Unresponsive participant"));

        const message = "Hello world!";
        let audience = ["8001", "8002"];

        await instance.sendMessage(message, audience);

        expect(mockPost).toHaveBeenCalledTimes(2);
        expect(audience).not.toContain("8000");
    });
});

describe("MessageModel utility functions", () => {
    let instance = new MessageModel();

    describe("addSequenceNumToMessage", () => {
        it("should add sequence number to  message", () => {
            const message = "I love cpsc 416";
            const sequenceNum = 123;
            const expectedOutput = `${SEQUENCE_STRING_START}${sequenceNum}${SEQUENCE_STRING_END}${message}`;

            expect(
                instance.addSequenceNumToMessage(message, sequenceNum)
            ).toEqual(expectedOutput);
        });

        it("should add negative sequence number to message", () => {
            const message = "I love cpsc 416";
            const sequenceNum = -123;
            const expectedOutput = `${SEQUENCE_STRING_START}${sequenceNum}${SEQUENCE_STRING_END}${message}`;

            expect(
                instance.addSequenceNumToMessage(message, sequenceNum)
            ).toEqual(expectedOutput);
        });
    });

    describe("getSequenceNumFromMessage", () => {
        it("should return the sequence number if it exists in the message", () => {
            const message = "I love cpsc 416";
            const sequenceNum = 123;

            const messageWithSequenceNum = instance.addSequenceNumToMessage(
                message,
                sequenceNum
            );
            expect(
                instance.getSequenceNumFromMessage(messageWithSequenceNum)
            ).toEqual(sequenceNum);
        });

        it("should return -1 if the sequence number does not exist in the message", () => {
            const message = "I love cpsc 416";
            const result = instance.getSequenceNumFromMessage(message);
            expect(result).toBe(-1);
        });
    });

    describe("getMessageFromTextWithSequenceNum", () => {
        it("should return the message without sequence number and newline characters", () => {
            const message = "I love cpsc 416 Hello,\nworld!\r\n";
            const sequenceNum = 123;

            const messageWithSequenceNum = instance.addSequenceNumToMessage(
                message,
                sequenceNum
            );

            const result = instance.getMessageFromTextWithSequenceNum(
                messageWithSequenceNum
            );
            expect(result).toBe("I love cpsc 416 Hello,world!");
        });

        it("should return the original message if it does not contain a sequence number", () => {
            const messageWithoutSeqNum = "I love cpsc 416";
            const result =
                instance.getMessageFromTextWithSequenceNum(
                    messageWithoutSeqNum
                );
            expect(result).toBe(messageWithoutSeqNum);
        });
    });
});
