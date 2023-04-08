import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';
import ChatFooter from './ChatFooter';
import { getPort, getIsLeader } from '../api/message'
import '../scss/chatcontainer.scss';

import {Socket, io} from 'socket.io-client';

export type SocketMessage = {
    sender: string;
    messageId: string;
    messageText: string;
}

function ChatContainer() {
    const [messages, setMessages] = useState<SocketMessage[]>([]);
    const [participants, setParticipants] = useState<string[]>([]);
    const [port, setPort] = useState<string>('');
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isLeader, setIsLeader] = useState<boolean>(false);
    const [chatStarted, setChatStarted] = useState<boolean>(false);
    const lastMessageRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        getPort().then((port) => {
            setPort(port);
            const makeSocket = io(`http://localhost:${port}`);
            setSocket(makeSocket);
        })
    }, []);

    useEffect(() => {
        const intervalId = setInterval(() => {
            getIsLeader().then((isLeader) => {
                setIsLeader(isLeader);
            });
        }, 1000); // update every 1 seconds ew, probs change to socket
    
        return () => {
          clearInterval(intervalId); // cleanup function to stop interval
        };
    }, []);
    
    useEffect(()=> {
        if (socket) {
            socket.on("message", (data: SocketMessage) => setMessages([...messages, data]));
        }
    }, [socket, messages]);

    useEffect(()=> {
        if (socket) {
            socket.on("chatStarted", (started: boolean) => setChatStarted(started));
        }
    }, [socket, chatStarted]);

    useEffect(()=> {
        if (socket) {
            socket.on("participants", (newParticipants: string[]) => setParticipants(newParticipants));
        }
    }, [socket, participants]);
  
    useEffect(() => {
      // scroll to bottom every time messages change
      lastMessageRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);


    return (
        <div className="chat-container">
            <div className="chat-container-sidebar">
                <Sidebar participants={participants} port={port} isLeader={isLeader} chatStarted={chatStarted}/>
            </div>
            <div className="chat-in-out">
                <Chat messages={messages} lastMessageRef={lastMessageRef} port={port}/>    
                <ChatFooter port={port}/>
            </div>
        </div>
    );
}

export default ChatContainer;