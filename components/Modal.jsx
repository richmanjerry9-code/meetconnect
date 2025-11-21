import { forwardRef } from 'react';
import styles from '../styles/Home.module.css';

const Modal = forwardRef(({ children, title, onClose }, ref) => (
  <div className={styles.modal} ref={ref} role="dialog" aria-modal="true">
    <div className={styles.modalContent}>
      <h2>{title}</h2>
      <span onClick={onClose} className={styles.close} role="button" aria-label="Close modal">×</span>
      {children}
    </div>
  </div>
));

export default Modal;
