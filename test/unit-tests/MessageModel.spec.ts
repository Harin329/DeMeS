import "jest";
import axios from "axios";
import MessageModel from "../../src/server/models/message";
import {
    Port,
    MessageType,
    SEQUENCE_STRING_START,
    SEQUENCE_STRING_END,
} from "../../src/shared/models/message";


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
