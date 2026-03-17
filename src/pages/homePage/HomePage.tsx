import { Link, useNavigate } from 'react-router-dom';
import PhotoBooth from '../../assets/PhotoBooth.png';
import Button from '../../components/ui/Button';
import homeStyle from './HomePage.module.css'

function HomePage() {
    const navigate = useNavigate(); // Hook para manejar la navegación

    const handleButtonClick = () => {
        navigate('/layout'); // Redirige a la página de layout
    };

    return(
        <div className={homeStyle.container}>
            <div className={homeStyle.imageWrapper}>
                <img
                    className={homeStyle.photoBooth}
                    src={PhotoBooth}
                    alt="Ilustración minimalista representando un fotomaton con el título 'PhotoBooth' en la parte superior. A la derecha esta la cabina de fotos con cortina gris ondulada y un cartel vacio alto rectangular. A la izquierda aparecen dibujos decorativos de tiras de fotografías, ejemplificando el resultado del fotomaton, es decir la tira fotografica que te devolvera, con unos garabatos decorativos. En la parte inferior izquierda justo bajo las tiras fotograficas hay una ranura por la que el fotomaton te imprime la fotografia."
                />
                <div className={homeStyle.buttonWrapper}>
                    <Button onClick={handleButtonClick}>Let's shoot!</Button>
                </div>
            </div>
            <footer className={homeStyle.footer}>
                <div className={homeStyle.footerLinks}>
                    <Link to="/about" className={homeStyle.footerLink}>About Lym</Link>
                    <Link to="/privacy" className={homeStyle.footerLink}>Privacy Policy</Link>
                </div>
                <span className={homeStyle.footerText}>A Lym's proyect</span>
            </footer>
        </div>
    );
};

export default HomePage;