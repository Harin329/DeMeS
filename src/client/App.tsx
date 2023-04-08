import * as React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import ChatContainer from './components/ChatContainer';
import './scss/app.scss';

function App() {
	return (
		<div className="app">
			<Header/>
			<ChatContainer/>
			<Footer/>
		</div>
	);
};

export default App;
