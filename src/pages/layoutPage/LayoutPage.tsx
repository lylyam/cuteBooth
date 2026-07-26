import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import type { LayoutId } from '../../context/PhotoBoothContext';
import layoutIcon1 from '../../assets/draws/layoutIcon1.svg';
import layoutIcon2 from '../../assets/draws/layoutIcon2.svg';
import layoutIcon3 from '../../assets/draws/layoutIcon3.svg';
import styles from './LayoutPage.module.css';

type LayoutCard = {
  id: LayoutId;
  imageSrc: string;
  alt: string;
};

function LayoutPage() {
  const navigate = useNavigate();
  const { setSelectedLayout } = usePhotoBooth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const cardData: LayoutCard[] = [
    {
      id: 'classic',
      imageSrc: layoutIcon1,
      alt: 'Marco vertical con foto y dos iconos de vista previa.',
    },
    {
      id: 'wide',
      imageSrc: layoutIcon2,
      alt: 'Marco horizontal con foto y dos iconos de vista previa.',
    },
    {
      id: 'square',
      imageSrc: layoutIcon3,
      alt: 'Marco panoramico con foto y dos iconos de vista previa.',
    },
  ];

  const handleSelectLayout = (layout: LayoutId) => {
    setSelectedLayout(layout);
    setIsModalOpen(true);
  };

  const handleTakePhotos = () => {
    setIsModalOpen(false);
    navigate('/camera');
  };

  const handleUploadPhotos = () => {
    setIsModalOpen(false);
    navigate('/upload');
  };

  return (
    <PageShell>
      <WebAppOldStyle className={styles.wideWindow} contentClassName={styles.windowContent}>
        <h1 className={styles.title}>Select your frame</h1>

        <div className={styles.cardsGrid}>
          {cardData.map((card) => (
            <Card
              key={card.id}
              image={<img src={card.imageSrc} alt={card.alt} />}
              buttonLabel="Use this"
              onButtonClick={() => handleSelectLayout(card.id)}
            />
          ))}
        </div>
      </WebAppOldStyle>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="You've selected your layout!"
        footer={
          <>
            <Button type="button" onClick={handleTakePhotos}>
              Take photos
            </Button>
            <Button type="button" onClick={handleUploadPhotos}>
              Upload photos
            </Button>
          </>
        }
      >
        How would you like to get your photos?
      </Modal>
    </PageShell>
  );
}

export default LayoutPage;
