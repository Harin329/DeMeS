import 'jest';
import MessageModel from '../../src/server/models/message';

describe('MessageModel', () => {
    let instance: MessageModel;

    beforeEach(() => {
        instance = new MessageModel();
    });

    it('should init with chatStarted as false', async () => {
        expect(instance.chatStarted).toBe(false);
    });

});