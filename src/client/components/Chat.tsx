import React, {useEffect, useState } from 'react';
import { SocketMessage } from './ChatContainer';
import '../scss/chat.scss';

type Props = {
	messages: SocketMessage[];
	lastMessageRef: React.RefObject<HTMLDivElement> | null;
	port: string;
}

function Chat({messages, lastMessageRef, port}: Props) {

    return (
		<div className="chat">
             <div className='message__container'>
				{ messages.map(message => (
					message.sender === port ? (
						<div className="message__chats" key={message.messageId}>
							<p className='sender__name'>You</p>
							<div className='message__sender'>
								<p>{message.messageText}</p>
							</div>
						</div>
					): (
						<div className="message__chats" key={message.messageId}>
							<p>{message.sender}</p>
							<div className='message__recipient'>
								<p>{message.messageText}</p>
							</div>
						</div>
					)
					))
				}

				<div ref={lastMessageRef} />   
			</div>
		</div>
	);
}

export default Chat;