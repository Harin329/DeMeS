import * as React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Hero from './components/Hero';
import './scss/app.scss';

function App() {
	return (
		<div className="app">
			<Header/>
			<Hero/>
			<Footer/>
		</div>
	);
};

export default App;
