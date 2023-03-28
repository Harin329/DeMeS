import * as React from 'react';
import { FaGithub } from "react-icons/fa";
import '../scss/footer.scss';

function Footer() {
    return (
		<div className="footer">
            <ul className="footer-links">
                <li><p>Developed by Harin Wu, Sean Goyel, and Justin Chan</p></li>
                <li><a target="_blank" rel="noopener noreferrer" href="https://github.com/Harin329/DeMeS"><FaGithub /></a></li>
            </ul>
		</div>
	);
}

export default Footer;