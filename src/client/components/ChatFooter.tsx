import React, { useState } from 'react';
import { sendClientMessage } from '../api/message';
import '../scss/chatfooter.scss';

type Props = {
    port: string;
}

function ChatFooter({port}: Props) {

    const [message, setMessage] = useState("");

    const handleSendMessage = (e: any) => {
        e.preventDefault();
        sendClientMessage(message);
        setMessage("");
    }

    return (
		<div className="chat-footer">
            <form className='form' onSubmit={handleSendMessage}>
                <input 
                    type="text" 
                    placeholder='Write message' 
                    className='message' 
                    value={message} 
                    onChange={e => setMessage(e.target.value)}
                    />
                <button className="sendBtn">Send</button>
            </form>
		</div>
	);
}

export default ChatFooter;