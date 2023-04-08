import React, { useState, useEffect, useRef } from 'react';
import { sendClientMessage } from '../api/message';
import { MessageType } from '../../shared/models/message';
import '../scss/sidebar.scss';

type Props = {
	participants: string[];
	port: string;
	isLeader: boolean;
	chatStarted: boolean;
}

function Sidebar({participants, port, isLeader, chatStarted}: Props) {

	const handleStartChat = async () => {
		try {
		  await sendClientMessage(MessageType.CREATE_CHAT);
		} catch (error) {
		  console.error(error);
		}
	};

    return (
		<div className="sidebar">
            <h3>Participants</h3>
			{ participants.length > 0 ? (
					participants.map((participant) => (
						participant === port ? (
							<div key={participant}>{"You (" + participant + ")"}</div>
						): (
							<div key={participant}>{participant}</div>
						)
					))
				): (
					<div>No participants yet</div>
				)
			}

			{
				isLeader ? (
					chatStarted ? (
						<div className="chat-status">Chat started.</div>
					) : (
						<div className="chat-status">
							<div>You are the leader.</div>
							<button className="startBtn" onClick={handleStartChat}>Start Chat</button>
						</div>
					)
				) : (
					chatStarted ? (
						<div className="chat-status">Leader started chat.</div>
					) : (
						<div className="chat-status">Leader will start chat.</div>
					)
				)
			}
		</div>
	);
}

export default Sidebar;