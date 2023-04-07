import * as React from 'react';
import Sidebar from './Sidebar';
import Chat from './Chat';
import '../scss/hero.scss';

function Hero() {

    return (
        <div className="hero">
            <Sidebar />
            <Chat />
        </div>
    );
}

export default Hero;