{showPaymentChoice && selectedPaymentMethod === 'mpesa' && (
  <div className={styles.modal}>
    <div className={styles.modalContent}>
      <h3>M-Pesa Payment for {selectedLevel} - {selectedDuration}</h3>
      <p>Total: KSh {plans[selectedLevel][selectedDuration]}</p>

      <label className={styles.label}>
        Phone to receive M-Pesa prompt
        <input
          type="text"
          value={mpesaPhone}
          onChange={(e) => setMpesaPhone(e.target.value)}
          placeholder={formData.phone || '0712345678'}
          className={styles.input}
        />
      </label>

      <div className={styles.modalButtons}>
        <button
          onClick={handleConfirmMpesaUpgrade}
          className={styles.upgradeButton}
        >
          Confirm Payment
        </button>
        <button
          onClick={() => { setShowPaymentChoice(false); setShowModal(true); }}
          className={styles.closeButton}
        >
          Back
        </button>
      </div>
    </div>
  </div>
)}

