import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { LAYOUT_LIST } from '../../constants/layouts';
import type { LayoutId } from '../../constants/layouts';
import styles from './LayoutPage.module.css';

function LayoutPage() {
  const navigate = useNavigate();
  const { dispatch } = usePhotoBooth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelectLayout = (layout: LayoutId) => {
    dispatch({ type: 'SET_LAYOUT', layout });
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
          {LAYOUT_LIST.map((card) => (
            <Card
              key={card.id}
              image={<img src={card.icon} alt={card.alt} />}
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
